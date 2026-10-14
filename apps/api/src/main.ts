import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { RedisIoAdapter } from './realtime/redis-io.adapter';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { getAIProvider } from './lib/aiProvider';
import { API_PREFIX } from './lib/api-prefix';
import { env, validateEnv } from './config/env';
import { corsOriginCallback } from './config/cors';

async function bootstrap() {
  validateEnv();

  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix(API_PREFIX);

  // Log active provider once at startup (Gemini vs Ollama Cloud).
  // The utility itself prints: "[AI Provider] Active: Gemini|Ollama Cloud"
  try {
    getAIProvider();
  } catch (err) {
    console.warn('AI Provider initialization warning:', err);
  }

  // CORS: an explicit allow-list (required in production); dev without a list reflects the origin.
  app.enableCors({
    origin: corsOriginCallback,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
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
      message: { message: 'Too many login attempts. Please try again in a minute.' },
    }),
  );

  app.use(
    rateLimit({
      windowMs: env.rateLimitWindowMs,
      limit: env.rateLimitMax,
      standardHeaders: true,
      legacyHeaders: false,
      skip: (req) =>
        req.path.startsWith('/api-docs') ||
        req.path.startsWith(`/${API_PREFIX}/health`),
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

  if (env.swaggerEnabled) {
    setupSwagger(app);
  }

  await app.listen(env.port);
}

function setupSwagger(app: Awaited<ReturnType<typeof NestFactory.create>>) {
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
}

void bootstrap();
