// Tests for the request sharing behind useApi (plan item 13.9). Run with `npm test`.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { shareRequest } from '../src/lib/inflight.ts';

const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

function deferredRequest() {
  const calls = [];
  const start = (signal) => {
    const call = { signal };
    calls.push(call);
    return new Promise((resolve, reject) => {
      call.resolve = resolve;
      signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    });
  };
  return { calls, start };
}

describe('shareRequest', () => {
  it('shares one request between concurrent callers', async () => {
    const { calls, start } = deferredRequest();
    const a = shareRequest('/dedupe', start);
    const b = shareRequest('/dedupe', start);
    assert.equal(calls.length, 1);
    calls[0].resolve({ ok: 1 });
    assert.deepEqual(await a.promise, { ok: 1 });
    assert.deepEqual(await b.promise, { ok: 1 });

    // Settled requests are not cached: the next caller fetches again.
    const c = shareRequest('/dedupe', start);
    assert.equal(calls.length, 2);
    calls[1].resolve(null);
    await c.promise;
  });

  it('aborts only after the last caller releases', async () => {
    const { calls, start } = deferredRequest();
    const a = shareRequest('/abort', start);
    const b = shareRequest('/abort', start);
    a.promise.catch(() => {});
    a.release();
    await tick();
    assert.equal(calls[0].signal.aborted, false);
    b.release();
    await tick();
    assert.equal(calls[0].signal.aborted, true);
    await assert.rejects(b.promise, { name: 'AbortError' });
  });

  it('reuses the request when a caller re-subscribes in the same tick', async () => {
    const { calls, start } = deferredRequest();
    const first = shareRequest('/remount', start);
    first.release();
    const second = shareRequest('/remount', start);
    await tick();
    assert.equal(calls.length, 1);
    assert.equal(calls[0].signal.aborted, false);
    calls[0].resolve('done');
    assert.equal(await second.promise, 'done');
  });
});
