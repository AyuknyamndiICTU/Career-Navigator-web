import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ApplyJobDto } from './dto/apply-job.dto';

@Injectable()
export class JobApplicationsService {
  constructor(private readonly prisma: PrismaService) {}

  async apply(userId: string, jobId: string, dto: ApplyJobDto) {
    const job = await this.prisma.job.findFirst({
      where: { id: jobId },
      select: { id: true, status: true },
    });

    if (!job || job.status !== 'ACTIVE') {
      throw new BadRequestException('Job is not available');
    }

    const existing = await this.prisma.jobApplication.findFirst({
      where: { userId, jobId },
      select: { id: true },
    });

    if (existing) {
      throw new BadRequestException('Already applied');
    }

    return this.prisma.jobApplication.create({
      data: {
        userId,
        jobId,
        coverLetter: dto.coverLetter,
      },
    });
  }

  async myApplications(userId: string): Promise<unknown> {
    const apps = await this.prisma.jobApplication.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        job: {
          select: {
            id: true,
            title: true,
            company: true,
            location: true,
            status: true,
            skills: true,
          },
        },
      },
    });

    const items = apps.map((a) => ({
      applicationId: a.id,
      appliedAt: a.createdAt,
      jobId: a.job.id,
      title: a.job.title,
      company: a.job.company,
      location: a.job.location,
      jobStatus: a.job.status,
      matchedSkills: Array.isArray(a.job.skills) ? a.job.skills : [],
    }));

    // Also return a lightweight “career skills” proxy for Level Up summaries.
    const allSkills = items.flatMap((i) => i.matchedSkills);
    const uniqueSkills = Array.from(
      new Set(allSkills.map((s) => String(s).trim())),
    )
      .filter(Boolean)
      .slice(0, 50);

    return { items, careerSkills: uniqueSkills };
  }
}
