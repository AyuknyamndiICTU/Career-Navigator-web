import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CvScanService } from '../cv-scan/cv-scan.service';
import { env } from '../config/env';
import { createHash, randomUUID } from 'node:crypto';
import type { Express } from 'express';
import {
  validateOcrWords,
  type ParsedCv,
  type TextItem,
} from '@career-navigator/cv-parser';
import { verifiedExtension } from './file-signature';
import {
  keyOwner,
  OBJECT_STORAGE,
  StorageError,
  userObjectKey,
  type ObjectStorage,
} from '../storage/object-storage';
import {
  CvScanProcessor,
  type StoredCvScan,
} from '../cv-scan/worker/cv-scan-processor.service';
import { CvProfilePopulator } from '../cv-scan/worker/cv-profile-populator.service';
import {
  CvAiParser,
  type CvAssistSection,
} from '../cv-scan/worker/cv-ai-parser.service';
import type { CvConfirmDto } from './dto/cv-review.dto';

const MEDIA_TYPE_PROFILE_PICTURE = 'PROFILE_PICTURE' as const;
const MEDIA_TYPE_CV = 'CV' as const;

type UploadMediaType = typeof MEDIA_TYPE_PROFILE_PICTURE | typeof MEDIA_TYPE_CV;

@Injectable()
export class UploadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cvScanService: CvScanService,
    private readonly cvScanProcessor: CvScanProcessor,
    private readonly cvProfilePopulator: CvProfilePopulator,
    private readonly cvAiParser: CvAiParser,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  private async store(params: {
    type: UploadMediaType;
    userId: string;
    file: Express.Multer.File;
  }): Promise<{
    objectKey: string;
    contentType?: string;
    originalFilename?: string;
  }> {
    if (!this.storage.configured) {
      throw new ServiceUnavailableException(
        'File storage is not configured on this server.',
      );
    }
    const content = params.file.buffer;
    if (!content?.length) throw new BadRequestException('Invalid file size');

    const ext = verifiedExtension(params.file.mimetype, content);
    if (!ext) {
      throw new BadRequestException('File content does not match its type');
    }

    const kind = params.type === MEDIA_TYPE_CV ? 'cv' : 'picture';
    const objectKey = userObjectKey(params.userId, kind, randomUUID(), ext);
    try {
      await this.storage.put(
        objectKey,
        content,
        params.file.mimetype ?? 'application/octet-stream',
      );
    } catch (err) {
      throw new ServiceUnavailableException(
        err instanceof StorageError
          ? 'File storage is unavailable. Please try again.'
          : 'Upload failed.',
      );
    }

    return {
      objectKey,
      contentType: params.file.mimetype,
      originalFilename: params.file.originalname,
    };
  }

  /** A short-lived direct download link for one of the caller's own files (private bucket, 18.2). */
  async signedUrl(
    userId: string,
    objectKey: string,
  ): Promise<{ url: string; expiresAt: string }> {
    if (keyOwner(objectKey) !== userId) {
      // Same answer for "not yours" and "does not exist".
      throw new ForbiddenException('File not available');
    }
    const ttl = env.storage.presignTtlSeconds;
    try {
      const url = await this.storage.presignGet(objectKey, {
        expiresInSeconds: ttl,
      });
      return {
        url,
        expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
      };
    } catch {
      throw new ServiceUnavailableException(
        'File storage is not configured on this server.',
      );
    }
  }

  async uploadPicture(
    userId: string,
    file: Express.Multer.File,
  ): Promise<unknown> {
    if (!file) throw new BadRequestException('Missing file');

    const { objectKey, contentType, originalFilename } = await this.store({
      userId,
      type: MEDIA_TYPE_PROFILE_PICTURE,
      file,
    });

    // Note: type-safe field names appear after `prisma generate`.
    await this.prisma.uploadMedia.upsert({
      where: {
        userId_type: {
          userId,
          type: MEDIA_TYPE_PROFILE_PICTURE,
        },
      },
      update: {
        objectKey,
        contentType: contentType ?? null,
        originalFilename: originalFilename ?? null,
      },
      create: {
        userId,
        type: MEDIA_TYPE_PROFILE_PICTURE,
        objectKey,
        contentType: contentType ?? null,
        originalFilename: originalFilename ?? null,
      },
    });

    return { message: 'Picture uploaded', objectKey };
  }

  async uploadCv(
    userId: string,
    file: Express.Multer.File,
    ocrField?: string,
  ): Promise<unknown> {
    if (!file) throw new BadRequestException('Missing file');

    // Words recognised in the browser (16.3) are untrusted input: strict shape and size checks.
    let ocrItems: TextItem[] | null = null;
    if (typeof ocrField === 'string' && ocrField.trim()) {
      try {
        ocrItems = validateOcrWords(JSON.parse(ocrField));
      } catch {
        ocrItems = null;
      }
      if (!ocrItems) throw new BadRequestException('Invalid OCR data');
    }

    const { objectKey, contentType, originalFilename } = await this.store({
      userId,
      type: MEDIA_TYPE_CV,
      file,
    });

    const scanReset = {
      cvScanStatus: 'PENDING' as const,
      cvScanRequestedAt: new Date(),
      cvScanCompletedAt: null,
      cvScanError: null,
      cvConfirmedAt: null,
    };
    const uploadMedia = await this.prisma.uploadMedia.upsert({
      where: {
        userId_type: {
          userId,
          type: MEDIA_TYPE_CV,
        },
      },
      update: {
        objectKey,
        contentType: contentType ?? null,
        originalFilename: originalFilename ?? null,
        ...scanReset,
      },
      create: {
        userId,
        type: MEDIA_TYPE_CV,
        objectKey,
        contentType: contentType ?? null,
        originalFilename: originalFilename ?? null,
        ...scanReset,
      },
    });

    if (ocrItems) {
      // Parsing words is fast and needs no file download, so do it now.
      const sha256 = createHash('sha256').update(file.buffer).digest('hex');
      await this.cvScanProcessor.processOcrWords(
        uploadMedia.id,
        ocrItems,
        sha256,
      );
    } else {
      await this.cvScanService.enqueueCvScan({
        userId,
        uploadMediaId: uploadMedia.id,
        objectKey,
      });
    }

    return { message: 'CV uploaded', objectKey };
  }

  private async loadCvScan(userId: string) {
    const media = await this.prisma.uploadMedia.findUnique({
      where: { userId_type: { userId, type: MEDIA_TYPE_CV } },
      select: {
        id: true,
        cvScanStatus: true,
        cvScanError: true,
        cvExtractedText: true,
        cvConfirmedAt: true,
        originalFilename: true,
      },
    });
    let stored: Partial<StoredCvScan> | null = null;
    if (media?.cvExtractedText) {
      try {
        const parsed = JSON.parse(media.cvExtractedText) as unknown;
        if (parsed && typeof parsed === 'object')
          stored = parsed as Partial<StoredCvScan>;
      } catch {
        stored = null;
      }
    }
    return { media, stored };
  }

  async getCvStatus(userId: string): Promise<{
    status: string | null;
    error: string | null;
    fileName: string | null;
    skills: string[];
    extractedData: {
      fullName?: string | null;
      education?: Array<Record<string, unknown>>;
      experience?: Array<Record<string, unknown>>;
      skills?: string[];
      summary?: string | null;
    } | null;
    review: ParsedCv | null;
    confirmedAt: Date | null;
    aiAssistAvailable: boolean;
  }> {
    const { media, stored } = await this.loadCvScan(userId);
    const aiAssistAvailable = env.cvScan.aiAssistEnabled;

    if (!media)
      return {
        status: null,
        error: null,
        fileName: null,
        skills: [],
        extractedData: null,
        review: null,
        confirmedAt: null,
        aiAssistAvailable,
      };

    const strings = (v: unknown): string[] =>
      Array.isArray(v)
        ? v.filter((s): s is string => typeof s === 'string')
        : [];
    const objects = (v: unknown): Array<Record<string, unknown>> =>
      Array.isArray(v)
        ? v.filter(
            (x): x is Record<string, unknown> =>
              Boolean(x) && typeof x === 'object',
          )
        : [];

    return {
      status: media.cvScanStatus,
      error: media.cvScanError,
      fileName: media.originalFilename,
      skills: strings(stored?.skills),
      extractedData: stored
        ? {
            fullName:
              typeof stored.fullName === 'string' ? stored.fullName : null,
            summary: typeof stored.summary === 'string' ? stored.summary : null,
            skills: strings(stored.skills),
            education: objects(stored.education),
            experience: objects(stored.experience),
          }
        : null,
      review: stored?.parsed ?? null,
      confirmedAt: media.cvConfirmedAt,
      aiAssistAvailable,
    };
  }

  /** Applies the reviewed CV to the profile (merge, no duplicates) and records the confirmation (16.7). */
  async confirmCv(userId: string, dto: CvConfirmDto): Promise<unknown> {
    const { media, stored } = await this.loadCvScan(userId);
    if (!media || media.cvScanStatus !== 'COMPLETED' || !stored) {
      throw new BadRequestException('There is no scanned CV to confirm.');
    }

    const result = await this.cvProfilePopulator.apply(userId, dto);

    // Job matching reads skills from the stored scan, so keep it in line with what the user approved.
    const updated = {
      ...stored,
      ...(dto.fullName !== undefined ? { fullName: dto.fullName } : {}),
      ...(dto.summary !== undefined ? { summary: dto.summary } : {}),
      ...(dto.skills ? { skills: dto.skills } : {}),
      ...(dto.education ? { education: dto.education } : {}),
      ...(dto.experience ? { experience: dto.experience } : {}),
    };
    const confirmedAt = new Date();
    await this.prisma.uploadMedia.update({
      where: { id: media.id },
      data: {
        cvConfirmedAt: confirmedAt,
        cvExtractedText: JSON.stringify(updated),
      },
    });
    return { message: 'CV applied to your profile', confirmedAt, ...result };
  }

  /** "Improve with AI" for one section, only when the user asks (16.8). */
  async assistCv(userId: string, section: CvAssistSection): Promise<unknown> {
    if (!env.cvScan.aiAssistEnabled) {
      throw new ForbiddenException('AI assistance is turned off.');
    }
    const { media, stored } = await this.loadCvScan(userId);
    const parsed = stored?.parsed;
    if (
      !media ||
      media.cvScanStatus !== 'COMPLETED' ||
      !parsed ||
      !stored.fileSha256
    ) {
      throw new BadRequestException('There is no scanned CV to improve.');
    }
    const text = (parsed.sections ?? [])
      .filter((s) => s.kind === section)
      .map((s) => s.text)
      .join('\n')
      .trim();
    if (!text) {
      throw new BadRequestException(
        `No ${section} section was found in this CV.`,
      );
    }
    const result = await this.cvAiParser.assist(
      userId,
      section,
      text,
      stored.fileSha256,
    );
    return { section, result };
  }
}
