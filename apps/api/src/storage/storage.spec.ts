import { describe, expect, it, jest } from '@jest/globals';
import {
  keyKind,
  keyOwner,
  userObjectKey,
  type ObjectStorage,
  type StoredObject,
} from './object-storage';
import { StorageLifecycleService } from './storage-lifecycle.service';
import { S3ObjectStorage } from './s3-object-storage';
import type { PrismaService } from '../prisma/prisma.service';

const NOW = new Date('2026-10-22T03:30:00Z');
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000);

function memoryStorage(objects: StoredObject[]) {
  const store = new Map(objects.map((o) => [o.key, o]));
  const storage = {
    configured: true,
    list: (prefix: string) =>
      Promise.resolve({
        objects: [...store.values()].filter((o) => o.key.startsWith(prefix)),
        nextToken: null,
      }),
    delete: jest.fn((key: string) => {
      store.delete(key);
      return Promise.resolve();
    }),
  } as unknown as ObjectStorage;
  return { storage, store };
}

function prismaWith(users: string[], media: string[], photos: string[] = []) {
  return {
    user: { findMany: () => Promise.resolve(users.map((id) => ({ id }))) },
    uploadMedia: {
      findMany: () =>
        Promise.resolve(media.map((objectKey) => ({ objectKey }))),
    },
    profile: {
      findMany: () =>
        Promise.resolve(
          photos.map((photoUrl) => ({ cvWizardData: { photoUrl } })),
        ),
    },
  } as unknown as PrismaService;
}

describe('object keys', () => {
  it('builds per-user keys and reads their owner and kind', () => {
    const key = userObjectKey('u1', 'cv', 'abc', '.pdf');
    expect(key).toBe('users/u1/cv/abc.pdf');
    expect(keyOwner(key)).toBe('u1');
    expect(keyKind(key)).toBe('cv');
  });

  it('understands the pre-Phase-18 layout', () => {
    expect(keyOwner('u1/CV/x.pdf')).toBe('u1');
    expect(keyKind('u1/PROFILE_PICTURE/x.png')).toBe('picture');
  });

  it('rejects traversal and unknown layouts', () => {
    expect(keyOwner('users/u1/../u2/cv/x.pdf')).toBeNull();
    expect(keyOwner('users//cv/x.pdf')).toBeNull();
    expect(keyOwner('random.txt')).toBeNull();
    expect(keyOwner('u1/OTHER/x')).toBeNull();
  });
});

describe('StorageLifecycleService.run', () => {
  it('keeps the current CV plus the newest older versions (3 in total)', async () => {
    const cvs = [1, 2, 3, 4, 5].map((d) => ({
      key: `users/u1/cv/v${d}.pdf`,
      size: 1,
      lastModified: daysAgo(d),
    }));
    const { storage, store } = memoryStorage(cvs);
    // v4 is the referenced (current) one even though it is not the newest.
    const service = new StorageLifecycleService(
      prismaWith(['u1'], ['users/u1/cv/v4.pdf']),
      storage,
    );

    const report = await service.run(NOW);

    expect([...store.keys()].sort()).toEqual([
      'users/u1/cv/v1.pdf',
      'users/u1/cv/v2.pdf',
      'users/u1/cv/v4.pdf',
    ]);
    expect(report).toEqual({ scanned: 5, deleted: 2, kept: 3, skipped: 0 });
  });

  it('keeps only the current picture, including one referenced from the CV wizard', async () => {
    const { storage, store } = memoryStorage([
      { key: 'users/u1/picture/old.webp', size: 1, lastModified: daysAgo(10) },
      { key: 'users/u1/picture/new.webp', size: 1, lastModified: daysAgo(2) },
      {
        key: 'u1/PROFILE_PICTURE/legacy.png',
        size: 1,
        lastModified: daysAgo(30),
      },
    ]);
    const service = new StorageLifecycleService(
      prismaWith(['u1'], [], ['users/u1/picture/old.webp']),
      storage,
    );

    await service.run(NOW);

    expect([...store.keys()]).toEqual(['users/u1/picture/old.webp']);
  });

  it('deletes objects of deleted users but respects the 24 h grace period', async () => {
    const { storage, store } = memoryStorage([
      { key: 'users/gone/cv/a.pdf', size: 1, lastModified: daysAgo(3) },
      {
        key: 'users/gone/cv/b.pdf',
        size: 1,
        lastModified: new Date(NOW.getTime() - 3_600_000),
      },
      {
        key: 'users/u1/picture/fresh.webp',
        size: 1,
        lastModified: new Date(NOW.getTime() - 60_000),
      },
      {
        key: 'users/u1/picture/current.webp',
        size: 1,
        lastModified: daysAgo(5),
      },
      { key: 'notes/readme.txt', size: 1, lastModified: daysAgo(100) },
    ]);
    const service = new StorageLifecycleService(
      prismaWith(['u1'], ['users/u1/picture/current.webp']),
      storage,
    );

    const report = await service.run(NOW);

    expect([...store.keys()].sort()).toEqual([
      'notes/readme.txt',
      'users/gone/cv/b.pdf',
      'users/u1/picture/current.webp',
      'users/u1/picture/fresh.webp',
    ]);
    expect(report).toEqual({ scanned: 5, deleted: 1, kept: 3, skipped: 1 });
  });

  it('deleteUserObjects removes both layouts for one user only', async () => {
    const { storage, store } = memoryStorage([
      { key: 'users/u1/cv/a.pdf', size: 1, lastModified: NOW },
      { key: 'u1/CV/b.pdf', size: 1, lastModified: NOW },
      { key: 'users/u10/cv/c.pdf', size: 1, lastModified: NOW },
    ]);
    const service = new StorageLifecycleService(prismaWith([], []), storage);

    expect(await service.deleteUserObjects('u1')).toBe(2);
    expect([...store.keys()]).toEqual(['users/u10/cv/c.pdf']);
  });
});

describe('S3ObjectStorage.presignGet', () => {
  it('signs against the public endpoint with an expiry and download name', async () => {
    const storage = new S3ObjectStorage({
      endpoint: 'http://garage:3900',
      publicEndpoint: 'http://localhost:3900',
      region: 'garage',
      bucket: 'career-navigator',
      accessKeyId: 'AK',
      secretAccessKey: 'SK',
      forcePathStyle: true,
    });

    const url = new URL(
      await storage.presignGet('users/u1/cv/a.pdf', {
        expiresInSeconds: 120,
        downloadName: 'cv.pdf',
      }),
    );

    expect(url.origin).toBe('http://localhost:3900');
    expect(url.pathname).toBe('/career-navigator/users/u1/cv/a.pdf');
    expect(url.searchParams.get('X-Amz-Expires')).toBe('120');
    expect(url.searchParams.get('X-Amz-Credential')).toMatch(
      /^AK\/\d{8}\/garage\/s3\/aws4_request$/,
    );
    expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/);
    expect(url.searchParams.get('response-content-disposition')).toContain(
      'cv.pdf',
    );
  });
});
