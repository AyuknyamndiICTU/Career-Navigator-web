export const PROVIDER_IDS = [
  'gemini',
  'openai',
  'anthropic',
  'openrouter',
  'ollama',
] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

export const AI_TASKS = [
  'chat',
  'mock-interview',
  'cv-assist',
  'job-rerank',
  'course-recs',
] as const;
export type AiTask = (typeof AI_TASKS)[number];

export type ChatTurn = { role: 'user' | 'assistant'; content: string };

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  reasoningTokens: number;
  /** Set when the provider reports the charge itself (OpenRouter). */
  providerCostUsd?: number;
};

export const EMPTY_USAGE: TokenUsage = {
  inputTokens: 0,
  outputTokens: 0,
  cachedTokens: 0,
  reasoningTokens: 0,
};

export type ProviderCall = {
  model: string;
  system: string;
  messages: ChatTurn[];
  maxOutputTokens: number;
  temperature: number;
  json: boolean;
  apiKey: string;
  baseUrl: string;
  signal: AbortSignal;
};

export type ProviderStreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'usage'; usage: TokenUsage };

export interface AiProviderAdapter {
  generate(call: ProviderCall): Promise<{ text: string; usage: TokenUsage }>;
  stream(call: ProviderCall): AsyncGenerator<ProviderStreamEvent>;
  listModels(
    apiKey: string,
    baseUrl: string,
    signal: AbortSignal,
  ): Promise<string[]>;
}

export type ProviderErrorKind =
  | 'rate-limit'
  | 'daily-quota'
  | 'auth'
  | 'payment'
  | 'timeout'
  | 'server'
  | 'bad-request'
  | 'network';

export class ProviderError extends Error {
  constructor(
    readonly kind: ProviderErrorKind,
    message: string,
    readonly status?: number,
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'ProviderError';
  }

  get retryable(): boolean {
    return this.kind === 'server' || this.kind === 'network';
  }
}

export function mergeUsage(a: TokenUsage, b: Partial<TokenUsage>): TokenUsage {
  return {
    inputTokens: b.inputTokens ?? a.inputTokens,
    outputTokens: b.outputTokens ?? a.outputTokens,
    cachedTokens: b.cachedTokens ?? a.cachedTokens,
    reasoningTokens: b.reasoningTokens ?? a.reasoningTokens,
    providerCostUsd: b.providerCostUsd ?? a.providerCostUsd,
  };
}
