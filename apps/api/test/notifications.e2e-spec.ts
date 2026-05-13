import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals';

import { AppModule } from '../src/app.module';
import { AuthService } from '../src/auth/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { signAccessToken } from '../src/auth/jwt/jwt-utils';

describe('Notifications CRUD + mark read (Milestone 4.3)', () => {
  let app: INestApplication<App>;

  const userId = 'user-1';
  const notificationId = 'n-1';

  const mockNotification: Record<string, any> = {
    findMany: jest.fn(),
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const mockPrisma: Record<string, unknown> = {
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

  it('GET /notifications without auth returns 401', async () => {
    await request(app.getHttpServer()).get('/notifications').expect(401);
  });

  it('GET /notifications returns unread notifications by default', async () => {
    mockNotification.findMany.mockResolvedValue([
      {
        id: notificationId,
        type: 'JOB_RERANK',
        message: 'Recommended job',
        isRead: false,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-02T00:00:00Z'),
      },
    ]);

    const token = signTestToken();

    const res = await request(app.getHttpServer())
      .get('/notifications')
      .set('authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(mockNotification.findMany).toHaveBeenCalledTimes(1);
  });

  it('POST /notifications creates a notification', async () => {
    mockNotification.create.mockResolvedValue({
      id: notificationId,
      userId,
      type: 'CUSTOM',
      message: 'Hello',
      isRead: false,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-02T00:00:00Z'),
    });

    const token = signTestToken();

    await request(app.getHttpServer())
      .post('/notifications')
      .set('authorization', `Bearer ${token}`)
      .send({ type: 'CUSTOM', message: 'Hello' })
      .expect(201);

    expect(mockNotification.create).toHaveBeenCalledTimes(1);
  });

  it('POST /notifications/:id/read marks notification as read', async () => {
    mockNotification.findFirst.mockResolvedValue({ id: notificationId });
    mockNotification.update.mockResolvedValue({ id: notificationId, isRead: true });

    const token = signTestToken();

    await request(app.getHttpServer())
      .post(`/notifications/${notificationId}/read`)
      .set('authorization', `Bearer ${token}`)
      .expect(201);

    expect(mockNotification.update).toHaveBeenCalledTimes(1);
  });

  it('DELETE /notifications/:id deletes a notification', async () => {
    mockNotification.findFirst.mockResolvedValue({ id: notificationId });
    mockNotification.delete.mockResolvedValue({});

    const token = signTestToken();

    await request(app.getHttpServer())
      .delete(`/notifications/${notificationId}`)
      .set('authorization', `Bearer ${token}`)
      .expect(200);

    expect(mockNotification.delete).toHaveBeenCalledTimes(1);
  });
});
