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
});
