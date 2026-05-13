import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CvScanService } from '../cv-scan/cv-scan.service';
import { verifyAccessToken } from '../auth/jwt/jwt-utils';
import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import type { Express } from 'express';
import { Client as MinioClient } from 'minio';

type AuthUser = { sub: string };

const MEDIA_TYPE_PROFILE_PICTURE = 'PROFILE_PICTURE' as const;
const MEDIA_TYPE_CV = 'CV' as const;

type UploadMediaType = typeof MEDIA_TYPE_PROFILE_PICTURE | typeof MEDIA_TYPE_CV;

const MINIO_BUCKET_DEFAULT = 'resumes';

function extractBearerToken(authorizationHeader: string | undefined): string {
  if (!authorizationHeader) return '';
  return authorizationHeader.replace(/^Bearer\s+/i, '').trim();
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

@Injectable()
export class UploadService {
  private minio?: MinioClient;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cvScanService: CvScanService,
  ) {
    // Lazy init: do not throw during app bootstrap (tests and other routes need to work).
    // We’ll instantiate MinIO only when an upload endpoint is called.
  }

  private getAuthUser(authorizationHeader: string | undefined): AuthUser {
    const accessSecret = process.env.JWT_ACCESS_SECRET;
    if (!accessSecret) {
      throw new UnauthorizedException('JWT secrets are not configured');
    }

    const token = extractBearerToken(authorizationHeader);
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const payload = verifyAccessToken({ secret: accessSecret, token });
    if (!payload?.sub) {
      throw new UnauthorizedException('Invalid token');
    }

    return { sub: payload.sub };
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
    const minioBucket = process.env.MINIO_BUCKET ?? MINIO_BUCKET_DEFAULT;

    const originalFilename = params.file.originalname ?? '';
    const ext = originalFilename.includes('.')
      ? originalFilename.slice(originalFilename.lastIndexOf('.'))
      : '';

    const objectKey = `${params.userId}/${params.type}/${randomUUID()}${ext}`;
    const stream = createReadStream(params.file.path);

    const size = params.file.size;
    if (!size) throw new BadRequestException('Invalid file size');

    if (!this.minio) {
      const minioEndpoint = process.env.MINIO_ENDPOINT;
      const minioAccessKey = process.env.MINIO_ACCESS_KEY;
      const minioSecretKey = process.env.MINIO_SECRET_KEY;

      if (
        !minioEndpoint ||
        !minioAccessKey ||
        !minioSecretKey ||
        !minioBucket
      ) {
        throw new BadRequestException('MinIO is not configured');
      }

      const { endPoint, port, useSSL } = parseMinioEndpoint(minioEndpoint);

      this.minio = new MinioClient({
        endPoint,
        port,
        useSSL,
        accessKey: minioAccessKey,
        secretKey: minioSecretKey,
      });
    }

    await this.minio.putObject(minioBucket, objectKey, stream, size, {
      'Content-Type': params.file.mimetype ?? 'application/octet-stream',
    });

    return {
      objectKey,
      contentType: params.file.mimetype,
      originalFilename: params.file.originalname,
    };
  }

  async uploadPicture(
    authorizationHeader: string | undefined,
    file: Express.Multer.File,
  ): Promise<unknown> {
    const { sub: userId } = this.getAuthUser(authorizationHeader);

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

  async uploadCv(
    authorizationHeader: string | undefined,
    file: Express.Multer.File,
  ): Promise<unknown> {
    const { sub: userId } = this.getAuthUser(authorizationHeader);

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
      },
      create: {
        userId,
        type: MEDIA_TYPE_CV,
        objectKey,
        contentType: contentType ?? null,
        originalFilename: originalFilename ?? null,
      },
    });

    await this.cvScanService.enqueueCvScan({
      userId,
      uploadMediaId: uploadMedia.id,
      objectKey,
    });

    return { message: 'CV uploaded', objectKey };
  }
}
