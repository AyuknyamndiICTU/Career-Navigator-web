import { getJson, postJson, readSse } from '../http';
import {
  AiProviderAdapter,
  ChatTurn,
  EMPTY_USAGE,
  ProviderCall,
  ProviderError,
  ProviderStreamEvent,
  TokenUsage,
} from '../types';

const API_VERSION = '2023-06-01';

type AnthropicUsage = {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
};

type AnthropicMessage = {
  content?: Array<{ type: string; text?: string }>;
  usage?: AnthropicUsage;
};

type StreamEvent = {
  type: string;
  message?: { usage?: AnthropicUsage };
  delta?: { type?: string; text?: string };
  usage?: AnthropicUsage;
  error?: { message?: string };
};

// Anthropic's input_tokens excludes cached tokens; report the full prompt size and the cached share.
function usageOf(
  u: AnthropicUsage | undefined,
  prev: TokenUsage = EMPTY_USAGE,
): TokenUsage {
  if (!u) return prev;
  const cachedRead = u.cache_read_input_tokens ?? 0;
  const input =
    u.input_tokens !== undefined
      ? u.input_tokens + cachedRead + (u.cache_creation_input_tokens ?? 0)
      : prev.inputTokens;
  return {
    inputTokens: input,
    outputTokens: u.output_tokens ?? prev.outputTokens,
    cachedTokens:
      u.cache_read_input_tokens !== undefined ? cachedRead : prev.cachedTokens,
    reasoningTokens: 0,
  };
}

/** The Messages API needs alternating turns starting with the user. */
function normalizeTurns(messages: ChatTurn[]): ChatTurn[] {
  const turns: ChatTurn[] = [];
  for (const m of messages) {
    const last = turns[turns.length - 1];
    if (last?.role === m.role) last.content += `\n\n${m.content}`;
    else turns.push({ ...m });
  }
  while (turns[0]?.role === 'assistant') turns.shift();
  return turns;
}

function requestBody(call: ProviderCall, stream: boolean) {
  return {
    model: call.model,
    max_tokens: call.maxOutputTokens,
    temperature: call.temperature,
    // Prompt caching: repeated system prompts are billed at ~10 % of the input price.
    system: [
      { type: 'text', text: call.system, cache_control: { type: 'ephemeral' } },
    ],
    messages: normalizeTurns(call.messages),
    ...(stream ? { stream: true } : {}),
  };
}

const headers = (apiKey: string) => ({
  'x-api-key': apiKey,
  'anthropic-version': API_VERSION,
});

export const anthropicProvider: AiProviderAdapter = {
  async generate(call) {
    const res = await postJson(
      `${call.baseUrl}/messages`,
      headers(call.apiKey),
      requestBody(call, false),
      call.signal,
      'Anthropic',
    );
    const data = (await res.json()) as AnthropicMessage;
    const text = (data.content ?? [])
      .filter((block) => block.type === 'text')
      .map((block) => block.text ?? '')
      .join('');
    return { text, usage: usageOf(data.usage) };
  },

  async *stream(call): AsyncGenerator<ProviderStreamEvent> {
    const res = await postJson(
      `${call.baseUrl}/messages`,
      headers(call.apiKey),
      requestBody(call, true),
      call.signal,
      'Anthropic',
    );

    let usage = EMPTY_USAGE;
    for await (const { data } of readSse(res, call.signal)) {
      const event = JSON.parse(data) as StreamEvent;
      if (event.type === 'error') {
        throw new ProviderError(
          'server',
          event.error?.message ?? 'Anthropic stream error',
        );
      }
      if (event.type === 'message_start')
        usage = usageOf(event.message?.usage, usage);
      if (event.type === 'message_delta') usage = usageOf(event.usage, usage);
      if (
        event.type === 'content_block_delta' &&
        event.delta?.type === 'text_delta'
      ) {
        if (event.delta.text) yield { type: 'delta', text: event.delta.text };
      }
    }
    yield { type: 'usage', usage };
  },

  async listModels(apiKey, baseUrl, signal) {
    const data = await getJson<{ data?: Array<{ id: string }> }>(
      `${baseUrl}/models?limit=1000`,
      headers(apiKey),
      signal,
      'Anthropic',
    );
    return (data.data ?? []).map((m) => m.id);
  },
};
