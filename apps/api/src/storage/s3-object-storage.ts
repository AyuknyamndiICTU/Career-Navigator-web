/* global Buffer */
import { AwsClient } from 'aws4fetch';
import { env } from '../config/env';
import {
  StorageError,
  type ObjectHead,
  type ObjectStorage,
  type StoredObject,
} from './object-storage';

export type S3Settings = {
  endpoint: string;
  publicEndpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
};

const REQUEST_TIMEOUT_MS = 30_000;

function encodeKey(key: string): string {
  return key.split('/').map(encodeURIComponent).join('/');
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&');
}

const tag = (xml: string, name: string): string | null =>
  new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(xml)?.[1] ?? null;

/** Any S3 API (Cloudflare R2, Garage, AWS) through SigV4-signed fetch calls; no SDK. */
export class S3ObjectStorage implements ObjectStorage {
  readonly configured = true;
  private readonly client: AwsClient;

  constructor(private readonly s3: S3Settings) {
    this.client = new AwsClient({
      accessKeyId: s3.accessKeyId,
      secretAccessKey: s3.secretAccessKey,
      service: 's3',
      region: s3.region,
    });
  }

  private url(key: string | null, endpoint = this.s3.endpoint): URL {
    const base = new URL(endpoint.replace(/\/+$/, ''));
    const path = key === null ? '' : `/${encodeKey(key)}`;
    if (this.s3.forcePathStyle) {
      base.pathname = `${base.pathname.replace(/\/+$/, '')}/${this.s3.bucket}${path}`;
    } else {
      base.hostname = `${this.s3.bucket}.${base.hostname}`;
      base.pathname = `${base.pathname.replace(/\/+$/, '')}${path || '/'}`;
    }
    return base;
  }

  private send(url: URL, init: RequestInit = {}): Promise<Response> {
    return this.client.fetch(url.toString(), {
      ...init,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  }

  private async fail(res: Response, action: string): Promise<never> {
    const body = await res.text().catch(() => '');
    const code = tag(body, 'Code') ?? res.statusText;
    throw new StorageError(
      `${action} failed: ${res.status} ${code}`,
      res.status,
    );
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    const res = await this.send(this.url(key), {
      method: 'PUT',
      body: new Uint8Array(body),
      headers: { 'content-type': contentType },
    });
    if (!res.ok) await this.fail(res, 'Upload');
  }

  async getBuffer(key: string): Promise<Buffer> {
    const res = await this.send(this.url(key));
    if (!res.ok) await this.fail(res, 'Download');
    return Buffer.from(await res.arrayBuffer());
  }

  async head(key: string): Promise<ObjectHead | null> {
    const res = await this.send(this.url(key), { method: 'HEAD' });
    if (res.status === 404) return null;
    if (!res.ok) await this.fail(res, 'Head');
    const modified = res.headers.get('last-modified');
    return {
      size: Number(res.headers.get('content-length') ?? 0),
      contentType: res.headers.get('content-type'),
      lastModified: modified ? new Date(modified) : null,
    };
  }

  async delete(key: string): Promise<void> {
    const res = await this.send(this.url(key), { method: 'DELETE' });
    if (!res.ok && res.status !== 404) await this.fail(res, 'Delete');
  }

  async list(
    prefix: string,
    continuationToken?: string,
  ): Promise<{ objects: StoredObject[]; nextToken: string | null }> {
    const url = this.url(null);
    url.searchParams.set('list-type', '2');
    url.searchParams.set('max-keys', '1000');
    if (prefix) url.searchParams.set('prefix', prefix);
    if (continuationToken)
      url.searchParams.set('continuation-token', continuationToken);
    const res = await this.send(url);
    if (!res.ok) await this.fail(res, 'List');
    const xml = await res.text();
    const objects = [...xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)].map(
      ([, block]) => ({
        key: decodeXml(tag(block, 'Key') ?? ''),
        size: Number(tag(block, 'Size') ?? 0),
        lastModified: new Date(tag(block, 'LastModified') ?? 0),
      }),
    );
    const truncated = tag(xml, 'IsTruncated') === 'true';
    const next = tag(xml, 'NextContinuationToken');
    return { objects, nextToken: truncated && next ? decodeXml(next) : null };
  }

  async presignGet(
    key: string,
    options: { expiresInSeconds?: number; downloadName?: string } = {},
  ): Promise<string> {
    const url = this.url(key, this.s3.publicEndpoint ?? this.s3.endpoint);
    url.searchParams.set(
      'X-Amz-Expires',
      String(options.expiresInSeconds ?? 300),
    );
    if (options.downloadName) {
      const safe =
        options.downloadName.replace(/[^\w.\- ]+/g, '_').slice(0, 100) ||
        'download';
      url.searchParams.set(
        'response-content-disposition',
        `attachment; filename="${safe}"`,
      );
    }
    const signed = await this.client.sign(url.toString(), {
      method: 'GET',
      aws: { signQuery: true },
    });
    return signed.url;
  }

  async bucketExists(): Promise<boolean> {
    // A one-key listing instead of HeadBucket: bucket-scoped R2 tokens only grant object operations.
    const url = this.url(null);
    url.searchParams.set('list-type', '2');
    url.searchParams.set('max-keys', '1');
    const res = await this.send(url);
    if (res.ok) return true;
    if (res.status === 404) return false;
    return this.fail(res, 'Bucket check');
  }
}

/** Stand-in when S3_* is not set: the app runs, uploads answer "storage is not configured". */
export class UnconfiguredStorage implements ObjectStorage {
  readonly configured = false;
  private never(): never {
    throw new StorageError(
      'File storage is not configured (S3_* settings).',
      503,
    );
  }
  async put(): Promise<void> {
    this.never();
  }
  async getBuffer(): Promise<Buffer> {
    return this.never();
  }
  async head(): Promise<ObjectHead | null> {
    return this.never();
  }
  async delete(): Promise<void> {
    this.never();
  }
  async list(): Promise<{ objects: StoredObject[]; nextToken: string | null }> {
    return this.never();
  }
  async presignGet(): Promise<string> {
    return this.never();
  }
  async bucketExists(): Promise<boolean> {
    return this.never();
  }
}

export function storageFromEnv(): ObjectStorage {
  const s = env.storage;
  if (!s.endpoint || !s.accessKeyId || !s.secretAccessKey)
    return new UnconfiguredStorage();
  return new S3ObjectStorage({
    endpoint: s.endpoint,
    publicEndpoint: s.publicEndpoint,
    region: s.region,
    bucket: s.bucket,
    accessKeyId: s.accessKeyId,
    secretAccessKey: s.secretAccessKey,
    forcePathStyle: s.forcePathStyle,
  });
}
