/* global Buffer */

export type StoredObject = { key: string; size: number; lastModified: Date };
export type ObjectHead = {
  size: number;
  contentType: string | null;
  lastModified: Date | null;
};

/** Provider-neutral object storage (R2, Garage or any S3 API). Inject with `@Inject(OBJECT_STORAGE)`. */
export interface ObjectStorage {
  readonly configured: boolean;
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  getBuffer(key: string): Promise<Buffer>;
  head(key: string): Promise<ObjectHead | null>;
  delete(key: string): Promise<void>;
  /** One page of keys under a prefix; pass the returned token to continue. */
  list(
    prefix: string,
    continuationToken?: string,
  ): Promise<{ objects: StoredObject[]; nextToken: string | null }>;
  /** Short-lived URL a browser can GET directly (private bucket). */
  presignGet(
    key: string,
    options?: { expiresInSeconds?: number; downloadName?: string },
  ): Promise<string>;
  bucketExists(): Promise<boolean>;
}

export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');

export class StorageError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export type MediaKind = 'cv' | 'picture';

/** New uploads: `users/{userId}/{kind}/{uuid}{ext}`. */
export function userObjectKey(
  userId: string,
  kind: MediaKind,
  id: string,
  ext: string,
): string {
  return `users/${userId}/${kind}/${id}${ext}`;
}

/** Owner of a key: `users/{id}/…`, or the pre-Phase-18 layout `{id}/{TYPE}/…`. */
export function keyOwner(key: string): string | null {
  const parts = key.split('/');
  if (parts.some((p) => p === '' || p === '.' || p === '..')) return null;
  if (parts[0] === 'users' && parts.length >= 4) return parts[1];
  if (parts.length === 3 && /^(CV|PROFILE_PICTURE)$/.test(parts[1]))
    return parts[0];
  return null;
}

export function keyKind(key: string): MediaKind | null {
  const parts = key.split('/');
  if (parts[0] === 'users' && parts.length >= 4)
    return parts[2] === 'cv' ? 'cv' : parts[2] === 'picture' ? 'picture' : null;
  if (parts.length === 3)
    return parts[1] === 'CV'
      ? 'cv'
      : parts[1] === 'PROFILE_PICTURE'
        ? 'picture'
        : null;
  return null;
}
