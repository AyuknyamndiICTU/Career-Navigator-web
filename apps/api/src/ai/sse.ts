import type { Response } from 'express';

type SseEvent = { type: string } & Record<string, unknown>;

/**
 * Streams events as Server-Sent Events (`event: <type>` + JSON `data`). The first event is awaited
 * before any header is written, so quota/availability errors still return a normal JSON error.
 * A closed connection aborts the upstream AI call through the signal.
 */
export async function sendSse(
  res: Response,
  start: (signal: AbortSignal) => AsyncGenerator<SseEvent>,
  map: (event: SseEvent) => SseEvent | null = (e) => e,
): Promise<void> {
  const abort = new AbortController();
  // `res` 'close' (not `req`) fires when the client disconnects or the response ends.
  res.on('close', () => {
    if (!res.writableEnded) abort.abort();
  });

  const events = start(abort.signal);
  const first = await events.next();

  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  // Stops nginx-style proxies from buffering the stream.
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const write = (event: SseEvent) => {
    const mapped = map(event);
    if (!mapped || res.writableEnded) return;
    const { type, ...data } = mapped;
    res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    if (!first.done) write(first.value);
    // The generator is its own iterator, so this continues after the first event.
    for await (const event of events) {
      write(event);
    }
  } catch (err) {
    const status = (err as { getStatus?: () => number }).getStatus?.() ?? 500;
    const message =
      status < 500 || status === 503
        ? (err as Error).message
        : 'Something went wrong while generating the answer.';
    write({ type: 'error', statusCode: status, message });
  } finally {
    if (!res.writableEnded) res.end();
  }
}
