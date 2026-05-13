import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

type NotificationProcessPayload = {
  notificationId: string;
};

function isNotificationsWorkerEnabled(): boolean {
  return process.env.NOTIFICATIONS_WORKER_ENABLED === 'true';
}

const NOTIFICATIONS_QUEUE_NAME = 'notifications';

type BullWorkerLike = {
  close: () => Promise<void>;
  on: (event: string, cb: unknown) => void;
};

@Injectable()
export class NotificationsWorkerService implements OnModuleDestroy {
  private readonly logger = new Logger(NotificationsWorkerService.name);
  private worker?: BullWorkerLike;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    if (!isNotificationsWorkerEnabled()) {
      this.logger.log(
        'notifications worker disabled (NOTIFICATIONS_WORKER_ENABLED !== true).',
      );
      return;
    }

    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      this.logger.warn(
        'notifications worker enabled but REDIS_URL is missing.',
      );
      return;
    }

    // Lazy require to avoid TS needing bullmq during typecheck/tests.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Worker } = require('bullmq') as {
      Worker: new (...args: unknown[]) => BullWorkerLike;
    };

    const concurrency = Number(
      process.env.NOTIFICATIONS_WORKER_CONCURRENCY ?? '2',
    );

    this.worker = new Worker(
      NOTIFICATIONS_QUEUE_NAME,
      async (job: { data: NotificationProcessPayload }) => {
        await this.processJob(job.data);
      },
      {
        connection: { url: redisUrl },
        concurrency: Number.isFinite(concurrency) ? concurrency : 2,
      },
    );

    this.worker.on('failed', (job: unknown, err: unknown) => {
      const data = (job as { data?: NotificationProcessPayload | undefined })
        ?.data;

      const notificationId = data?.notificationId;

      const errMessage = err instanceof Error ? err.message : String(err);

      this.logger.error(
        `notifications job failed. notificationId=${notificationId} err=${errMessage}`,
      );
    });

    this.logger.log('notifications worker started.');
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }

  private async processJob(payload: NotificationProcessPayload): Promise<void> {
    const { notificationId } = payload;

    const existing = await this.prisma.notification.findUnique({
      where: { id: notificationId },
      select: { id: true, message: true },
    });

    if (!existing) return;

    const nextMessage = `${existing.message} (processed)`;

    await this.prisma.notification.update({
      where: { id: notificationId },
      data: { message: nextMessage },
    });
  }
}
