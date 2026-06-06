import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import * as bcrypt from 'bcryptjs';

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

describe('Auth flows (Milestone: Phase 6.2)', () => {
  let app: INestApplication<App>;

  const userId = 'auth-user-1';
  const validEmail = 'test@example.com';
  const validPassword = 'Test1234!';
  const passwordHash = bcrypt.hashSync(validPassword, 10);

  const mockUser: Record<string, any> = {
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  };

  const mockOtp: Record<string, any> = {
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  };

  const mockRefreshToken: Record<string, any> = {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  };

  const mockPrisma: Record<string, any> = {
    user: mockUser,
    emailVerificationOtp: mockOtp,
    refreshToken: mockRefreshToken,
    $transaction: jest.fn((fn: Function) => fn(mockPrisma)),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    process.env.JWT_ACCESS_EXPIRES_IN = '15m';
    process.env.JWT_REFRESH_EXPIRES_IN = '30d';
    process.env.OTP_EMAIL_LOG_ONLY = 'true';
    process.env.BREVO_API_KEY = 'test';
    process.env.BREVO_SENDER_EMAIL = 'test@example.com';

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

  // ─── Registration ────────────────────────────────────────────

  it('POST /auth/register with valid complex password returns 201', async () => {
    mockUser.findUnique.mockResolvedValue(null);
    mockUser.findUniqueOrThrow.mockResolvedValue({
      id: userId,
      email: validEmail,
      isActive: false,
    });
    mockUser.create.mockResolvedValue({ id: userId, email: validEmail });
    mockOtp.create.mockResolvedValue({ id: 'otp-1' });

    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: validEmail, password: validPassword })
      .expect(201);

    expect(res.body.message).toBeTruthy();
  });

  it('POST /auth/register rejects duplicate active email', async () => {
    mockUser.findUnique.mockResolvedValue({
      id: userId,
      email: validEmail,
      isActive: true,
    });

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: validEmail, password: validPassword })
      .expect(400);
  });

  // ─── Login ───────────────────────────────────────────────────

  it('POST /auth/login with invalid credentials returns 401', async () => {
    mockUser.findUnique.mockResolvedValue({
      id: userId,
      email: validEmail,
      passwordHash,
      isActive: true,
    });

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: validEmail, password: 'WrongPass1!' })
      .expect(401);
  });

  it('POST /auth/login with inactive account returns 401', async () => {
    mockUser.findUnique.mockResolvedValue({
      id: userId,
      email: validEmail,
      passwordHash,
      isActive: false,
    });

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: validEmail, password: validPassword })
      .expect(401);
  });

  it('POST /auth/login with valid credentials returns tokens', async () => {
    mockUser.findUnique.mockResolvedValue({
      id: userId,
      email: validEmail,
      passwordHash,
      isActive: true,
    });

    mockRefreshToken.create.mockResolvedValue({ id: 'rt-1' });

    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: validEmail, password: validPassword })
      .expect(201);

    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
  });

  // ─── Password Reset ──────────────────────────────────────────

  it('POST /auth/password-reset/request returns generic message even for unknown email', async () => {
    mockUser.findUnique.mockResolvedValue(null);

    const res = await request(app.getHttpServer())
      .post('/auth/password-reset/request')
      .send({ email: 'unknown@example.com' })
      .expect(201);

    expect(res.body.message).toBeTruthy();
  });
});
