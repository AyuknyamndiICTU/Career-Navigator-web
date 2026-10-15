import {
  BadRequestException,
  Injectable,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { env } from '../config/env';
import { CreateNotificationDto } from './dto/create-notification.dto';

type NotificationsQueue = {
  add: (...args: unknown[]) => Promise<unknown>;
  close: () => Promise<void>;
};

@Injectable()
export class NotificationsService implements OnModuleDestroy {
  private queue?: NotificationsQueue;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleDestroy(): Promise<void> {
    await this.queue?.close();
  }

  private getQueue(): NotificationsQueue | undefined {
    if (!env.notificationsWorker.enabled || !env.redisUrl) return undefined;
    if (!this.queue) {
      // Lazy require so TS/tests don't need extra static imports.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Queue } = require('bullmq') as {
        Queue: new (...args: unknown[]) => NotificationsQueue;
      };
      this.queue = new Queue('notifications', {
        connection: { url: env.redisUrl },
      });
    }
    return this.queue;
  }

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
    await this.getQueue()?.add('process', { notificationId: created.id });

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
