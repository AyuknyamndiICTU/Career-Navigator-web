import { ProviderError } from './types';

const DAILY_QUOTA_HINT = /per[\s_-]?day|perday|daily/i;

/** Seconds from `Retry-After`, or Gemini's `"retryDelay": "17s"` in the error body. */
function parseRetryAfterMs(res: Response, body: string): number | undefined {
  const raw = res.headers.get('retry-after');
  const header = raw === null || raw.trim() === '' ? NaN : Number(raw);
  if (Number.isFinite(header) && header >= 0) return header * 1000;

  const match = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/.exec(body);
  return match ? Math.ceil(Number(match[1]) * 1000) : undefined;
}

export async function toProviderError(
  res: Response,
  provider: string,
): Promise<ProviderError> {
  const body = await res.text().catch(() => '');
  const detail = `${provider} returned HTTP ${res.status}`;
  const status = res.status;

  if (status === 429) {
    const kind = DAILY_QUOTA_HINT.test(body) ? 'daily-quota' : 'rate-limit';
    return new ProviderError(
      kind,
      detail,
      status,
      parseRetryAfterMs(res, body),
    );
  }
  if (status === 401 || status === 403)
    return new ProviderError('auth', detail, status);
  // Gemini reports an invalid key as 400 INVALID_ARGUMENT.
  if (status === 400 && /API_KEY_INVALID|API key not valid/i.test(body)) {
    return new ProviderError('auth', detail, status);
  }
  if (status === 402) return new ProviderError('payment', detail, status);
  if (status === 408 || status >= 500)
    return new ProviderError('server', detail, status);
  return new ProviderError(
    'bad-request',
    `${detail}: ${body.slice(0, 200)}`,
    status,
  );
}

/** Maps fetch/abort failures; HTTP errors are already ProviderErrors. */
export function toNetworkError(
  err: unknown,
  signal: AbortSignal,
): ProviderError {
  if (err instanceof ProviderError) return err;
  if (signal.aborted) {
    const reason: unknown = signal.reason;
    const message =
      reason instanceof Error ? reason.message : 'Request timed out';
    return new ProviderError('timeout', message);
  }
  return new ProviderError(
    'network',
    err instanceof Error ? err.message : String(err),
  );
}

export async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  signal: AbortSignal,
  provider: string,
): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    throw toNetworkError(err, signal);
  }
  if (!res.ok) throw await toProviderError(res, provider);
  return res;
}

export async function getJson<T>(
  url: string,
  headers: Record<string, string>,
  signal: AbortSignal,
  provider: string,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { headers, signal });
  } catch (err) {
    throw toNetworkError(err, signal);
  }
  if (!res.ok) throw await toProviderError(res, provider);
  return (await res.json()) as T;
}

/** Yields the `data:` payload of each Server-Sent Event in a streaming response body. */
export async function* readSse(
  res: Response,
  signal: AbortSignal,
): AsyncGenerator<{ event?: string; data: string }> {
  if (!res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let event: string | undefined;
  let data: string[] = [];
  let finished = false;

  try {
    for (;;) {
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await reader.read();
      } catch (err) {
        throw toNetworkError(err, signal);
      }
      if (chunk.done) {
        finished = true;
        break;
      }
      buffer += decoder.decode(chunk.value, { stream: true });

      let newline: number;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newline).replace(/\r$/, '');
        buffer = buffer.slice(newline + 1);

        if (line === '') {
          if (data.length > 0) yield { event, data: data.join('\n') };
          event = undefined;
          data = [];
        } else if (line.startsWith('data:')) {
          data.push(line.slice(5).trimStart());
        } else if (line.startsWith('event:')) {
          event = line.slice(6).trim();
        }
      }
    }
    if (data.length > 0) yield { event, data: data.join('\n') };
  } finally {
    // Stop the upstream generation when the consumer stops early (client left, fallback, error).
    if (!finished) await reader.cancel().catch(() => undefined);
    else reader.releaseLock();
  }
}
