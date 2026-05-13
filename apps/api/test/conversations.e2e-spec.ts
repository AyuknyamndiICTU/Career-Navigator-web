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

describe('Conversations REST fallback (Milestone 4.1)', () => {
  let app: INestApplication<App>;

  const userId = 'user-1';
  const conversationId = 'conv-1';

  const mockConversation = {
    findMany: jest.fn(),
  };

  const mockConversationParticipant = {
    findFirst: jest.fn(),
    findMany: jest.fn(),
  };

  const mockMessage = {
    findMany: jest.fn(),
    create: jest.fn(),
  };

  const mockPrisma: any = {
    conversation: mockConversation,
    conversationParticipant: mockConversationParticipant,
    message: mockMessage,
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

  it('GET /conversations without auth returns 401', async () => {
    await request(app.getHttpServer()).get('/conversations').expect(401);
  });

  it('GET /conversations with auth returns conversations', async () => {
    mockConversation.findMany.mockResolvedValue([
      {
        id: conversationId,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-02T00:00:00Z'),
      },
    ]);

    const token = signTestToken();
    const res = await request(app.getHttpServer())
      .get('/conversations')
      .set('authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items).toHaveLength(1);
    expect(mockConversation.findMany).toHaveBeenCalledTimes(1);
  });

  it('GET /conversations/:id/messages with auth checks participant and returns history', async () => {
    mockConversationParticipant.findFirst.mockResolvedValue({ id: 'p1' });
    mockConversationParticipant.findMany.mockResolvedValue([{ userId }]);
    mockMessage.findMany.mockResolvedValue([
      {
        id: 'm1',
        senderId: userId,
        content: 'Hi',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
      },
    ]);

    const token = signTestToken();
    const res = await request(app.getHttpServer())
      .get(`/conversations/${conversationId}/messages`)
      .set('authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items[0].content).toBe('Hi');
    expect(mockConversationParticipant.findFirst).toHaveBeenCalledTimes(1);
    expect(mockMessage.findMany).toHaveBeenCalledTimes(1);
  });

  it('POST /conversations/:id/messages with auth sends message', async () => {
    mockConversationParticipant.findFirst.mockResolvedValue({ id: 'p1' });
    mockMessage.create.mockResolvedValue({
      id: 'm1',
      senderId: userId,
      content: 'Hello',
      createdAt: new Date('2024-01-01T00:00:00Z'),
    });

    const token = signTestToken();
    await request(app.getHttpServer())
      .post(`/conversations/${conversationId}/messages`)
      .set('authorization', `Bearer ${token}`)
      .send({ content: 'Hello' })
      .expect(201);

    expect(mockMessage.create).toHaveBeenCalledTimes(1);
  });
});
