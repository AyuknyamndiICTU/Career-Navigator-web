import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { env } from '../config/env';
import { CreateNotificationDto } from './dto/create-notification.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listNotifications(
    userId: string,
    includeRead = false,
  ): Promise<unknown> {
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
    userId: string,
    dto: CreateNotificationDto,
  ): Promise<unknown> {
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
    if (env.notificationsWorker.enabled) {
      const redisUrl = env.redisUrl;
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
    userId: string,
    notificationId: string,
  ): Promise<{ message: string }> {
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
    userId: string,
    notificationId: string,
  ): Promise<unknown> {
    const existing = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!existing) {
      throw new BadRequestException('Notification not found');
    }

    return existing;
  }

  async deleteNotification(
    userId: string,
    notificationId: string,
  ): Promise<{ message: string }> {
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
