import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { RedisIoAdapter } from './realtime/redis-io.adapter';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS — allow the web frontend to call the API cross-origin
  const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS;
  app.enableCors({
    origin: allowedOrigins
      ? allowedOrigins.split(',').map((o) => o.trim())
      : '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    app.useWebSocketAdapter(new RedisIoAdapter(app, redisUrl));
  }

  // Production hardening
  app.use(
    helmet({
      contentSecurityPolicy: false,
    }),
  );

  const rateLimitWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000);
  const rateLimitMax = Number(process.env.RATE_LIMIT_MAX ?? 200);

  app.use(
    rateLimit({
      windowMs: Number.isFinite(rateLimitWindowMs) ? rateLimitWindowMs : 60_000,
      limit: Number.isFinite(rateLimitMax) ? rateLimitMax : 200,
      standardHeaders: true,
      legacyHeaders: false,
      skip: (req) =>
        req.path.startsWith('/api-docs') || req.path.startsWith('/health'),
    }),
  );

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Career Navigator API')
    .setDescription('Career Navigator REST API documentation')
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
