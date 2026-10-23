import { describe, expect, it } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { S3ObjectStorage } from '../src/storage/s3-object-storage';

/**
 * Contract test for the real S3 client against a running S3 server (local Garage in CI and docker compose).
 * Skipped unless S3_CONTRACT_ENDPOINT is set, e.g.
 *   S3_CONTRACT_ENDPOINT=http://localhost:3900 npx jest --config ./test/jest-e2e.json storage-contract
 * Defaults match the dev Garage key in infra/docker/docker-compose.yml.
 */
const endpoint = process.env.S3_CONTRACT_ENDPOINT;
const run = endpoint ? describe : describe.skip;

run('S3ObjectStorage contract (live S3 server)', () => {
  const storage = new S3ObjectStorage({
    endpoint: endpoint ?? '',
    region: process.env.S3_CONTRACT_REGION ?? 'garage',
    bucket: process.env.S3_CONTRACT_BUCKET ?? 'career-navigator',
    accessKeyId:
      process.env.S3_CONTRACT_ACCESS_KEY ?? 'GK1c0de0de0c0ffee000000001',
    secretAccessKey:
      process.env.S3_CONTRACT_SECRET_KEY ??
      '6c6f63616c2d6465762d6761726167652d7365637265742d6368616e67652d6d',
    forcePathStyle: true,
  });
  const prefix = `contract-test/${randomUUID()}/`;
  const body = Buffer.from('%PDF-1.7\ncontract test ü');

  it('finds the bucket', async () => {
    expect(await storage.bucketExists()).toBe(true);
  });

  it('puts, heads, reads, lists, presigns and deletes an object', async () => {
    const key = `${prefix}a b+c.pdf`;
    await storage.put(key, body, 'application/pdf');

    const head = await storage.head(key);
    expect(head).toMatchObject({
      size: body.length,
      contentType: 'application/pdf',
    });
    expect((await storage.getBuffer(key)).equals(body)).toBe(true);

    const page = await storage.list(prefix);
    expect(page.objects.map((o) => o.key)).toEqual([key]);
    expect(page.objects[0].lastModified).toBeInstanceOf(Date);

    const url = await storage.presignGet(key, {
      expiresInSeconds: 60,
      downloadName: 'cv.pdf',
    });
    const res = await fetch(url);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toContain('cv.pdf');
    expect(Buffer.from(await res.arrayBuffer()).equals(body)).toBe(true);

    const tampered = await fetch(
      url.replace(/X-Amz-Signature=[0-9a-f]{4}/, 'X-Amz-Signature=0000'),
    );
    expect(tampered.status).toBe(403);

    await storage.delete(key);
    expect(await storage.head(key)).toBeNull();
    await expect(storage.getBuffer(key)).rejects.toMatchObject({ status: 404 });
  });

  it('lists only the requested prefix through the continuation loop', async () => {
    const keys = Array.from({ length: 3 }, (_, i) => `${prefix}page/${i}.txt`);
    await Promise.all(
      keys.map((k) => storage.put(k, Buffer.from(k), 'text/plain')),
    );
    try {
      const seen: string[] = [];
      let token: string | undefined;
      do {
        const page = await storage.list(`${prefix}page/`, token);
        seen.push(...page.objects.map((o) => o.key));
        token = page.nextToken ?? undefined;
      } while (token);
      expect(seen.sort()).toEqual(keys);
    } finally {
      await Promise.all(keys.map((k) => storage.delete(k)));
    }
  });
});
