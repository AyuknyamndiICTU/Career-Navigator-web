import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CvScanService } from '../cv-scan/cv-scan.service';
import { env } from '../config/env';
import { randomUUID } from 'node:crypto';
import type { Express } from 'express';
import type { Client as MinioClient } from 'minio';
import { verifiedExtension } from './file-signature';
import { createMinioClient } from '../lib/minio-client';

const MEDIA_TYPE_PROFILE_PICTURE = 'PROFILE_PICTURE' as const;
const MEDIA_TYPE_CV = 'CV' as const;

type UploadMediaType = typeof MEDIA_TYPE_PROFILE_PICTURE | typeof MEDIA_TYPE_CV;

@Injectable()
export class UploadService {
  private minio?: MinioClient;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cvScanService: CvScanService,
  ) {}

  /** Lazy so the app boots (and non-upload routes work) without storage configured. */
  private getMinio(): MinioClient {
    this.minio ??= createMinioClient() ?? undefined;
    if (!this.minio) {
      throw new BadRequestException('MinIO is not configured');
    }
    return this.minio;
  }

  private async uploadToMinio(params: {
    type: UploadMediaType;
    userId: string;
    file: Express.Multer.File;
  }): Promise<{
    objectKey: string;
    contentType?: string;
    originalFilename?: string;
  }> {
    const minioBucket = env.minio.bucket;

    const content = params.file.buffer;
    if (!content?.length) throw new BadRequestException('Invalid file size');

    const ext = verifiedExtension(params.file.mimetype, content);
    if (!ext) {
      throw new BadRequestException('File content does not match its type');
    }

    const objectKey = `${params.userId}/${params.type}/${randomUUID()}${ext}`;
    const minio = this.getMinio();

    const bucketExists = await minio.bucketExists(minioBucket);
    if (!bucketExists) {
      await minio.makeBucket(minioBucket);
    }

    await minio.putObject(minioBucket, objectKey, content, content.length, {
      'Content-Type': params.file.mimetype ?? 'application/octet-stream',
    });

    return {
      objectKey,
      contentType: params.file.mimetype,
      originalFilename: params.file.originalname,
    };
  }

  async uploadPicture(
    userId: string,
    file: Express.Multer.File,
  ): Promise<unknown> {
    if (!file) throw new BadRequestException('Missing file');

    const { objectKey, contentType, originalFilename } =
      await this.uploadToMinio({
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

  async uploadCv(userId: string, file: Express.Multer.File): Promise<unknown> {
    if (!file) throw new BadRequestException('Missing file');

    const { objectKey, contentType, originalFilename } =
      await this.uploadToMinio({
        userId,
        type: MEDIA_TYPE_CV,
        file,
      });

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
        cvScanStatus: 'PENDING',
        cvScanRequestedAt: new Date(),
      },
      create: {
        userId,
        type: MEDIA_TYPE_CV,
        objectKey,
        contentType: contentType ?? null,
        originalFilename: originalFilename ?? null,
        cvScanStatus: 'PENDING',
        cvScanRequestedAt: new Date(),
      },
    });

    await this.cvScanService.enqueueCvScan({
      userId,
      uploadMediaId: uploadMedia.id,
      objectKey,
    });

    return { message: 'CV uploaded', objectKey };
  }

  async getCvStatus(userId: string): Promise<{
    status: string | null;
    error: string | null;
    skills: string[];
    extractedData: {
      fullName?: string | null;
      education?: Array<Record<string, unknown>>;
      experience?: Array<Record<string, unknown>>;
      skills?: string[];
      summary?: string | null;
    } | null;
  }> {
    const media = await this.prisma.uploadMedia.findUnique({
      where: { userId_type: { userId, type: MEDIA_TYPE_CV } },
      select: { cvScanStatus: true, cvScanError: true, cvExtractedText: true },
    });

    if (!media)
      return { status: null, error: null, skills: [], extractedData: null };

    let skills: string[] = [];
    let extractedData: {
      fullName?: string | null;
      education?: Array<Record<string, unknown>>;
      experience?: Array<Record<string, unknown>>;
      skills?: string[];
      summary?: string | null;
    } | null = null;

    if (media.cvExtractedText) {
      try {
        const parsed = JSON.parse(media.cvExtractedText) as Record<
          string,
          unknown
        >;
        if (Array.isArray(parsed.skills)) skills = parsed.skills as string[];

        extractedData = {
          fullName:
            typeof parsed.fullName === 'string' ? parsed.fullName : null,
          summary: typeof parsed.summary === 'string' ? parsed.summary : null,
          skills: Array.isArray(parsed.skills)
            ? (parsed.skills as string[])
            : [],
          education: Array.isArray(parsed.education)
            ? (parsed.education as Array<Record<string, unknown>>)
            : [],
          experience: Array.isArray(parsed.experience)
            ? (parsed.experience as Array<Record<string, unknown>>)
            : [],
        };
      } catch {
        // ignore invalid extracted JSON
      }
    }

    return {
      status: media.cvScanStatus,
      error: media.cvScanError,
      skills,
      extractedData,
    };
  }

  /**
   * Retrieve a file from MinIO as a readable stream.
   * Used by the proxy endpoint so the browser can load images via the API
   * instead of hitting MinIO directly (which may have CORS / port issues).
   */
  async getFileStream(objectKey: string): Promise<{
    stream: import('stream').Readable;
    contentType: string;
  }> {
    const minioBucket = env.minio.bucket;
    const minio = this.getMinio();

    // Get stat for content-type, then stream the object
    let contentType = 'application/octet-stream';
    try {
      const stat = await minio.statObject(minioBucket, objectKey);
      contentType =
        stat.metaData?.['content-type'] ?? 'application/octet-stream';
    } catch {
      // Ignore stat errors; we'll still try to stream
    }

    const stream = await minio.getObject(minioBucket, objectKey);
    return { stream, contentType };
  }
}
