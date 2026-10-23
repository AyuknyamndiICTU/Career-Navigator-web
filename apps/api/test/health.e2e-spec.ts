import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  describe,
  beforeEach,
  afterEach,
  it,
  jest,
  expect,
} from '@jest/globals';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { OBJECT_STORAGE } from '../src/storage/object-storage';
import { FakeObjectStorage } from './fake-storage';

describe('Health checks and error responses (e2e)', () => {
  let app: INestApplication<App>;

  const mockPrisma = {
    $queryRaw: jest.fn(),
    user: { findUnique: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    delete process.env.REDIS_URL;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .overrideProvider(OBJECT_STORAGE)
      .useValue(new FakeObjectStorage())
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /health/live is public and needs no dependencies', async () => {
    await request(app.getHttpServer())
      .get('/health/live')
      .expect(200)
      .expect({ status: 'ok' });
    expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('GET /health/ready reports each dependency', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }] as never);

    const res = await request(app.getHttpServer())
      .get('/health/ready')
      .expect(200);

    expect(res.body).toEqual({
      status: 'ok',
      checks: { database: 'up', redis: 'skipped', storage: 'up' },
    });
  });

  it('GET /health/ready returns 503 when the database is down', async () => {
    mockPrisma.$queryRaw.mockRejectedValue(
      new Error('connection refused') as never,
    );

    const res = await request(app.getHttpServer())
      .get('/health/ready')
      .expect(503);

    expect(res.body.status).toBe('error');
    expect(res.body.checks.database).toBe('down');
    expect(JSON.stringify(res.body)).not.toContain('connection refused');
  });

  it('errors carry a request ID and hide internal details', async () => {
    mockPrisma.user.findUnique.mockRejectedValue(
      new Error('secret internal failure') as never,
    );

    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'alice@example.com', password: 'Password123!' })
      .expect(500);

    expect(res.body).toEqual({
      statusCode: 500,
      message: 'Internal server error',
      requestId: res.headers['x-request-id'],
    });
    expect(res.body.requestId).toEqual(expect.any(String));
    expect(res.body.stack).toBeUndefined();
  });

  it('reuses a well-formed incoming X-Request-Id', async () => {
    const res = await request(app.getHttpServer())
      .get('/health/nope')
      .set('X-Request-Id', 'trace-abc-123')
      .expect(404);

    expect(res.headers['x-request-id']).toBe('trace-abc-123');
    expect(res.body.requestId).toBe('trace-abc-123');
  });
});
