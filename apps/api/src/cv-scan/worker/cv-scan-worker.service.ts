/* global process, fetch, Buffer, AbortController, setTimeout, clearTimeout, URL, NodeJS */
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Client as MinioClient } from 'minio';
import { getAIProvider, GEMINI_MODEL } from '../../lib/aiProvider';

type CvScanJobPayload = {
  userId: string;
  uploadMediaId: string;
  objectKey: string;
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
  on: (_event: string, _listener: (..._args: unknown[]) => void) => void;
};
type CvScanWorkerLike = WorkerCloseLike & WorkerOnLike;

@Injectable()
export class CvScanWorkerService implements OnModuleDestroy {
  private readonly logger = new Logger(CvScanWorkerService.name);
  private worker?: CvScanWorkerLike;
  private readonly prisma: PrismaService;

  constructor(prisma: PrismaService) {
    this.prisma = prisma;
  }

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

    const concurrency = Number(process.env.CV_SCAN_WORKER_CONCURRENCY ?? '1');

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

    // Overall timeout: fail the job if it takes longer than 30 seconds total
    const JOB_TIMEOUT_MS = 30_000;
    const timeoutController = new AbortController();
    const jobTimeoutId = setTimeout(() => {
      this.logger.error(`cv-scan job timed out after ${JOB_TIMEOUT_MS}ms. uploadMediaId=${uploadMediaId}`);
      timeoutController.abort();
    }, JOB_TIMEOUT_MS);

    try {
      await this.processJobInternal(payload, timeoutController.signal);
    } finally {
      clearTimeout(jobTimeoutId);
    }
  }

  private async processJobInternal(payload: CvScanJobPayload, abortSignal: AbortSignal): Promise<void> {
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
      const extractedText = await this.extractCvTextFromMinio(objectKey);

      // DOCX support is handled here.
      if (!extractedText.trim()) {
        throw new Error(
          `No extractable text found for objectKey=${objectKey}.`,
        );
      }

      const structured = await this.extractStructuredCvViaGemini(extractedText);

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

    const isDocx = objectKey.toLowerCase().endsWith('.docx');

    if (isDocx) {
      // Mammoth has fairly complex types for its input; using `any` keeps
      // the worker resilient without changing runtime behavior.
      const mammoth = (await import('mammoth')) as any;

      const result = await mammoth.extractRawText(buffer);
      return result?.value?.trim() ? result.value : '';
    }

    const pdfParseMod = await import('pdf-parse');
    const pdfParse =
      (pdfParseMod as any).default ?? (pdfParseMod as any) ?? pdfParseMod;

    const parsed = await pdfParse(buffer);

    if (!parsed?.text) return '';
    return parsed.text;
  }

  private async generateWithGemini(
    systemInstruction: string,
    userMessage: string,
  ): Promise<string> {
    // PRIMARY: Gemini via GEMINI_API_KEY
    const provider = getAIProvider();
    const url = provider.gemini?.generateContentUrlForModel(GEMINI_MODEL);

    if (!url) {
      throw new Error('GEMINI_API_KEY is not configured.');
    }

    // FALLBACK triggers (as requested):
    // - HTTP 429
    // - timeout > 15s
    // - connection error (fetch throws)

    const body = {
      system_instruction: {
        parts: [{ text: systemInstruction }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: userMessage }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        topP: 0.9,
        maxOutputTokens: 2048,
      },
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12_000);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (res.ok) {
        const data = (await res.json()) as unknown;

        const dataAny = data as {
          candidates?: Array<{
            content?: { parts?: Array<{ text?: string }> };
          }>;
        };

        return dataAny?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      }

      if (res.status === 429 || res.status === 403) {
        this.logger.warn(`Gemini returned ${res.status}, falling back to Ollama Cloud`);
        return await this.generateWithOllamaCloud(systemInstruction, userMessage);
      }

      const errorBody = await res.text().catch(() => '');
      throw new Error(
        `Gemini request failed: ${res.status} ${errorBody}`.trim(),
      );
    } catch (err) {
      const errAny = err as { name?: string } | undefined;
      if (errAny?.name === 'AbortError') {
        this.logger.warn('Gemini timed out, falling back to Ollama Cloud');
        return await this.generateWithOllamaCloud(systemInstruction, userMessage);
      }
      // For any other fetch/network error, try fallback
      this.logger.warn(`Gemini fetch error, falling back to Ollama Cloud: ${(err as Error)?.message}`);
      return await this.generateWithOllamaCloud(systemInstruction, userMessage);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async generateWithOllamaCloud(
    systemInstruction: string,
    userMessage: string,
  ): Promise<string> {
    // FALLBACK: Ollama Cloud via OLLAMA_API_KEY
    const provider = getAIProvider();
    const ollamaApiKey = provider.ollama?.apiKey;
    if (!ollamaApiKey) {
      throw new Error('OLLAMA_API_KEY is not configured.');
    }

    const baseUrl = provider.ollama?.baseUrl ?? 'https://ollama.com/v1';
    const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;

    const body = {
      model: 'glm-4.6:cloud',
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.2,
      max_tokens: 2048,
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ollamaApiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorBody = await res.text().catch(() => '');
      throw new Error(
        `Ollama Cloud request failed: ${res.status} ${errorBody}`.trim(),
      );
    }

    const data = (await res.json()) as unknown;

    const dataAny = data as {
      choices?: Array<{
        message?: { content?: unknown };
      }>;
    };

    return typeof dataAny?.choices?.[0]?.message?.content === 'string'
      ? (dataAny.choices[0].message.content as string)
      : '';
  }

  private async extractStructuredCvViaGemini(cvText: string): Promise<string> {
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
${cvText}
"""`.trim();

    const responseText = await this.generateWithGemini(
      systemInstruction,
      userMessage,
    );

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
