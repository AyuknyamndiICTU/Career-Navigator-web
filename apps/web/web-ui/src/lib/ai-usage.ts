export type AiUsage = {
  inputTokens: number;
  outputTokens: number;
  cachedTokens?: number;
  costUsd: number;
  costSource: 'PROVIDER' | 'PRICE_TABLE' | 'FREE';
  estimated?: boolean;
};

export type AiMeta = {
  provider: string;
  model: string;
  viaOwnKey: boolean;
  cached?: boolean;
  latencyMs?: number;
  usage: AiUsage;
};

export type UsageTotals = {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
};

export type Allowance = Record<
  string,
  { used: number; limit: number; remaining: number; resetAt: string; exempt: boolean }
>;

const numberFormat = new Intl.NumberFormat('en-US');

export function formatTokens(n: number): string {
  return numberFormat.format(Math.round(n));
}

/** Sub-cent amounts keep 4 decimals so small calls don't all read "$0.00". */
export function formatUsd(n: number): string {
  if (n === 0) return '$0';
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

export function costLabel(usage: AiUsage): string {
  if (usage.costSource === 'FREE') return 'free';
  return `${usage.estimated ? '≈' : ''}${formatUsd(usage.costUsd)}`;
}
