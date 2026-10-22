import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { createHash } from 'node:crypto';
import { sign, verify, type JwtPayload } from 'jsonwebtoken';
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
import { MessagingGateway } from '../src/realtime/messaging.gateway';
import { signAccessToken } from '../src/auth/jwt/jwt-utils';

const KEY = 'test-key';
const SECRET = 'test-livekit-secret-0123456789-abcdefghij';
const CONVERSATION = '11111111-1111-4111-8111-111111111111';
const OTHER_CONVERSATION = '22222222-2222-4222-8222-222222222222';

type Session = {
  id: string;
  room: string;
  conversationId: string;
  createdById: string;
  startedAt: Date;
  endedAt: Date | null;
  participantMinutes: number;
};
type Participant = {
  id: string;
  sessionId: string;
  userId: string;
  joinedAt: Date;
  leftAt: Date | null;
};

describe('Video calls (Phase 17)', () => {
  let app: INestApplication<App>;
  const saved = { ...process.env };
  let sessions: Session[];
  let participants: Participant[];
  let roles: Record<string, string>;
  const emitToUser = jest.fn();

  const members: Record<string, string[]> = {
    [CONVERSATION]: ['alice', 'bob'],
    [OTHER_CONVERSATION]: ['carol', 'dave'],
  };

  const match = <T extends Record<string, unknown>>(
    row: T,
    where: Record<string, unknown>,
  ): boolean =>
    Object.entries(where).every(([k, v]) => {
      if (v && typeof v === 'object' && !(v instanceof Date)) {
        const cond = v as { gt?: Date; gte?: Date };
        const value = row[k] as Date;
        return (
          (!cond.gt || value > cond.gt) && (!cond.gte || value >= cond.gte)
        );
      }
      return row[k] === v;
    });

  const prisma = {
    conversationParticipant: {
      findMany: jest.fn(({ where }: { where: { conversationId: string } }) =>
        Promise.resolve(
          (members[where.conversationId] ?? []).map((userId) => ({ userId })),
        ),
      ),
    },
    user: {
      findUnique: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve({
          email: `${where.id}@example.com`,
          role: roles[where.id] ?? 'USER',
          profile: {
            firstName: where.id === 'alice' ? 'Alice' : null,
            lastName: null,
          },
        }),
      ),
    },
    videoSession: {
      findFirst: jest.fn(({ where }: { where: Record<string, unknown> }) =>
        Promise.resolve(
          sessions
            .filter((s) => match(s, where))
            .sort((a, b) => +b.startedAt - +a.startedAt)[0] ?? null,
        ),
      ),
      findUnique: jest.fn(({ where }: { where: { room: string } }) =>
        Promise.resolve(sessions.find((s) => s.room === where.room) ?? null),
      ),
      create: jest.fn(
        ({
          data,
        }: {
          data: Omit<
            Session,
            'id' | 'startedAt' | 'endedAt' | 'participantMinutes'
          >;
        }) => {
          const row: Session = {
            id: `s${sessions.length + 1}`,
            startedAt: new Date(),
            endedAt: null,
            participantMinutes: 0,
            ...data,
          };
          sessions.push(row);
          return Promise.resolve(row);
        },
      ),
      update: jest.fn(
        ({
          where,
          data,
        }: {
          where: { id: string };
          data: { endedAt?: Date; participantMinutes?: { increment: number } };
        }) => {
          const row = sessions.find((s) => s.id === where.id)!;
          if (data.endedAt) row.endedAt = data.endedAt;
          if (data.participantMinutes)
            row.participantMinutes += data.participantMinutes.increment;
          return Promise.resolve(row);
        },
      ),
      aggregate: jest.fn(() =>
        Promise.resolve({
          _sum: {
            participantMinutes: sessions.reduce(
              (n, s) => n + s.participantMinutes,
              0,
            ),
          },
        }),
      ),
      count: jest.fn(() => Promise.resolve(sessions.length)),
    },
    videoParticipant: {
      findFirst: jest.fn(({ where }: { where: Record<string, unknown> }) =>
        Promise.resolve(participants.find((p) => match(p, where)) ?? null),
      ),
      findMany: jest.fn(({ where }: { where: Record<string, unknown> }) =>
        Promise.resolve(participants.filter((p) => match(p, where))),
      ),
      create: jest.fn(
        ({ data }: { data: Omit<Participant, 'id' | 'leftAt'> }) => {
          const row: Participant = {
            id: `p${participants.length + 1}`,
            leftAt: null,
            ...data,
          };
          participants.push(row);
          return Promise.resolve(row);
        },
      ),
      update: jest.fn(
        ({
          where,
          data,
        }: {
          where: { id: string };
          data: { leftAt: Date };
        }) => {
          const row = participants.find((p) => p.id === where.id)!;
          row.leftAt = data.leftAt;
          return Promise.resolve(row);
        },
      ),
    },
  };

  const token = (userId: string) =>
    signAccessToken({
      secret: 'test-secret',
      expiresIn: '15m',
      userId,
      email: `${userId}@example.com`,
      isActive: true,
    });

  const webhook = (
    event: Record<string, unknown>,
    secret = SECRET,
    tamper = false,
  ) => {
    const body = JSON.stringify(event);
    const sha256 = createHash('sha256')
      .update(tamper ? `${body} ` : body)
      .digest('base64');
    const auth = sign({ sha256 }, secret, {
      algorithm: 'HS256',
      issuer: KEY,
      expiresIn: 300,
    });
    return request(app.getHttpServer())
      .post('/video/webhook')
      .set('content-type', 'application/webhook+json')
      .set('authorization', auth)
      .send(body);
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    sessions = [];
    participants = [];
    roles = {};
    process.env.JWT_ACCESS_SECRET = 'test-secret';
    process.env.LIVEKIT_URL = 'wss://video.example.com';
    process.env.LIVEKIT_API_KEY = KEY;
    process.env.LIVEKIT_API_SECRET = SECRET;
    delete process.env.VIDEO_TOKEN_TTL_MINUTES;
    delete process.env.VIDEO_FREE_MINUTES_PER_MONTH;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AuthService)
      .useValue({})
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(MessagingGateway)
      .useValue({ emitToUser })
      .compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    process.env = { ...saved };
  });

  const join = (userId: string, conversationId = CONVERSATION) =>
    request(app.getHttpServer())
      .post('/video/sessions')
      .set('authorization', `Bearer ${token(userId)}`)
      .send({ conversationId });

  it('requires a signed-in user', async () => {
    await request(app.getHttpServer())
      .post('/video/sessions')
      .send({ conversationId: CONVERSATION })
      .expect(401);
  });

  it('gives conversation participants a room-scoped LiveKit token and rings the others once', async () => {
    const res = await join('alice').expect(200);
    expect(res.body).toMatchObject({
      provider: 'livekit',
      url: 'wss://video.example.com',
    });
    expect(res.body.room).toMatch(/^cn-[0-9a-f-]{36}$/);

    const claims = verify(res.body.token, SECRET, {
      algorithms: ['HS256'],
      issuer: KEY,
    }) as JwtPayload;
    expect(claims.sub).toBe('alice');
    expect(claims.name).toBe('Alice');
    expect(claims.video).toEqual({
      room: res.body.room,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });
    expect(claims.exp! - claims.nbf!).toBe(120 * 60);
    expect(new Date(res.body.expiresAt).getTime()).toBe(claims.exp! * 1000);

    expect(emitToUser).toHaveBeenCalledTimes(1);
    expect(emitToUser).toHaveBeenCalledWith(
      'bob',
      'call:incoming',
      expect.objectContaining({
        conversationId: CONVERSATION,
        from: { id: 'alice', name: 'Alice' },
      }),
    );

    // Bob joins the same open room; nobody is rung again.
    const bob = await join('bob').expect(200);
    expect(bob.body.room).toBe(res.body.room);
    expect(emitToUser).toHaveBeenCalledTimes(1);
  });

  it('never gives a token for a conversation the user is not in', async () => {
    await join('carol', OTHER_CONVERSATION).expect(200);
    const res = await join('alice', OTHER_CONVERSATION).expect(400);
    expect(res.body.token).toBeUndefined();
    await request(app.getHttpServer())
      .get(`/video/sessions/active?conversationId=${OTHER_CONVERSATION}`)
      .set('authorization', `Bearer ${token('alice')}`)
      .expect(400);
  });

  it('rejects a malformed conversation id', async () => {
    await join('alice', 'not-a-uuid').expect(400);
  });

  it('issues tokens that expire after the configured lifetime', async () => {
    process.env.VIDEO_TOKEN_TTL_MINUTES = '1';
    const res = await join('alice').expect(200);
    const later = Math.floor(Date.now() / 1000) + 120;
    expect(() =>
      verify(res.body.token, SECRET, {
        algorithms: ['HS256'],
        clockTimestamp: later,
      }),
    ).toThrow(/expired/);
    expect(() =>
      verify(res.body.token, 'another-secret-0123456789-0123456789', {
        algorithms: ['HS256'],
      }),
    ).toThrow();
  });

  it('answers 503 when video is not configured', async () => {
    delete process.env.LIVEKIT_URL;
    await join('alice').expect(503);
  });

  it('reports the open call of a conversation', async () => {
    await join('alice').expect(200);
    const res = await request(app.getHttpServer())
      .get(`/video/sessions/active?conversationId=${CONVERSATION}`)
      .set('authorization', `Bearer ${token('bob')}`)
      .expect(200);
    expect(res.body.session).toMatchObject({ createdById: 'alice' });
  });

  it('accepts signed webhooks and records participant-minutes', async () => {
    const { body } = await join('alice').expect(200);
    const t0 = Math.floor(Date.now() / 1000);
    const room = { name: body.room };
    await webhook({
      event: 'participant_joined',
      room,
      participant: { identity: 'alice' },
      createdAt: t0,
    }).expect(200);
    // Retried delivery does not open a second connection.
    await webhook({
      event: 'participant_joined',
      room,
      participant: { identity: 'alice' },
      createdAt: t0,
    }).expect(200);
    await webhook({
      event: 'participant_joined',
      room,
      participant: { identity: 'bob' },
      createdAt: t0 + 10,
    }).expect(200);
    expect(participants).toHaveLength(2);

    await webhook({
      event: 'participant_left',
      room,
      participant: { identity: 'bob' },
      createdAt: t0 + 10 + 30 * 60,
    }).expect(200);
    await webhook({
      event: 'room_finished',
      room,
      createdAt: t0 + 31 * 60,
    }).expect(200);

    expect(sessions[0].participantMinutes).toBe(30 + 31);
    expect(sessions[0].endedAt).toEqual(new Date((t0 + 31 * 60) * 1000));
    expect(participants.every((p) => p.leftAt)).toBe(true);
  });

  it('rejects webhooks with a bad signature or a changed body', async () => {
    const { body } = await join('alice').expect(200);
    const event = {
      event: 'room_finished',
      room: { name: body.room },
      createdAt: 1,
    };
    await webhook(event, 'wrong-secret-0123456789-0123456789-xx').expect(401);
    await webhook(event, SECRET, true).expect(401);
    await request(app.getHttpServer())
      .post('/video/webhook')
      .set('content-type', 'application/webhook+json')
      .send(JSON.stringify(event))
      .expect(401);
    expect(sessions[0].endedAt).toBeNull();
  });

  it('shows monthly usage to admins only, with an 80 % alert', async () => {
    process.env.VIDEO_FREE_MINUTES_PER_MONTH = '100';
    await join('alice').expect(200);
    sessions[0].participantMinutes = 85;

    await request(app.getHttpServer())
      .get('/video/usage')
      .set('authorization', `Bearer ${token('alice')}`)
      .expect(403);

    roles.admin = 'ADMIN';
    const res = await request(app.getHttpServer())
      .get('/video/usage')
      .set('authorization', `Bearer ${token('admin')}`)
      .expect(200);
    expect(res.body).toMatchObject({
      participantMinutes: 85,
      freeMinutes: 100,
      percent: 85,
      alert: true,
      configured: true,
      sessions: 1,
    });
  });
});
