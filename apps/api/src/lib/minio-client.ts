import { Client as MinioClient } from 'minio';
import { env } from '../config/env';

/** Builds an S3-compatible client from env, or returns null when storage is not configured. */
export function createMinioClient(): MinioClient | null {
  const { endpoint, accessKey, secretKey } = env.minio;
  if (!endpoint || !accessKey || !secretKey) return null;

  const url = new URL(endpoint.trim());
  const useSSL = url.protocol === 'https:';

  return new MinioClient({
    endPoint: url.hostname,
    port: url.port ? Number(url.port) : useSSL ? 443 : 80,
    useSSL,
    accessKey,
    secretKey,
  });
}
