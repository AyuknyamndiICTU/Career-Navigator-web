import { getJson, postJson, readSse } from '../http';
import {
  AiProviderAdapter,
  EMPTY_USAGE,
  ProviderCall,
  ProviderError,
  ProviderStreamEvent,
  TokenUsage,
} from '../types';

type Flavor = 'openai' | 'openrouter' | 'ollama';

type ChatCompletion = {
  choices?: Array<{
    message?: { content?: string | null };
    delta?: { content?: string | null };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    prompt_tokens_details?: { cached_tokens?: number };
    completion_tokens_details?: { reasoning_tokens?: number };
    /** OpenRouter reports the charged amount in USD. */
    cost?: number;
  } | null;
  error?: { message?: string };
};

const LABEL: Record<Flavor, string> = {
  openai: 'OpenAI',
  openrouter: 'OpenRouter',
  ollama: 'Ollama Cloud',
};

function usageOf(data: ChatCompletion): TokenUsage | undefined {
  const u = data.usage;
  if (!u) return undefined;
  return {
    inputTokens: u.prompt_tokens ?? 0,
    outputTokens: u.completion_tokens ?? 0,
    cachedTokens: u.prompt_tokens_details?.cached_tokens ?? 0,
    reasoningTokens: u.completion_tokens_details?.reasoning_tokens ?? 0,
    ...(typeof u.cost === 'number' ? { providerCostUsd: u.cost } : {}),
  };
}

function requestBody(flavor: Flavor, call: ProviderCall, stream: boolean) {
  return {
    model: call.model,
    messages: [{ role: 'system', content: call.system }, ...call.messages],
    // OpenAI's current models take max_completion_tokens and only the default temperature.
    ...(flavor === 'openai'
      ? { max_completion_tokens: call.maxOutputTokens }
      : { max_tokens: call.maxOutputTokens, temperature: call.temperature }),
    ...(call.json ? { response_format: { type: 'json_object' } } : {}),
    ...(stream
      ? { stream: true, stream_options: { include_usage: true } }
      : {}),
    ...(flavor === 'openrouter' ? { usage: { include: true } } : {}),
  };
}

const headers = (apiKey: string) => ({ authorization: `Bearer ${apiKey}` });

export function openAiCompatibleProvider(flavor: Flavor): AiProviderAdapter {
  const label = LABEL[flavor];

  return {
    async generate(call) {
      const res = await postJson(
        `${call.baseUrl}/chat/completions`,
        headers(call.apiKey),
        requestBody(flavor, call, false),
        call.signal,
        label,
      );
      const data = (await res.json()) as ChatCompletion;
      return {
        text: data.choices?.[0]?.message?.content ?? '',
        usage: usageOf(data) ?? EMPTY_USAGE,
      };
    },

    async *stream(call): AsyncGenerator<ProviderStreamEvent> {
      const res = await postJson(
        `${call.baseUrl}/chat/completions`,
        headers(call.apiKey),
        requestBody(flavor, call, true),
        call.signal,
        label,
      );

      let usage: TokenUsage | undefined;
      for await (const { data } of readSse(res, call.signal)) {
        if (data === '[DONE]') break;
        const chunk = JSON.parse(data) as ChatCompletion;
        if (chunk.error) {
          throw new ProviderError(
            'server',
            chunk.error.message ?? `${label} stream error`,
          );
        }
        const text = chunk.choices?.[0]?.delta?.content;
        if (text) yield { type: 'delta', text };
        usage = usageOf(chunk) ?? usage;
      }
      yield { type: 'usage', usage: usage ?? EMPTY_USAGE };
    },

    async listModels(apiKey, baseUrl, signal) {
      const data = await getJson<{ data?: Array<{ id: string }> }>(
        `${baseUrl}/models`,
        headers(apiKey),
        signal,
        label,
      );
      return (data.data ?? []).map((m) => m.id);
    },
  };
}

export type OpenRouterKeyInfo = {
  usageUsd: number;
  limitUsd: number | null;
  remainingUsd: number | null;
  isFreeTier: boolean;
};

/** Balance and limits for an OpenRouter key (no tokens spent). */
export async function getOpenRouterKeyInfo(
  apiKey: string,
  baseUrl: string,
  signal: AbortSignal,
): Promise<OpenRouterKeyInfo> {
  const { data } = await getJson<{
    data: {
      usage?: number;
      limit?: number | null;
      limit_remaining?: number | null;
      is_free_tier?: boolean;
    };
  }>(`${baseUrl}/key`, headers(apiKey), signal, 'OpenRouter');

  return {
    usageUsd: data.usage ?? 0,
    limitUsd: data.limit ?? null,
    remainingUsd: data.limit_remaining ?? null,
    isFreeTier: Boolean(data.is_free_tier),
  };
}
