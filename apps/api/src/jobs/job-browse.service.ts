/* global fetch, Buffer */
import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JobStatus, Prisma } from '@prisma/client';
import { env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import {
  normalizeText,
  recentJobFallbackCatalog,
  skillMatches,
} from './job-catalog';

export type BrowseJobsParams = {
  searchQuery?: string;
  status?: string;
  location?: string;
  skill?: string;
  page: number;
  limit: number;
};

/** Public job board: filtered browsing and the optional OpenSearch export. */
@Injectable()
export class JobBrowseService {
  constructor(private readonly prisma: PrismaService) {}

  async browse(params: BrowseJobsParams): Promise<{
    items: Array<{
      id: string;
      title: string;
      company: string;
      location: string | null;
      description: string | null;
      status: JobStatus;
      skills: string[];
      externalUrl?: string;
      source?: string;
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

    const where: Prisma.JobWhereInput = {
      ...(parsedStatus ? { status: parsedStatus } : {}),
      ...(location
        ? { location: { contains: location, mode: 'insensitive' } }
        : {}),
      ...(skill ? { skills: { has: skill } } : {}),
      ...(searchQuery
        ? {
            OR: [
              { title: { contains: searchQuery, mode: 'insensitive' } },
              { company: { contains: searchQuery, mode: 'insensitive' } },
              { description: { contains: searchQuery, mode: 'insensitive' } },
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

    if (items.length === 0 && total === 0) {
      const fallbackItems = recentJobFallbackCatalog().filter((job) => {
        if (parsedStatus && job.status !== parsedStatus) return false;

        if (
          location &&
          !normalizeText(job.location ?? '').includes(normalizeText(location))
        ) {
          return false;
        }

        if (
          skill &&
          !job.skills.some((candidateSkill) =>
            skillMatches(candidateSkill, skill),
          )
        ) {
          return false;
        }

        if (searchQuery) {
          const q = normalizeText(searchQuery);
          const searchable = normalizeText(
            [
              job.title,
              job.company,
              job.location,
              job.description,
              job.skills.join(' '),
            ]
              .filter(Boolean)
              .join(' '),
          );

          if (!searchable.includes(q)) return false;
        }

        return true;
      });

      return {
        items: fallbackItems.slice(skip, skip + limit),
        page,
        limit,
        total: fallbackItems.length,
      };
    }

    return { items, page, limit, total };
  }

  async ingestJobDemand(): Promise<{
    indexed: number;
    index: string;
  }> {
    const opensearchUrl = env.opensearch.url;
    const username = env.opensearch.username;
    const password = env.opensearch.password;

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
}
