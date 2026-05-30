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
import { AuthService } from '../src/auth/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { signAccessToken } from '../src/auth/jwt/jwt-utils';

describe('AI chat (Milestone 5.2) + career-path enforcement (5.1)', () => {
  let app: INestApplication<App>;

  const userId = 'user-1';

  const mockJobApplication: any = {
    findMany: jest.fn(),
  };

  const mockPrisma: any = {
    jobApplication: mockJobApplication,
  };

  const signTestToken = (): string => {
    const secret = process.env.JWT_ACCESS_SECRET ?? 'test-secret';

    return signAccessToken({
      secret,
      expiresIn: '15m',
      userId,
      email: 'alice@example.com',
      isActive: true,
    });
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.JWT_ACCESS_SECRET = 'test-secret';
    process.env.OLLAMA_BASE_URL = 'http://localhost:11434';
    process.env.OLLAMA_MODEL = 'llama3';
    delete process.env.GEMINI_API_KEY;

    (global as any).fetch = jest.fn();

    mockJobApplication.findMany.mockResolvedValue([
      { job: { skills: ['node', 'ts'] } },
    ]);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AuthService)
      .useValue({})
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

  it('POST /ai/chat returns response when it mentions allowed skills', async () => {
    (global as any).fetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '',
      json: async () => ({
        response: 'Sure—let’s talk about Node.js and TypeScript.',
      }),
    });

    const token = signTestToken();
    const res = await request(app.getHttpServer())
      .post('/ai/chat')
      .set('authorization', `Bearer ${token}`)
      .send({
        message: 'Help me with a project plan',
        allowedSkills: ['node', 'ts'],
      })
      .expect(201);

    expect(res.body.allowedSkills).toEqual(['node', 'ts']);
    expect(typeof res.body.response).toBe('string');
    expect(res.body.response.toLowerCase()).toContain('node');
  });

  it('POST /ai/chat refuses when model response mentions no allowed skills', async () => {
    (global as any).fetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '',
      json: async () => ({ response: 'I can help with cooking recipes.' }),
    });

    const token = signTestToken();
    const res = await request(app.getHttpServer())
      .post('/ai/chat')
      .set('authorization', `Bearer ${token}`)
      .send({
        message: 'Help me with something',
        allowedSkills: ['node'],
      })
      .expect(201);

    expect(res.body.allowedSkills).toEqual(['node']);
    expect(res.body.response.toLowerCase()).toContain('career-path skills');
  });

  it('POST /ai/mock-interview returns interview response mentioning allowed skills', async () => {
    (global as any).fetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '',
      json: async () => ({
        response: 'Question about Node.js and TypeScript.',
      }),
    });

    const token = signTestToken();
    const res = await request(app.getHttpServer())
      .post('/ai/mock-interview')
      .set('authorization', `Bearer ${token}`)
      .send({ role: 'Frontend Engineer', allowedSkills: ['node'] })
      .expect(201);

    expect(res.body.allowedSkills).toEqual(['node']);
    expect(res.body.role).toBe('Frontend Engineer');
    expect(res.body.response.toLowerCase()).toContain('node');
  });

  it('POST /ai/mock-interview refuses when response mentions no allowed skills', async () => {
    (global as any).fetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '',
      json: async () => ({ response: 'I will ask about cooking recipes.' }),
    });

    const token = signTestToken();
    const res = await request(app.getHttpServer())
      .post('/ai/mock-interview')
      .set('authorization', `Bearer ${token}`)
      .send({ role: 'Frontend Engineer', allowedSkills: ['node'] })
      .expect(201);

    expect(res.body.allowedSkills).toEqual(['node']);
    expect(res.body.response.toLowerCase()).toContain('career-path skills');
  });

  it('POST /ai/course-recommendations returns course recommendations', async () => {
    (global as any).fetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '',
      json: async () => ({
        response:
          '- Coursera: Node.js Basics\n- Udemy: TypeScript for Developers',
      }),
    });

    const token = signTestToken();
    const res = await request(app.getHttpServer())
      .post('/ai/course-recommendations')
      .set('authorization', `Bearer ${token}`)
      .send({ allowedSkills: ['node'], studentGoal: 'Get job-ready skills' })
      .expect(201);

    expect(res.body.allowedSkills).toEqual(['node']);
    expect(typeof res.body.response).toBe('string');
  });

  it('POST /ai/chat retries on 429 then succeeds', async () => {
    const token = signTestToken();

    (global as any).fetch
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'rate limited',
        headers: { get: () => '0' },
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '',
        json: async () => ({
          response: 'Node.js is a great start for your project plan.',
        }),
      });

    const res = await request(app.getHttpServer())
      .post('/ai/chat')
      .set('authorization', `Bearer ${token}`)
      .send({
        message: 'Help me with something',
        allowedSkills: ['node'],
      })
      .expect(201);

    expect(res.body.allowedSkills).toEqual(['node']);
    expect(res.body.response.toLowerCase()).toContain('node');
  });

  it('POST /ai/chat retries on 503 then succeeds', async () => {
    const token = signTestToken();

    (global as any).fetch
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => 'service unavailable',
        headers: { get: () => '0' },
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '',
        json: async () => ({
          response: 'For TypeScript + Node.js, focus on project structure.',
        }),
      });

    const res = await request(app.getHttpServer())
      .post('/ai/chat')
      .set('authorization', `Bearer ${token}`)
      .send({
        message: 'Help me with something',
        allowedSkills: ['node'],
      })
      .expect(201);

    expect(res.body.allowedSkills).toEqual(['node']);
    expect(res.body.response.toLowerCase()).toContain('node');
  });

  it('Provider audit step 1: POST /ai/chat responds using Gemini when GEMINI_API_KEY is set', async () => {
    process.env.GEMINI_API_KEY = 'test-gemini-key';

    const token = signTestToken();

    (global as any).fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => '',
      json: async () => ({
        response: 'Gemini reply mentioning Node.js and TypeScript.',
      }),
    });

    const res = await request(app.getHttpServer())
      .post('/ai/chat')
      .set('authorization', `Bearer ${token}`)
      .send({
        message: 'I need help planning',
        allowedSkills: ['node', 'ts'],
      })
      .expect(201);

    expect(res.body.allowedSkills).toEqual(['node', 'ts']);
    expect(res.body.response).toContain('Gemini reply');
  });

  it('Provider audit step 2-4: Gemini 429 -> Ollama model fallback + [Provider Switch], then Gemini restored after 30s', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const token = signTestToken();
    const baseTime = 1700000000000;

    const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => baseTime);

    // Step 2: simulate Gemini 429 (Gemini key exists but is "invalid" for realism).
    process.env.GEMINI_API_KEY = 'invalid-key';

    let capturedOllamaModel: string | null = null;

    (global as any).fetch
      // Gemini call -> 429
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'rate limited',
      })
      // Ollama Cloud call
      .mockImplementationOnce(async (_url: any, opts: any) => {
        const body =
          typeof opts?.body === 'string' ? JSON.parse(opts.body) : null;
        capturedOllamaModel = body?.model ?? null;

        return {
          ok: true,
          status: 200,
          text: async () => '',
          json: async () => ({
            response: 'Ollama fallback reply mentioning Node.js.',
          }),
        };
      });

    // Code-related task => should choose qwen3-coder:480b-cloud
    const res1 = await request(app.getHttpServer())
      .post('/ai/chat')
      .set('authorization', `Bearer ${token}`)
      .send({
        message: 'Write TypeScript code plan for a Node.js backend',
        allowedSkills: ['node', 'ts'],
      })
      .expect(201);

    expect(capturedOllamaModel).toBe('qwen3-coder:480b-cloud');
    expect(res1.body.response).toContain('Ollama fallback reply');

    // Step 3: provider switch notification appears
    expect(consoleSpy).toHaveBeenCalledWith(
      '[Provider Switch] → Now using: qwen3-coder:480b-cloud (reason: Gemini returned HTTP 429)',
    );

    // Step 4: advance time beyond 30s, restore correct Gemini key and confirm restored notification + Gemini usage.
    (nowSpy as jest.Mock).mockImplementation(() => baseTime + 30001);
    process.env.GEMINI_API_KEY = 'test-gemini-key';

    (global as any).fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => '',
      json: async () => ({
        response: 'Gemini restored reply mentioning Node.js.',
      }),
    });

    const res2 = await request(app.getHttpServer())
      .post('/ai/chat')
      .set('authorization', `Bearer ${token}`)
      .send({
        message: 'Plan my next steps',
        allowedSkills: ['node', 'ts'],
      })
      .expect(201);

    expect(res2.body.response).toContain('Gemini restored reply');
    expect(consoleSpy).toHaveBeenCalledWith(
      '[Provider Restored] → Back to Gemini',
    );

    nowSpy.mockRestore();
    consoleSpy.mockRestore();
  });
});
