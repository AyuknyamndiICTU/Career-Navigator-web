import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  describe,
  beforeEach,
  afterEach,
  it,
  expect,
  jest,
} from '@jest/globals';

import { AppModule } from '../src/app.module';
import { AuthService } from '../src/auth/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Mentors search (Milestone 3.3)', () => {
  let app: INestApplication<App>;

  const mockMentor: Record<string, any> = {
    findMany: jest.fn(),
    count: jest.fn(),
  };

  const mockPrisma: Record<string, unknown> = {
    mentor: mockMentor,
  };

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

  afterEach(async () => {
    await app.close();
  });

  it('GET /mentors returns paginated items', async () => {
    mockMentor.findMany.mockResolvedValue([
      {
        id: 'mentor-1',
        displayName: 'John Mentor',
        bio: 'Expert in TS',
        skills: ['ts', 'node'],
        expertise: ['frontend'],
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-02T00:00:00Z'),
      },
    ]);

    mockMentor.count.mockResolvedValue(1);

    const res = await request(app.getHttpServer())
      .get('/mentors?page=1&limit=10')
      .expect(200);

    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.total).toBe(1);
    expect(mockMentor.findMany).toHaveBeenCalledTimes(1);
    expect(mockMentor.count).toHaveBeenCalledTimes(1);
  });

  it('GET /mentors filters by q, skill, and expertise', async () => {
    mockMentor.findMany.mockResolvedValue([]);
    mockMentor.count.mockResolvedValue(0);

    const url = '/mentors?q=mentor&skill=ts&expertise=frontend&page=2&limit=5';

    await request(app.getHttpServer()).get(url).expect(200);

    const findManyArgs = mockMentor.findMany.mock.calls[0][0];

    expect(findManyArgs.take).toBe(5);
    expect(findManyArgs.skip).toBe(5);

    expect(findManyArgs.where.skills.has).toBe('ts');
    expect(findManyArgs.where.expertise.has).toBe('frontend');

    expect(Array.isArray(findManyArgs.where.OR)).toBe(true);
    expect(findManyArgs.where.OR).toHaveLength(2);
    expect(findManyArgs.where.OR[0].displayName.contains).toBe('mentor');
    expect(findManyArgs.where.OR[1].bio.contains).toBe('mentor');
  });

  it('GET /mentors defaults when pagination params are invalid', async () => {
    mockMentor.findMany.mockResolvedValue([]);
    mockMentor.count.mockResolvedValue(0);

    const res = await request(app.getHttpServer())
      .get('/mentors?page=BAD')
      .expect(200);

    expect(Array.isArray(res.body.items)).toBe(true);
    expect(mockMentor.findMany).toHaveBeenCalledTimes(1);
    expect(mockMentor.count).toHaveBeenCalledTimes(1);
  });
});
