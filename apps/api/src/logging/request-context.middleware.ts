import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export type RequestWithId = Request & { id?: string };

const INCOMING_ID = /^[\w-]{1,64}$/;

/**
 * Assigns every request an ID (reusing a well-formed incoming `X-Request-Id`), echoes it in the
 * response and writes one access-log line when the response finishes. Only method, path (no query
 * string), status and timing are logged, so headers, cookies, bodies and tokens never reach the logs.
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: RequestWithId, res: Response, next: NextFunction): void {
    const incoming = req.header('x-request-id');
    const requestId =
      incoming && INCOMING_ID.test(incoming) ? incoming : randomUUID();
    req.id = requestId;
    res.setHeader('X-Request-Id', requestId);

    const startedAt = process.hrtime.bigint();
    res.on('finish', () => {
      const path = req.originalUrl.split('?')[0];
      if (path.includes('/health/')) return;

      const durationMs =
        Math.round(Number(process.hrtime.bigint() - startedAt) / 1e5) / 10;
      const line = `${req.method} ${path} ${res.statusCode} ${durationMs}ms requestId=${requestId}`;

      if (res.statusCode >= 500) this.logger.error(line);
      else if (res.statusCode >= 400) this.logger.warn(line);
      else this.logger.log(line);
    });

    next();
  }
}
