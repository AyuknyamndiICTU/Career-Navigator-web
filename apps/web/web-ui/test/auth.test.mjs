// Regression tests for plan item 10.1 (refresh-token race). Run with `npm test` (Node's test runner;
// Node >= 22.18 strips the TypeScript types of the imported module).
import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { apiFetch, ensureAccessToken, setAccessToken } from '../src/lib/auth.ts';

const API = '/api';

function fakeJwt(expiresInSeconds) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  return `${encode({ alg: 'HS256' })}.${encode({ sub: 'user-1', exp })}.signature`;
}

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('auth client refresh', () => {
  const realFetch = globalThis.fetch;
  let calls;

  beforeEach(() => {
    calls = [];
    setAccessToken(null);
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  function mockApi(handler) {
    globalThis.fetch = async (url, init = {}) => {
      const path = String(url).replace(API, '');
      const authorization = new Headers(init.headers).get('authorization');
      calls.push({ path, authorization });
      // Let concurrent callers pile up before answering, like a real network round-trip.
      await new Promise((resolve) => setTimeout(resolve, 10));
      return handler(path, authorization);
    };
  }

  it('shares one refresh between parallel requests', async () => {
    const token = fakeJwt(900);
    mockApi((path) =>
      path === '/auth/refresh' ? json(200, { accessToken: token }) : json(200, { ok: true }),
    );

    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) => apiFetch(`/profile/item-${i}`)),
    );

    assert.equal(calls.filter((c) => c.path === '/auth/refresh').length, 1);
    assert.equal(results.length, 5);
    for (const call of calls.filter((c) => c.path !== '/auth/refresh')) {
      assert.equal(call.authorization, `Bearer ${token}`);
    }
  });

  it('refreshes an expiring token once and retries after a 401', async () => {
    setAccessToken(fakeJwt(900));
    const fresh = fakeJwt(1800);
    let rejected = 0;
    mockApi((path, authorization) => {
      if (path === '/auth/refresh') return json(200, { accessToken: fresh });
      if (authorization !== `Bearer ${fresh}`) {
        rejected += 1;
        return json(401, { message: 'Invalid or expired access token' });
      }
      return json(200, { ok: true });
    });

    const results = await Promise.all([apiFetch('/a'), apiFetch('/b'), apiFetch('/c')]);

    assert.deepEqual(results, [{ ok: true }, { ok: true }, { ok: true }]);
    assert.equal(rejected, 3);
    assert.equal(calls.filter((c) => c.path === '/auth/refresh').length, 1);
  });

  it('reports no session when the refresh cookie is rejected', async () => {
    mockApi(() => json(401, { message: 'Invalid refresh token' }));

    assert.equal(await ensureAccessToken(), null);
    assert.equal(calls.length, 1);
  });
});
