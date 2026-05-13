import { Injectable, Logger } from '@nestjs/common';

export type CvScanJobPayload = {
  userId: string;
  uploadMediaId: string;
  objectKey: string;
};

export type EnqueueCvScanResult =
  | { skipped: true }
  | { skipped: false; jobId: string };

const CV_SCAN_QUEUE_NAME = 'cv-scan';

function isCvScanEnabled(): boolean {
  return process.env.CV_SCAN_ENABLED === 'true';
}

type BullMqQueueLike = {
  add: (
    name: string,
    data: CvScanJobPayload,
    opts: {
      jobId: string;
      removeOnComplete: true;
      removeOnFail: number;
    },
  ) => Promise<unknown>;
};

@Injectable()
export class CvScanService {
  private readonly logger = new Logger(CvScanService.name);
  private queue?: BullMqQueueLike;

  private getQueue(): BullMqQueueLike | undefined {
    if (!isCvScanEnabled()) return undefined;
    if (this.queue) return this.queue;

    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      this.logger.warn(
        'CV_SCAN_ENABLED is true but REDIS_URL is missing. Skipping enqueue.',
      );
      return undefined;
    }

    // Lazy require so TypeScript doesn't need bullmq installed during compile/tests.
    // (When CV_SCAN_ENABLED !== true, this path is never executed.)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Queue } = require('bullmq') as {
      Queue: new (...args: unknown[]) => unknown;
    };

    const queueInstance = new Queue(CV_SCAN_QUEUE_NAME, {
      connection: { url: redisUrl },
    }) as unknown as BullMqQueueLike;

    this.queue = queueInstance;
    return this.queue;
  }

  async enqueueCvScan(params: CvScanJobPayload): Promise<EnqueueCvScanResult> {
    const queue = this.getQueue();
    if (!queue) return { skipped: true };

    const jobId = params.uploadMediaId;

    await queue.add('cv-scan', params, {
      jobId,
      removeOnComplete: true,
      removeOnFail: 50,
    });

    return { skipped: false, jobId };
  }
}
