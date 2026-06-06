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

describe('Input validation (Milestone: Phase 3)', () => {
  let app: INestApplication<App>;

  const userId = 'user-val-1';

  const mockUser: Record<string, any> = {
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };

  const mockOtp: Record<string, any> = {
    create: jest.fn(),
    findFirst: jest.fn(),
  };

  const mockProfile: Record<string, any> = {
    upsert: jest.fn(),
    findUnique: jest.fn(),
  };

  const mockPrisma: Record<string, any> = {
    user: mockUser,
    emailVerificationOtp: mockOtp,
    profile: mockProfile,
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
    process.env.OTP_EMAIL_LOG_ONLY = 'true';
    process.env.BREVO_API_KEY = 'test';
    process.env.BREVO_SENDER_EMAIL = 'test@example.com';

    mockUser.findUnique.mockResolvedValue(null);

    mockUser.findUniqueOrThrow.mockResolvedValue({
      id: userId,
      email: 'alice@example.com',
      isActive: true,
    });

    mockOtp.create.mockResolvedValue({ id: 'otp-1' });
    mockProfile.upsert.mockResolvedValue({ id: 'pf-1', userId });

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

  // ─── Phone validation ─────────────────────────────────────────

  it('PUT /profile rejects invalid phone "hello world"', async () => {
    const token = signTestToken();
    mockProfile.upsert.mockResolvedValue({ id: 'pf-1', userId });
    mockProfile.findUnique.mockResolvedValue(null);

    await request(app.getHttpServer())
      .put('/profile')
      .set('authorization', `Bearer ${token}`)
      .send({ phone: 'hello world' })
      .expect(400);
  });

  it('PUT /profile accepts valid phone "+234-800-555-1234"', async () => {
    const token = signTestToken();
    mockProfile.upsert.mockResolvedValue({ id: 'pf-1', userId, phone: '+234-800-555-1234' });
    mockProfile.findUnique.mockResolvedValue(null);

    await request(app.getHttpServer())
      .put('/profile')
      .set('authorization', `Bearer ${token}`)
      .send({ phone: '+234-800-555-1234' })
      .expect(200);
  });

  // ─── Password complexity validation ───────────────────────────

  it('POST /auth/register rejects weak password "aaaaaaaa" (no uppercase/number/special)', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'test@example.com', password: 'aaaaaaaa' })
      .expect(400);
  });

  it('POST /auth/register accepts valid complex password "Test1234!"', async () => {
    mockUser.create.mockResolvedValue({ id: userId });

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'test2@example.com', password: 'Test1234!' })
      .expect(201);
  });

  // ─── Profile CV wizard URL/email validation ───────────────────

  it('PUT /profile rejects invalid website URL in cvWizardData', async () => {
    const token = signTestToken();
    mockProfile.upsert.mockResolvedValue({ id: 'pf-1', userId });

    await request(app.getHttpServer())
      .put('/profile')
      .set('authorization', `Bearer ${token}`)
      .send({
        cvWizardData: {
          website: 'not-a-url',
        },
      })
      .expect(400);
  });

  it('PUT /profile rejects invalid email in cvWizardData', async () => {
    const token = signTestToken();
    mockProfile.upsert.mockResolvedValue({ id: 'pf-1', userId });

    await request(app.getHttpServer())
      .put('/profile')
      .set('authorization', `Bearer ${token}`)
      .send({
        cvWizardData: {
          email: 'not-an-email',
        },
      })
      .expect(400);
  });

  // ─── Auth ────────────────────────────────────────────────────

  it('POST /auth/register rejects invalid email', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'not-email', password: 'Test1234!' })
      .expect(400);
  });
});
