import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AiStateStore } from './ai-state.store';
import { allTaskProfiles, dailyLimit } from './task-profiles';
import { nextUtcMidnight, TTL, utcDay } from './time';
import { AiTask } from './types';

export type QuotaState = {
  used: number;
  limit: number;
  remaining: number;
  resetAt: string;
};

export class AiQuotaExceededError extends HttpException {
  constructor(task: AiTask, state: QuotaState) {
    super(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: `You've used today's ${state.limit} free AI requests for this feature. It resets at ${state.resetAt} (UTC), or add your own API key in Settings → AI providers.`,
        task,
        limit: state.limit,
        resetAt: state.resetAt,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

const ROLE_CACHE_MS = 5 * 60_000;

/** Daily per-user allowance on the platform's free AI; admins and own-key calls are exempt. */
@Injectable()
export class AiQuotaService {
  private readonly roles = new Map<string, { admin: boolean; at: number }>();

  constructor(
    private readonly store: AiStateStore,
    private readonly prisma: PrismaService,
  ) {}

  private key(userId: string, task: AiTask): string {
    return `ai:quota:${userId}:${task}:${utcDay()}`;
  }

  async isAdmin(userId: string): Promise<boolean> {
    const cached = this.roles.get(userId);
    if (cached && Date.now() - cached.at < ROLE_CACHE_MS) return cached.admin;
    let admin = false;
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });
      admin = user?.role === 'ADMIN';
    } catch {
      admin = false;
    }
    this.roles.set(userId, { admin, at: Date.now() });
    return admin;
  }

  async state(userId: string, task: AiTask): Promise<QuotaState> {
    const limit = dailyLimit(task);
    const used = Number(await this.store.get(this.key(userId, task))) || 0;
    return {
      used,
      limit,
      remaining: Math.max(0, limit - used),
      resetAt: nextUtcMidnight().toISOString(),
    };
  }

  async assertAvailable(userId: string, task: AiTask): Promise<void> {
    if (await this.isAdmin(userId)) return;
    const state = await this.state(userId, task);
    if (state.remaining <= 0) throw new AiQuotaExceededError(task, state);
  }

  async consume(userId: string, task: AiTask): Promise<void> {
    await this.store.incr(this.key(userId, task), TTL.day);
  }

  async allStates(
    userId: string,
  ): Promise<Record<string, QuotaState & { exempt: boolean }>> {
    const exempt = await this.isAdmin(userId);
    const entries = await Promise.all(
      allTaskProfiles().map(
        async (p) =>
          [p.task, { ...(await this.state(userId, p.task)), exempt }] as const,
      ),
    );
    return Object.fromEntries(entries);
  }
}
