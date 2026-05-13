import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Client as MinioClient } from 'minio';

type CvScanJobPayload = {
  userId: string;
  uploadMediaId: string;
  objectKey: string;
};

type OllamaGenerateResponse = {
  response?: string;
};

const CV_SCAN_QUEUE_NAME = 'cv-scan';

function isCvScanEnabled(): boolean {
  return process.env.CV_SCAN_ENABLED === 'true';
}

function parseMinioEndpoint(endpoint: string): {
  endPoint: string;
  port: number;
  useSSL: boolean;
} {
  const trimmed = endpoint.trim();
  const url = new URL(trimmed);

  const port = url.port
    ? Number(url.port)
    : url.protocol === 'https:'
      ? 443
      : 80;

  return {
    endPoint: url.hostname,
    port,
    useSSL: url.protocol === 'https:',
  };
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
  on: (event: string, listener: (...args: unknown[]) => void) => void;
};
type CvScanWorkerLike = WorkerCloseLike & WorkerOnLike;

@Injectable()
export class CvScanWorkerService implements OnModuleDestroy {
  private readonly logger = new Logger(CvScanWorkerService.name);
  private worker?: CvScanWorkerLike;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    if (!isCvScanEnabled()) {
      this.logger.log('CV scan worker disabled (CV_SCAN_ENABLED !== true).');
      return;
    }

    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      this.logger.warn('CV scan worker enabled but REDIS_URL is missing.');
      return;
    }

    const concurrency = Number(process.env.CV_SCAN_WORKER_CONCURRENCY ?? '2');

    // Lazy require so TS doesn't need bullmq installed during typecheck/tests.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Worker } = require('bullmq') as {
      Worker: new (...args: unknown[]) => CvScanWorkerLike;
    };

    this.worker = new Worker(
      CV_SCAN_QUEUE_NAME,
      async (job: { data: CvScanJobPayload }) => {
        await this.processJob(job.data);
      },
      {
        connection: { url: redisUrl },
        concurrency: Number.isFinite(concurrency) ? concurrency : 2,
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

    await this.prisma.uploadMedia.update({
      where: { id: uploadMediaId },
      data: {
        cvScanStatus: 'PROCESSING',
        cvScanRequestedAt: new Date(),
      },
    });

    try {
      const extractedText = await this.extractCvTextFromMinio(objectKey);
      const structured = await this.extractStructuredCvViaOllama(extractedText);

      await this.prisma.uploadMedia.update({
        where: { id: uploadMediaId },
        data: {
          cvScanStatus: 'COMPLETED',
          cvScanCompletedAt: new Date(),
          cvExtractedText: structured,
          cvScanError: null,
        },
      });
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
    const minioEndpoint = process.env.MINIO_ENDPOINT;
    const minioAccessKey = process.env.MINIO_ACCESS_KEY;
    const minioSecretKey = process.env.MINIO_SECRET_KEY;
    const minioBucket = process.env.MINIO_BUCKET;

    if (!minioEndpoint || !minioAccessKey || !minioSecretKey || !minioBucket) {
      throw new Error('MinIO is not configured (missing env vars).');
    }

    const { endPoint, port, useSSL } = parseMinioEndpoint(minioEndpoint);

    return new MinioClient({
      endPoint,
      port,
      useSSL,
      accessKey: minioAccessKey,
      secretKey: minioSecretKey,
    });
  }

  private async extractCvTextFromMinio(objectKey: string): Promise<string> {
    const minioBucket = process.env.MINIO_BUCKET ?? 'resumes';
    const minio = await this.getMinioClient();

    const objectStream = await minio.getObject(minioBucket, objectKey);

    const buffer = await streamToBuffer(
      objectStream as unknown as NodeJS.ReadableStream,
    );

    // Lazy require so TS doesn't need pdf-parse installed during typecheck/tests.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse') as (
      dataBuffer: Buffer,
    ) => Promise<{ text?: string }>;

    const parsed = await pdfParse(buffer);

    if (!parsed?.text) return '';
    return parsed.text;
  }

  private async extractStructuredCvViaOllama(cvText: string): Promise<string> {
    const ollamaBaseUrl = process.env.OLLAMA_BASE_URL;
    const ollamaModel = process.env.OLLAMA_MODEL ?? 'llama3';

    if (!ollamaBaseUrl) {
      throw new Error('OLLAMA_BASE_URL is not configured.');
    }

    const prompt = `
You are a CV parser. Extract structured data from the CV text below.
Return ONLY valid JSON (no markdown, no commentary) in this format:

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

If a field is missing, use null. If you cannot find skills, return [].

CV TEXT:
"""
${cvText}
"""
    `.trim();

    const base = ollamaBaseUrl.replace(/\/+$/, '');

    const res = await fetch(`${base}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: ollamaModel,
        prompt,
        stream: false,
      }),
    });

    if (!res.ok) {
      const bodyText = await res.text().catch(() => '');
      throw new Error(`Ollama request failed: ${res.status} ${bodyText}`);
    }

    const data = (await res.json()) as OllamaGenerateResponse;
    const responseText = data?.response ?? '';

    const jsonText = tryExtractJson(responseText);

    try {
      JSON.parse(jsonText);
      return jsonText;
    } catch {
      return responseText;
    }
  }
}
