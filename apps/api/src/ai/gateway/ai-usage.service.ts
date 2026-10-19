import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Prisma } from '../../prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MessagingGateway } from '../../realtime/messaging.gateway';
import { AiStateStore } from './ai-state.store';
import { AiPricingService, CostSource } from './ai-pricing.service';
import { PROVIDERS } from './providers';
import { TTL, utcDay, utcMonth } from './time';
import { AiTask, ProviderId, TokenUsage } from './types';

export type MeteredUsage = {
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  reasoningTokens: number;
  costUsd: number;
  costSource: CostSource;
  estimated: boolean;
};

export type UsageTotals = {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
};

export type OwnKeyMeta = {
  id: string;
  tier: 'FREE' | 'PAID';
  monthlyBudgetUsd: number | null;
  label: string;
};

type RecordInput = {
  userId: string;
  task: AiTask;
  provider: ProviderId;
  model: string;
  ownKey: OwnKeyMeta | null;
  usage: TokenUsage;
  latencyMs: number;
  status: 'ok' | 'error' | 'cancelled';
};

const FLUSH_INTERVAL_MS = 2_000;
const FLUSH_BATCH = 100;
const MICRO = 1_000_000;

function totalsFrom(hash: Record<string, number>): UsageTotals {
  return {
    calls: hash.calls ?? 0,
    inputTokens: hash.in ?? 0,
    outputTokens: hash.out ?? 0,
    costUsd: (hash.costMicros ?? 0) / MICRO,
  };
}

/**
 * Meters every AI call: cost from provider/price table, hot counters in Redis (per user per
 * day/month and per own key per month), durable AiUsageEvent rows written in background batches,
 * budget alerts, and a live `ai:usage` Socket.IO event to the user's open tabs.
 */
@Injectable()
export class AiUsageService implements OnModuleDestroy {
  private readonly logger = new Logger('AiUsage');
  private buffer: Prisma.AiUsageEventCreateManyInput[] = [];
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly store: AiStateStore,
    private readonly pricing: AiPricingService,
    private readonly realtime: MessagingGateway,
  ) {}

  async onModuleDestroy(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    await this.flush();
  }

  static userDayKey(userId: string, day = utcDay()): string {
    return `ai:u:user:${userId}:d:${day}`;
  }

  static userMonthKey(userId: string, month = utcMonth()): string {
    return `ai:u:user:${userId}:m:${month}`;
  }

  static credentialMonthKey(credentialId: string, month = utcMonth()): string {
    return `ai:u:cred:${credentialId}:m:${month}`;
  }

  async record(input: RecordInput): Promise<MeteredUsage> {
    const cost = await this.pricing.cost(
      input.provider,
      input.model,
      input.usage,
      input.ownKey?.tier ?? null,
    );
    const metered: MeteredUsage = {
      inputTokens: input.usage.inputTokens,
      outputTokens: input.usage.outputTokens,
      cachedTokens: input.usage.cachedTokens,
      reasoningTokens: input.usage.reasoningTokens,
      ...cost,
    };

    this.enqueue(input, metered);

    if (input.status === 'error') return metered;

    const fields = {
      calls: 1,
      in: metered.inputTokens,
      out: metered.outputTokens,
      costMicros: Math.round(metered.costUsd * MICRO),
    };
    await Promise.all([
      this.store.hincrBy(
        AiUsageService.userDayKey(input.userId),
        fields,
        TTL.day,
      ),
      this.store.hincrBy(
        AiUsageService.userMonthKey(input.userId),
        fields,
        TTL.month,
      ),
      input.ownKey
        ? this.store.hincrBy(
            AiUsageService.credentialMonthKey(input.ownKey.id),
            fields,
            TTL.month,
          )
        : Promise.resolve(),
    ]);

    if (input.ownKey) await this.checkBudget(input.userId, input.ownKey);

    const today = await this.todayTotals(input.userId);
    this.realtime.emitToUser(input.userId, 'ai:usage', {
      task: input.task,
      provider: input.provider,
      model: input.model,
      viaOwnKey: Boolean(input.ownKey),
      usage: metered,
      today,
    });

    return metered;
  }

  async todayTotals(userId: string): Promise<UsageTotals> {
    return totalsFrom(
      await this.store.hgetall(AiUsageService.userDayKey(userId)),
    );
  }

  async monthTotals(userId: string): Promise<UsageTotals> {
    return totalsFrom(
      await this.store.hgetall(AiUsageService.userMonthKey(userId)),
    );
  }

  async credentialMonthSpendUsd(credentialId: string): Promise<number> {
    const hash = await this.store.hgetall(
      AiUsageService.credentialMonthKey(credentialId),
    );
    return (hash.costMicros ?? 0) / MICRO;
  }

  private async checkBudget(userId: string, key: OwnKeyMeta): Promise<void> {
    if (!key.monthlyBudgetUsd || key.monthlyBudgetUsd <= 0) return;
    const spent = await this.credentialMonthSpendUsd(key.id);
    const ratio = spent / key.monthlyBudgetUsd;
    const month = utcMonth();

    for (const [threshold, message] of [
      [
        1,
        `Your AI key "${key.label}" reached its monthly budget of $${key.monthlyBudgetUsd.toFixed(2)}. Requests now use the free platform AI (if fallback is on) until the 1st.`,
      ],
      [
        0.8,
        `Your AI key "${key.label}" has used 80% of its $${key.monthlyBudgetUsd.toFixed(2)} monthly budget.`,
      ],
    ] as const) {
      if (ratio < threshold) continue;
      const fresh = await this.store.setOnce(
        `ai:budget:${key.id}:${month}:${threshold}`,
        '1',
        TTL.month,
      );
      if (fresh) await this.notify(userId, message);
      return;
    }
  }

  async notify(userId: string, message: string): Promise<void> {
    try {
      await this.prisma.notification.create({
        data: { userId, type: 'AI_USAGE', message },
      });
      this.realtime.emitToUser(userId, 'notification:new', {
        type: 'AI_USAGE',
        message,
      });
    } catch (err) {
      this.logger.warn(`Could not create AI notification: ${String(err)}`);
    }
  }

  private enqueue(input: RecordInput, metered: MeteredUsage): void {
    this.buffer.push({
      userId: input.userId,
      credentialId: input.ownKey?.id ?? null,
      provider: PROVIDERS[input.provider].dbId,
      model: input.model,
      task: input.task,
      inputTokens: metered.inputTokens,
      outputTokens: metered.outputTokens,
      cachedTokens: metered.cachedTokens,
      reasoningTokens: metered.reasoningTokens,
      costUsd: new Prisma.Decimal(metered.costUsd.toFixed(6)),
      costSource: metered.costSource,
      latencyMs: Math.round(input.latencyMs),
      status: input.status,
    });

    if (this.buffer.length >= FLUSH_BATCH) {
      void this.flush();
    } else if (!this.timer) {
      this.timer = setTimeout(() => void this.flush(), FLUSH_INTERVAL_MS);
      this.timer.unref();
    }
  }

  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    if (this.buffer.length === 0) return;
    const batch = this.buffer;
    this.buffer = [];
    try {
      await this.prisma.aiUsageEvent.createMany({ data: batch });
    } catch (err) {
      this.logger.warn(
        `Dropped ${batch.length} AI usage events: ${String(err)}`,
      );
    }
  }
}
