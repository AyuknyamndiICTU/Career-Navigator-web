import {
  describe,
  beforeAll,
  afterAll,
  beforeEach,
  it,
  expect,
  jest,
} from '@jest/globals';

jest.mock('minio', () => {
  return {
    Client: jest.fn().mockImplementation(() => ({
      putObject: jest.fn().mockResolvedValue({}),
    })),
  };
});

import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';

import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { AuthService } from '../src/auth/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { signAccessToken } from '../src/auth/jwt/jwt-utils';

describe('Upload endpoints (Milestone 2.3)', () => {
  let app: INestApplication<App>;

  const userId = 'user-1';

  const mockPrisma: any = {
    uploadMedia: {
      upsert: jest.fn().mockResolvedValue({} as never),
    },
  };

  beforeAll(() => {
    // multer destination is './tmp' (relative to process.cwd())
    fs.mkdirSync(path.join(process.cwd(), 'tmp'), { recursive: true });

    process.env.JWT_ACCESS_SECRET = 'test-secret';
    process.env.MINIO_ENDPOINT = 'http://localhost:9000';
    process.env.MINIO_ACCESS_KEY = 'minio-access';
    process.env.MINIO_SECRET_KEY = 'minio-secret';
    process.env.MINIO_BUCKET = 'resumes';
  });

  beforeEach(async () => {
    jest.clearAllMocks();

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

  afterAll(async () => {
    await app.close();
  });

  const signTestToken = (): string => {
    return signAccessToken({
      secret: process.env.JWT_ACCESS_SECRET ?? 'test-secret',
      expiresIn: '15m',
      userId,
      email: 'alice@example.com',
      isActive: true,
    });
  };

  const fileBuffer = Buffer.from('dummy-content');

  it('POST /upload/picture without auth returns 401', async () => {
    await request(app.getHttpServer())
      .post('/upload/picture')
      .attach('file', fileBuffer, {
        filename: 'pic.png',
        contentType: 'image/png',
      })
      .expect(401);
  });

  it('POST /upload/picture uploads and persists metadata', async () => {
    mockPrisma.uploadMedia.upsert.mockResolvedValue({} as never);

    const token = signTestToken();
    await request(app.getHttpServer())
      .post('/upload/picture')
      .set('authorization', `Bearer ${token}`)
      .attach('file', fileBuffer, {
        filename: 'pic.png',
        contentType: 'image/png',
      })
      .expect(200);

    expect(mockPrisma.uploadMedia.upsert).toHaveBeenCalledTimes(1);
  });

  it('POST /upload/cv without auth returns 401', async () => {
    await request(app.getHttpServer())
      .post('/upload/cv')
      .attach('file', fileBuffer, {
        filename: 'cv.pdf',
        contentType: 'application/pdf',
      })
      .expect(401);
  });

  it('POST /upload/cv uploads and persists metadata', async () => {
    mockPrisma.uploadMedia.upsert.mockResolvedValue({} as never);

    const token = signTestToken();
    await request(app.getHttpServer())
      .post('/upload/cv')
      .set('authorization', `Bearer ${token}`)
      .attach('file', fileBuffer, {
        filename: 'cv.pdf',
        contentType: 'application/pdf',
      })
      .expect(200);

    expect(mockPrisma.uploadMedia.upsert).toHaveBeenCalledTimes(1);
  });
});
