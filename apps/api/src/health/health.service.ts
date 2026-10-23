import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import IORedis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { env } from '../config/env';
import { OBJECT_STORAGE, type ObjectStorage } from '../storage/object-storage';

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

  constructor(
    private readonly prisma: PrismaService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  async onModuleDestroy(): Promise<void> {
    if (this.redis) await this.redis.quit().catch(() => undefined);
  }

  async readiness(): Promise<Readiness> {
    const [database, redis, storage] = await Promise.all([
      this.check('database', () => this.prisma.$queryRaw`SELECT 1`),
      env.redisUrl
        ? this.check('redis', () => this.getRedis().ping())
        : Promise.resolve<DependencyStatus>('skipped'),
      this.storage.configured
        ? this.check('storage', async () => {
            if (!(await this.storage.bucketExists()))
              throw new Error(`bucket "${env.storage.bucket}" not found`);
          })
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
}
