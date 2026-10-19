import { BadRequestException, Injectable } from '@nestjs/common';
import { Job, JobStatus, Prisma } from '@prisma/client';
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

/** Public job board: filtered browsing with Postgres full-text search. */
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
    const { status, location, skill, page, limit } = params;
    const searchQuery = params.searchQuery?.trim().slice(0, 200) || undefined;

    let parsedStatus: JobStatus | undefined;
    if (status) {
      const normalized = status.trim().toUpperCase();
      if (normalized !== 'ACTIVE' && normalized !== 'INACTIVE') {
        throw new BadRequestException('Invalid status filter');
      }
      parsedStatus = normalized as JobStatus;
    }

    const skip = (page - 1) * limit;

    const [items, total] = searchQuery
      ? await this.search(searchQuery, {
          status: parsedStatus,
          location,
          skill,
          skip,
          take: limit,
        })
      : await this.list(
          {
            ...(parsedStatus ? { status: parsedStatus } : {}),
            ...(location
              ? { location: { contains: location, mode: 'insensitive' } }
              : {}),
            ...(skill ? { skills: { has: skill } } : {}),
          },
          skip,
          limit,
        );

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

  private list(
    where: Prisma.JobWhereInput,
    skip: number,
    take: number,
  ): Promise<[Job[], number]> {
    return Promise.all([
      this.prisma.job.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.job.count({ where }),
    ]);
  }

  /** Ranked full-text search (stemmed words) plus typo-tolerant title matching. */
  private async search(
    q: string,
    filters: {
      status?: JobStatus;
      location?: string;
      skill?: string;
      skip: number;
      take: number;
    },
  ): Promise<[Job[], number]> {
    const tsQuery = Prisma.sql`websearch_to_tsquery('english', ${q})`;
    const conditions = [
      Prisma.sql`("searchVector" @@ ${tsQuery} OR ${q} <% "title")`,
    ];
    if (filters.status) {
      conditions.push(Prisma.sql`"status" = ${filters.status}::"JobStatus"`);
    }
    if (filters.location) {
      const pattern = `%${filters.location.replace(/[\\%_]/g, '\\$&')}%`;
      conditions.push(Prisma.sql`"location" ILIKE ${pattern}`);
    }
    if (filters.skill) {
      conditions.push(Prisma.sql`"skills" @> ARRAY[${filters.skill}]::text[]`);
    }
    const where = Prisma.join(conditions, ' AND ');

    const [ranked, counted] = await Promise.all([
      this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT "id" FROM "Job" WHERE ${where}
        ORDER BY ts_rank("searchVector", ${tsQuery}) + word_similarity(${q}, "title") DESC,
                 "createdAt" DESC
        OFFSET ${filters.skip} LIMIT ${filters.take}`),
      this.prisma.$queryRaw<Array<{ total: number }>>(Prisma.sql`
        SELECT count(*)::int AS total FROM "Job" WHERE ${where}`),
    ]);

    const ids = ranked.map((row) => row.id);
    const rows = ids.length
      ? await this.prisma.job.findMany({ where: { id: { in: ids } } })
      : [];
    const byId = new Map(rows.map((row) => [row.id, row]));
    const items = ids
      .map((id) => byId.get(id))
      .filter((job): job is Job => job !== undefined);
    return [items, counted[0]?.total ?? 0];
  }
}
