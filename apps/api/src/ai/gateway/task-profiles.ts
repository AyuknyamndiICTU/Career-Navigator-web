import { Logger } from '@nestjs/common';
import { env } from '../../config/env';
import { AiTask, PROVIDER_IDS, ProviderId } from './types';

export type RouteEntry = { provider: ProviderId; model: string };

export type TaskProfile = {
  task: AiTask;
  label: string;
  maxOutputTokens: number;
  temperature: number;
  json: boolean;
  /** Streams must produce their first token within this time or the next model is tried. */
  firstTokenTimeoutMs: number;
  /** Non-streamed attempts must finish within this time. */
  attemptTimeoutMs: number;
  /** Everything (all fallbacks) must finish within this time. */
  totalBudgetMs: () => number;
  defaultRoute: string;
  /** Platform-AI calls per user per day. */
  defaultDailyLimit: number;
};

const PROFILES: Record<AiTask, TaskProfile> = {
  chat: {
    task: 'chat',
    label: 'Career chat',
    maxOutputTokens: 800,
    temperature: 0.7,
    json: false,
    firstTokenTimeoutMs: 8_000,
    attemptTimeoutMs: 15_000,
    totalBudgetMs: () => env.ai.chatTimeBudgetMs,
    defaultRoute:
      'gemini/gemini-3.8-flash,gemini/gemini-3.6-flash,ollama/gpt-oss:120b,anthropic/claude-haiku-5-5,openrouter/openrouter/free',
    defaultDailyLimit: 40,
  },
  'mock-interview': {
    task: 'mock-interview',
    label: 'Mock interview',
    maxOutputTokens: 600,
    temperature: 0.7,
    json: false,
    firstTokenTimeoutMs: 8_000,
    attemptTimeoutMs: 15_000,
    totalBudgetMs: () => env.ai.chatTimeBudgetMs,
    defaultRoute:
      'gemini/gemini-3.8-flash,anthropic/claude-haiku-5-5,ollama/gpt-oss:120b,openrouter/openrouter/free',
    defaultDailyLimit: 20,
  },
  'cv-assist': {
    task: 'cv-assist',
    label: 'CV AI assist',
    maxOutputTokens: 1_500,
    temperature: 0.2,
    json: true,
    firstTokenTimeoutMs: 30_000,
    attemptTimeoutMs: 30_000,
    totalBudgetMs: () => 60_000,
    defaultRoute:
      'gemini/gemini-3.5-flash-lite,gemini/gemini-3.1-flash-lite,ollama/gpt-oss:20b,anthropic/claude-haiku-5-5',
    defaultDailyLimit: 10,
  },
  'job-rerank': {
    task: 'job-rerank',
    label: 'Job matching',
    maxOutputTokens: 1_000,
    temperature: 0.4,
    json: true,
    firstTokenTimeoutMs: 12_000,
    attemptTimeoutMs: 12_000,
    totalBudgetMs: () => 20_000,
    defaultRoute:
      'gemini/gemini-3.5-flash-lite,gemini/gemini-2.5-flash-lite,ollama/gpt-oss:20b',
    defaultDailyLimit: 30,
  },
  'course-recs': {
    task: 'course-recs',
    label: 'Course recommendations',
    maxOutputTokens: 1_000,
    temperature: 0.4,
    json: true,
    firstTokenTimeoutMs: 15_000,
    attemptTimeoutMs: 15_000,
    totalBudgetMs: () => 25_000,
    defaultRoute:
      'gemini/gemini-3.1-flash-lite,gemini/gemini-3.5-flash-lite,ollama/gpt-oss:20b',
    defaultDailyLimit: 20,
  },
};

const logger = new Logger('AiRoutes');

export function taskProfile(task: AiTask): TaskProfile {
  return PROFILES[task];
}

export function allTaskProfiles(): TaskProfile[] {
  return Object.values(PROFILES);
}

/** `provider/model` entries, split on the first `/` (OpenRouter models contain slashes). */
export function parseRoute(raw: string): RouteEntry[] {
  const entries: RouteEntry[] = [];
  for (const item of raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)) {
    const slash = item.indexOf('/');
    const provider = item.slice(0, slash) as ProviderId;
    const model = item.slice(slash + 1);
    if (slash <= 0 || !model || !PROVIDER_IDS.includes(provider)) {
      logger.warn(`Ignoring invalid AI route entry "${item}"`);
      continue;
    }
    entries.push({ provider, model });
  }
  return entries;
}

export function platformRoute(task: AiTask): RouteEntry[] {
  return parseRoute(env.ai.route(task) ?? PROFILES[task].defaultRoute);
}

export function dailyLimit(task: AiTask): number {
  return env.ai.userDailyLimit(task, PROFILES[task].defaultDailyLimit);
}
