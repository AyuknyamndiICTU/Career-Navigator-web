import {
  StorageError,
  type ObjectStorage,
} from '../src/storage/object-storage';

/** In-memory ObjectStorage for e2e tests; records every object it is given. */
export class FakeObjectStorage implements ObjectStorage {
  readonly configured = true;
  readonly objects = new Map<
    string,
    { body: Buffer; contentType: string; lastModified: Date }
  >();
  bucketOk = true;

  put(key: string, body: Buffer, contentType: string): Promise<void> {
    this.objects.set(key, { body, contentType, lastModified: new Date() });
    return Promise.resolve();
  }

  getBuffer(key: string): Promise<Buffer> {
    const obj = this.objects.get(key);
    if (!obj) return Promise.reject(new StorageError('Not found', 404));
    return Promise.resolve(obj.body);
  }

  head(key: string) {
    const obj = this.objects.get(key);
    return Promise.resolve(
      obj
        ? {
            size: obj.body.length,
            contentType: obj.contentType,
            lastModified: obj.lastModified,
          }
        : null,
    );
  }

  delete(key: string): Promise<void> {
    this.objects.delete(key);
    return Promise.resolve();
  }

  list(prefix: string) {
    const objects = [...this.objects.entries()]
      .filter(([k]) => k.startsWith(prefix))
      .map(([key, o]) => ({
        key,
        size: o.body.length,
        lastModified: o.lastModified,
      }));
    return Promise.resolve({ objects, nextToken: null });
  }

  presignGet(
    key: string,
    opts: { expiresInSeconds?: number } = {},
  ): Promise<string> {
    return Promise.resolve(
      `https://storage.test/bucket/${key}?X-Amz-Expires=${opts.expiresInSeconds ?? 300}&X-Amz-Signature=fake`,
    );
  }

  bucketExists(): Promise<boolean> {
    return Promise.resolve(this.bucketOk);
  }
}
