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

describe('Profile / Education flows (e2e routes)', () => {
  let app: INestApplication<App>;

  const userId = 'user-1';
  const educationId = 'edu-1';
  const workExperienceId = 'we-1';

  const mockEducation: Record<string, any> = {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const mockWorkExperience: Record<string, any> = {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const mockProfile: Record<string, any> = {
    upsert: jest.fn(),
  };

  const mockPrisma: Record<string, any> = {
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

  it('GET /profile without auth returns 401', async () => {
    await request(app.getHttpServer()).get('/profile').expect(401);
  });

  it('GET /profile with auth returns profile', async () => {
    mockProfile.upsert.mockResolvedValue({
      id: 'profile-1',
      userId,
      firstName: 'Alice',
      lastName: null,
      headline: null,
    });

    const token = signTestToken();
    const res = await request(app.getHttpServer())
      .get('/profile')
      .set('authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.userId).toBe(userId);
    expect(mockProfile.upsert).toHaveBeenCalledTimes(1);
  });

  it('PUT /profile with auth upserts profile', async () => {
    mockProfile.upsert.mockResolvedValue({
      id: 'profile-1',
      userId,
      firstName: 'Alice',
    });

    const token = signTestToken();
    const res = await request(app.getHttpServer())
      .put('/profile')
      .set('authorization', `Bearer ${token}`)
      .send({ firstName: 'Alice' })
      .expect(200);

    expect(res.body.firstName).toBe('Alice');
    expect(mockProfile.upsert).toHaveBeenCalledTimes(1);
  });

  it('GET /profile/education with auth lists education entries', async () => {
    mockEducation.findMany.mockResolvedValue([
      {
        id: educationId,
        userId,
        degree: 'BSc',
        startYear: 2018,
        endYear: 2022,
        isCurrent: false,
      },
    ]);

    const token = signTestToken();
    const res = await request(app.getHttpServer())
      .get('/profile/education')
      .set('authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
    expect(mockEducation.findMany).toHaveBeenCalledTimes(1);
  });

  it('POST /profile/education with auth creates education entry', async () => {
    mockEducation.create.mockResolvedValue({
      id: educationId,
      userId,
      degree: 'BSc',
    });

    const token = signTestToken();
    await request(app.getHttpServer())
      .post('/profile/education')
      .set('authorization', `Bearer ${token}`)
      .send({ degree: 'BSc' })
      .expect(201);

    expect(mockEducation.create).toHaveBeenCalledTimes(1);
    const arg = mockEducation.create.mock.calls[0][0];
    expect(arg).toEqual({ data: { userId, degree: 'BSc' } });
  });

  it('PUT /profile/education/:educationId with auth updates education entry (owned)', async () => {
    mockEducation.findFirst.mockResolvedValue({ id: educationId });
    mockEducation.update.mockResolvedValue({
      id: educationId,
      userId,
      degree: 'MSc',
    });

    const token = signTestToken();
    await request(app.getHttpServer())
      .put(`/profile/education/${educationId}`)
      .set('authorization', `Bearer ${token}`)
      .send({ degree: 'MSc' })
      .expect(200);

    expect(mockEducation.findFirst).toHaveBeenCalledTimes(1);
    expect(mockEducation.update).toHaveBeenCalledTimes(1);

    const updateArg = mockEducation.update.mock.calls[0][0];
    expect(updateArg).toEqual({
      where: { id: educationId },
      data: { degree: 'MSc' },
    });
  });

  it('PUT /profile/education/:educationId with auth rejects update (not owned)', async () => {
    mockEducation.findFirst.mockResolvedValue(undefined);

    const token = signTestToken();
    await request(app.getHttpServer())
      .put(`/profile/education/${educationId}`)
      .set('authorization', `Bearer ${token}`)
      .send({ degree: 'MSc' })
      .expect(400);

    expect(mockEducation.update).not.toHaveBeenCalled();
  });

  it('DELETE /profile/education/:educationId with auth deletes education entry (owned)', async () => {
    mockEducation.findFirst.mockResolvedValue({ id: educationId });
    mockEducation.delete.mockResolvedValue({});

    const token = signTestToken();
    const res = await request(app.getHttpServer())
      .delete(`/profile/education/${educationId}`)
      .set('authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toEqual({ message: 'Education deleted' });
    expect(mockEducation.delete).toHaveBeenCalledTimes(1);
  });

  it('DELETE /profile/education/:educationId with auth rejects delete (not owned)', async () => {
    mockEducation.findFirst.mockResolvedValue(undefined);

    const token = signTestToken();
    await request(app.getHttpServer())
      .delete(`/profile/education/${educationId}`)
      .set('authorization', `Bearer ${token}`)
      .expect(400);

    expect(mockEducation.delete).not.toHaveBeenCalled();
  });

  // Milestone 2.2 Work experience CRUD

  it('GET /profile/work-experience without auth returns 401', async () => {
    await request(app.getHttpServer())
      .get('/profile/work-experience')
      .expect(401);
  });

  it('GET /profile/work-experience with auth lists work experiences', async () => {
    mockWorkExperience.findMany.mockResolvedValue([
      {
        id: workExperienceId,
        userId,
        jobTitle: 'Software Engineer',
        company: 'Acme',
        startYear: 2020,
        endYear: 2023,
        isCurrent: false,
      },
    ]);

    const token = signTestToken();
    const res = await request(app.getHttpServer())
      .get('/profile/work-experience')
      .set('authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
    expect(mockWorkExperience.findMany).toHaveBeenCalledTimes(1);
  });

  it('POST /profile/work-experience with auth creates work experience entry', async () => {
    mockWorkExperience.create.mockResolvedValue({
      id: workExperienceId,
      userId,
      jobTitle: 'Software Engineer',
    });

    const token = signTestToken();
    await request(app.getHttpServer())
      .post('/profile/work-experience')
      .set('authorization', `Bearer ${token}`)
      .send({ jobTitle: 'Software Engineer', company: 'Acme' })
      .expect(201);

    expect(mockWorkExperience.create).toHaveBeenCalledTimes(1);
    const arg = mockWorkExperience.create.mock.calls[0][0];
    expect(arg).toEqual({
      data: { userId, jobTitle: 'Software Engineer', company: 'Acme' },
    });
  });

  it('PUT /profile/work-experience/:workExperienceId with auth updates work experience entry (owned)', async () => {
    mockWorkExperience.findFirst.mockResolvedValue({ id: workExperienceId });
    mockWorkExperience.update.mockResolvedValue({
      id: workExperienceId,
      userId,
      jobTitle: 'Senior Engineer',
      company: 'Acme',
    });

    const token = signTestToken();
    await request(app.getHttpServer())
      .put(`/profile/work-experience/${workExperienceId}`)
      .set('authorization', `Bearer ${token}`)
      .send({ jobTitle: 'Senior Engineer' })
      .expect(200);

    expect(mockWorkExperience.findFirst).toHaveBeenCalledTimes(1);
    expect(mockWorkExperience.update).toHaveBeenCalledTimes(1);

    const updateArg = mockWorkExperience.update.mock.calls[0][0];
    expect(updateArg).toEqual({
      where: { id: workExperienceId },
      data: { jobTitle: 'Senior Engineer' },
    });
  });

  it('PUT /profile/work-experience/:workExperienceId with auth rejects update (not owned)', async () => {
    mockWorkExperience.findFirst.mockResolvedValue(undefined);

    const token = signTestToken();
    await request(app.getHttpServer())
      .put(`/profile/work-experience/${workExperienceId}`)
      .set('authorization', `Bearer ${token}`)
      .send({ jobTitle: 'Senior Engineer' })
      .expect(400);

    expect(mockWorkExperience.update).not.toHaveBeenCalled();
  });

  it('DELETE /profile/work-experience/:workExperienceId with auth deletes work experience entry (owned)', async () => {
    mockWorkExperience.findFirst.mockResolvedValue({ id: workExperienceId });
    mockWorkExperience.delete.mockResolvedValue({});

    const token = signTestToken();
    const res = await request(app.getHttpServer())
      .delete(`/profile/work-experience/${workExperienceId}`)
      .set('authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toEqual({ message: 'Work experience deleted' });
    expect(mockWorkExperience.delete).toHaveBeenCalledTimes(1);
  });

  it('DELETE /profile/work-experience/:workExperienceId with auth rejects delete (not owned)', async () => {
    mockWorkExperience.findFirst.mockResolvedValue(undefined);

    const token = signTestToken();
    await request(app.getHttpServer())
      .delete(`/profile/work-experience/${workExperienceId}`)
      .set('authorization', `Bearer ${token}`)
      .expect(400);

    expect(mockWorkExperience.delete).not.toHaveBeenCalled();
  });
});
