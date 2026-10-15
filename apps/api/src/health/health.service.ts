import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import IORedis from 'ioredis';
import type { Client as MinioClient } from 'minio';
import { PrismaService } from '../prisma/prisma.service';
import { env } from '../config/env';
import { createMinioClient } from '../lib/minio-client';

export type DependencyStatus = 'up' | 'down' | 'skipped';

export type Readiness = {
  status: 'ok' | 'error';
  checks: Record<string, DependencyStatus>;
};

const CHECK_TIMEOUT_MS = 3000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

@Injectable()
export class HealthService implements OnModuleDestroy {
  private readonly logger = new Logger(HealthService.name);
  private redis?: IORedis;
  private minio?: MinioClient | null;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleDestroy(): Promise<void> {
    if (this.redis) await this.redis.quit().catch(() => undefined);
  }

  async readiness(): Promise<Readiness> {
    const [database, redis, storage] = await Promise.all([
      this.check('database', () => this.prisma.$queryRaw`SELECT 1`),
      env.redisUrl
        ? this.check('redis', () => this.getRedis().ping())
        : Promise.resolve<DependencyStatus>('skipped'),
      this.getMinio()
        ? this.check('storage', () =>
            this.getMinio()!.bucketExists(env.minio.bucket),
          )
        : Promise.resolve<DependencyStatus>('skipped'),
    ]);

    const checks = { database, redis, storage };
    const ok = Object.values(checks).every((s) => s !== 'down');
    return { status: ok ? 'ok' : 'error', checks };
  }

  private async check(
    name: string,
    probe: () => Promise<unknown>,
  ): Promise<DependencyStatus> {
    try {
      await withTimeout(probe(), CHECK_TIMEOUT_MS);
      return 'up';
    } catch (err) {
      this.logger.warn(`Readiness check "${name}" failed: ${String(err)}`);
      return 'down';
    }
  }

  private getRedis(): IORedis {
    if (!this.redis) {
      this.redis = new IORedis(env.redisUrl!, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        connectTimeout: CHECK_TIMEOUT_MS,
      });
      // Failures are reported through the readiness result; avoid unhandled 'error' events.
      this.redis.on('error', () => undefined);
    }
    return this.redis;
  }

  private getMinio(): MinioClient | null {
    if (this.minio === undefined) this.minio = createMinioClient();
    return this.minio;
  }
}
