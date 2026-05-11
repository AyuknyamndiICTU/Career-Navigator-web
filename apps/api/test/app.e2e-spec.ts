import { INestApplication } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { describe, beforeEach, afterEach, it, jest } from '@jest/globals';
import { AppModule } from './../src/app.module';
import { AuthService } from '../src/auth/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Auth flows (e2e routes)', () => {
  let app: INestApplication<App>;

  const authServiceMock: Partial<Record<keyof AuthService, unknown>> = {
    register: jest.fn(() => Promise.resolve({ message: 'OTP sent to email' })),
    verifyRegisterOtp: jest.fn(() =>
      Promise.resolve({ message: 'Email verified', isActive: true }),
    ),
    login: jest.fn(() =>
      Promise.resolve({ accessToken: 'access', refreshToken: 'refresh' }),
    ),
    refresh: jest.fn(() =>
      Promise.resolve({
        accessToken: 'access2',
        refreshToken: 'refresh2',
      }),
    ),
    requestPasswordReset: jest.fn(() =>
      Promise.resolve({
        message: 'If the account exists, a reset code was sent.',
      }),
    ),
    confirmPasswordReset: jest.fn(() =>
      Promise.resolve({ message: 'Password has been reset.' }),
    ),
    deactivate: jest.fn((authorizationHeader: string) => {
      if (!authorizationHeader) throw new UnauthorizedException();
      return Promise.resolve({ message: 'Account deactivated' });
    }),
    getTheme: jest.fn((authorizationHeader: string) => {
      if (!authorizationHeader) throw new UnauthorizedException();
      return Promise.resolve({ themePreference: 'DARK' });
    }),
    setTheme: jest.fn((authorizationHeader?: string) => {
      if (!authorizationHeader) throw new UnauthorizedException();
      return Promise.resolve({ themePreference: 'DARK' });
    }),
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AuthService)
      .useValue(authServiceMock)
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('GET / still works (Milestone 0 smoke)', async () => {
    await request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  // Milestone 1.1/1.2
  it('POST /auth/register works', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'alice@example.com', password: 'password123' })
      .expect(201)
      .expect({ message: 'OTP sent to email' });
  });

  it('POST /auth/verify-otp works', async () => {
    await request(app.getHttpServer())
      .post('/auth/verify-otp')
      .send({ email: 'alice@example.com', code: '123456' })
      .expect(201)
      .expect({ message: 'Email verified', isActive: true });
  });

  it('POST /auth/login works', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'alice@example.com', password: 'password123' })
      .expect(201)
      .expect({ accessToken: 'access', refreshToken: 'refresh' });
  });

  it('POST /auth/refresh works', async () => {
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: 'refresh' })
      .expect(201)
      .expect({ accessToken: 'access2', refreshToken: 'refresh2' });
  });

  // Milestone 1.3
  it('POST /auth/password-reset/request works', async () => {
    await request(app.getHttpServer())
      .post('/auth/password-reset/request')
      .send({ email: 'alice@example.com' })
      .expect(201)
      .expect({ message: 'If the account exists, a reset code was sent.' });
  });

  it('POST /auth/password-reset/confirm works', async () => {
    await request(app.getHttpServer())
      .post('/auth/password-reset/confirm')
      .send({
        email: 'alice@example.com',
        code: '123456',
        newPassword: 'newpassword123',
      })
      .expect(201)
      .expect({ message: 'Password has been reset.' });
  });

  // Milestone 1.4
  it('POST /auth/deactivate without auth returns 401', async () => {
    await request(app.getHttpServer()).post('/auth/deactivate').expect(401);
  });

  // Milestone 1.5
  it('GET /auth/theme without auth returns 401', async () => {
    await request(app.getHttpServer()).get('/auth/theme').expect(401);
  });

  it('POST /auth/theme without auth returns 401', async () => {
    await request(app.getHttpServer())
      .post('/auth/theme')
      .send({ themePreference: 'DARK' })
      .expect(401);
  });

  afterEach(async () => {
    await app.close();
  });
});
