/* global process */
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { RedisIoAdapter } from './realtime/redis-io.adapter';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { getAIProvider } from './lib/aiProvider';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Log active provider once at startup (Gemini vs Ollama Cloud).
  // The utility itself prints: "[AI Provider] Active: Gemini|Ollama Cloud"
  try {
    getAIProvider();
  } catch (err) {
    console.warn('AI Provider initialization warning:', err);
  }

  // CORS — allow the web frontend to call the API cross-origin
  const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS;

  let corsOrigin: boolean | string | string[];
  if (!allowedOrigins || allowedOrigins.trim() === '*') {
    // When credentials: true, the spec forbids the literal "*" header.
    // Setting origin to `true` makes Express reflect the request's Origin.
    corsOrigin = true;
  } else {
    corsOrigin = allowedOrigins.split(',').map((o) => o.trim());
  }

  app.enableCors({
    origin: corsOrigin,
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
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // Login-specific brute-force rate limiter (strict, per-endpoint)
  app.use(
    '/auth/login',
    rateLimit({
      windowMs: 60_000, // 1 minute
      limit: 5, // max 5 login attempts per minute per IP
      standardHeaders: true,
      legacyHeaders: false,
      message: { message: 'Too many login attempts. Please try again in a minute.' },
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

  // Swagger / OpenAPI documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Career Navigator API')
    .setDescription(
      'REST API for the Career Navigator platform — AI-powered career guidance, resume building, job matching, mentor discovery, and more.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter JWT access token',
        in: 'header',
      },
      'access-token',
    )
    .addServer('http://localhost:3001', 'Local Development')
    .addTag('auth', 'Authentication & account management')
    .addTag('profile', 'User profile, education & work experience')
    .addTag('upload', 'File uploads (CV, profile picture)')
    .addTag('resume', 'Resume builder & templates')
    .addTag('jobs', 'Job listings, applications & matching')
    .addTag('mentors', 'Mentor discovery & profiles')
    .addTag('ai', 'AI chat, mock interviews & course recommendations')
    .addTag('agora', 'Video calling sessions')
    .addTag('conversations', 'Real-time messaging')
    .addTag('notifications', 'User notifications')
    .addTag('admin', 'Admin dashboard & user management')
    .addTag('courses', 'Course catalog & scraping')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig, {
    include: [AppModule],
    deepScanRoutes: true,
  });
  SwaggerModule.setup('api-docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'list',
      filter: true,
      tryItOutEnabled: true,
    },
    customSiteTitle: 'Career Navigator API Docs',
  });

  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
