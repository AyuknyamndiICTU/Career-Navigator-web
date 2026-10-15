import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
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
import { MessagingGateway } from '../src/realtime/messaging.gateway';
import { AiUsageService } from '../src/ai/gateway/ai-usage.service';
import { signAccessToken } from '../src/auth/jwt/jwt-utils';
import {
  anthropicSse,
  failure,
  geminiJson,
  geminiSse,
  hang,
  json,
  mockFetch,
  openAiJson,
  openAiSse,
  parseSse,
  rawText,
  resetAiEnv,
} from './ai-fixtures';

const GEMINI = 'https://generativelanguage.googleapis.com/v1beta/models/';
const OLLAMA = 'https://ollama.com/v1/chat/completions';

describe('AI gateway: chat, fallback, quotas, streaming, metering (Phase 12)', () => {
  let app: INestApplication<App>;
  const userId = 'user-1';

  const mockPrisma: any = {
    jobApplication: { findMany: jest.fn() },
    user: { findUnique: jest.fn() },
    aiUsageEvent: { createMany: jest.fn() },
    aiModelPrice: { findMany: jest.fn() },
    notification: { create: jest.fn() },
  };

  const token = () =>
    signAccessToken({
      secret: 'test-secret',
      expiresIn: '15m',
      userId,
      email: 'alice@example.com',
      isActive: true,
    });

  const chat = (message = 'Help me plan my Node.js learning') =>
    request(app.getHttpServer())
      .post('/ai/chat')
      .set('authorization', `Bearer ${token()}`)
      .send({ message, allowedSkills: ['node', 'ts'] });

  const chatStream = (message = 'Help me plan') =>
    request(app.getHttpServer())
      .post('/ai/chat/stream')
      .set('authorization', `Bearer ${token()}`)
      .send({ message })
      .buffer(true)
      .parse(rawText);

  beforeEach(async () => {
    jest.clearAllMocks();
    resetAiEnv();
    mockPrisma.jobApplication.findMany.mockResolvedValue([
      { job: { skills: ['node', 'ts'] } },
    ]);
    mockPrisma.user.findUnique.mockResolvedValue({
      role: 'USER',
      aiFallbackToPlatform: true,
    });
    mockPrisma.aiUsageEvent.createMany.mockResolvedValue({ count: 1 });
    mockPrisma.notification.create.mockResolvedValue({});
    mockPrisma.aiModelPrice.findMany.mockResolvedValue([
      {
        provider: 'OLLAMA_CLOUD',
        model: 'gpt-oss:120b',
        inputPerMTok: 0.15,
        outputPerMTok: 0.6,
        cachedInputPerMTok: null,
        isFree: false,
        effectiveFrom: new Date(0),
      },
    ]);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('POST /ai/chat returns 401 without auth', async () => {
    await request(app.getHttpServer())
      .post('/ai/chat')
      .send({ message: 'hi' })
      .expect(401);
  });

  it('answers with Gemini, sends the key in a header and reports exact usage', async () => {
    const calls = mockFetch(() =>
      geminiJson('Start with Node.js streams and TypeScript types.'),
    );

    const res = await chat().expect(201);

    expect(res.body.response).toContain('Node.js');
    expect(res.body.allowedSkills).toEqual(['node', 'ts']);
    expect(res.body.ai).toMatchObject({
      provider: 'gemini',
      model: 'gemini-3.8-flash',
      viaOwnKey: false,
      usage: {
        inputTokens: 120,
        outputTokens: 30,
        costUsd: 0,
        costSource: 'FREE',
      },
    });
    expect(calls[0].url).toBe(`${GEMINI}gemini-3.8-flash:generateContent`);
    expect(calls[0].url).not.toContain('key=');
    expect(calls[0].headers.get('x-goog-api-key')).toBe('test-gemini-key');
    expect(calls[0].body.generationConfig.maxOutputTokens).toBe(800);
  });

  it('keeps answers on the career-path skills', async () => {
    mockFetch(() => geminiJson('I can help with cooking recipes.'));
    const res = await chat('Help me with something').expect(201);
    expect(res.body.response.toLowerCase()).toContain('career-path skills');
  });

  it('sends only the last 6 turns and condenses older ones', async () => {
    const calls = mockFetch(() => geminiJson('Node.js it is.'));
    const history = Array.from({ length: 10 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `turn ${i}`,
    }));
    await request(app.getHttpServer())
      .post('/ai/chat')
      .set('authorization', `Bearer ${token()}`)
      .send({ message: 'next step?', history })
      .expect(201);

    const contents = calls[0].body.contents as Array<{
      parts: Array<{ text: string }>;
    }>;
    expect(contents).toHaveLength(7);
    expect(contents[6].parts[0].text).toContain(
      'Earlier in this chat the user asked about: turn 0 | turn 2',
    );
  });

  it('cools a rate-limited model down and moves to the next one', async () => {
    const calls = mockFetch(({ url }) =>
      url.includes('gemini-3.8-flash')
        ? failure(429, 'quota', { 'retry-after': '30' })
        : geminiJson('Gemini 3.6 says Node.js.'),
    );

    const first = await chat().expect(201);
    expect(first.body.ai.model).toBe('gemini-3.6-flash');

    // The cooling model is skipped entirely on the next request.
    await chat().expect(201);
    expect(calls.map((c) => c.url.split('/models/')[1])).toEqual([
      'gemini-3.8-flash:generateContent',
      'gemini-3.6-flash:generateContent',
      'gemini-3.6-flash:generateContent',
    ]);
  });

  it('falls back to Ollama Cloud when Gemini is exhausted and prices it from the price table', async () => {
    mockFetch(({ url }) =>
      url.startsWith(GEMINI)
        ? failure(
            429,
            '{"error":{"message":"Quota exceeded: GenerateRequestsPerDay"}}',
          )
        : openAiJson('Ollama says Node.js.', {
            prompt_tokens: 100,
            completion_tokens: 20,
          }),
    );

    const res = await chat().expect(201);
    expect(res.body.ai).toMatchObject({
      provider: 'ollama',
      model: 'gpt-oss:120b',
      usage: { inputTokens: 100, outputTokens: 20, costSource: 'PRICE_TABLE' },
    });
    // (100 x 0.15 + 20 x 0.60) / 1M
    expect(res.body.ai.usage.costUsd).toBeCloseTo(0.000027, 9);
  });

  it('serves chat through the next provider when the Gemini key is revoked', async () => {
    delete process.env.GEMINI_API_KEY;
    const calls = mockFetch(() => openAiJson('Ollama: Node.js plan.'));

    const res = await chat().expect(201);
    expect(res.body.ai.provider).toBe('ollama');
    expect(calls.every((c) => c.url === OLLAMA)).toBe(true);
    expect(calls[0].headers.get('authorization')).toBe(
      'Bearer test-ollama-key',
    );
  });

  it('retries a 503 once on the same model', async () => {
    let n = 0;
    const calls = mockFetch(() =>
      n++ === 0 ? failure(503, 'busy') : geminiJson('Retried: Node.js.'),
    );

    const res = await chat().expect(201);
    expect(res.body.ai.model).toBe('gemini-3.8-flash');
    expect(calls).toHaveLength(2);
  });

  it('gives up within the total time budget when providers hang', async () => {
    process.env.AI_CHAT_TIME_BUDGET_MS = '1200';
    mockFetch(({ init }) => hang(init));

    const started = Date.now();
    const res = await chat().expect(503);
    expect(Date.now() - started).toBeLessThan(4_000);
    expect(res.body.message).toMatch(/busy/i);
    expect(res.body.requestId).toBeDefined();
  });

  it('enforces the daily free allowance per user, exempting admins', async () => {
    process.env.AI_USER_DAILY_LIMIT_CHAT = '1';
    mockFetch(() => geminiJson('Node.js.'));

    await chat().expect(201);
    const limited = await chat().expect(429);
    expect(limited.body.message).toMatch(/free AI requests/);
    expect(limited.body.resetAt).toBeDefined();

    mockPrisma.user.findUnique.mockResolvedValue({
      role: 'ADMIN',
      aiFallbackToPlatform: true,
    });
    await app.close();
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    await chat().expect(201);
    await chat().expect(201);
  });

  it('streams chat as Server-Sent Events with exact final usage and a live ai:usage event', async () => {
    const emit = jest.spyOn(app.get(MessagingGateway), 'emitToUser');
    mockFetch(() => geminiSse(['Learn ', 'Node.js ', 'streams.']));

    const res = await chatStream().expect(200);
    expect(res.headers['content-type']).toContain('text/event-stream');

    const events = parseSse(res.body as unknown as string);
    expect(events.map((e) => e.event)).toEqual([
      'context',
      'start',
      'delta',
      'delta',
      'delta',
      'done',
    ]);
    expect(events[1].data).toEqual({
      provider: 'gemini',
      model: 'gemini-3.8-flash',
      viaOwnKey: false,
    });
    const done = events[5].data;
    expect(done.response).toBe('Learn Node.js streams.');
    expect(done.ai.usage).toMatchObject({ inputTokens: 120, outputTokens: 12 });

    expect(emit).toHaveBeenCalledWith(
      userId,
      'ai:usage',
      expect.objectContaining({
        task: 'chat',
        usage: expect.objectContaining({ outputTokens: 12 }),
        today: expect.objectContaining({ calls: 1, outputTokens: 12 }),
      }),
    );
  });

  it('falls back before the first token when a streamed model fails', async () => {
    mockFetch(({ url }) =>
      url.startsWith(GEMINI)
        ? failure(429, 'slow down')
        : openAiSse(['Ollama ', 'answer.']),
    );

    const events = parseSse(
      (await chatStream().expect(200)).body as unknown as string,
    );
    expect(events.find((e) => e.event === 'start')?.data.provider).toBe(
      'ollama',
    );
    expect(events.at(-1)?.data.response).toBe('Ollama answer.');
    expect(events.at(-1)?.data.ai.usage).toMatchObject({
      inputTokens: 90,
      outputTokens: 15,
    });
  });

  it('reads Claude streaming usage including prompt-cache reads', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
    process.env.AI_ROUTE_CHAT = 'anthropic/claude-haiku-5-5';
    const calls = mockFetch(() => anthropicSse(['Claude ', 'on Node.js.']));

    const events = parseSse(
      (await chatStream().expect(200)).body as unknown as string,
    );
    expect(events.at(-1)?.data.ai.usage).toMatchObject({
      inputTokens: 240,
      cachedTokens: 200,
      outputTokens: 18,
    });
    expect(calls[0].headers.get('x-api-key')).toBe('test-anthropic-key');
    expect(calls[0].body.system[0].cache_control).toEqual({
      type: 'ephemeral',
    });
  });

  it('returns a normal JSON 429 (not a stream) when the allowance is used up', async () => {
    process.env.AI_USER_DAILY_LIMIT_CHAT = '1';
    mockFetch(() => geminiSse(['Node.js']));
    await chatStream().expect(200);

    const res = await request(app.getHttpServer())
      .post('/ai/chat/stream')
      .set('authorization', `Bearer ${token()}`)
      .send({ message: 'again' })
      .expect(429);
    expect(res.headers['content-type']).toContain('application/json');
  });

  it('writes durable usage events with provider-reported tokens', async () => {
    mockFetch(() => geminiJson('Node.js.'));
    await chat().expect(201);
    await app.get(AiUsageService).flush();

    expect(mockPrisma.aiUsageEvent.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          userId,
          credentialId: null,
          provider: 'GEMINI',
          model: 'gemini-3.8-flash',
          task: 'chat',
          inputTokens: 120,
          outputTokens: 30,
          costSource: 'FREE',
          status: 'ok',
        }),
      ],
    });
  });

  it('POST /ai/mock-interview uses the mock-interview route', async () => {
    const calls = mockFetch(() => geminiJson('Question 1 about Node.js.'));
    const res = await request(app.getHttpServer())
      .post('/ai/mock-interview')
      .set('authorization', `Bearer ${token()}`)
      .send({ role: 'Backend Engineer', allowedSkills: ['node'] })
      .expect(201);

    expect(res.body.role).toBe('Backend Engineer');
    expect(res.body.response).toContain('Node.js');
    expect(calls[0].body.systemInstruction.parts[0].text).toContain(
      'Role: Backend Engineer',
    );
    expect(calls[0].body.generationConfig.maxOutputTokens).toBe(600);
  });

  it('caches course recommendations so the same request never calls a model twice', async () => {
    const courses = {
      courses: [
        {
          platform: 'Coursera',
          courseName: 'Node.js Basics',
          difficulty: 'Beginner',
          description: 'Intro',
          externalUrl: 'https://example.com/node',
          whyRecommended: 'Builds node skills',
        },
      ],
    };
    const calls = mockFetch(() => geminiJson(JSON.stringify(courses)));
    const send = () =>
      request(app.getHttpServer())
        .post('/ai/course-recommendations')
        .set('authorization', `Bearer ${token()}`)
        .send({ allowedSkills: ['node'], studentGoal: 'Get job-ready skills' })
        .expect(201);

    const first = await send();
    expect(first.body.courses[0].courseName).toBe('Node.js Basics');
    expect(calls[0].url).toContain('gemini-3.1-flash-lite');
    expect(calls[0].body.generationConfig.responseMimeType).toBe(
      'application/json',
    );

    const second = await send();
    expect(second.body.ai.cached).toBe(true);
    expect(calls).toHaveLength(1);
  });

  it('still recommends curated courses when no AI is available', async () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.OLLAMA_API_KEY;
    mockFetch(() => json({}));

    const res = await request(app.getHttpServer())
      .post('/ai/course-recommendations')
      .set('authorization', `Bearer ${token()}`)
      .send({ allowedSkills: ['node'] })
      .expect(201);
    expect(res.body.courses.length).toBeGreaterThan(0);
    expect(res.body.ai).toBeNull();
  });
});
