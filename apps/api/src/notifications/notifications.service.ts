import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { verifyAccessToken } from '../auth/jwt/jwt-utils';
import { CreateNotificationDto } from './dto/create-notification.dto';

type AuthUser = { sub: string };

function extractBearerToken(authorizationHeader: string | undefined): string {
  if (!authorizationHeader) return '';
  return authorizationHeader.replace(/^Bearer\s+/i, '').trim();
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  private getAuthUser(authorizationHeader: string | undefined): AuthUser {
    const accessSecret = process.env.JWT_ACCESS_SECRET;
    if (!accessSecret) {
      throw new UnauthorizedException('JWT secrets are not configured');
    }

    const token = extractBearerToken(authorizationHeader);
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const payload = verifyAccessToken({ secret: accessSecret, token });

    if (!payload?.sub) {
      throw new UnauthorizedException('Invalid token');
    }

    return { sub: payload.sub };
  }

  async listNotifications(
    authorizationHeader: string | undefined,
    includeRead = false,
  ): Promise<unknown> {
    const { sub: userId } = this.getAuthUser(authorizationHeader);

    const where = includeRead ? { userId } : { userId, isRead: false };

    return this.prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        type: true,
        message: true,
        isRead: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async createNotification(
    authorizationHeader: string | undefined,
    dto: CreateNotificationDto,
  ): Promise<unknown> {
    const { sub: userId } = this.getAuthUser(authorizationHeader);

    if (!dto.type?.trim()) {
      throw new BadRequestException('Notification type is required');
    }

    const created = await this.prisma.notification.create({
      data: {
        userId,
        type: dto.type,
        message: dto.message,
      },
    });

    // Milestone 4.4: enqueue async worker update when enabled.
    // Keep this guarded so tests/configs without Redis won't break.
    if (process.env.NOTIFICATIONS_WORKER_ENABLED === 'true') {
      const redisUrl = process.env.REDIS_URL;
      if (redisUrl) {
        // Lazy require so TS/tests don't need extra static imports.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { Queue } = require('bullmq') as {
          Queue: new (...args: unknown[]) => {
            add: (...args: unknown[]) => Promise<unknown>;
          };
        };

        const queue = new Queue('notifications', {
          connection: { url: redisUrl },
        });

        await queue.add('process', { notificationId: created.id });
      }
    }

    return created;
  }

  async markAsRead(
    authorizationHeader: string | undefined,
    notificationId: string,
  ): Promise<{ message: string }> {
    const { sub: userId } = this.getAuthUser(authorizationHeader);

    const existing = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
      select: { id: true },
    });

    if (!existing) {
      throw new BadRequestException('Notification not found');
    }

    await this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });

    return { message: 'Notification marked as read' };
  }

  async getNotification(
    authorizationHeader: string | undefined,
    notificationId: string,
  ): Promise<unknown> {
    const { sub: userId } = this.getAuthUser(authorizationHeader);

    const existing = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!existing) {
      throw new BadRequestException('Notification not found');
    }

    return existing;
  }

  async deleteNotification(
    authorizationHeader: string | undefined,
    notificationId: string,
  ): Promise<{ message: string }> {
    const { sub: userId } = this.getAuthUser(authorizationHeader);

    const existing = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
      select: { id: true },
    });

    if (!existing) {
      throw new BadRequestException('Notification not found');
    }

    await this.prisma.notification.delete({
      where: { id: notificationId },
    });

    return { message: 'Notification deleted' };
  }
}
