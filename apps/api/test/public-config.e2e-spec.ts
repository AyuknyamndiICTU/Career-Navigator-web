import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { describe, afterEach, it, expect } from '@jest/globals';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { API_PREFIX } from '../src/lib/api-prefix';
import { setupSwagger } from '../src/swagger';

describe('Public config + Swagger (Phase 14.1 / 14.8)', () => {
  let app: INestApplication<App>;
  const saved = { ...process.env };

  async function start(withSwagger = false): Promise<void> {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix(API_PREFIX);
    if (withSwagger) setupSwagger(app);
    await app.init();
  }

  afterEach(async () => {
    await app.close();
    process.env = { ...saved };
  });

  it('GET /api/config/public is anonymous and exposes only browser-safe settings', async () => {
    process.env.LIVEKIT_URL = 'wss://video.example.com';
    process.env.LIVEKIT_API_KEY = 'key';
    process.env.LIVEKIT_API_SECRET = 'secret-livekit-value';
    await start();

    const res = await request(app.getHttpServer())
      .get('/api/config/public')
      .expect(200);

    expect(res.body).toEqual({
      videoEnabled: true,
      aiByokEnabled: false,
      cvAiAssistEnabled: true,
    });
    expect(JSON.stringify(res.body)).not.toContain('secret-livekit-value');
    expect(res.headers['cache-control']).toContain('max-age=300');
  });

  it('serves the OpenAPI document at /api/docs-json with a relative server', async () => {
    delete process.env.SWAGGER_USER;
    delete process.env.SWAGGER_PASSWORD;
    await start(true);

    const res = await request(app.getHttpServer())
      .get('/api/docs-json')
      .expect(200);

    expect(res.body.servers).toEqual([
      { url: '/', description: 'Current origin' },
    ]);
    expect(Object.keys(res.body.paths)).toContain('/api/config/public');
    expect(Object.keys(res.body.paths)).not.toContain('/api/jobs/index');
  });

  it('requires basic auth for the docs when SWAGGER_USER/SWAGGER_PASSWORD are set', async () => {
    process.env.SWAGGER_USER = 'docs';
    process.env.SWAGGER_PASSWORD = 'p:ss';
    await start(true);
    const server = app.getHttpServer();

    await request(server).get('/api/docs-json').expect(401);
    await request(server)
      .get('/api/docs-json')
      .auth('docs', 'wrong')
      .expect(401);
    await request(server)
      .get('/api/docs-json')
      .auth('docs', 'p:ss')
      .expect(200);
    // Other routes are unaffected.
    await request(server).get('/api/config/public').expect(200);
  });
});
