import { getJson, postJson, readSse } from '../http';
import {
  AiProviderAdapter,
  EMPTY_USAGE,
  ProviderCall,
  ProviderError,
  ProviderStreamEvent,
  TokenUsage,
} from '../types';

type GeminiPart = { text?: string; thought?: boolean };
type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: GeminiPart[] } }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    cachedContentTokenCount?: number;
    thoughtsTokenCount?: number;
  };
  error?: { message?: string };
};

function usageOf(data: GeminiResponse): TokenUsage | undefined {
  const meta = data.usageMetadata;
  if (!meta) return undefined;
  return {
    inputTokens: meta.promptTokenCount ?? 0,
    outputTokens:
      (meta.candidatesTokenCount ?? 0) + (meta.thoughtsTokenCount ?? 0),
    cachedTokens: meta.cachedContentTokenCount ?? 0,
    reasoningTokens: meta.thoughtsTokenCount ?? 0,
  };
}

function textOf(data: GeminiResponse): string {
  return (data.candidates?.[0]?.content?.parts ?? [])
    .filter((p) => !p.thought && typeof p.text === 'string')
    .map((p) => p.text)
    .join('');
}

function requestBody(call: ProviderCall) {
  return {
    // Kept identical across requests of a task so Gemini's implicit prefix caching applies.
    systemInstruction: { parts: [{ text: call.system }] },
    contents: call.messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    generationConfig: {
      temperature: call.temperature,
      maxOutputTokens: call.maxOutputTokens,
      ...(call.json ? { responseMimeType: 'application/json' } : {}),
    },
  };
}

// The key travels in a header, never in the URL, so it can't leak through logged URLs.
const headers = (apiKey: string) => ({ 'x-goog-api-key': apiKey });

export const geminiProvider: AiProviderAdapter = {
  async generate(call) {
    const res = await postJson(
      `${call.baseUrl}/models/${encodeURIComponent(call.model)}:generateContent`,
      headers(call.apiKey),
      requestBody(call),
      call.signal,
      'Gemini',
    );
    const data = (await res.json()) as GeminiResponse;
    return { text: textOf(data), usage: usageOf(data) ?? EMPTY_USAGE };
  },

  async *stream(call): AsyncGenerator<ProviderStreamEvent> {
    const res = await postJson(
      `${call.baseUrl}/models/${encodeURIComponent(call.model)}:streamGenerateContent?alt=sse`,
      headers(call.apiKey),
      requestBody(call),
      call.signal,
      'Gemini',
    );

    let usage: TokenUsage | undefined;
    for await (const { data } of readSse(res, call.signal)) {
      const chunk = JSON.parse(data) as GeminiResponse;
      if (chunk.error) {
        throw new ProviderError(
          'server',
          chunk.error.message ?? 'Gemini stream error',
        );
      }
      const text = textOf(chunk);
      if (text) yield { type: 'delta', text };
      // Every chunk carries cumulative usage; the last one is final.
      usage = usageOf(chunk) ?? usage;
    }
    yield { type: 'usage', usage: usage ?? EMPTY_USAGE };
  },

  async listModels(apiKey, baseUrl, signal) {
    const data = await getJson<{
      models?: Array<{ name: string; supportedGenerationMethods?: string[] }>;
    }>(`${baseUrl}/models?pageSize=1000`, headers(apiKey), signal, 'Gemini');

    return (data.models ?? [])
      .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m) => m.name.replace(/^models\//, ''));
  },
};
