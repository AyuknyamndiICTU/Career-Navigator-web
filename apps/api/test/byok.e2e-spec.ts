import { INestApplication, Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'node:crypto';
import {
  describe,
  beforeEach,
  afterEach,
  it,
  expect,
  jest,
} from '@jest/globals';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { signAccessToken } from '../src/auth/jwt/jwt-utils';
import {
  failure,
  geminiJson,
  json,
  mockFetch,
  openAiJson,
  resetAiEnv,
} from './ai-fixtures';

const USER = 'byok-user';
const OTHER_USER = 'someone-else';
const OWN_KEY = 'sk-or-v1-supersecretvalue-9876';
const OPENROUTER = 'https://openrouter.ai/api/v1';

/** In-memory stand-in for the Prisma models the BYOK flow touches. */
function fakePrisma() {
  const users = new Map<string, any>([
    [USER, { id: USER, role: 'USER', aiFallbackToPlatform: true }],
    [OTHER_USER, { id: OTHER_USER, role: 'USER', aiFallbackToPlatform: true }],
  ]);
  const credentials: any[] = [];
  const preferences: any[] = [];

  return {
    credentials,
    preferences,
    users,
    user: {
      findUnique: jest.fn(
        async ({ where }: any) => users.get(where.id) ?? null,
      ),
      update: jest.fn(async ({ where, data }: any) =>
        Object.assign(users.get(where.id), data),
      ),
    },
    userAiCredential: {
      count: jest.fn(
        async ({ where }: any) =>
          credentials.filter(
            (c) =>
              c.userId === where.userId &&
              (!where.status || c.status === where.status),
          ).length,
      ),
      create: jest.fn(async ({ data }: any) => {
        const row = {
          id: randomUUID(),
          status: 'ACTIVE',
          statusReason: null,
          baseUrl: null,
          monthlyBudgetUsd: null,
          lastValidatedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        credentials.push(row);
        return row;
      }),
      findFirst: jest.fn(
        async ({ where }: any) =>
          credentials.find(
            (c) => c.id === where.id && c.userId === where.userId,
          ) ?? null,
      ),
      findMany: jest.fn(async ({ where }: any) =>
        credentials.filter((c) => !where?.userId || c.userId === where.userId),
      ),
      update: jest.fn(async ({ where, data }: any) =>
        Object.assign(
          credentials.find((c) => c.id === where.id),
          data,
        ),
      ),
      deleteMany: jest.fn(async ({ where }: any) => {
        const doomed = credentials.filter(
          (c) => c.userId === where.userId && (!where.id || c.id === where.id),
        );
        for (const c of doomed) {
          credentials.splice(credentials.indexOf(c), 1);
          for (const p of preferences.filter((x) => x.credentialId === c.id)) {
            preferences.splice(preferences.indexOf(p), 1);
          }
        }
        return { count: doomed.length };
      }),
    },
    userAiPreference: {
      findUnique: jest.fn(async ({ where }: any) => {
        const { userId, task } = where.userId_task;
        const pref = preferences.find(
          (p) => p.userId === userId && p.task === task,
        );
        return pref
          ? {
              ...pref,
              credential: credentials.find((c) => c.id === pref.credentialId),
            }
          : null;
      }),
      findMany: jest.fn(async ({ where }: any) =>
        preferences.filter((p) => p.userId === where.userId),
      ),
      deleteMany: jest.fn(async ({ where }: any) => {
        const doomed = preferences.filter(
          (p) => p.userId === where.userId && p.task === where.task,
        );
        for (const p of doomed) preferences.splice(preferences.indexOf(p), 1);
        return { count: doomed.length };
      }),
      upsert: jest.fn(async ({ where, create, update }: any) => {
        const { userId, task } = where.userId_task;
        const existing = preferences.find(
          (p) => p.userId === userId && p.task === task,
        );
        if (existing) return Object.assign(existing, update);
        const row = { id: randomUUID(), ...create };
        preferences.push(row);
        return row;
      }),
    },
    notification: { create: jest.fn(async () => ({})) },
    aiUsageEvent: { createMany: jest.fn(async () => ({ count: 0 })) },
    aiModelPrice: { findMany: jest.fn(async () => []) },
    jobApplication: {
      findMany: jest.fn(async () => [{ job: { skills: ['node'] } }]),
    },
  };
}

describe('Bring your own AI key (Phase 12.14-12.24)', () => {
  let app: INestApplication<App>;
  let prisma: ReturnType<typeof fakePrisma>;
  let output: string;
  const writes: jest.SpiedFunction<any>[] = [];

  const auth = (userId = USER) =>
    `Bearer ${signAccessToken({ secret: 'test-secret', expiresIn: '15m', userId, email: `${userId}@x.io`, isActive: true })}`;

  const http = () => request(app.getHttpServer());

  /** Provider fakes: OpenRouter accepts only OWN_KEY; Gemini is the platform fallback. */
  function providers(overrides: { ownChat?: () => Response } = {}) {
    return mockFetch(({ url, headers }) => {
      if (url.startsWith(OPENROUTER)) {
        if (headers.get('authorization') !== `Bearer ${OWN_KEY}`)
          return failure(401, 'bad key');
        if (url.endsWith('/models')) {
          return json({
            data: [
              { id: 'openai/gpt-5.4-nano' },
              { id: 'meta-llama/llama-4:free' },
            ],
          });
        }
        if (url.endsWith('/key')) {
          return json({
            data: {
              usage: 1.5,
              limit: 10,
              limit_remaining: 8.5,
              is_free_tier: false,
            },
          });
        }
        return (
          overrides.ownChat?.() ??
          openAiJson('Own key: Node.js roadmap.', {
            prompt_tokens: 50,
            completion_tokens: 10,
            cost: 0.0021,
          })
        );
      }
      return geminiJson('Platform: Node.js roadmap.');
    });
  }

  const addKey = (body: Record<string, unknown> = {}) =>
    http()
      .post('/ai/credentials')
      .set('authorization', auth())
      .send({
        provider: 'OPENROUTER',
        apiKey: OWN_KEY,
        label: 'My OpenRouter',
        tier: 'PAID',
        ...body,
      });

  const useKeyForChat = (credentialId: string) =>
    http()
      .put('/ai/preferences')
      .set('authorization', auth())
      .send({
        tasks: [{ task: 'chat', credentialId, model: 'openai/gpt-5.4-nano' }],
      })
      .expect(200);

  const chat = () =>
    http()
      .post('/ai/chat')
      .set('authorization', auth())
      .send({ message: 'Plan my Node.js year' });

  beforeEach(async () => {
    resetAiEnv();
    process.env.AI_BYOK_ENABLED = 'true';
    process.env.AI_KEY_ENCRYPTION_KEY = Buffer.alloc(32, 3).toString('base64');
    prisma = fakePrisma();

    output = '';
    // Nest's testing logger hides non-error output, so capture logger calls and raw writes.
    for (const method of ['log', 'warn', 'error', 'debug'] as const) {
      writes.push(
        jest
          .spyOn(Logger.prototype, method)
          .mockImplementation((...args: unknown[]) => {
            output += `${args.map(String).join(' ')}\n`;
          }),
      );
    }
    for (const stream of [process.stdout, process.stderr]) {
      writes.push(
        jest.spyOn(stream, 'write').mockImplementation((chunk: any) => {
          output += String(chunk);
          return true;
        }),
      );
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    writes.splice(0).forEach((spy) => spy.mockRestore());
  });

  it('a new user chats on the free platform AI with no setup', async () => {
    providers();
    const res = await chat().expect(201);
    expect(res.body.ai).toMatchObject({ provider: 'gemini', viaOwnKey: false });
  });

  it('validates and stores a key encrypted, and never returns or logs it', async () => {
    const calls = providers();
    const res = await addKey().expect(201);

    expect(res.body).toMatchObject({
      provider: 'OPENROUTER',
      keyPreview: '••••9876',
      tier: 'PAID',
      status: 'ACTIVE',
    });
    expect(calls[0].url).toBe(`${OPENROUTER}/models`);

    const stored = prisma.credentials[0];
    expect(stored.ciphertext).toBeDefined();
    expect(JSON.stringify(stored)).not.toContain(OWN_KEY);

    const list = await http()
      .get('/ai/credentials')
      .set('authorization', auth())
      .expect(200);
    for (const body of [res.body, list.body]) {
      const text = JSON.stringify(body);
      expect(text).not.toContain(OWN_KEY);
      expect(text).not.toContain('ciphertext');
    }
    expect(output).not.toContain(OWN_KEY);
    expect(output).toContain('credential.create');
  });

  it('rejects a key the provider refuses', async () => {
    providers();
    const res = await addKey({ apiKey: 'sk-or-v1-wrong-key-0000' }).expect(400);
    expect(res.body.message).toMatch(/rejected this key/);
    expect(prisma.credentials).toHaveLength(0);
  });

  it('lists models (free ones tagged) and reports the live OpenRouter balance', async () => {
    providers();
    const { body: key } = await addKey().expect(201);

    const models = await http()
      .get(`/ai/credentials/${key.id}/models`)
      .set('authorization', auth())
      .expect(200);
    expect(models.body).toEqual([
      { id: 'meta-llama/llama-4:free', free: true },
      { id: 'openai/gpt-5.4-nano', free: false },
    ]);

    const test = await http()
      .post(`/ai/credentials/${key.id}/test`)
      .set('authorization', auth())
      .expect(200);
    expect(test.body).toMatchObject({
      ok: true,
      keyInfo: { remainingUsd: 8.5 },
    });
  });

  it("runs the chosen feature on the user's key, with provider-reported cost and no platform allowance used", async () => {
    process.env.AI_USER_DAILY_LIMIT_CHAT = '1';
    const calls = providers();
    const { body: key } = await addKey().expect(201);
    await useKeyForChat(key.id);

    for (let i = 0; i < 2; i++) {
      const res = await chat().expect(201);
      expect(res.body.ai).toMatchObject({
        provider: 'openrouter',
        model: 'openai/gpt-5.4-nano',
        viaOwnKey: true,
        usage: {
          inputTokens: 50,
          outputTokens: 10,
          costUsd: 0.0021,
          costSource: 'PROVIDER',
        },
      });
    }
    const chatCall = calls.find(
      (c) => c.url === `${OPENROUTER}/chat/completions`,
    )!;
    expect(chatCall.headers.get('authorization')).toBe(`Bearer ${OWN_KEY}`);
    expect(chatCall.body.usage).toEqual({ include: true });
  });

  it('marks a rejected key invalid, notifies the user and falls back to the free platform AI', async () => {
    providers({ ownChat: () => failure(401, 'revoked') });
    const { body: key } = await addKey().expect(201);
    await useKeyForChat(key.id);

    const res = await chat().expect(201);
    expect(res.body.ai).toMatchObject({ provider: 'gemini', viaOwnKey: false });
    expect(prisma.credentials[0].status).toBe('INVALID');
    expect(prisma.notification.create).toHaveBeenCalled();
  });

  it('stops using the key at its monthly budget: fallback when allowed, clear message when not', async () => {
    providers();
    const { body: key } = await addKey({ monthlyBudgetUsd: 0.01 }).expect(201);
    await useKeyForChat(key.id);

    // Five calls at $0.0021 cross the $0.01 budget.
    for (let i = 0; i < 5; i++)
      expect((await chat().expect(201)).body.ai.viaOwnKey).toBe(true);
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        message: expect.stringContaining('monthly budget'),
      }),
    });

    expect((await chat().expect(201)).body.ai.viaOwnKey).toBe(false);

    await http()
      .put('/ai/preferences')
      .set('authorization', auth())
      .send({ fallbackToPlatform: false })
      .expect(200);
    const blocked = await chat().expect(503);
    expect(blocked.body.message).toMatch(/monthly budget/);
  });

  it('removing the key immediately returns the account to the platform AI', async () => {
    providers();
    const { body: key } = await addKey().expect(201);
    await useKeyForChat(key.id);
    expect((await chat().expect(201)).body.ai.viaOwnKey).toBe(true);

    await http()
      .delete(`/ai/credentials/${key.id}`)
      .set('authorization', auth())
      .expect(200);
    expect(prisma.preferences).toHaveLength(0);
    expect((await chat().expect(201)).body.ai.viaOwnKey).toBe(false);
  });

  it("can't read, test or use another user's key", async () => {
    providers();
    const { body: key } = await addKey().expect(201);

    await http()
      .get(`/ai/credentials/${key.id}/models`)
      .set('authorization', auth(OTHER_USER))
      .expect(404);
    await http()
      .delete(`/ai/credentials/${key.id}`)
      .set('authorization', auth(OTHER_USER))
      .expect(404);
    await http()
      .put('/ai/preferences')
      .set('authorization', auth(OTHER_USER))
      .send({ tasks: [{ task: 'chat', credentialId: key.id, model: 'x' }] })
      .expect(404);
  });

  it('blocks custom base URLs that are not allow-listed HTTPS hosts (SSRF guard)', async () => {
    providers();
    for (const baseUrl of [
      'http://169.254.169.254/v1',
      'https://internal.example.com/v1',
    ]) {
      const res = await addKey({ provider: 'OPENAI', baseUrl }).expect(400);
      expect(res.body.message).toMatch(/https|allowed list/);
    }
  });

  it('refuses new keys when BYOK is switched off', async () => {
    process.env.AI_BYOK_ENABLED = 'false';
    providers();
    await addKey().expect(403);
  });

  it('reports usage and remaining allowance for the usage page', async () => {
    providers();
    await chat().expect(201);
    const summary = await http()
      .get('/ai/usage/summary')
      .set('authorization', auth())
      .expect(200);
    expect(summary.body.today).toMatchObject({
      calls: 1,
      inputTokens: 120,
      outputTokens: 30,
    });
    expect(summary.body.allowance.chat).toMatchObject({
      used: 1,
      limit: 40,
      remaining: 39,
    });
  });
});
