/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertProfileDto } from './dto/profile.dto';
import { CreateEducationDto, UpdateEducationDto } from './dto/education.dto';
import { verifyAccessToken } from '../auth/jwt/jwt-utils';

type AuthUser = { sub: string };

const USER_PURPOSE_FORBIDDEN = 'Invalid request';

function extractBearerToken(authorizationHeader: string | undefined): string {
  if (!authorizationHeader) return '';
  return authorizationHeader.replace(/^Bearer\s+/i, '').trim();
}

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

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

  async getProfile(authorizationHeader: string | undefined) {
    const { sub: userId } = this.getAuthUser(authorizationHeader);

    return this.prisma.profile.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }

  async upsertProfile(
    authorizationHeader: string | undefined,
    dto: UpsertProfileDto,
  ) {
    const { sub: userId } = this.getAuthUser(authorizationHeader);

    return this.prisma.profile.upsert({
      where: { userId },
      create: { userId, ...dto },
      update: { ...dto },
    });
  }

  async listEducations(authorizationHeader: string | undefined) {
    const { sub: userId } = this.getAuthUser(authorizationHeader);

    return this.prisma.education.findMany({
      where: { userId },
      orderBy: { startYear: 'desc' },
    });
  }

  async createEducation(
    authorizationHeader: string | undefined,
    dto: CreateEducationDto,
  ) {
    const { sub: userId } = this.getAuthUser(authorizationHeader);

    return this.prisma.education.create({
      data: { userId, ...dto },
    });
  }

  async updateEducation(
    authorizationHeader: string | undefined,
    educationId: string,
    dto: UpdateEducationDto,
  ) {
    const { sub: userId } = this.getAuthUser(authorizationHeader);

    const existing = await this.prisma.education.findFirst({
      where: { id: educationId, userId },
      select: { id: true },
    });

    if (!existing) {
      throw new BadRequestException(USER_PURPOSE_FORBIDDEN);
    }

    return this.prisma.education.update({
      where: { id: educationId },
      data: dto,
    });
  }

  async deleteEducation(
    authorizationHeader: string | undefined,
    educationId: string,
  ) {
    const { sub: userId } = this.getAuthUser(authorizationHeader);

    const existing = await this.prisma.education.findFirst({
      where: { id: educationId, userId },
      select: { id: true },
    });

    if (!existing) {
      throw new BadRequestException(USER_PURPOSE_FORBIDDEN);
    }

    await this.prisma.education.delete({
      where: { id: educationId },
    });

    return { message: 'Education deleted' };
  }
}
