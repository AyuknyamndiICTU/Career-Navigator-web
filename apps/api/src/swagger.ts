import { timingSafeEqual } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { API_PREFIX } from './lib/api-prefix';
import { env } from './config/env';

export const SWAGGER_PATH = `${API_PREFIX}/docs`;

export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
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
    // Paths already include the /api prefix, so the server is the current origin.
    .addServer('/', 'Current origin')
    .addTag('auth', 'Authentication & account management')
    .addTag('profile', 'User profile, education & work experience')
    .addTag('upload', 'File uploads (CV, profile picture)')
    .addTag('resume', 'Resume builder & templates')
    .addTag('jobs', 'Job listings, applications & matching')
    .addTag('mentors', 'Mentor discovery & profiles')
    .addTag('ai', 'AI chat, mock interviews & course recommendations')
    .addTag('video', 'Video calls (LiveKit)')
    .addTag('conversations', 'Real-time messaging')
    .addTag('notifications', 'User notifications')
    .addTag('admin', 'Admin dashboard & user management')
    .addTag('courses', 'Course catalog & scraping')
    .addTag('config', 'Public runtime settings for the web app')
    .build();

  return SwaggerModule.createDocument(app, config, {
    include: [AppModule],
    deepScanRoutes: true,
  });
}

function sameSecret(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Serves Swagger UI at /api/docs (JSON at /api/docs-json), optionally behind HTTP basic auth. */
export function setupSwagger(app: INestApplication): void {
  const user = env.swaggerUser;
  const password = env.swaggerPassword;
  if (user && password) {
    // Also covers /api/docs-json, which a mount path would not match.
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (!req.path.startsWith(`/${SWAGGER_PATH}`)) return next();
      const [scheme, encoded] = (req.headers.authorization ?? '').split(' ');
      const [u, ...rest] = Buffer.from(encoded ?? '', 'base64')
        .toString()
        .split(':');
      if (
        scheme === 'Basic' &&
        sameSecret(u ?? '', user) &&
        sameSecret(rest.join(':'), password)
      ) {
        return next();
      }
      res.setHeader('WWW-Authenticate', 'Basic realm="api-docs"');
      res.status(401).send('Authentication required');
    });
  }

  SwaggerModule.setup(SWAGGER_PATH, app, buildOpenApiDocument(app), {
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'list',
      filter: true,
      tryItOutEnabled: true,
    },
    customSiteTitle: 'Career Navigator API Docs',
  });
}
