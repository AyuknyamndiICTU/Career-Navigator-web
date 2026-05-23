 // @ts-nocheck
/* eslint-disable no-undef */

// Token helpers for the web client

export const ACCESS_TOKEN_KEY = 'accessToken';
export const REFRESH_TOKEN_KEY = 'refreshToken';

export function getApiBaseUrl() {
  const v =
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    'http://localhost:3000';

  return String(v).replace(/\/+$/, '');
}

/** @returns {string|null} */
export function getAccessToken() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

/** @param {{accessToken: string, refreshToken: string}} tokens */
export function setTokens(tokens) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  window.localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

export function clearTokens() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
}

/** @returns {Record<string, string>} */
export function authHeaders() {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * @template T
 * @param {string} path
 * @param {any} [init]
 * @returns {Promise<T>}
 */
export async function apiFetch(
  path,
  init = {},
  options?: { redirectOn401?: boolean },
) {
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...authHeaders(),
    },
    body: init.body ? JSON.stringify(init.body) : init.body,
  });
  return handleResponse(res, options?.redirectOn401);
}

export async function apiFetchFile(
  path: string,
  formData: FormData,
  options?: { redirectOn401?: boolean },
) {
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  });


  return handleResponse(res, options?.redirectOn401);
}

async function handleResponse(res: Response, redirectOn401?: boolean) {
  if (!res.ok) {
    const status = res.status;

    let body: any = null;
    try {
      body = await res.json();
    } catch {
      // ignore
    }

    const msg = body?.message ?? body?.error ?? '';
    const readable = Array.isArray(msg)
      ? msg.join(', ')
      : typeof msg === 'string'
      ? msg
      : '';

    let errorText = '';
    try {
      errorText = await res.text();
    } catch {
      errorText = '';
    }

    const messageToThrow =
      readable || errorText || (status === 401 ? 'Unauthorized' : `Request failed: ${status}`);

    if (
      status === 401 &&
      typeof window !== 'undefined' &&
      redirectOn401 !== false
    ) {
      clearTokens();
      window.location.href = '/auth/login';
      throw new Error('');
    }

    if (status === 401 && typeof window !== 'undefined') {
      clearTokens();
    }

    throw new Error(messageToThrow);
  }

  return res.json();
}
