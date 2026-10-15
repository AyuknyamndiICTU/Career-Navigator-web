// Browser auth client: the access token lives in memory only; the refresh token is an
// httpOnly cookie set by the API, so scripts can never read it.

const REFRESH_LOCK = 'cn-auth-refresh';
const EXPIRY_SKEW_MS = 30_000;
const PUBLIC_AUTH_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/verify-otp',
  '/auth/password-reset/',
  '/auth/refresh',
  '/auth/logout',
];

let accessToken: string | null = null;
let refreshInFlight: Promise<boolean> | null = null;

if (typeof window !== 'undefined') {
  // Older builds kept both tokens in localStorage; remove any leftovers.
  window.localStorage.removeItem('accessToken');
  window.localStorage.removeItem('refreshToken');
}

export function getApiBaseUrl(): string {
  const value =
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    'http://localhost:3001/api';

  return value.replace(/\/+$/, '');
}

export function getSocketUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SOCKET_URL;
  if (explicit) return explicit.replace(/\/+$/, '');

  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
  return new URL(getApiBaseUrl(), origin).origin;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

function isPublicAuthPath(path: string): boolean {
  return PUBLIC_AUTH_PATHS.some((p) => path.startsWith(p));
}

function expiresSoon(token: string): boolean {
  try {
    const payload = JSON.parse(
      atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')),
    ) as { exp?: number };
    return (
      typeof payload.exp !== 'number' ||
      payload.exp * 1000 - EXPIRY_SKEW_MS <= Date.now()
    );
  } catch {
    return true;
  }
}

async function requestRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });

    if (!res.ok) {
      accessToken = null;
      return false;
    }

    const body = (await res.json()) as { accessToken?: string };
    accessToken = body.accessToken ?? null;
    return accessToken !== null;
  } catch {
    return false;
  }
}

// The API revokes every session when a rotated refresh token is reused, so concurrent
// 401s in this tab share one request and other tabs wait on a Web Lock.
function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
    const run = locks
      ? locks.request(REFRESH_LOCK, requestRefresh).then((ok) => ok)
      : requestRefresh();

    refreshInFlight = run.finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

export async function ensureAccessToken(): Promise<string | null> {
  if (accessToken && !expiresSoon(accessToken)) return accessToken;
  return (await refreshSession()) ? accessToken : null;
}

export async function logout(): Promise<void> {
  await fetch(`${getApiBaseUrl()}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  }).catch(() => undefined);
  accessToken = null;
}

type ApiFetchInit = Omit<RequestInit, 'body'> & { body?: unknown };
type ApiFetchOptions = { redirectOn401?: boolean };

function send(path: string, init: RequestInit): Promise<Response> {
  const headers = new Headers(init.headers);
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  return fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });
}

async function authorizedFetch(
  path: string,
  init: RequestInit,
  options?: ApiFetchOptions,
): Promise<any> {
  const publicPath = isPublicAuthPath(path);
  let refreshed = false;

  if (!publicPath && (!accessToken || expiresSoon(accessToken))) {
    refreshed = true;
    await refreshSession();
  }

  let res = await send(path, init);

  if (res.status === 401 && !publicPath && !refreshed && (await refreshSession())) {
    res = await send(path, init);
  }

  return handleResponse(res, path, options?.redirectOn401);
}

export function apiFetch(
  path: string,
  init: ApiFetchInit = {},
  options?: ApiFetchOptions,
): Promise<any> {
  const { body, headers, ...rest } = init;
  const finalHeaders = new Headers(headers);
  if (body !== undefined) finalHeaders.set('content-type', 'application/json');

  return authorizedFetch(
    path,
    {
      ...rest,
      headers: finalHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    },
    options,
  );
}

export function apiFetchFile(
  path: string,
  formData: FormData,
  options?: ApiFetchOptions,
): Promise<any> {
  return authorizedFetch(path, { method: 'POST', body: formData }, options);
}

export type StreamHandler = (event: string, data: any) => void;

/**
 * POSTs JSON and reads a Server-Sent Events response, calling `onEvent` per event.
 * Errors before the stream starts (401/429/503) throw like apiFetch; an `error` event mid-stream
 * is passed to `onEvent`. Abort with `signal` to stop generation server-side too.
 */
export async function apiStream(
  path: string,
  body: unknown,
  onEvent: StreamHandler,
  signal?: AbortSignal,
): Promise<void> {
  const init: RequestInit = {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
    body: JSON.stringify(body),
    signal,
  };

  if (!accessToken || expiresSoon(accessToken)) await refreshSession();
  let res = await send(path, init);
  if (res.status === 401 && (await refreshSession())) res = await send(path, init);

  if (!res.ok || !res.body || !res.headers.get('content-type')?.includes('text/event-stream')) {
    await handleResponse(res, path);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary: number;
    while ((boundary = buffer.indexOf('\n\n')) >= 0) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const event = /^event: (.*)$/m.exec(block)?.[1] ?? 'message';
      const data = /^data: (.*)$/m.exec(block)?.[1];
      if (data !== undefined) onEvent(event, JSON.parse(data));
    }
  }
}

async function handleResponse(
  res: Response,
  path: string,
  redirectOn401?: boolean,
): Promise<any> {
  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }

  if (res.ok) return body;

  const msg = body?.message ?? body?.error ?? '';
  const readable = Array.isArray(msg)
    ? msg.join(', ')
    : typeof msg === 'string'
      ? msg
      : '';
  const message =
    readable ||
    text ||
    (res.status === 401 ? 'Unauthorized' : `Request failed: ${res.status}`);

  if (res.status === 401 && typeof window !== 'undefined' && !isPublicAuthPath(path)) {
    accessToken = null;
    if (redirectOn401 !== false) {
      window.location.href = '/auth/login';
      throw new Error('');
    }
  }

  throw new Error(message);
}
