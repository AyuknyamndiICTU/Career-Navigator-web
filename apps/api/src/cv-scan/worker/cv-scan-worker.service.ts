/* global Buffer, AbortController, setTimeout, clearTimeout, NodeJS */
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import type { Client as MinioClient } from 'minio';
import { AiGatewayService } from '../../ai/gateway/ai-gateway.service';
import { redactPii } from '../../ai/gateway/redact-pii';
import { env } from '../../config/env';
import { createMinioClient } from '../../lib/minio-client';

// Re-uploading the same file never calls a model again.
const CV_CACHE_MS = 30 * 24 * 3_600_000;

type CvScanJobPayload = {
  userId: string;
  uploadMediaId: string;
  objectKey: string;
};

const CV_SCAN_QUEUE_NAME = 'cv-scan';

function isCvScanEnabled(): boolean {
  return env.cvScan.enabled;
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];

  for await (const chunk of stream as AsyncIterable<unknown>) {
    if (chunk instanceof Buffer) chunks.push(chunk);
    else chunks.push(Buffer.from(chunk as Uint8Array));
  }

  return Buffer.concat(chunks);
}

function tryExtractJson(text: string): string {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return text;
  return text.slice(start, end + 1);
}

type WorkerCloseLike = { close: () => Promise<void> };
type WorkerOnLike = {
  on: (_event: string, _listener: (..._args: unknown[]) => void) => void;
};
type CvScanWorkerLike = WorkerCloseLike & WorkerOnLike;

@Injectable()
export class CvScanWorkerService implements OnModuleDestroy {
  private readonly logger = new Logger(CvScanWorkerService.name);
  private worker?: CvScanWorkerLike;

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: AiGatewayService,
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
        await this.extractCvTextFromMinio(objectKey);
      abortSignal.throwIfAborted();

      // DOCX support is handled here.
      if (!extractedText.trim()) {
        throw new Error(
          `No extractable text found for objectKey=${objectKey}.`,
        );
      }

      const structured = await this.extractStructuredCv(
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
        await this.applyExtractedDataToProfile(payload.userId, structured);
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

  private async getMinioClient(): Promise<MinioClient> {
    const client = createMinioClient();
    if (!client) {
      throw new Error('MinIO is not configured (missing env vars).');
    }
    return client;
  }

  private async extractCvTextFromMinio(
    objectKey: string,
  ): Promise<{ text: string; sha256: string }> {
    const minioBucket = env.minio.bucket;
    const minio = await this.getMinioClient();

    const objectStream = await minio.getObject(minioBucket, objectKey);

    const buffer = await streamToBuffer(
      objectStream as unknown as NodeJS.ReadableStream,
    );
    const sha256 = createHash('sha256').update(buffer).digest('hex');

    const isDocx = objectKey.toLowerCase().endsWith('.docx');

    if (isDocx) {
      // Mammoth has fairly complex types for its input; using `any` keeps
      // the worker resilient without changing runtime behavior.
      const mammoth = (await import('mammoth')) as any;

      const result = await mammoth.extractRawText(buffer);
      return { text: result?.value?.trim() ? result.value : '', sha256 };
    }

    const pdfParseMod = await import('pdf-parse');
    const pdfParse =
      (pdfParseMod as any).default ?? (pdfParseMod as any) ?? pdfParseMod;

    const parsed = await pdfParse(buffer);

    return { text: parsed?.text ?? '', sha256 };
  }

  private async extractStructuredCv(
    userId: string,
    cvText: string,
    sha256: string,
    signal: AbortSignal,
  ): Promise<string> {
    const systemInstruction = `You are a CV parser.
Return ONLY valid JSON. No markdown. No extra commentary.
If you cannot find a field, set it to null (for nullable fields) or [] (for arrays).`;

    const userMessage = `
Extract structured data from the CV text below.

Return ONLY valid JSON with this exact shape:

{
  "fullName": string | null,
  "education": Array<{
    "degree": string | null,
    "fieldOfStudy": string | null,
    "institution": string | null,
    "startYear": number | null,
    "endYear": number | null,
    "grade": string | null,
    "description": string | null,
    "isCurrent": boolean
  }>,
  "experience": Array<{
    "jobTitle": string | null,
    "company": string | null,
    "location": string | null,
    "startYear": number | null,
    "endYear": number | null,
    "description": string | null,
    "isCurrent": boolean
  }>,
  "skills": string[],
  "summary": string | null
}

CV TEXT:
"""
${redactPii(cvText)}
"""`.trim();

    const { text: responseText } = await this.gateway.generate({
      task: 'cv-assist',
      userId,
      system: systemInstruction,
      messages: [{ role: 'user', content: userMessage }],
      signal,
      cache: { key: sha256, ttlMs: CV_CACHE_MS },
    });

    const fencedMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidateText = fencedMatch?.[1] ? fencedMatch[1] : responseText;

    const jsonText = tryExtractJson(candidateText);

    const coerceSkills = (value: unknown): string[] => {
      if (!Array.isArray(value)) return [];
      return value
        .filter((v): v is string => typeof v === 'string')
        .map((v) => v.trim())
        .filter((v) => v.length > 0);
    };

    try {
      const parsed = JSON.parse(jsonText) as unknown;

      if (!parsed || typeof parsed !== 'object') {
        return JSON.stringify({ skills: [] });
      }

      const record = parsed as Record<string, unknown>;
      const skills = coerceSkills(record.skills);

      // Keep output resilient: always return a JSON object with `skills: string[]`
      record.skills = skills;

      return JSON.stringify(record);
    } catch {
      return JSON.stringify({ skills: [] });
    }
  }

  /**
   * Bridge extracted CV data into Profile, Education, and WorkExperience tables.
   * Called after a successful CV extraction so the profile page and resume builder
   * can display the data immediately.
   */
  private async applyExtractedDataToProfile(
    userId: string,
    structuredJson: string,
  ): Promise<void> {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(structuredJson) as Record<string, unknown>;
    } catch {
      return; // Nothing to apply
    }

    if (!parsed || typeof parsed !== 'object') return;

    const str = (v: unknown): string | undefined =>
      typeof v === 'string' && v.trim() ? v.trim() : undefined;

    const strArray = (v: unknown): string[] => {
      if (!Array.isArray(v)) return [];
      return v
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean);
    };

    // --- 1. Upsert Profile ---
    const fullName = str(parsed.fullName);
    let firstName: string | undefined;
    let lastName: string | undefined;
    if (fullName) {
      const parts = fullName.split(/\s+/);
      firstName = parts[0];
      lastName = parts.length > 1 ? parts.slice(1).join(' ') : undefined;
    }

    const summary = str(parsed.summary);
    const skills = strArray(parsed.skills);

    // Build cvWizardData from extracted fields
    const cvWizardData: Record<string, unknown> = {};
    if (skills.length > 0) cvWizardData.skills = skills;

    const profileData: Record<string, unknown> = {};
    if (firstName) profileData.firstName = firstName;
    if (lastName) profileData.lastName = lastName;
    if (summary) profileData.summary = summary;
    if (Object.keys(cvWizardData).length > 0) {
      profileData.cvWizardData = cvWizardData;
    }

    if (Object.keys(profileData).length > 0) {
      await this.prisma.profile.upsert({
        where: { userId },
        create: { userId, ...profileData },
        update: profileData,
      });
    }

    // --- 2. Populate Education ---
    const educationArr = Array.isArray(parsed.education)
      ? parsed.education
      : [];

    if (educationArr.length > 0) {
      // Remove existing entries so re-upload doesn't create duplicates
      await this.prisma.education.deleteMany({ where: { userId } });

      for (const edu of educationArr) {
        if (!edu || typeof edu !== 'object') continue;
        const e = edu as Record<string, unknown>;

        await this.prisma.education.create({
          data: {
            userId,
            degree: str(e.degree) ?? null,
            fieldOfStudy: str(e.fieldOfStudy) ?? null,
            institution: str(e.institution) ?? null,
            startYear:
              typeof e.startYear === 'number' && Number.isFinite(e.startYear)
                ? Math.round(e.startYear)
                : null,
            endYear:
              typeof e.endYear === 'number' && Number.isFinite(e.endYear)
                ? Math.round(e.endYear)
                : null,
            grade: str(e.grade) ?? null,
            description: str(e.description) ?? null,
            isCurrent: e.isCurrent === true,
          },
        });
      }
    }

    // --- 3. Populate WorkExperience ---
    const experienceArr = Array.isArray(parsed.experience)
      ? parsed.experience
      : [];

    if (experienceArr.length > 0) {
      // Remove existing entries so re-upload doesn't create duplicates
      await this.prisma.workExperience.deleteMany({ where: { userId } });

      for (const exp of experienceArr) {
        if (!exp || typeof exp !== 'object') continue;
        const w = exp as Record<string, unknown>;

        await this.prisma.workExperience.create({
          data: {
            userId,
            jobTitle: str(w.jobTitle) ?? null,
            company: str(w.company) ?? null,
            location: str(w.location) ?? null,
            startYear:
              typeof w.startYear === 'number' && Number.isFinite(w.startYear)
                ? Math.round(w.startYear)
                : null,
            endYear:
              typeof w.endYear === 'number' && Number.isFinite(w.endYear)
                ? Math.round(w.endYear)
                : null,
            description: str(w.description) ?? null,
            isCurrent: w.isCurrent === true,
          },
        });
      }
    }
  }
}
