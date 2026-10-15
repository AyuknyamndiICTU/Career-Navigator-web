import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { env } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { AiQuotaService } from '../gateway/ai-quota.service';
import { AiUsageService } from '../gateway/ai-usage.service';
import { ModelHealthService } from '../gateway/model-health.service';
import { PROVIDERS, providerByDbId } from '../gateway/providers';
import { allTaskProfiles, platformRoute } from '../gateway/task-profiles';
import { AiCredentialsService } from './ai-credentials.service';
import type { UsageQueryDto } from './dto/ai-credential.dto';

type Sums = {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  costUsd: number;
};

type GroupField = 'task' | 'provider' | 'model' | 'credentialId';

const DAY_MS = 86_400_000;
const BILLABLE = ['ok', 'cancelled'];

function startOfUtcDay(d = new Date()): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

function sums(row: {
  _count: { _all: number };
  _sum: {
    inputTokens: number | null;
    outputTokens: number | null;
    cachedTokens: number | null;
    costUsd: Prisma.Decimal | null;
  };
}): Sums {
  return {
    calls: row._count._all,
    inputTokens: row._sum.inputTokens ?? 0,
    outputTokens: row._sum.outputTokens ?? 0,
    cachedTokens: row._sum.cachedTokens ?? 0,
    costUsd: Number(row._sum.costUsd ?? 0),
  };
}

/** Read side of AI metering: the user's usage page, the top-bar summary and the admin card. */
@Injectable()
export class AiUsageReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usage: AiUsageService,
    private readonly quota: AiQuotaService,
    private readonly credentials: AiCredentialsService,
    private readonly health: ModelHealthService,
  ) {}

  private range(q: UsageQueryDto): { from: Date; to: Date } {
    const now = new Date();
    switch (q.range ?? 'month') {
      case 'today':
        return { from: startOfUtcDay(now), to: now };
      case '30d':
        return { from: new Date(now.getTime() - 30 * DAY_MS), to: now };
      case 'custom': {
        const from = new Date(q.from ?? '');
        const to = q.to ? new Date(q.to) : now;
        if (
          Number.isNaN(from.getTime()) ||
          Number.isNaN(to.getTime()) ||
          from >= to
        ) {
          throw new BadRequestException('Provide a valid from/to date range');
        }
        if (to.getTime() - from.getTime() > 366 * DAY_MS) {
          throw new BadRequestException('The range can be at most one year');
        }
        return { from, to };
      }
      default:
        return {
          from: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
          to: now,
        };
    }
  }

  private async daily(where: Prisma.Sql, from: Date, to: Date) {
    const rows = await this.prisma.$queryRaw<
      Array<{
        day: Date;
        calls: bigint;
        input: bigint;
        output: bigint;
        cost: Prisma.Decimal;
      }>
    >(Prisma.sql`
      SELECT date_trunc('day', "createdAt") AS day, COUNT(*) AS calls,
             COALESCE(SUM("inputTokens"), 0) AS input, COALESCE(SUM("outputTokens"), 0) AS output,
             COALESCE(SUM("costUsd"), 0) AS cost
      FROM "AiUsageEvent"
      WHERE ${where} AND "status" IN ('ok', 'cancelled') AND "createdAt" >= ${from} AND "createdAt" < ${to}
      GROUP BY 1 ORDER BY 1`);
    return rows.map((r) => ({
      day: r.day.toISOString().slice(0, 10),
      calls: Number(r.calls),
      inputTokens: Number(r.input),
      outputTokens: Number(r.output),
      costUsd: Number(r.cost),
    }));
  }

  async report(userId: string, q: UsageQueryDto) {
    const { from, to } = this.range(q);
    const groupBy = q.groupBy ?? 'task';
    const field: GroupField =
      groupBy === 'credential'
        ? 'credentialId'
        : groupBy === 'day'
          ? 'task'
          : groupBy;
    const where: Prisma.AiUsageEventWhereInput = {
      userId,
      status: { in: BILLABLE },
      createdAt: { gte: from, lt: to },
    };

    const [grouped, keys, daily, today, allowance] = await Promise.all([
      this.prisma.aiUsageEvent.groupBy({
        by: [field],
        where,
        _count: { _all: true },
        _sum: {
          inputTokens: true,
          outputTokens: true,
          cachedTokens: true,
          costUsd: true,
        },
      }),
      this.keysWithBalances(userId),
      this.daily(Prisma.sql`"userId" = ${userId}`, from, to),
      this.usage.todayTotals(userId),
      this.quota.allStates(userId),
    ]);

    const labelFor = (value: string | null): string => {
      if (field === 'credentialId') {
        return value
          ? (keys.find((k) => k.id === value)?.label ?? 'Removed key')
          : 'Platform free AI';
      }
      if (field === 'provider' && value) return providerByDbId(value).name;
      if (field === 'task')
        return (
          allTaskProfiles().find((p) => p.task === value)?.label ??
          String(value)
        );
      return String(value);
    };

    const groups = grouped
      .map((row) => {
        const key = (row as Record<GroupField, string | null>)[field];
        return { key, label: labelFor(key), ...sums(row) };
      })
      .sort((a, b) => b.calls - a.calls);

    const totals = groups.reduce<Sums>(
      (acc, g) => ({
        calls: acc.calls + g.calls,
        inputTokens: acc.inputTokens + g.inputTokens,
        outputTokens: acc.outputTokens + g.outputTokens,
        cachedTokens: acc.cachedTokens + g.cachedTokens,
        costUsd: acc.costUsd + g.costUsd,
      }),
      {
        calls: 0,
        inputTokens: 0,
        outputTokens: 0,
        cachedTokens: 0,
        costUsd: 0,
      },
    );

    return {
      range: { from, to },
      groupBy,
      groups: groupBy === 'day' ? [] : groups,
      totals,
      daily,
      today,
      allowance,
      keys,
      // Gemini, OpenAI and Anthropic don't expose balances to API keys; spend there is our estimate.
      costNote:
        'Costs are calculated from provider-reported usage and our price table; balances are live only for OpenRouter keys.',
    };
  }

  private async keysWithBalances(userId: string) {
    const keys = await this.credentials.list(userId);
    const rows = await this.prisma.userAiCredential.findMany({
      where: { userId },
    });
    return Promise.all(
      keys.map(async (k) => {
        const row = rows.find((r) => r.id === k.id);
        const balance = row ? await this.credentials.keyInfo(row) : null;
        return {
          ...k,
          budgetRemainingUsd:
            k.monthlyBudgetUsd === null
              ? null
              : Math.max(0, k.monthlyBudgetUsd - k.monthSpendUsd),
          spendIsEstimate: k.provider !== 'OPENROUTER',
          balance,
        };
      }),
    );
  }

  /** Small payload for the top-bar widget. */
  async summary(userId: string) {
    const [today, allowance, ownKeys] = await Promise.all([
      this.usage.todayTotals(userId),
      this.quota.allStates(userId),
      this.prisma.userAiCredential
        .count({ where: { userId, status: 'ACTIVE' } })
        .catch(() => 0),
    ]);
    return { today, allowance, ownKeys };
  }

  providers() {
    return {
      byokEnabled: env.ai.byokEnabled,
      providers: Object.values(PROVIDERS).map((p) => ({
        id: p.dbId,
        name: p.name,
        keyUrl: p.keyUrl,
        platformConfigured: Boolean(p.platformKey()),
        customBaseUrl: p.id === 'openai' && env.ai.byokAllowedHosts.length > 0,
      })),
      tasks: allTaskProfiles().map((p) => ({ task: p.task, label: p.label })),
    };
  }

  // ─── Admin ───────────────────────────────────────────────────────────────

  private async platformUsage(from: Date) {
    const rows = await this.prisma.aiUsageEvent.groupBy({
      by: ['provider', 'model', 'status'],
      where: { credentialId: null, createdAt: { gte: from } },
      _count: { _all: true },
      _sum: {
        inputTokens: true,
        outputTokens: true,
        cachedTokens: true,
        costUsd: true,
      },
    });

    const byModel = new Map<
      string,
      Sums & { provider: string; model: string; errors: number }
    >();
    for (const row of rows) {
      const key = `${row.provider}/${row.model}`;
      const entry = byModel.get(key) ?? {
        provider: providerByDbId(row.provider).name,
        model: row.model,
        calls: 0,
        inputTokens: 0,
        outputTokens: 0,
        cachedTokens: 0,
        costUsd: 0,
        errors: 0,
      };
      if (row.status === 'error') {
        entry.errors += row._count._all;
      } else {
        const s = sums(row);
        entry.calls += s.calls;
        entry.inputTokens += s.inputTokens;
        entry.outputTokens += s.outputTokens;
        entry.cachedTokens += s.cachedTokens;
        entry.costUsd += s.costUsd;
      }
      byModel.set(key, entry);
    }
    return [...byModel.values()].sort((a, b) => b.calls - a.calls);
  }

  private async ownKeyUsage(from: Date) {
    const row = await this.prisma.aiUsageEvent.aggregate({
      where: {
        credentialId: { not: null },
        status: { in: BILLABLE },
        createdAt: { gte: from },
      },
      _count: { _all: true },
      _sum: {
        inputTokens: true,
        outputTokens: true,
        cachedTokens: true,
        costUsd: true,
      },
    });
    return sums(row);
  }

  async adminUsage() {
    const today = startOfUtcDay();
    const thirtyDays = new Date(Date.now() - 30 * DAY_MS);
    const [platformToday, platform30d, ownToday, own30d, keyHolders, daily] =
      await Promise.all([
        this.platformUsage(today),
        this.platformUsage(thirtyDays),
        this.ownKeyUsage(today),
        this.ownKeyUsage(thirtyDays),
        this.prisma.userAiCredential.findMany({
          distinct: ['userId'],
          select: { userId: true },
        }),
        this.daily(Prisma.sql`"credentialId" IS NULL`, thirtyDays, new Date()),
      ]);
    return {
      byokEnabled: env.ai.byokEnabled,
      usersWithOwnKeys: keyHolders.length,
      platform: { today: platformToday, last30Days: platform30d, daily },
      ownKeys: { today: ownToday, last30Days: own30d },
    };
  }

  async aiHealth() {
    const routes = await Promise.all(
      allTaskProfiles().map(async (p) => ({
        task: p.task,
        label: p.label,
        chain: await Promise.all(
          platformRoute(p.task).map(async (entry) => ({
            provider: entry.provider,
            model: entry.model,
            configured: Boolean(PROVIDERS[entry.provider].platformKey()),
            ...(await this.health.snapshot(
              `p:${entry.provider}/${entry.model}`,
              true,
            )),
          })),
        ),
      })),
    );
    return {
      byokEnabled: env.ai.byokEnabled,
      providers: Object.values(PROVIDERS).map((p) => ({
        id: p.id,
        name: p.name,
        platformKeyConfigured: Boolean(p.platformKey()),
      })),
      routes,
    };
  }
}
