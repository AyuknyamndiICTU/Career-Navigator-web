import { INestApplication } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
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
    logout: jest.fn(() => Promise.resolve({ message: 'Logged out' })),
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
      .send({ email: 'alice@example.com', password: 'Password123!' })
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

  it('POST /auth/login returns the access token and sets the refresh cookie', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'alice@example.com', password: 'password123' })
      .expect(201)
      .expect({ accessToken: 'access' });

    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toContain('cn_refresh=refresh');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Path=/api/auth');
  });

  it('POST /auth/refresh reads the refresh token from the cookie', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', 'cn_refresh=refresh')
      .send({})
      .expect(201)
      .expect({ accessToken: 'access2' });

    expect(authServiceMock.refresh).toHaveBeenCalledWith('refresh');
    expect(String(res.headers['set-cookie'])).toContain('cn_refresh=refresh2');
  });

  it('POST /auth/refresh without a token returns 401', async () => {
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({})
      .expect(401);
  });

  it('POST /auth/logout revokes the cookie token and clears the cookie', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', 'cn_refresh=refresh')
      .expect(200)
      .expect({ message: 'Logged out' });

    expect(authServiceMock.logout).toHaveBeenCalledWith('refresh');
    expect(String(res.headers['set-cookie'])).toMatch(/cn_refresh=;/);
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
        newPassword: 'NewPassword123!',
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

  // Milestone 2.1 Profile/Education: should be protected (401 without auth)
  it('GET /profile without auth returns 401', async () => {
    await request(app.getHttpServer()).get('/profile').expect(401);
  });

  it('PUT /profile without auth returns 401', async () => {
    await request(app.getHttpServer())
      .put('/profile')
      .send({ firstName: 'Alice' })
      .expect(401);
  });

  it('GET /profile/education without auth returns 401', async () => {
    await request(app.getHttpServer()).get('/profile/education').expect(401);
  });

  it('POST /profile/education without auth returns 401', async () => {
    await request(app.getHttpServer())
      .post('/profile/education')
      .send({ degree: 'BSc' })
      .expect(401);
  });

  afterEach(async () => {
    await app.close();
  });
});
