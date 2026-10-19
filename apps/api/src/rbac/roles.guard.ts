import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '../prisma/client';

import { ROLES_KEY } from './roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/jwt-auth.guard';

/** Runs after the global JwtAuthGuard, which has already verified the token and set request.user. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!roles || roles.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<{ user?: AuthUser; userId?: string }>();
    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user || !roles.includes(user.role)) {
      throw new ForbiddenException('Insufficient role privileges');
    }

    request.userId = userId;
    return true;
  }
}
