import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertProfileDto } from './dto/profile.dto';
import { CreateEducationDto, UpdateEducationDto } from './dto/education.dto';
import {
  CreateWorkExperienceDto,
  UpdateWorkExperienceDto,
} from './dto/work-experience.dto';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto';
import { CreateReferenceDto, UpdateReferenceDto } from './dto/reference.dto';
import { verifyAccessToken } from '../auth/jwt/jwt-utils';

type AuthUser = { sub: string };

const USER_PURPOSE_FORBIDDEN = 'Invalid request';

type ProfileWriteData = Pick<
  Prisma.ProfileUncheckedCreateInput,
  | 'firstName'
  | 'lastName'
  | 'headline'
  | 'phone'
  | 'location'
  | 'summary'
  | 'cvWizardData'
>;

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

  private toProfileWriteData(dto: UpsertProfileDto): ProfileWriteData {
    const data: ProfileWriteData = {};

    if (dto.firstName !== undefined) data.firstName = dto.firstName;
    if (dto.lastName !== undefined) data.lastName = dto.lastName;
    if (dto.headline !== undefined) data.headline = dto.headline;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.location !== undefined) data.location = dto.location;
    if (dto.summary !== undefined) data.summary = dto.summary;
    if (dto.cvWizardData !== undefined) data.cvWizardData = dto.cvWizardData as Prisma.InputJsonValue;

    return data;
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
    const data = this.toProfileWriteData(dto);

    return this.prisma.profile.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
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

  async listWorkExperiences(authorizationHeader: string | undefined) {
    const { sub: userId } = this.getAuthUser(authorizationHeader);

    return this.prisma.workExperience.findMany({
      where: { userId },
      orderBy: { startYear: 'desc' },
    });
  }

  async createWorkExperience(
    authorizationHeader: string | undefined,
    dto: CreateWorkExperienceDto,
  ) {
    const { sub: userId } = this.getAuthUser(authorizationHeader);

    return this.prisma.workExperience.create({
      data: { userId, ...dto },
    });
  }

  async updateWorkExperience(
    authorizationHeader: string | undefined,
    workExperienceId: string,
    dto: UpdateWorkExperienceDto,
  ) {
    const { sub: userId } = this.getAuthUser(authorizationHeader);

    const existing = await this.prisma.workExperience.findFirst({
      where: { id: workExperienceId, userId },
      select: { id: true },
    });

    if (!existing) {
      throw new BadRequestException(USER_PURPOSE_FORBIDDEN);
    }

    return this.prisma.workExperience.update({
      where: { id: workExperienceId },
      data: dto,
    });
  }

  async deleteWorkExperience(
    authorizationHeader: string | undefined,
    workExperienceId: string,
  ) {
    const { sub: userId } = this.getAuthUser(authorizationHeader);

    const existing = await this.prisma.workExperience.findFirst({
      where: { id: workExperienceId, userId },
      select: { id: true },
    });

    if (!existing) {
      throw new BadRequestException(USER_PURPOSE_FORBIDDEN);
    }

    await this.prisma.workExperience.delete({
      where: { id: workExperienceId },
    });

    return { message: 'Work experience deleted' };
  }

  async listProjects(authorizationHeader: string | undefined) {
    const { sub: userId } = this.getAuthUser(authorizationHeader);

    return this.prisma.project.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createProject(
    authorizationHeader: string | undefined,
    dto: CreateProjectDto,
  ) {
    const { sub: userId } = this.getAuthUser(authorizationHeader);

    return this.prisma.project.create({
      data: { userId, ...dto },
    });
  }

  async updateProject(
    authorizationHeader: string | undefined,
    projectId: string,
    dto: UpdateProjectDto,
  ) {
    const { sub: userId } = this.getAuthUser(authorizationHeader);

    const existing = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
      select: { id: true },
    });

    if (!existing) {
      throw new BadRequestException(USER_PURPOSE_FORBIDDEN);
    }

    return this.prisma.project.update({
      where: { id: projectId },
      data: dto,
    });
  }

  async deleteProject(
    authorizationHeader: string | undefined,
    projectId: string,
  ) {
    const { sub: userId } = this.getAuthUser(authorizationHeader);

    const existing = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
      select: { id: true },
    });

    if (!existing) {
      throw new BadRequestException(USER_PURPOSE_FORBIDDEN);
    }

    await this.prisma.project.delete({
      where: { id: projectId },
    });

    return { message: 'Project deleted' };
  }

  async listReferences(authorizationHeader: string | undefined) {
    const { sub: userId } = this.getAuthUser(authorizationHeader);

    return this.prisma.reference.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createReference(
    authorizationHeader: string | undefined,
    dto: CreateReferenceDto,
  ) {
    const { sub: userId } = this.getAuthUser(authorizationHeader);

    return this.prisma.reference.create({
      data: { userId, ...dto },
    });
  }

  async updateReference(
    authorizationHeader: string | undefined,
    referenceId: string,
    dto: UpdateReferenceDto,
  ) {
    const { sub: userId } = this.getAuthUser(authorizationHeader);

    const existing = await this.prisma.reference.findFirst({
      where: { id: referenceId, userId },
      select: { id: true },
    });

    if (!existing) {
      throw new BadRequestException(USER_PURPOSE_FORBIDDEN);
    }

    return this.prisma.reference.update({
      where: { id: referenceId },
      data: dto,
    });
  }

  async deleteReference(
    authorizationHeader: string | undefined,
    referenceId: string,
  ) {
    const { sub: userId } = this.getAuthUser(authorizationHeader);

    const existing = await this.prisma.reference.findFirst({
      where: { id: referenceId, userId },
      select: { id: true },
    });

    if (!existing) {
      throw new BadRequestException(USER_PURPOSE_FORBIDDEN);
    }

    await this.prisma.reference.delete({
      where: { id: referenceId },
    });

    return { message: 'Reference deleted' };
  }
}
