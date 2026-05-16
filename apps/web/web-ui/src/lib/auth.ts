 // @ts-nocheck
/* eslint-disable no-undef */

// Token helpers for the web client

export const ACCESS_TOKEN_KEY = 'accessToken';
export const REFRESH_TOKEN_KEY = 'refreshToken';

function getApiBaseUrl() {
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
export async function apiFetch(path, init = {}) {
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...authHeaders(),
    },
    body: init.body ? JSON.stringify(init.body) : init.body,
  });

  if (!res.ok) {
    // NestJS usually responds with JSON like: { statusCode, message, error }
    // We want a clean, user-friendly message.
    let errorText = '';
    let status = res.status;

    try {
      const body = await res.json().catch(() => null);

      if (body) {
        const msg = body.message ?? body.error ?? '';
        const readable =
          Array.isArray(msg) ? msg.join(', ') : typeof msg === 'string' ? msg : '';
        throw new Error(readable || `Request failed: ${status}`);
      }
    } catch {
      // Fall back to raw text if JSON parsing fails
      errorText = await res.text().catch(() => '');
      throw new Error(errorText || `Request failed: ${status}`);
    }

    throw new Error(errorText || `Request failed: ${status}`);
  }

  return res.json();
}
