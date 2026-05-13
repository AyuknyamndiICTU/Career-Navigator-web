import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals';

import { AppModule } from '../src/app.module';
import { AuthService } from '../src/auth/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { signAccessToken } from '../src/auth/jwt/jwt-utils';

describe('Jobs OpenSearch indexing (Milestone 3.4)', () => {
  let app: INestApplication<App>;

  const userId = 'user-1';

  const mockJob: Record<string, any> = {
    findMany: jest.fn(),
  };

  const mockPrisma: Record<string, unknown> = {
    job: mockJob,
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

    process.env.OPENSEARCH_URL = 'http://localhost:9200';
    process.env.OPENSEARCH_USERNAME = 'admin';
    process.env.OPENSEARCH_PASSWORD = 'pass';

    mockJob.findMany.mockResolvedValue([
      {
        id: 'job-1',
        title: 'Software Engineer',
        company: 'Acme',
        location: 'Lagos',
        description: 'Build things',
        skills: ['node', 'ts'],
        status: 'ACTIVE',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-02T00:00:00Z'),
      },
    ]);

    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => '',
      json: async () => ({}),
    })) as unknown as typeof fetch;

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

  it('POST /jobs/index without auth returns 401', async () => {
    await request(app.getHttpServer()).post('/jobs/index').expect(401);

    expect(mockJob.findMany).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('POST /jobs/index indexes ACTIVE jobs into OpenSearch', async () => {
    const token = signTestToken();

    const res = await request(app.getHttpServer())
      .post('/jobs/index')
      .set('authorization', `Bearer ${token}`)
      .expect(201);

    expect(res.body.indexed).toBe(1);
    expect(res.body.index).toBe('jobs');

    expect(mockJob.findMany).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
