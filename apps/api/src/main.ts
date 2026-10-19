import { NestFactory } from '@nestjs/core';
import { existsSync } from 'node:fs';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { RedisIoAdapter } from './realtime/redis-io.adapter';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { PROVIDERS } from './ai/gateway/providers';
import { API_PREFIX } from './lib/api-prefix';
import { env, validateEnv } from './config/env';
import { corsOriginCallback } from './config/cors';
import { RedactingLogger } from './logging/redacting-logger';
import { setupSwagger, SWAGGER_PATH } from './swagger';

async function bootstrap() {
  // Local runs read apps/api/.env; containers get real environment variables (existing values win).
  if (existsSync('.env')) process.loadEnvFile('.env');
  validateEnv();

  const app = await NestFactory.create(AppModule, {
    // One JSON object per line in production (log shippers parse it); readable output in dev.
    // Tokens, cookies, passwords, OTPs and API keys are masked before anything is written.
    logger: new RedactingLogger({ json: env.isProduction }),
  });
  app.setGlobalPrefix(API_PREFIX);
  if (env.trustProxyHops > 0) {
    // Client IPs (rate limits, logs) come from X-Forwarded-For set by the proxy.
    app.getHttpAdapter().getInstance().set('trust proxy', env.trustProxyHops);
  }
  // SIGTERM/SIGINT run onModuleDestroy: BullMQ workers, queues, Redis and Prisma close cleanly.
  app.enableShutdownHooks();

  // Which platform AI providers have keys (the gateway skips the rest).
  const aiProviders = Object.values(PROVIDERS)
    .filter((p) => p.platformKey())
    .map((p) => p.name);
  new Logger('AiGateway').log(
    aiProviders.length > 0
      ? `Platform AI providers: ${aiProviders.join(', ')}`
      : 'No platform AI keys configured; only users with their own keys can use AI.',
  );

  // CORS: an explicit allow-list (required in production); dev without a list reflects the origin.
  app.enableCors({
    origin: corsOriginCallback,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
  });

  const redisUrl = env.redisUrl;
  if (redisUrl) {
    app.useWebSocketAdapter(new RedisIoAdapter(app, redisUrl));
  }

  // Production hardening
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // Login-specific brute-force rate limiter (strict, per-endpoint)
  app.use(
    `/${API_PREFIX}/auth/login`,
    rateLimit({
      windowMs: 60_000, // 1 minute
      limit: 5, // max 5 login attempts per minute per IP
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        message: 'Too many login attempts. Please try again in a minute.',
      },
    }),
  );

  // Adding, changing, testing and removing AI keys calls providers; keep it slow for abuse.
  app.use(
    `/${API_PREFIX}/ai/credentials`,
    rateLimit({
      windowMs: 10 * 60_000,
      limit: 30,
      standardHeaders: true,
      legacyHeaders: false,
      skip: (req) => req.method === 'GET',
      message: {
        message: 'Too many AI key changes. Please wait a few minutes.',
      },
    }),
  );

  app.use(
    rateLimit({
      windowMs: env.rateLimitWindowMs,
      limit: env.rateLimitMax,
      standardHeaders: true,
      legacyHeaders: false,
      skip: (req) =>
        req.path.startsWith(`/${SWAGGER_PATH}`) ||
        req.path.startsWith(`/${API_PREFIX}/health`),
    }),
  );

  if (env.swaggerEnabled) {
    setupSwagger(app);
  }

  await app.listen(env.port);
}

void bootstrap();
