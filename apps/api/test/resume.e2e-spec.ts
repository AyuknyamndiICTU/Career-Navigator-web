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

describe('Resume builder (Milestone 2.4)', () => {
  let app: INestApplication<App>;

  const userId = 'user-1';

  const mockProfile = {
    findUnique: jest.fn(),
  };

  const mockEducation = {
    findMany: jest.fn(),
  };

  const mockWorkExperience = {
    findMany: jest.fn(),
  };

  const mockPrisma = {
    profile: mockProfile,
    education: mockEducation,
    workExperience: mockWorkExperience,
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
    process.env.JWT_ACCESS_SECRET = 'test-secret';
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

  afterEach(async () => {
    await app.close();
  });

  it('POST /resume/build without auth returns 401', async () => {
    await request(app.getHttpServer())
      .post('/resume/build')
      .send({ template: 'STANDARD' })
      .expect(401);
  });

  it('POST /resume/build with auth returns structured resume', async () => {
    mockProfile.findUnique.mockResolvedValue({
      userId,
      firstName: 'Alice',
      lastName: 'Doe',
      headline: 'Software Engineer',
      phone: '0700-000-000',
      location: 'Lagos',
      summary: 'Building products.',
    } as any);

    mockEducation.findMany.mockResolvedValue([
      {
        id: 'edu-1',
        userId,
        degree: 'BSc',
        fieldOfStudy: 'Computer Science',
        institution: 'Uni A',
        startYear: 2018,
        endYear: 2022,
        grade: null,
        description: null,
        isCurrent: false,
      },
    ] as never);

    mockWorkExperience.findMany.mockResolvedValue([
      {
        id: 'we-1',
        userId,
        jobTitle: 'Software Engineer',
        company: 'Acme',
        location: 'Lagos',
        startYear: 2020,
        endYear: 2023,
        description: 'Worked on services.',
        isCurrent: false,
      },
    ] as never);

    const token = signTestToken();
    const res = await request(app.getHttpServer())
      .post('/resume/build')
      .set('authorization', `Bearer ${token}`)
      .send({ template: 'STANDARD' })
      .expect(200);

    expect(res.body.template).toBe('STANDARD');
    expect(res.body.sections.header.fullName).toBe('Alice Doe');
    expect(res.body.sections.experience).toHaveLength(1);
    expect(res.body.sections.education).toHaveLength(1);
  });
});
