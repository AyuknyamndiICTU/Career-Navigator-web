type InFlight = { promise: Promise<unknown>; controller: AbortController; refs: number };

const inFlight = new Map<string, InFlight>();

/**
 * Callers asking for the same `key` while a request is pending share one request.
 * Each caller must `release()` when it no longer needs the result; the request is aborted
 * once every caller has released it (deferred one tick so an immediate re-subscribe,
 * e.g. a React StrictMode remount, reuses it).
 */
export function shareRequest<T>(
  key: string,
  start: (signal: AbortSignal) => Promise<T>,
): { promise: Promise<T>; release: () => void } {
  let entry = inFlight.get(key);
  if (entry) {
    entry.refs += 1;
  } else {
    const controller = new AbortController();
    const created: InFlight = { controller, refs: 1, promise: Promise.resolve() };
    created.promise = start(controller.signal).finally(() => {
      if (inFlight.get(key) === created) inFlight.delete(key);
    });
    entry = created;
    inFlight.set(key, entry);
  }

  const current = entry;
  let released = false;
  return {
    promise: current.promise as Promise<T>,
    release: () => {
      if (released) return;
      released = true;
      current.refs -= 1;
      if (current.refs > 0) return;
      setTimeout(() => {
        if (current.refs <= 0 && inFlight.get(key) === current) {
          inFlight.delete(key);
          current.controller.abort();
        }
      }, 0);
    },
  };
}
