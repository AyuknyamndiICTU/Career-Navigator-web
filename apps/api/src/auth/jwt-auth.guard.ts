import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { env } from '../config/env';
import { AccessTokenPayload, verifyAccessToken } from './jwt/jwt-utils';

export type AuthUser = AccessTokenPayload;
type AuthenticatedRequest = Request & { user?: AuthUser };

const IS_PUBLIC_KEY = 'isPublic';

/** Opts a route (or controller) out of the global JWT guard. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Injects the authenticated user, or one of its fields: `@CurrentUser('sub') userId: string`. */
export const CurrentUser = createParamDecorator(
  (field: keyof AuthUser | undefined, context: ExecutionContext) => {
    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
    return field ? user?.[field] : user;
  },
);

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Socket.IO connections authenticate in the gateway handshake instead.
    if (context.getType() !== 'http') return true;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = request.headers.authorization
      ?.replace(/^Bearer\s+/i, '')
      .trim();
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const secret = env.jwt.accessSecret;
    if (!secret) {
      throw new UnauthorizedException('JWT secrets are not configured');
    }

    const payload = verifyAccessToken({ secret, token });
    if (!payload?.sub) {
      throw new UnauthorizedException('Invalid token');
    }

    request.user = payload;
    return true;
  }
}
