/* global AbortController, setTimeout, clearTimeout */
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { env } from '../../config/env';
import { CvTextExtractor } from './cv-text-extractor.service';
import { CvAiParser } from './cv-ai-parser.service';
import { CvProfilePopulator } from './cv-profile-populator.service';

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

/** BullMQ worker: extract text → parse with AI → fill the profile, with status tracking. */
@Injectable()
export class CvScanWorkerService implements OnModuleDestroy {
  private readonly logger = new Logger(CvScanWorkerService.name);
  private worker?: CvScanWorkerLike;

  constructor(
    private readonly prisma: PrismaService,
    private readonly extractor: CvTextExtractor,
    private readonly parser: CvAiParser,
    private readonly populator: CvProfilePopulator,
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
    const { uploadMediaId } = payload;

    // Overall timeout: text extraction plus the AI time budget (60 s) with some headroom.
    const JOB_TIMEOUT_MS = 90_000;
    const timeoutController = new AbortController();
    const jobTimeoutId = setTimeout(() => {
      this.logger.error(
        `cv-scan job timed out after ${JOB_TIMEOUT_MS}ms. uploadMediaId=${uploadMediaId}`,
      );
      timeoutController.abort();
    }, JOB_TIMEOUT_MS);

    try {
      await this.processJobInternal(payload, timeoutController.signal);
    } finally {
      clearTimeout(jobTimeoutId);
    }
  }

  private async processJobInternal(
    payload: CvScanJobPayload,
    abortSignal: AbortSignal,
  ): Promise<void> {
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

    await this.prisma.uploadMedia.update({
      where: { id: uploadMediaId },
      data: {
        cvScanStatus: 'PROCESSING',
        cvScanRequestedAt: new Date(),
      },
    });

    try {
      const { text: extractedText, sha256 } =
        await this.extractor.extract(objectKey);
      abortSignal.throwIfAborted();

      // DOCX support is handled here.
      if (!extractedText.trim()) {
        throw new Error(
          `No extractable text found for objectKey=${objectKey}.`,
        );
      }

      const structured = await this.parser.parse(
        payload.userId,
        extractedText,
        sha256,
        abortSignal,
      );
      // A timed-out job is marked FAILED instead of writing late results.
      abortSignal.throwIfAborted();

      await this.prisma.uploadMedia.update({
        where: { id: uploadMediaId },
        data: {
          cvScanStatus: 'COMPLETED',
          cvScanCompletedAt: new Date(),
          cvExtractedText: structured,
          cvScanError: null,
        },
      });

      // Auto-populate Profile, Education, and WorkExperience from extracted data
      try {
        await this.populator.apply(payload.userId, structured);
        this.logger.log(
          `cv-scan profile auto-populated. userId=${payload.userId}`,
        );
      } catch (applyErr) {
        // Log but don't fail the job — the extraction itself succeeded
        this.logger.warn(
          `cv-scan profile auto-populate failed (non-fatal). userId=${payload.userId} err=${(applyErr as Error)?.message}`,
        );
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : `Unknown error: ${String(err)}`;

      await this.prisma.uploadMedia.update({
        where: { id: uploadMediaId },
        data: {
          cvScanStatus: 'FAILED',
          cvScanCompletedAt: new Date(),
          cvScanError: message,
        },
      });

      this.logger.error(
        `Failed to process cv-scan. uploadMediaId=${uploadMediaId} err=${message}`,
      );
    }
  }
}
