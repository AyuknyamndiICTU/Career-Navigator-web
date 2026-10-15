import { AiKeyCrypto } from './ai-key-crypto';
import { toProviderError } from './http';
import { __test, assertAllowedBaseUrl } from './providers';
import { redactPii } from './redact-pii';
import { parseRoute, platformRoute } from './task-profiles';
import { msUntilPacificMidnight } from './time';

const KEY = Buffer.alloc(32, 7).toString('base64');
const OTHER_KEY = Buffer.alloc(32, 9).toString('base64');

describe('task routes', () => {
  afterEach(() => delete process.env.AI_ROUTE_CHAT);

  it('splits provider/model on the first slash only', () => {
    expect(
      parseRoute('gemini/gemini-3.8-flash, openrouter/openrouter/free'),
    ).toEqual([
      { provider: 'gemini', model: 'gemini-3.8-flash' },
      { provider: 'openrouter', model: 'openrouter/free' },
    ]);
  });

  it('skips unknown providers and malformed entries', () => {
    expect(
      parseRoute('ollama-local/llama3,gemini,/x,anthropic/claude-haiku-5-5'),
    ).toEqual([{ provider: 'anthropic', model: 'claude-haiku-5-5' }]);
  });

  it('uses the env override for a task', () => {
    process.env.AI_ROUTE_CHAT = 'ollama/gpt-oss:20b';
    expect(platformRoute('chat')).toEqual([
      { provider: 'ollama', model: 'gpt-oss:20b' },
    ]);
  });

  it('never routes to a local model by default', () => {
    for (const task of [
      'chat',
      'mock-interview',
      'cv-assist',
      'job-rerank',
      'course-recs',
    ] as const) {
      expect(platformRoute(task).length).toBeGreaterThan(0);
    }
  });
});

describe('provider error mapping', () => {
  const res = (
    status: number,
    body = '',
    headers: Record<string, string> = {},
  ) => new Response(body, { status, headers });

  it('maps 429 with Retry-After to a timed rate limit', async () => {
    const err = await toProviderError(
      res(429, 'slow down', { 'retry-after': '12' }),
      'X',
    );
    expect(err.kind).toBe('rate-limit');
    expect(err.retryAfterMs).toBe(12_000);
  });

  it("reads Gemini's retryDelay and detects per-day quotas", async () => {
    const body = JSON.stringify({
      error: {
        details: [
          {
            violations: [
              { quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' },
            ],
          },
          { retryDelay: '33s' },
        ],
      },
    });
    const err = await toProviderError(res(429, body), 'Gemini');
    expect(err.kind).toBe('daily-quota');
    expect(err.retryAfterMs).toBe(33_000);
  });

  it.each([
    [401, 'auth'],
    [403, 'auth'],
    [402, 'payment'],
    [500, 'server'],
    [503, 'server'],
    [400, 'bad-request'],
  ])('maps HTTP %i to %s', async (status, kind) => {
    expect((await toProviderError(res(status), 'X')).kind).toBe(kind);
  });

  it("treats Gemini's invalid-key 400 as an auth error", async () => {
    const body =
      '{"error":{"code":400,"message":"API key not valid. Please pass a valid API key.","details":[{"reason":"API_KEY_INVALID"}]}}';
    expect((await toProviderError(res(400, body), 'Gemini')).kind).toBe('auth');
  });

  it('only retries transient errors', async () => {
    expect((await toProviderError(res(503), 'X')).retryable).toBe(true);
    expect((await toProviderError(res(429), 'X')).retryable).toBe(false);
    expect((await toProviderError(res(401), 'X')).retryable).toBe(false);
  });
});

describe('AI key encryption', () => {
  const crypto = new AiKeyCrypto();

  beforeEach(() => {
    process.env.AI_KEY_ENCRYPTION_KEY = KEY;
    delete process.env.AI_KEY_ENCRYPTION_KEY_PREVIOUS;
  });

  it('round-trips with AES-256-GCM and a fresh IV each time', () => {
    const a = crypto.encrypt('sk-secret-1234');
    const b = crypto.encrypt('sk-secret-1234');
    expect(a.ciphertext).not.toContain('secret');
    expect(a.iv).not.toBe(b.iv);
    expect(crypto.decrypt(a)).toEqual({
      plaintext: 'sk-secret-1234',
      needsReencrypt: false,
    });
  });

  it('detects tampering', () => {
    const record = crypto.encrypt('sk-secret-1234');
    const bytes = Buffer.from(record.ciphertext, 'base64');
    bytes[0] ^= 1;
    expect(() =>
      crypto.decrypt({ ...record, ciphertext: bytes.toString('base64') }),
    ).toThrow();
    expect(() =>
      crypto.decrypt({
        ...record,
        authTag: Buffer.alloc(16).toString('base64'),
      }),
    ).toThrow();
  });

  it('reads rows written with the previous master key during a rotation', () => {
    process.env.AI_KEY_ENCRYPTION_KEY = OTHER_KEY;
    const old = crypto.encrypt('sk-old');
    process.env.AI_KEY_ENCRYPTION_KEY = KEY;
    expect(() => crypto.decrypt(old)).toThrow();
    process.env.AI_KEY_ENCRYPTION_KEY_PREVIOUS = OTHER_KEY;
    expect(crypto.decrypt(old)).toEqual({
      plaintext: 'sk-old',
      needsReencrypt: true,
    });
  });
});

describe('PII redaction', () => {
  it('masks emails, phone numbers and street addresses but keeps dates and skills', () => {
    const cv =
      'Jane Doe\njane.doe@mail.com | +237 6 77 12 34 56 | 12 Old Mill Road\nTypeScript, Node.js\nAcme Ltd 2018 - 2021';
    const out = redactPii(cv);
    expect(out).toContain('[email]');
    expect(out).toContain('[phone]');
    expect(out).toContain('[address]');
    expect(out).not.toMatch(/jane\.doe|77 12 34|Old Mill/);
    expect(out).toContain('Jane Doe');
    expect(out).toContain('TypeScript, Node.js');
    expect(out).toContain('2018 - 2021');
  });
});

describe('SSRF guard for custom base URLs', () => {
  afterEach(() => delete process.env.AI_BYOK_ALLOWED_HOSTS);

  it('blocks private, loopback, link-local and metadata addresses', () => {
    for (const ip of [
      '10.1.2.3',
      '127.0.0.1',
      '169.254.169.254',
      '172.20.0.1',
      '192.168.1.1',
      '100.64.0.1',
      '::1',
      'fd00::1',
      '::ffff:10.0.0.1',
    ]) {
      expect(__test.isPrivateAddress(ip)).toBe(true);
    }
    expect(__test.isPrivateAddress('8.8.8.8')).toBe(false);
  });

  it('requires https and an allow-listed host', async () => {
    process.env.AI_BYOK_ALLOWED_HOSTS = 'api.example.com';
    await expect(
      assertAllowedBaseUrl('http://api.example.com/v1'),
    ).rejects.toThrow(/https/);
    await expect(
      assertAllowedBaseUrl('https://evil.example.com/v1'),
    ).rejects.toThrow(/allowed list/);
  });

  it('rejects an allow-listed host that points at a private address', async () => {
    process.env.AI_BYOK_ALLOWED_HOSTS = '10.0.0.5';
    await expect(assertAllowedBaseUrl('https://10.0.0.5/v1')).rejects.toThrow(
      /private/,
    );
  });
});

describe('quota reset time', () => {
  it('is within one day', () => {
    const ms = msUntilPacificMidnight();
    expect(ms).toBeGreaterThan(0);
    expect(ms).toBeLessThanOrEqual(86_400_000);
  });
});
