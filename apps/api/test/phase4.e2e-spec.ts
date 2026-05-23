import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { describe, beforeEach, afterEach, it, jest, expect } from '@jest/globals';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Phase 4 flows (e2e routes)', () => {
  let app: INestApplication<App>;

  const prismaMock = {
    job: {
      findMany: jest.fn(() => Promise.resolve([{ id: 'job1', title: 'Engineer', status: 'ACTIVE' }])),
      count: jest.fn(() => Promise.resolve(1)),
    },
    mentor: {
      findMany: jest.fn(() => Promise.resolve([{ id: 'm1', displayName: 'Alice' }])),
      count: jest.fn(() => Promise.resolve(1)),
    },
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('GET /jobs works', async () => {
    await request(app.getHttpServer())
      .get('/jobs?limit=10&page=1')
      .expect(200)
      .expect((res) => {
        expect(res.body.items.length).toBe(1);
        expect(res.body.items[0].title).toBe('Engineer');
        expect(res.body.total).toBe(1);
      });
  });

  it('GET /mentors works', async () => {
    await request(app.getHttpServer())
      .get('/mentors?limit=10&page=1')
      .expect(200)
      .expect((res) => {
        expect(res.body.items.length).toBe(1);
        expect(res.body.items[0].displayName).toBe('Alice');
        expect(res.body.total).toBe(1);
      });
  });

  it('POST /jobs/rerank without auth returns 401', async () => {
    await request(app.getHttpServer())
      .post('/jobs/rerank')
      .send({ skills: ['React'] })
      .expect(401);
  });

  it('POST /jobs/matched without auth returns 401', async () => {
    await request(app.getHttpServer())
      .post('/jobs/matched')
      .send({})
      .expect(401);
  });

  afterEach(async () => {
    await app.close();
  });
});
