import {
  describe,
  beforeAll,
  afterEach,
  beforeEach,
  it,
  expect,
  jest,
} from '@jest/globals';

import request from 'supertest';

import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { AuthService } from '../src/auth/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { AiGatewayService } from '../src/ai/gateway/ai-gateway.service';
import { signAccessToken } from '../src/auth/jwt/jwt-utils';
import { OBJECT_STORAGE } from '../src/storage/object-storage';
import { FakeObjectStorage } from './fake-storage';

/** OCR words for a short CV, one word per item, laid out in lines like tesseract output. */
function ocrWords(): Array<Record<string, number | string>> {
  const lines: Array<[string, number, number]> = [
    ['Jane Doe', 60, 40],
    ['jane.doe@example.com', 30, 80],
    ['EXPERIENCE', 30, 140],
    ['Software Engineer, Acme Corp 2020 - Present', 30, 175],
    ['EDUCATION', 30, 240],
    ['BSc Computer Science, University of Buea 2015 - 2019', 30, 275],
    ['SKILLS', 30, 340],
    ['JavaScript, TypeScript, Docker', 30, 375],
  ];
  const words: Array<Record<string, number | string>> = [];
  for (const [text, height, y] of lines) {
    let x = 50;
    for (const word of text.split(' ')) {
      const width = word.length * height * 0.5;
      words.push({ text: word, x, y, width, height: height * 0.7, page: 1 });
      x += width + height * 0.3;
    }
  }
  return words;
}

describe('Upload endpoints (Milestone 2.3)', () => {
  let app: INestApplication<App>;

  const userId = 'user-1';

  const mockTx: any = {
    profile: {
      findUnique: jest.fn(),
      upsert: jest.fn().mockResolvedValue({} as never),
    },
    education: {
      findMany: jest.fn(),
      update: jest.fn().mockResolvedValue({} as never),
      create: jest.fn().mockResolvedValue({ id: 'edu-new' } as never),
    },
    workExperience: {
      findMany: jest.fn(),
      update: jest.fn().mockResolvedValue({} as never),
      create: jest.fn().mockResolvedValue({ id: 'exp-new' } as never),
    },
  };

  const mockPrisma: any = {
    uploadMedia: {
      upsert: jest.fn().mockResolvedValue({} as never),
      update: jest.fn().mockResolvedValue({} as never),
      findUnique: jest.fn().mockResolvedValue({
        cvScanStatus: 'PENDING',
        cvScanError: null,
        cvExtractedText: null,
      }),
    },
    $queryRaw: jest.fn().mockResolvedValue([{ skill: 'Kubernetes' }] as never),
    $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(mockTx)),
  };

  const mockGateway = { generate: jest.fn() };

  beforeAll(() => {
    process.env.JWT_ACCESS_SECRET = 'test-secret';
  });

  let storage: FakeObjectStorage;

  beforeEach(async () => {
    jest.clearAllMocks();
    storage = new FakeObjectStorage();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AuthService)
      .useValue({})
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .overrideProvider(AiGatewayService)
      .useValue(mockGateway)
      .overrideProvider(OBJECT_STORAGE)
      .useValue(storage)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
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
    const keys = [...storage.objects.keys()];
    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatch(/^users\/user-1\/picture\/[0-9a-f-]{36}\.png$/);
  });

  it('GET /upload/url signs keys the user owns (new and legacy layout)', async () => {
    const token = signTestToken();
    for (const key of [
      'users/user-1/picture/a.webp',
      'user-1/PROFILE_PICTURE/a.png',
    ]) {
      const res = await request(app.getHttpServer())
        .get('/upload/url')
        .query({ key })
        .set('authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body.url).toContain(key);
      expect(res.body.url).toContain('X-Amz-Signature');
    }
  });

  it('GET /upload/url refuses other users, bad keys and anonymous callers', async () => {
    const token = signTestToken();
    await request(app.getHttpServer())
      .get('/upload/url')
      .query({ key: 'users/user-2/cv/a.pdf' })
      .set('authorization', `Bearer ${token}`)
      .expect(403);
    await request(app.getHttpServer())
      .get('/upload/url')
      .query({ key: 'users/user-1/../user-2/cv/a.pdf' })
      .set('authorization', `Bearer ${token}`)
      .expect(403);
    await request(app.getHttpServer())
      .get('/upload/url')
      .query({ key: 'users/user-1/cv/a b?.pdf' })
      .set('authorization', `Bearer ${token}`)
      .expect(400);
    await request(app.getHttpServer())
      .get('/upload/url')
      .query({ key: 'users/user-1/cv/a.pdf' })
      .expect(401);
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

  const jpegBuffer = Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
    Buffer.from('jpeg-body'),
  ]);

  it('POST /upload/cv with browser OCR words parses inline, without AI, and waits for review', async () => {
    mockPrisma.uploadMedia.upsert.mockResolvedValue({ id: 'media-1' } as never);

    const token = signTestToken();
    await request(app.getHttpServer())
      .post('/upload/cv')
      .set('authorization', `Bearer ${token}`)
      .field('ocr', JSON.stringify(ocrWords()))
      .attach('file', jpegBuffer, {
        filename: 'scan.jpg',
        contentType: 'image/jpeg',
      })
      .expect(200);

    expect(mockGateway.generate).not.toHaveBeenCalled();
    expect(mockTx.profile.upsert).not.toHaveBeenCalled();
    const completed = mockPrisma.uploadMedia.update.mock.calls
      .map((c: any[]) => c[0].data)
      .find((d: any) => d.cvScanStatus === 'COMPLETED');
    expect(completed).toBeDefined();
    const stored = JSON.parse(completed.cvExtractedText);
    expect(stored.ocr).toBe('browser');
    expect(stored.fullName).toBe('Jane Doe');
    expect(stored.skills).toEqual(
      expect.arrayContaining(['JavaScript', 'TypeScript', 'Docker']),
    );
    expect(stored.parsed.contact.email.value).toBe('jane.doe@example.com');
    expect(stored.experience[0]).toMatchObject({
      jobTitle: 'Software Engineer',
      company: 'Acme Corp',
    });
    expect(stored.fileSha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('POST /upload/cv rejects malformed OCR data before storing anything', async () => {
    const token = signTestToken();
    await request(app.getHttpServer())
      .post('/upload/cv')
      .set('authorization', `Bearer ${token}`)
      .field(
        'ocr',
        JSON.stringify([
          { text: 'x', x: 'NaN', y: 0, width: 1, height: 1, page: 1 },
        ]),
      )
      .attach('file', jpegBuffer, {
        filename: 'scan.jpg',
        contentType: 'image/jpeg',
      })
      .expect(400);

    expect(mockPrisma.uploadMedia.upsert).not.toHaveBeenCalled();
  });

  const storedScan = {
    fullName: 'Jane Doe',
    summary: null,
    skills: ['Docker'],
    education: [],
    experience: [],
    fileSha256: 'a'.repeat(64),
    parserVersion: 1,
    ocr: 'none',
    parsed: {
      contact: {
        fullName: { value: 'Jane Doe', confidence: 0.9, source: 'Jane Doe' },
      },
      sections: [
        {
          kind: 'skills',
          heading: 'Skills',
          text: 'Docker, k8s',
          confidence: 0.9,
        },
      ],
    },
  };

  const completedMedia = (extra: Record<string, unknown> = {}) => ({
    id: 'media-1',
    cvScanStatus: 'COMPLETED',
    cvScanError: null,
    cvExtractedText: JSON.stringify(storedScan),
    cvConfirmedAt: null,
    originalFilename: 'cv.pdf',
    ...extra,
  });

  it('GET /upload/cv/status returns the parsed CV for review', async () => {
    mockPrisma.uploadMedia.findUnique.mockResolvedValueOnce(
      completedMedia() as never,
    );
    const token = signTestToken();
    const res = await request(app.getHttpServer())
      .get('/upload/cv/status')
      .set('authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.status).toBe('COMPLETED');
    expect(res.body.skills).toEqual(['Docker']);
    expect(res.body.review.contact.fullName.value).toBe('Jane Doe');
    expect(res.body.confirmedAt).toBeNull();
    expect(typeof res.body.aiAssistAvailable).toBe('boolean');
  });

  it('POST /upload/cv/confirm merges into the profile without duplicating entries', async () => {
    mockPrisma.uploadMedia.findUnique.mockResolvedValueOnce(
      completedMedia() as never,
    );
    mockTx.profile.findUnique.mockResolvedValue({
      cvWizardData: { skills: ['React'], objective: 'Keep me' },
    } as never);
    mockTx.education.findMany.mockResolvedValue([
      {
        id: 'edu-1',
        institution: 'University of Buea',
        degree: 'BSc',
        startYear: 2015,
        endYear: null,
        grade: null,
        description: null,
        fieldOfStudy: null,
        isCurrent: false,
      },
    ] as never);
    mockTx.workExperience.findMany.mockResolvedValue([] as never);

    const token = signTestToken();
    const res = await request(app.getHttpServer())
      .post('/upload/cv/confirm')
      .set('authorization', `Bearer ${token}`)
      .send({
        fullName: 'Jane Doe',
        skills: ['Docker', 'react'],
        education: [
          {
            degree: 'BSc',
            fieldOfStudy: 'Computer Science',
            institution: 'university of buea',
            startYear: 2015,
            endYear: 2019,
          },
        ],
        experience: [
          {
            jobTitle: 'Software Engineer',
            company: 'Acme Corp',
            startYear: 2020,
            isCurrent: true,
          },
        ],
      })
      .expect(200);

    expect(res.body).toMatchObject({ educationAdded: 0, experienceAdded: 1 });
    expect(mockTx.education.create).not.toHaveBeenCalled();
    expect(mockTx.education.update).toHaveBeenCalledWith({
      where: { id: 'edu-1' },
      data: { fieldOfStudy: 'Computer Science', endYear: 2019 },
    });
    expect(mockTx.workExperience.create).toHaveBeenCalledTimes(1);
    const profile = mockTx.profile.upsert.mock.calls[0][0].update;
    expect(profile).toMatchObject({ firstName: 'Jane', lastName: 'Doe' });
    expect(profile.cvWizardData).toEqual({
      skills: ['React', 'Docker'],
      objective: 'Keep me',
    });
    const confirmed = mockPrisma.uploadMedia.update.mock.calls[0][0].data;
    expect(confirmed.cvConfirmedAt).toBeInstanceOf(Date);
    expect(JSON.parse(confirmed.cvExtractedText).skills).toEqual([
      'Docker',
      'react',
    ]);
  });

  it('POST /upload/cv/confirm validates the review payload', async () => {
    const token = signTestToken();
    await request(app.getHttpServer())
      .post('/upload/cv/confirm')
      .set('authorization', `Bearer ${token}`)
      .send({ education: [{ startYear: 'soon' }], isAdmin: true })
      .expect(400);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('POST /upload/cv/confirm needs a completed scan', async () => {
    const token = signTestToken();
    await request(app.getHttpServer())
      .post('/upload/cv/confirm')
      .set('authorization', `Bearer ${token}`)
      .send({ fullName: 'Jane Doe' })
      .expect(400);
  });

  it('POST /upload/cv/assist re-reads one section with redacted text and a per-file cache key', async () => {
    mockPrisma.uploadMedia.findUnique.mockResolvedValueOnce(
      completedMedia() as never,
    );
    mockGateway.generate.mockResolvedValueOnce({
      text: `\`\`\`json\n${JSON.stringify({ skills: ['Docker', 'Kubernetes', 'x'.repeat(200)], extra: 'ignored' })}\n\`\`\``,
    } as never);

    const token = signTestToken();
    const res = await request(app.getHttpServer())
      .post('/upload/cv/assist')
      .set('authorization', `Bearer ${token}`)
      .send({ section: 'skills' })
      .expect(200);

    expect(res.body.section).toBe('skills');
    expect(res.body.result.skills.slice(0, 2)).toEqual([
      'Docker',
      'Kubernetes',
    ]);
    expect(res.body.result.skills[2].length).toBeLessThanOrEqual(60);
    const req = mockGateway.generate.mock.calls[0][0] as any;
    expect(req.task).toBe('cv-assist');
    expect(req.cache.key).toBe(`${'a'.repeat(64)}:skills`);
    expect(req.messages[0].content).toContain('Docker, k8s');
  });

  it('POST /upload/cv/assist rejects unknown sections and respects CV_AI_ASSIST_ENABLED', async () => {
    const token = signTestToken();
    await request(app.getHttpServer())
      .post('/upload/cv/assist')
      .set('authorization', `Bearer ${token}`)
      .send({ section: 'contact' })
      .expect(400);

    process.env.CV_AI_ASSIST_ENABLED = 'false';
    try {
      await request(app.getHttpServer())
        .post('/upload/cv/assist')
        .set('authorization', `Bearer ${token}`)
        .send({ section: 'skills' })
        .expect(403);
    } finally {
      delete process.env.CV_AI_ASSIST_ENABLED;
    }
    expect(mockGateway.generate).not.toHaveBeenCalled();
  });
});
