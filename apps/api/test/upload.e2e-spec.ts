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
      bucketExists: jest.fn().mockResolvedValue(true as never),
      makeBucket: jest.fn().mockResolvedValue(undefined as never),
      putObject: jest.fn().mockResolvedValue({} as never),
    })),
  };
});

import request from 'supertest';

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
      findUnique: jest.fn().mockResolvedValue({
        cvScanStatus: 'PENDING',
        cvScanError: null,
        cvExtractedText: null,
      }),
    },
  };

  beforeAll(() => {
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

  const pngBuffer = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from('png-body'),
  ]);
  const pdfBuffer = Buffer.from('%PDF-1.7\ndummy');
  const docxBuffer = Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x03, 0x04]),
    Buffer.from('docx-body'),
  ]);
  const fileBuffer = pngBuffer;

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

  it('POST /upload/picture rejects content that is not really an image', async () => {
    const token = signTestToken();
    await request(app.getHttpServer())
      .post('/upload/picture')
      .set('authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('<script>alert(1)</script>'), {
        filename: 'pic.png',
        contentType: 'image/png',
      })
      .expect(400);

    expect(mockPrisma.uploadMedia.upsert).not.toHaveBeenCalled();
  });

  it('POST /upload/cv without auth returns 401', async () => {
    await request(app.getHttpServer())
      .post('/upload/cv')
      .attach('file', pdfBuffer, {
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
      .attach('file', pdfBuffer, {
        filename: 'cv.pdf',
        contentType: 'application/pdf',
      })
      .expect(200);

    expect(mockPrisma.uploadMedia.upsert).toHaveBeenCalledTimes(1);
  });

  it('POST /upload/cv accepts DOCX files', async () => {
    mockPrisma.uploadMedia.upsert.mockResolvedValue({} as never);

    const token = signTestToken();
    await request(app.getHttpServer())
      .post('/upload/cv')
      .set('authorization', `Bearer ${token}`)
      .attach('file', docxBuffer, {
        filename: 'cv.docx',
        contentType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      })
      .expect(200);

    expect(mockPrisma.uploadMedia.upsert).toHaveBeenCalledTimes(1);

    const statusRes = await request(app.getHttpServer())
      .get('/upload/cv/status')
      .set('authorization', `Bearer ${token}`)
      .expect(200);

    expect(statusRes.body).toHaveProperty('status');
    expect(statusRes.body).toHaveProperty('error');
    expect(statusRes.body).toHaveProperty('skills');
    expect(Array.isArray(statusRes.body.skills)).toBe(true);
    expect(statusRes.body.skills).toEqual([]);
  });

  it('POST /upload/cv (PDF) returns expected status shape', async () => {
    mockPrisma.uploadMedia.upsert.mockResolvedValue({} as never);

    const token = signTestToken();
    await request(app.getHttpServer())
      .post('/upload/cv')
      .set('authorization', `Bearer ${token}`)
      .attach('file', pdfBuffer, {
        filename: 'cv.pdf',
        contentType: 'application/pdf',
      })
      .expect(200);

    const statusRes = await request(app.getHttpServer())
      .get('/upload/cv/status')
      .set('authorization', `Bearer ${token}`)
      .expect(200);

    expect(statusRes.body).toHaveProperty('status');
    expect(statusRes.body).toHaveProperty('error');
    expect(statusRes.body).toHaveProperty('skills');
    expect(Array.isArray(statusRes.body.skills)).toBe(true);
  });
});
