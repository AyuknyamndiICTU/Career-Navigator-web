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
import { AuthService } from '../src/auth/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { signAccessToken } from '../src/auth/jwt/jwt-utils';

describe('Conversations CRUD (Milestone: Phase 4 + 6.3)', () => {
  let app: INestApplication<App>;

  const userId = 'conv-user-1';
  const otherUserId = 'conv-user-2';

  const signTestToken = (uid: string = userId): string => {
    const secret = process.env.JWT_ACCESS_SECRET ?? 'test-secret';
    return signAccessToken({
      secret,
      expiresIn: '15m',
      userId: uid,
      email: `${uid}@example.com`,
      isActive: true,
    });
  };

  const mockConversation: Record<string, any> = {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
  };

  const mockParticipant: Record<string, any> = {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
  };

  const mockMessage: Record<string, any> = {
    findMany: jest.fn(),
    create: jest.fn(),
  };

  const mockUser: Record<string, any> = {
    findUnique: jest.fn(),
  };

  const mockPrisma: Record<string, any> = {
    conversation: mockConversation,
    conversationParticipant: mockParticipant,
    message: mockMessage,
    user: mockUser,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.JWT_ACCESS_SECRET = 'test-secret';

    // Default: other user exists and is active
    mockUser.findUnique.mockImplementation(
      (args: { where: { id: string } }) => {
        if (args.where.id === otherUserId) {
          return Promise.resolve({ id: otherUserId, isActive: true });
        }
        return Promise.resolve({ id: args.where.id, isActive: true });
      },
    );

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

  // ─── Conversation creation ───────────────────────────────────

  it('POST /conversations creates a new conversation', async () => {
    mockConversation.findFirst.mockResolvedValue(null); // no existing conversation
    mockConversation.create.mockResolvedValue({ id: 'conv-new-1' });

    const token = signTestToken();
    const res = await request(app.getHttpServer())
      .post('/conversations')
      .set('authorization', `Bearer ${token}`)
      .send({ participantUserId: otherUserId })
      .expect(201);

    expect(res.body.conversationId).toBe('conv-new-1');
    expect(mockConversation.create).toHaveBeenCalledTimes(1);
  });

  it('POST /conversations returns existing conversation if one already exists', async () => {
    mockConversation.findFirst.mockResolvedValue({ id: 'conv-existing-1' });

    const token = signTestToken();
    const res = await request(app.getHttpServer())
      .post('/conversations')
      .set('authorization', `Bearer ${token}`)
      .send({ participantUserId: otherUserId })
      .expect(201);

    expect(res.body.conversationId).toBe('conv-existing-1');
    expect(mockConversation.create).not.toHaveBeenCalled();
  });

  it('POST /conversations without auth returns 401', async () => {
    await request(app.getHttpServer())
      .post('/conversations')
      .send({ participantUserId: otherUserId })
      .expect(401);
  });

  it('POST /conversations with self returns 400', async () => {
    const token = signTestToken();
    await request(app.getHttpServer())
      .post('/conversations')
      .set('authorization', `Bearer ${token}`)
      .send({ participantUserId: userId })
      .expect(400);
  });

  it('POST /conversations with inactive participant returns 400', async () => {
    mockUser.findUnique.mockResolvedValue({ id: otherUserId, isActive: false });
    mockConversation.findFirst.mockResolvedValue(null);

    const token = signTestToken();
    await request(app.getHttpServer())
      .post('/conversations')
      .set('authorization', `Bearer ${token}`)
      .send({ participantUserId: otherUserId })
      .expect(400);
  });

  // ─── Listing conversations ──────────────────────────────────

  it('GET /conversations lists user conversations', async () => {
    mockConversation.findMany.mockResolvedValue([
      { id: 'conv-1', createdAt: new Date(), updatedAt: new Date() },
    ]);

    const token = signTestToken();
    const res = await request(app.getHttpServer())
      .get('/conversations')
      .set('authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items).toHaveLength(1);
  });

  it('GET /conversations without auth returns 401', async () => {
    await request(app.getHttpServer()).get('/conversations').expect(401);
  });

  // ─── Message history pagination ─────────────────────────────

  it('GET /conversations/:id/messages pages backwards with nextBefore', async () => {
    mockParticipant.findFirst.mockResolvedValue({ id: 'p-1' });
    const at = (m: number) => new Date(Date.UTC(2026, 0, 1, 0, m));
    // Prisma returns newest first; limit=2 asks for take=3.
    mockMessage.findMany.mockResolvedValue([
      {
        id: 'm3',
        senderId: userId,
        content: 'c',
        createdAt: at(3),
        updatedAt: at(3),
      },
      {
        id: 'm2',
        senderId: userId,
        content: 'b',
        createdAt: at(2),
        updatedAt: at(2),
      },
      {
        id: 'm1',
        senderId: userId,
        content: 'a',
        createdAt: at(1),
        updatedAt: at(1),
      },
    ]);

    const before = at(4).toISOString();
    const res = await request(app.getHttpServer())
      .get(`/conversations/conv-1/messages?limit=2&before=${before}`)
      .set('authorization', `Bearer ${signTestToken()}`)
      .expect(200);

    expect(res.body.items.map((m: { id: string }) => m.id)).toEqual([
      'm2',
      'm3',
    ]);
    expect(res.body.nextBefore).toBe(at(2).toISOString());
    const args = mockMessage.findMany.mock.calls[0][0] as Record<string, any>;
    expect(args.take).toBe(3);
    expect(args.orderBy).toEqual({ createdAt: 'desc' });
    expect(args.where.createdAt.lt.toISOString()).toBe(before);
  });

  it('GET /conversations/:id/messages returns nextBefore=null on the last page', async () => {
    mockParticipant.findFirst.mockResolvedValue({ id: 'p-1' });
    mockMessage.findMany.mockResolvedValue([]);

    const res = await request(app.getHttpServer())
      .get('/conversations/conv-1/messages')
      .set('authorization', `Bearer ${signTestToken()}`)
      .expect(200);

    expect(res.body).toEqual({ items: [], nextBefore: null });
  });

  it('GET /conversations/:id/messages rejects an invalid before', async () => {
    mockParticipant.findFirst.mockResolvedValue({ id: 'p-1' });
    await request(app.getHttpServer())
      .get('/conversations/conv-1/messages?before=not-a-date')
      .set('authorization', `Bearer ${signTestToken()}`)
      .expect(400);
  });
});
