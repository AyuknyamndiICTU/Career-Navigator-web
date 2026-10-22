import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { env } from '../../config/env';
import { CvScanProcessor } from './cv-scan-processor.service';

type CvScanJobPayload = {
  userId: string;
  uploadMediaId: string;
  objectKey: string;
};

const CV_SCAN_QUEUE_NAME = 'cv-scan';

function isCvScanEnabled(): boolean {
  return env.cvScan.enabled;
}

type WorkerCloseLike = { close: () => Promise<void> };
type WorkerOnLike = {
  on: (_event: string, _listener: (..._args: unknown[]) => void) => void;
};
type CvScanWorkerLike = WorkerCloseLike & WorkerOnLike;

/** BullMQ worker: rule-based CV parse with status tracking (no AI, no profile writes). */
@Injectable()
export class CvScanWorkerService implements OnModuleDestroy {
  private readonly logger = new Logger(CvScanWorkerService.name);
  private worker?: CvScanWorkerLike;

  constructor(
    private readonly prisma: PrismaService,
    private readonly processor: CvScanProcessor,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!isCvScanEnabled()) {
      this.logger.log('CV scan worker disabled (CV_SCAN_ENABLED !== true).');
      return;
    }

    const redisUrl = env.redisUrl;
    if (!redisUrl) {
      this.logger.warn('CV scan worker enabled but REDIS_URL is missing.');
      return;
    }

    const concurrency = env.cvScan.concurrency;

    // Lazy import so TS doesn't need bullmq installed during typecheck/tests.
    const bullmqMod = (await import('bullmq')) as {
      Worker: new (..._args: unknown[]) => CvScanWorkerLike;
    };

    const { Worker } = bullmqMod;

    this.worker = new Worker(
      CV_SCAN_QUEUE_NAME,
      async (job: { data: CvScanJobPayload }) => {
        await this.processJob(job.data);
      },
      {
        connection: { url: redisUrl },
        concurrency,
      },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(
        `cv-scan job failed. jobId=${(job as { id?: string } | undefined)?.id} err=${(err as Error)?.message}`,
      );
    });

    this.logger.log('cv-scan worker started.');
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }

  private async processJob(payload: CvScanJobPayload): Promise<void> {
    const { uploadMediaId, objectKey } = payload;

    // Skip if already processed for the same upload file.
    const existing = await this.prisma.uploadMedia.findUnique({
      where: { id: uploadMediaId },
      select: {
        objectKey: true,
        cvScanStatus: true,
        cvExtractedText: true,
        cvScanCompletedAt: true,
      },
    });

    if (
      existing?.cvScanStatus === 'COMPLETED' &&
      existing.objectKey === objectKey &&
      existing.cvExtractedText &&
      existing.cvScanCompletedAt
    ) {
      this.logger.log(
        `cv-scan skipped (already completed for same upload). uploadMediaId=${uploadMediaId}`,
      );
      return;
    }

    // Rule-based parse only; results wait for the user's review (16.7/16.8).
    await this.processor.processFile(uploadMediaId, objectKey);
  }
}
