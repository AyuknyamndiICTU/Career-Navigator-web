import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { verifyAccessToken } from '../auth/jwt/jwt-utils';
import { PrismaService } from '../prisma/prisma.service';
import { JobStatus } from '@prisma/client';
import { ApplyJobDto } from './dto/apply-job.dto';
import { RerankJobsDto } from './dto/rerank-jobs.dto';

export type BrowseJobsParams = {
  searchQuery?: string;
  status?: string;
  location?: string;
  skill?: string;
  page: number;
  limit: number;
};

type AuthUser = { sub: string };

function extractBearerToken(authorizationHeader: string | undefined): string {
  if (!authorizationHeader) return '';
  return authorizationHeader.replace(/^Bearer\s+/i, '').trim();
}

@Injectable()
export class JobsService {
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

  async browse(params: BrowseJobsParams): Promise<{
    items: Array<{
      id: string;
      title: string;
      company: string;
      location: string | null;
      description: string | null;
      status: JobStatus;
      skills: string[];
      createdAt: Date;
      updatedAt: Date;
    }>;
    page: number;
    limit: number;
    total: number;
  }> {
    const { searchQuery, status, location, skill, page, limit } = params;

    let parsedStatus: JobStatus | undefined;
    if (status) {
      const normalized = status.trim().toUpperCase();
      if (normalized !== 'ACTIVE' && normalized !== 'INACTIVE') {
        throw new BadRequestException('Invalid status filter');
      }
      parsedStatus = normalized as JobStatus;
    }

    const where = {
      ...(parsedStatus ? { status: parsedStatus } : {}),
      ...(location
        ? {
            location: {
              contains: location,
              mode: 'insensitive' as const,
            },
          }
        : {}),
      ...(skill ? { skills: { has: skill } } : {}),
      ...(searchQuery
        ? {
            OR: [
              {
                title: {
                  contains: searchQuery,
                  mode: 'insensitive' as const,
                },
              },
              {
                company: {
                  contains: searchQuery,
                  mode: 'insensitive' as const,
                },
              },
              {
                description: {
                  contains: searchQuery,
                  mode: 'insensitive' as const,
                },
              },
            ],
          }
        : {}),
    };

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.job.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.job.count({ where }),
    ]);

    return { items, page, limit, total };
  }

  async apply(
    authorizationHeader: string | undefined,
    jobId: string,
    dto: ApplyJobDto,
  ) {
    const { sub: userId } = this.getAuthUser(authorizationHeader);

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

  async ingestJobDemand(authorizationHeader: string | undefined): Promise<{
    indexed: number;
    index: string;
  }> {
    // Validate auth (reuses the existing auth style)
    void this.getAuthUser(authorizationHeader);

    const opensearchUrl = process.env.OPENSEARCH_URL;
    const username = process.env.OPENSEARCH_USERNAME;
    const password = process.env.OPENSEARCH_PASSWORD;

    if (!opensearchUrl || !username || !password) {
      throw new UnauthorizedException('OpenSearch is not configured');
    }

    const indexName = 'jobs';

    const activeJobs = await this.prisma.job.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        title: true,
        company: true,
        location: true,
        description: true,
        skills: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const base = opensearchUrl.replace(/\/+$/, '');
    const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString(
      'base64',
    )}`;

    let indexed = 0;

    await Promise.all(
      activeJobs.map(async (job) => {
        const url = `${base}/${indexName}/_doc/${job.id}`;

        const res = await fetch(url, {
          method: 'PUT',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: job.id,
            title: job.title,
            company: job.company,
            location: job.location,
            description: job.description,
            skills: job.skills,
            status: job.status,
            createdAt: job.createdAt,
            updatedAt: job.updatedAt,
          }),
        });

        if (!res.ok) {
          const bodyText = await res.text().catch(() => '');
          throw new Error(`OpenSearch index failed: ${res.status} ${bodyText}`);
        }

        indexed += 1;
      }),
    );

    return { indexed, index: indexName };
  }

  async rerankJobs(
    authorizationHeader: string | undefined,
    dto: RerankJobsDto,
  ) {
    const { sub: userId } = this.getAuthUser(authorizationHeader);

    const limit = dto.limit ?? 5;

    const activeJobs = await this.prisma.job.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        title: true,
        company: true,
        location: true,
        description: true,
        skills: true,
        updatedAt: true,
      },
      take: 200,
    });

    const requestSkills = Array.from(
      new Set(dto.skills.map((s) => s.trim())),
    ).filter(Boolean);

    type Ranked = {
      jobId: string;
      title: string;
      company: string;
      score: number;
      matchedSkills: string[];
      location: string | null;
      description: string | null;
    };

    const rankedAll: Ranked[] = activeJobs
      .map((job) => {
        const matched = job.skills.filter((s) => requestSkills.includes(s));
        const score = matched.length;

        return {
          jobId: job.id,
          title: job.title,
          company: job.company,
          score,
          matchedSkills: matched,
          location: job.location,
          description: job.description,
        };
      })
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        // stable-ish tie-breaker: more recent jobs first
        return 0;
      });

    const ranked = rankedAll.sort((a, b) => b.score - a.score).slice(0, limit);

    const notifyTargets = ranked.filter((r) => r.score > 0);

    if (notifyTargets.length > 0) {
      await this.prisma.notification.createMany({
        data: notifyTargets.map((r) => ({
          userId,
          type: 'JOB_RERANK',
          message: `Recommended job: ${r.title} (${r.company}). Matched: ${r.matchedSkills.join(
            ', ',
          )}`,
        })),
      });
    }

    return {
      items: ranked,
      notificationsCreated: notifyTargets.length,
    };
  }

  async matchedJobs(authorizationHeader: string | undefined): Promise<unknown> {
    const { sub: userId } = this.getAuthUser(authorizationHeader);

    const jobApplications = await this.prisma.jobApplication.findMany({
      where: { userId },
      select: {
        job: { select: { skills: true } },
      },
    });

    const careerSkills = jobApplications.flatMap((a) => a.job.skills);
    const allowedSkills = Array.from(new Set(careerSkills.map((s) => s.trim())))
      .filter(Boolean)
      .slice(0, 50);

    if (allowedSkills.length === 0) {
      throw new BadRequestException(
        'No career-path skills available for this user.',
      );
    }

    const activeJobs = await this.prisma.job.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        title: true,
        company: true,
        location: true,
        description: true,
        skills: true,
        updatedAt: true,
      },
      take: 500,
    });

    type Ranked = {
      jobId: string;
      title: string;
      company: string;
      score: number;
      matchedSkills: string[];
      location: string | null;
      description: string | null;
      updatedAt: Date;
    };

    const allowedLower = new Set(allowedSkills.map((s) => s.toLowerCase()));

    const rankedAll: Ranked[] = activeJobs
      .map((job) => {
        const matched = job.skills.filter((s) =>
          allowedLower.has(s.toLowerCase()),
        );
        const score = matched.length;

        return {
          jobId: job.id,
          title: job.title,
          company: job.company,
          score,
          matchedSkills: matched,
          location: job.location,
          description: job.description,
          updatedAt: job.updatedAt,
        };
      })
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.updatedAt.getTime() - a.updatedAt.getTime();
      });

    const limit = 10;
    const ranked = rankedAll.slice(0, limit);

    const notifyTargets = ranked.filter((r) => r.score > 0);

    if (notifyTargets.length > 0) {
      await this.prisma.notification.createMany({
        data: notifyTargets.map((r) => ({
          userId,
          type: 'JOB_MATCHED',
          message: `Matched job: ${r.title} (${r.company}). Matched: ${r.matchedSkills.join(
            ', ',
          )}`,
        })),
      });
    }

    return {
      items: ranked,
      allowedSkills,
      notificationsCreated: notifyTargets.length,
    };
  }
}
