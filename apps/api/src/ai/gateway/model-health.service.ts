import { Injectable, Logger } from '@nestjs/common';
import { env } from '../../config/env';
import { AiStateStore } from './ai-state.store';
import { pacificDay, msUntilPacificMidnight, TTL } from './time';
import { ProviderError } from './types';

const BREAKER_THRESHOLD = 3;
const BREAKER_OPEN_MS = 60_000;
const DEFAULT_RATE_LIMIT_COOLDOWN_MS = 60_000;
const AUTH_COOLDOWN_MS = 15 * 60_000;

export type HealthState = {
  key: string;
  coolingUntil: number | null;
  breakerOpenUntil: number | null;
  callsToday: number;
  dailyLimit: number | null;
};

/**
 * Tracks which `provider/model` entries can take traffic: Redis-backed cooldowns after 429s
 * (until Retry-After, or the next Pacific midnight for per-day quotas), per-model daily call
 * counters, and an in-process circuit breaker after repeated server/network failures.
 */
@Injectable()
export class ModelHealthService {
  private readonly logger = new Logger('AiModelHealth');
  private readonly breakers = new Map<
    string,
    { failures: number; openUntil: number }
  >();

  constructor(private readonly store: AiStateStore) {}

  private callsKey(key: string): string {
    return `ai:calls:${key}:${pacificDay()}`;
  }

  async unavailableReason(
    key: string,
    platform: boolean,
  ): Promise<string | null> {
    const breaker = this.breakers.get(key);
    if (breaker && breaker.openUntil > Date.now()) return 'circuit open';

    const coolingUntil = Number(await this.store.get(`ai:cool:${key}`));
    if (coolingUntil > Date.now()) return 'cooling down';

    const cap = platform ? env.ai.modelDailyLimits.get(key) : undefined;
    if (cap && Number(await this.store.get(this.callsKey(key))) >= cap)
      return 'daily cap reached';

    return null;
  }

  async recordSuccess(key: string): Promise<void> {
    this.breakers.delete(key);
    await this.store.incr(this.callsKey(key), TTL.day);
  }

  async recordFailure(key: string, err: ProviderError): Promise<void> {
    switch (err.kind) {
      case 'rate-limit':
        return this.cool(
          key,
          err.retryAfterMs ?? DEFAULT_RATE_LIMIT_COOLDOWN_MS,
          err.kind,
        );
      case 'daily-quota':
        return this.cool(key, msUntilPacificMidnight(), err.kind);
      case 'auth':
      case 'payment':
        return this.cool(key, AUTH_COOLDOWN_MS, err.kind);
      case 'server':
      case 'network':
      case 'timeout': {
        const state = this.breakers.get(key) ?? { failures: 0, openUntil: 0 };
        state.failures += 1;
        if (state.failures >= BREAKER_THRESHOLD) {
          state.failures = 0;
          state.openUntil = Date.now() + BREAKER_OPEN_MS;
          this.logger.warn(
            `Circuit opened for ${key} after ${BREAKER_THRESHOLD} failures`,
          );
        }
        this.breakers.set(key, state);
        return;
      }
      default:
        return;
    }
  }

  private async cool(key: string, ms: number, why: string): Promise<void> {
    const until = Date.now() + ms;
    this.logger.warn(`Cooling ${key} for ${Math.round(ms / 1000)}s (${why})`);
    await this.store.set(`ai:cool:${key}`, String(until), ms);
  }

  async snapshot(key: string, platform: boolean): Promise<HealthState> {
    const coolingUntil = Number(await this.store.get(`ai:cool:${key}`));
    const breaker = this.breakers.get(key);
    return {
      key,
      coolingUntil: coolingUntil > Date.now() ? coolingUntil : null,
      breakerOpenUntil:
        breaker && breaker.openUntil > Date.now() ? breaker.openUntil : null,
      callsToday: Number(await this.store.get(this.callsKey(key))) || 0,
      dailyLimit: (platform && env.ai.modelDailyLimits.get(key)) || null,
    };
  }
}
