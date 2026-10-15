import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import type { RequestWithId } from './request-context.middleware';

/**
 * Every HTTP error leaves the API as `{ statusCode, message, ..., requestId }`.
 * Unexpected errors are logged with their stack and returned as a generic 500 —
 * internal details and stack traces never reach the client.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') {
      this.logger.error('Unhandled non-HTTP exception', errorStack(exception));
      return;
    }

    const ctx = host.switchToHttp();
    const req = ctx.getRequest<RequestWithId>();
    const res = ctx.getResponse<Response>();
    const requestId = req.id;

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: Record<string, unknown> = {
      statusCode: status,
      message: 'Internal server error',
    };

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const response = exception.getResponse();
      body =
        typeof response === 'string'
          ? { statusCode: status, message: response }
          : { statusCode: status, ...(response as Record<string, unknown>) };
    }

    if (status >= 500) {
      this.logger.error(
        `${req.method} ${req.originalUrl.split('?')[0]} failed requestId=${requestId}`,
        errorStack(exception),
      );
    }

    // Streaming responses (SSE) may already have started; nothing more can be sent.
    if (res.headersSent) {
      res.end();
      return;
    }

    res.status(status).json({ ...body, requestId });
  }
}

function errorStack(exception: unknown): string {
  return exception instanceof Error
    ? (exception.stack ?? exception.message)
    : String(exception);
}
