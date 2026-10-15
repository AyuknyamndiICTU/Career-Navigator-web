import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { env } from '../../config/env';
import { anthropicProvider } from './providers/anthropic.provider';
import { geminiProvider } from './providers/gemini.provider';
import { openAiCompatibleProvider } from './providers/openai-compatible.provider';
import { AiProviderAdapter, ProviderError, ProviderId } from './types';

export type ProviderInfo = {
  id: ProviderId;
  /** Prisma enum value. */
  dbId: 'GEMINI' | 'OPENAI' | 'ANTHROPIC' | 'OPENROUTER' | 'OLLAMA_CLOUD';
  name: string;
  baseUrl: string;
  keyUrl: string;
  adapter: AiProviderAdapter;
  platformKey: () => string | undefined;
};

// Outbound AI calls only ever go to these fixed HTTPS hosts (plus the admin allowlist below).
export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  gemini: {
    id: 'gemini',
    dbId: 'GEMINI',
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    keyUrl: 'https://aistudio.google.com/apikey',
    adapter: geminiProvider,
    platformKey: () => env.ai.geminiApiKey,
  },
  openai: {
    id: 'openai',
    dbId: 'OPENAI',
    name: 'OpenAI (GPT)',
    baseUrl: 'https://api.openai.com/v1',
    keyUrl: 'https://platform.openai.com/api-keys',
    adapter: openAiCompatibleProvider('openai'),
    platformKey: () => env.ai.openaiApiKey,
  },
  anthropic: {
    id: 'anthropic',
    dbId: 'ANTHROPIC',
    name: 'Anthropic (Claude)',
    baseUrl: 'https://api.anthropic.com/v1',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    adapter: anthropicProvider,
    platformKey: () => env.ai.anthropicApiKey,
  },
  openrouter: {
    id: 'openrouter',
    dbId: 'OPENROUTER',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    keyUrl: 'https://openrouter.ai/settings/keys',
    adapter: openAiCompatibleProvider('openrouter'),
    platformKey: () => env.ai.openrouterApiKey,
  },
  ollama: {
    id: 'ollama',
    dbId: 'OLLAMA_CLOUD',
    name: 'Ollama Cloud',
    baseUrl: 'https://ollama.com/v1',
    keyUrl: 'https://ollama.com/settings/keys',
    adapter: openAiCompatibleProvider('ollama'),
    platformKey: () => env.ai.ollamaApiKey,
  },
};

export function providerByDbId(dbId: string): ProviderInfo {
  const info = Object.values(PROVIDERS).find((p) => p.dbId === dbId);
  if (!info) throw new Error(`Unknown AI provider ${dbId}`);
  return info;
}

function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  const lower = address.toLowerCase();
  if (lower.startsWith('::ffff:')) return isPrivateAddress(lower.slice(7));
  return (
    lower === '::' ||
    lower === '::1' ||
    lower.startsWith('fc') ||
    lower.startsWith('fd') ||
    lower.startsWith('fe80')
  );
}

/**
 * Validates a user-supplied OpenAI-compatible base URL: HTTPS, host on AI_BYOK_ALLOWED_HOSTS,
 * and every resolved address public (no SSRF into the cluster or cloud metadata).
 */
export async function assertAllowedBaseUrl(raw: string): Promise<string> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ProviderError('bad-request', 'Base URL is not a valid URL');
  }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new ProviderError(
      'bad-request',
      'Base URL must be a plain https:// URL',
    );
  }
  if (!env.ai.byokAllowedHosts.includes(host)) {
    throw new ProviderError(
      'bad-request',
      `Host ${host} is not on the allowed list`,
    );
  }
  const addresses = isIP(host)
    ? [{ address: host }]
    : await lookup(host, { all: true });
  if (
    addresses.length === 0 ||
    addresses.some((a) => isPrivateAddress(a.address))
  ) {
    throw new ProviderError(
      'bad-request',
      `Host ${host} resolves to a private address`,
    );
  }
  return url.toString().replace(/\/+$/, '');
}

export const __test = { isPrivateAddress };
