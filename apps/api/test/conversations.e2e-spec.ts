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
    mockUser.findUnique.mockImplementation((args: { where: { id: string } }) => {
      if (args.where.id === otherUserId) {
        return Promise.resolve({ id: otherUserId, isActive: true });
      }
      return Promise.resolve({ id: args.where.id, isActive: true });
    });

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
    await request(app.getHttpServer())
      .get('/conversations')
      .expect(401);
  });
});
