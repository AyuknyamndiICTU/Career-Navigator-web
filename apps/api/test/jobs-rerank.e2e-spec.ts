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

describe('Jobs AI rerank + notifications (Milestone 3.5)', () => {
  let app: INestApplication<App>;

  const userId = 'user-1';

  const mockJob: Record<string, any> = {
    findMany: jest.fn(),
  };

  const mockNotification: Record<string, any> = {
    createMany: jest.fn(),
  };

  const mockPrisma: Record<string, unknown> = {
    job: mockJob,
    notification: mockNotification,
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

    mockJob.findMany.mockResolvedValue([
      {
        id: 'job-1',
        title: 'Software Engineer',
        company: 'Acme',
        location: 'Lagos',
        description: 'Build things',
        skills: ['node', 'ts'],
        updatedAt: new Date('2024-01-02T00:00:00Z'),
      },
      {
        id: 'job-2',
        title: 'Frontend Engineer',
        company: 'Globex',
        location: 'Abuja',
        description: 'Build UI',
        skills: ['react', 'ts'],
        updatedAt: new Date('2024-01-03T00:00:00Z'),
      },
    ]);

    mockNotification.createMany.mockResolvedValue({ count: 2 });

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

  it('POST /jobs/rerank without auth returns 401', async () => {
    await request(app.getHttpServer())
      .post('/jobs/rerank')
      .send({ skills: ['node', 'ts'], limit: 2 })
      .expect(401);
  });

  it('POST /jobs/rerank returns ranked jobs and creates notifications', async () => {
    const token = signTestToken();

    const res = await request(app.getHttpServer())
      .post('/jobs/rerank')
      .set('authorization', `Bearer ${token}`)
      .send({ skills: ['node', 'ts'], limit: 2 })
      .expect(201);

    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBe(2);

    // job-1 matches both skills -> score 2
    expect(res.body.items[0].jobId).toBe('job-1');

    expect(mockNotification.createMany).toHaveBeenCalledTimes(1);

    const createManyArg = mockNotification.createMany.mock.calls[0][0];
    expect(createManyArg.data[0].userId).toBe(userId);
    expect(createManyArg.data[0].type).toBe('JOB_RERANK');
    expect(createManyArg.data[0].message).toContain('Recommended job:');
  });
});
