import { BadRequestException, Injectable } from '@nestjs/common';
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

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  private toProfileWriteData(dto: UpsertProfileDto): ProfileWriteData {
    const data: ProfileWriteData = {};

    if (dto.firstName !== undefined) data.firstName = dto.firstName;
    if (dto.lastName !== undefined) data.lastName = dto.lastName;
    if (dto.headline !== undefined) data.headline = dto.headline;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.location !== undefined) data.location = dto.location;
    if (dto.summary !== undefined) data.summary = dto.summary;
    if (dto.cvWizardData !== undefined) {
      data.cvWizardData = JSON.parse(JSON.stringify(dto.cvWizardData)) as Prisma.InputJsonValue;
    }

    return data;
  }

  async getProfile(userId: string) {
    return this.prisma.profile.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }

  async upsertProfile(userId: string, dto: UpsertProfileDto) {
    const data = this.toProfileWriteData(dto);

    return this.prisma.profile.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
  }

  async listEducations(userId: string) {
    return this.prisma.education.findMany({
      where: { userId },
      orderBy: { startYear: 'desc' },
    });
  }

  async createEducation(userId: string, dto: CreateEducationDto) {
    return this.prisma.education.create({
      data: { userId, ...dto },
    });
  }

  async updateEducation(
    userId: string,
    educationId: string,
    dto: UpdateEducationDto,
  ) {
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

  async deleteEducation(userId: string, educationId: string) {
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

  async listWorkExperiences(userId: string) {
    return this.prisma.workExperience.findMany({
      where: { userId },
      orderBy: { startYear: 'desc' },
    });
  }

  async createWorkExperience(userId: string, dto: CreateWorkExperienceDto) {
    return this.prisma.workExperience.create({
      data: { userId, ...dto },
    });
  }

  async updateWorkExperience(
    userId: string,
    workExperienceId: string,
    dto: UpdateWorkExperienceDto,
  ) {
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

  async deleteWorkExperience(userId: string, workExperienceId: string) {
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

  async listProjects(userId: string) {
    return this.prisma.project.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createProject(userId: string, dto: CreateProjectDto) {
    return this.prisma.project.create({
      data: { userId, ...dto },
    });
  }

  async updateProject(
    userId: string,
    projectId: string,
    dto: UpdateProjectDto,
  ) {
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

  async deleteProject(userId: string, projectId: string) {
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

  async listReferences(userId: string) {
    return this.prisma.reference.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createReference(userId: string, dto: CreateReferenceDto) {
    return this.prisma.reference.create({
      data: { userId, ...dto },
    });
  }

  async updateReference(
    userId: string,
    referenceId: string,
    dto: UpdateReferenceDto,
  ) {
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

  async deleteReference(userId: string, referenceId: string) {
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
