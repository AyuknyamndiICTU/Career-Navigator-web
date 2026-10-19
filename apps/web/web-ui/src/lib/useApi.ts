'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from './auth';
import { shareRequest } from './inflight';

// Identical GETs issued while one is pending share a single request.
function sharedGet(path: string): { promise: Promise<unknown>; release: () => void } {
  return shareRequest(path, (signal) => apiFetch(path, { method: 'GET', signal }));
}

function isAbort(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'AbortError';
}

const FOCUS_THROTTLE_MS = 5_000;

export type UseApiResult<T> = {
  data: T | undefined;
  error: string;
  loading: boolean;
  /** Re-fetches; keeps the current data visible until the new response arrives. */
  reload: () => Promise<void>;
  /** Local optimistic update. */
  mutate: (update: T | ((prev: T | undefined) => T | undefined)) => void;
};

/**
 * GET `path` (skipped while `path` is null). Dedupes concurrent identical requests,
 * aborts on unmount or when `path` changes, and revalidates when the tab regains focus.
 */
export function useApi<T = unknown>(
  path: string | null,
  options: { revalidateOnFocus?: boolean; errorMessage?: string } = {},
): UseApiResult<T> {
  const { revalidateOnFocus = true, errorMessage = 'Failed to load data' } = options;
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(path !== null);
  const releaseRef = useRef<(() => void) | null>(null);
  const lastFetchRef = useRef(0);

  const run = useCallback(async () => {
    if (path === null) return;
    const previous = releaseRef.current;
    const { promise, release } = sharedGet(path);
    releaseRef.current = release;
    previous?.();
    lastFetchRef.current = Date.now();
    setLoading(true);
    setError('');
    try {
      const res = (await promise) as T;
      if (releaseRef.current !== release) return;
      setData(res);
    } catch (e) {
      if (releaseRef.current !== release || isAbort(e)) return;
      setError(e instanceof Error ? e.message : errorMessage);
    } finally {
      if (releaseRef.current === release) {
        releaseRef.current = null;
        setLoading(false);
      }
    }
  }, [path, errorMessage]);

  useEffect(() => {
    if (path === null) return;
    void run();
    return () => {
      const release = releaseRef.current;
      releaseRef.current = null;
      release?.();
    };
  }, [path, run]);

  useEffect(() => {
    if (!revalidateOnFocus || path === null) return;
    const onFocus = () => {
      if (document.visibilityState !== 'visible') return;
      if (releaseRef.current || Date.now() - lastFetchRef.current < FOCUS_THROTTLE_MS) return;
      void run();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [revalidateOnFocus, path, run]);

  const mutate = useCallback<UseApiResult<T>['mutate']>((update) => {
    setData((prev) =>
      typeof update === 'function'
        ? (update as (p: T | undefined) => T | undefined)(prev)
        : update,
    );
  }, []);

  return { data, error, loading: path !== null && loading, reload: run, mutate };
}
