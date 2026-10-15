import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import IORedis from 'ioredis';
import { env } from '../../config/env';

type Entry = { value: string; expiresAt: number };

/**
 * Small key/value + hash-counter store for AI cooldowns, quotas, usage counters and caches.
 * Uses Redis when REDIS_URL is set (shared by all replicas) and falls back to process memory
 * whenever Redis is not configured or unreachable, so AI keeps working without it.
 */
@Injectable()
export class AiStateStore implements OnModuleDestroy {
  private readonly logger = new Logger(AiStateStore.name);
  private redis?: IORedis;
  private redisFailedLogged = false;
  private readonly memory = new Map<string, Entry>();
  private readonly memoryHashes = new Map<
    string,
    { fields: Map<string, number>; expiresAt: number }
  >();

  async onModuleDestroy(): Promise<void> {
    await this.redis?.quit().catch(() => undefined);
  }

  private client(): IORedis | undefined {
    const url = env.redisUrl;
    if (!url) return undefined;
    if (!this.redis) {
      this.redis = new IORedis(url, {
        lazyConnect: true,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
      });
      this.redis.on('error', () => undefined);
      void this.redis.connect().catch(() => undefined);
    }
    return this.redis.status === 'ready' ? this.redis : undefined;
  }

  private async withRedis<T>(
    action: (redis: IORedis) => Promise<T>,
    fallback: () => T,
  ): Promise<T> {
    const redis = this.client();
    if (redis) {
      try {
        return await action(redis);
      } catch (err) {
        if (!this.redisFailedLogged) {
          this.redisFailedLogged = true;
          this.logger.warn(
            `Redis unavailable for AI state, using memory: ${String(err)}`,
          );
        }
      }
    }
    return fallback();
  }

  private memoryGet(key: string): string | null {
    const entry = this.memory.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.memory.delete(key);
      return null;
    }
    return entry.value;
  }

  private memorySet(key: string, value: string, ttl: number): void {
    if (this.memory.size > 10_000) {
      const now = Date.now();
      for (const [k, e] of this.memory)
        if (e.expiresAt <= now) this.memory.delete(k);
      for (const [k, h] of this.memoryHashes)
        if (h.expiresAt <= now) this.memoryHashes.delete(k);
    }
    this.memory.set(key, { value, expiresAt: Date.now() + ttl });
  }

  get(key: string): Promise<string | null> {
    return this.withRedis(
      (r) => r.get(key),
      () => this.memoryGet(key),
    );
  }

  async set(key: string, value: string, ttlMs: number): Promise<void> {
    const ttl = Math.max(1, Math.round(ttlMs));
    await this.withRedis(
      async (r) => void (await r.set(key, value, 'PX', ttl)),
      () => this.memorySet(key, value, ttl),
    );
  }

  /** Sets the key only if it does not exist yet; returns true when it was set. */
  async setOnce(key: string, value: string, ttlMs: number): Promise<boolean> {
    const ttl = Math.max(1, Math.round(ttlMs));
    return this.withRedis(
      async (r) => (await r.set(key, value, 'PX', ttl, 'NX')) === 'OK',
      () => {
        if (this.memoryGet(key) !== null) return false;
        this.memorySet(key, value, ttl);
        return true;
      },
    );
  }

  async del(key: string): Promise<void> {
    await this.withRedis(
      async (r) => void (await r.del(key)),
      () => void this.memory.delete(key),
    );
  }

  async incr(key: string, ttlMs: number): Promise<number> {
    const ttl = Math.max(1, Math.round(ttlMs));
    return this.withRedis(
      async (r) => {
        const [[, value]] = (await r
          .multi()
          .incr(key)
          .pexpire(key, ttl)
          .exec()) as [[Error | null, number]];
        return value;
      },
      () => {
        const next = Number(this.memoryGet(key) ?? 0) + 1;
        this.memorySet(key, String(next), ttl);
        return next;
      },
    );
  }

  async hincrBy(
    key: string,
    fields: Record<string, number>,
    ttlMs: number,
  ): Promise<void> {
    const ttl = Math.max(1, Math.round(ttlMs));
    await this.withRedis(
      async (r) => {
        const multi = r.multi();
        for (const [field, by] of Object.entries(fields)) {
          if (by) multi.hincrby(key, field, Math.round(by));
        }
        await multi.pexpire(key, ttl).exec();
      },
      () => {
        const now = Date.now();
        let hash = this.memoryHashes.get(key);
        if (!hash || hash.expiresAt <= now) {
          hash = { fields: new Map(), expiresAt: now + ttl };
          this.memoryHashes.set(key, hash);
        }
        for (const [field, by] of Object.entries(fields)) {
          hash.fields.set(
            field,
            (hash.fields.get(field) ?? 0) + Math.round(by),
          );
        }
      },
    );
  }

  async hgetall(key: string): Promise<Record<string, number>> {
    return this.withRedis(
      async (r) => {
        const raw = await r.hgetall(key);
        return Object.fromEntries(
          Object.entries(raw).map(([k, v]) => [k, Number(v)]),
        );
      },
      () => {
        const hash = this.memoryHashes.get(key);
        if (!hash || hash.expiresAt <= Date.now()) return {};
        return Object.fromEntries(hash.fields);
      },
    );
  }
}
