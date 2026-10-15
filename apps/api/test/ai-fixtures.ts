import { jest } from '@jest/globals';

/** Recorded-shape responses of the real provider APIs, used instead of network calls. */

export const json = (
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

export const failure = (
  status: number,
  body = '',
  headers: Record<string, string> = {},
) => new Response(body, { status, headers });

export const sse = (events: unknown[], done = false) =>
  new Response(
    events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('') +
      (done ? 'data: [DONE]\n\n' : ''),
    { status: 200, headers: { 'content-type': 'text/event-stream' } },
  );

export const geminiJson = (
  text: string,
  usage = { promptTokenCount: 120, candidatesTokenCount: 30 },
) =>
  json({
    candidates: [{ content: { parts: [{ text }] } }],
    usageMetadata: usage,
  });

export const geminiSse = (
  chunks: string[],
  usage = { promptTokenCount: 120, candidatesTokenCount: 12 },
) =>
  sse(
    chunks.map((text, i) => ({
      candidates: [{ content: { parts: [{ text }] } }],
      // Gemini sends cumulative usage on every chunk; the last one is final.
      usageMetadata:
        i === chunks.length - 1
          ? usage
          : { promptTokenCount: usage.promptTokenCount },
    })),
  );

export const openAiJson = (
  text: string,
  usage: Record<string, unknown> = {
    prompt_tokens: 100,
    completion_tokens: 20,
  },
) => json({ choices: [{ message: { content: text } }], usage });

export const openAiSse = (
  chunks: string[],
  usage: Record<string, unknown> = { prompt_tokens: 90, completion_tokens: 15 },
) =>
  sse(
    [
      ...chunks.map((content) => ({ choices: [{ delta: { content } }] })),
      { choices: [], usage },
    ],
    true,
  );

export const anthropicSse = (chunks: string[]) =>
  sse([
    {
      type: 'message_start',
      message: {
        usage: {
          input_tokens: 40,
          cache_read_input_tokens: 200,
          output_tokens: 1,
        },
      },
    },
    ...chunks.map((text) => ({
      type: 'content_block_delta',
      delta: { type: 'text_delta', text },
    })),
    { type: 'message_delta', usage: { output_tokens: 18 } },
    { type: 'message_stop' },
  ]);

/** A provider that never answers until the request is aborted. */
export const hang = (init?: RequestInit) =>
  new Promise<Response>((_, reject) => {
    init?.signal?.addEventListener('abort', () =>
      reject(Object.assign(new Error('aborted'), { name: 'AbortError' })),
    );
  });

export type FetchCall = {
  url: string;
  init: RequestInit;
  headers: Headers;
  body: any;
};

/** Replaces global fetch; every call is recorded and answered by the handler. */
export function mockFetch(
  handler: (call: FetchCall) => Response | Promise<Response>,
) {
  const calls: FetchCall[] = [];
  const fn = jest.fn(async (input: unknown, init: RequestInit = {}) => {
    const call: FetchCall = {
      url: String(input),
      init,
      headers: new Headers(init.headers),
      body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
    };
    calls.push(call);
    return handler(call);
  });
  (global as any).fetch = fn;
  return calls;
}

/** supertest parser that keeps the raw text of a streamed response. */
export const rawText = (
  res: any,
  cb: (err: Error | null, body: string) => void,
) => {
  let data = '';
  res.setEncoding('utf8');
  res.on('data', (chunk: string) => (data += chunk));
  res.on('end', () => cb(null, data));
};

export function parseSse(text: string): Array<{ event: string; data: any }> {
  return text
    .split('\n\n')
    .filter(Boolean)
    .map((block) => {
      const event = /^event: (.+)$/m.exec(block)?.[1] ?? 'message';
      const data = /^data: (.+)$/m.exec(block)?.[1];
      return { event, data: data ? JSON.parse(data) : null };
    });
}

export const AI_ENV_KEYS = [
  'GEMINI_API_KEY',
  'OLLAMA_API_KEY',
  'ANTHROPIC_API_KEY',
  'OPENROUTER_API_KEY',
  'OPENAI_API_KEY',
  'REDIS_URL',
  'AI_BYOK_ENABLED',
  'AI_KEY_ENCRYPTION_KEY',
  'AI_KEY_ENCRYPTION_KEY_PREVIOUS',
  'AI_USER_DAILY_LIMIT_CHAT',
  'AI_CHAT_TIME_BUDGET_MS',
  'AI_ROUTE_CHAT',
  'AI_BYOK_ALLOWED_HOSTS',
  'AI_PLATFORM_FREE_PROVIDERS',
];

/** Clean AI environment: Gemini + Ollama Cloud platform keys, in-memory state (no Redis). */
export function resetAiEnv(): void {
  for (const key of AI_ENV_KEYS) delete process.env[key];
  process.env.JWT_ACCESS_SECRET = 'test-secret';
  process.env.GEMINI_API_KEY = 'test-gemini-key';
  process.env.OLLAMA_API_KEY = 'test-ollama-key';
}
