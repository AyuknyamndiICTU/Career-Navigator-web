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

describe('Jobs browse + apply (Milestone 3.2)', () => {
  let app: INestApplication<App>;

  const userId = 'user-1';
  const jobId = 'job-1';

  const mockJob: Record<string, any> = {
    findMany: jest.fn(),
    count: jest.fn(),
    findFirst: jest.fn(),
  };

  const mockJobApplication: Record<string, any> = {
    findFirst: jest.fn(),
    create: jest.fn(),
  };

  const mockPrisma: Record<string, unknown> = {
    job: mockJob,
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

  // Milestone 3.1: browse

  it('GET /jobs returns paginated items', async () => {
    mockJob.findMany.mockResolvedValue([
      {
        id: 'job-1',
        title: 'Software Engineer',
        company: 'Acme',
        location: 'Lagos',
        description: 'Build things',
        status: 'ACTIVE',
        skills: ['node', 'ts'],
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-02T00:00:00Z'),
      },
    ]);

    mockJob.count.mockResolvedValue(1);

    const res = await request(app.getHttpServer())
      .get('/jobs?page=1&limit=10')
      .expect(200);

    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.total).toBe(1);
    expect(mockJob.findMany).toHaveBeenCalledTimes(1);
    expect(mockJob.count).toHaveBeenCalledTimes(1);
  });

  it('GET /jobs filters by status, location, skill, and q', async () => {
    mockJob.findMany.mockResolvedValue([]);
    mockJob.count.mockResolvedValue(0);

    const url =
      '/jobs?q=engineer&status=ACTIVE&location=Lagos&skill=node&page=2&limit=5';

    await request(app.getHttpServer()).get(url).expect(200);

    const findManyArgs = mockJob.findMany.mock.calls[0][0];

    expect(findManyArgs.take).toBe(5);
    expect(findManyArgs.skip).toBe(5);

    expect(findManyArgs.where.status).toBe('ACTIVE');
    expect(findManyArgs.where.location.contains).toBe('Lagos');
    expect(findManyArgs.where.skills.has).toBe('node');

    expect(Array.isArray(findManyArgs.where.OR)).toBe(true);
    expect(findManyArgs.where.OR).toHaveLength(3);
  });

  it('GET /jobs rejects invalid status filter', async () => {
    await request(app.getHttpServer()).get('/jobs?status=BAD').expect(400);

    expect(mockJob.findMany).not.toHaveBeenCalled();
    expect(mockJob.count).not.toHaveBeenCalled();
  });

  // Milestone 3.2: apply with cover letter

  it('POST /jobs/:jobId/apply without auth returns 401', async () => {
    await request(app.getHttpServer())
      .post(`/jobs/${jobId}/apply`)
      .send({ coverLetter: 'My cover letter' })
      .expect(401);

    expect(mockJobApplication.create).not.toHaveBeenCalled();
  });

  it('POST /jobs/:jobId/apply applies successfully for ACTIVE job', async () => {
    mockJob.findFirst.mockResolvedValue({ id: jobId, status: 'ACTIVE' });
    mockJobApplication.findFirst.mockResolvedValue(undefined);
    mockJobApplication.create.mockResolvedValue({
      id: 'app-1',
      userId,
      jobId,
      coverLetter: 'My cover letter',
    });

    const token = signTestToken();

    const res = await request(app.getHttpServer())
      .post(`/jobs/${jobId}/apply`)
      .set('authorization', `Bearer ${token}`)
      .send({ coverLetter: 'My cover letter' })
      .expect(201);

    expect(res.body.id).toBe('app-1');
    expect(mockJobApplication.create).toHaveBeenCalledTimes(1);
    const createArg = mockJobApplication.create.mock.calls[0][0];
    expect(createArg).toEqual({
      data: { userId, jobId, coverLetter: 'My cover letter' },
    });
  });

  it('POST /jobs/:jobId/apply rejects if user already applied', async () => {
    mockJob.findFirst.mockResolvedValue({ id: jobId, status: 'ACTIVE' });
    mockJobApplication.findFirst.mockResolvedValue({ id: 'app-1' });

    const token = signTestToken();

    await request(app.getHttpServer())
      .post(`/jobs/${jobId}/apply`)
      .set('authorization', `Bearer ${token}`)
      .send({ coverLetter: 'Another letter' })
      .expect(400);

    expect(mockJobApplication.create).not.toHaveBeenCalled();
  });
});
