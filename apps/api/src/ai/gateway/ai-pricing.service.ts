import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { env } from '../../config/env';
import { PROVIDERS } from './providers';
import { ProviderId, TokenUsage } from './types';

export type ModelPrice = {
  inputPerMTok: number;
  outputPerMTok: number;
  cachedInputPerMTok: number | null;
  isFree: boolean;
};

export type CostSource = 'PROVIDER' | 'PRICE_TABLE' | 'FREE';

export type Cost = {
  costUsd: number;
  costSource: CostSource;
  estimated: boolean;
};

const CACHE_MS = 5 * 60_000;

@Injectable()
export class AiPricingService {
  private readonly logger = new Logger('AiPricing');
  private prices = new Map<string, ModelPrice>();
  private loadedAt = 0;

  constructor(private readonly prisma: PrismaService) {}

  invalidate(): void {
    this.loadedAt = 0;
  }

  private async load(): Promise<Map<string, ModelPrice>> {
    if (Date.now() - this.loadedAt < CACHE_MS) return this.prices;
    try {
      const rows = await this.prisma.aiModelPrice.findMany({
        where: { effectiveFrom: { lte: new Date() } },
        orderBy: { effectiveFrom: 'desc' },
      });
      const next = new Map<string, ModelPrice>();
      for (const row of rows) {
        const key = `${row.provider}/${row.model}`;
        if (next.has(key)) continue;
        next.set(key, {
          inputPerMTok: Number(row.inputPerMTok),
          outputPerMTok: Number(row.outputPerMTok),
          cachedInputPerMTok:
            row.cachedInputPerMTok === null
              ? null
              : Number(row.cachedInputPerMTok),
          isFree: row.isFree,
        });
      }
      this.prices = next;
    } catch (err) {
      this.logger.warn(`Could not load AI prices: ${String(err)}`);
    }
    this.loadedAt = Date.now();
    return this.prices;
  }

  async priceFor(
    provider: ProviderId,
    model: string,
  ): Promise<ModelPrice | undefined> {
    return (await this.load()).get(`${PROVIDERS[provider].dbId}/${model}`);
  }

  /**
   * Provider-reported cost wins; FREE-tier own keys and free platform providers cost $0
   * (tokens are still counted); otherwise price table x tokens.
   */
  async cost(
    provider: ProviderId,
    model: string,
    usage: TokenUsage,
    ownKeyTier: 'FREE' | 'PAID' | null,
  ): Promise<Cost> {
    if (ownKeyTier === 'FREE')
      return { costUsd: 0, costSource: 'FREE', estimated: false };
    if (
      ownKeyTier === null &&
      env.ai.platformFreeProviders.includes(provider)
    ) {
      return { costUsd: 0, costSource: 'FREE', estimated: false };
    }
    if (typeof usage.providerCostUsd === 'number') {
      return {
        costUsd: usage.providerCostUsd,
        costSource: 'PROVIDER',
        estimated: false,
      };
    }

    const price = await this.priceFor(provider, model);
    if (!price)
      return { costUsd: 0, costSource: 'PRICE_TABLE', estimated: true };
    if (price.isFree)
      return { costUsd: 0, costSource: 'FREE', estimated: false };

    const cached = Math.min(usage.cachedTokens, usage.inputTokens);
    const costUsd =
      ((usage.inputTokens - cached) * price.inputPerMTok +
        cached * (price.cachedInputPerMTok ?? price.inputPerMTok) +
        usage.outputTokens * price.outputPerMTok) /
      1_000_000;
    return { costUsd, costSource: 'PRICE_TABLE', estimated: true };
  }
}
