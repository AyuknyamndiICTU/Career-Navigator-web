import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type SearchMentorsParams = {
  q?: string;
  skill?: string;
  expertise?: string;
  page: number;
  limit: number;
};

@Injectable()
export class MentorsService {
  constructor(private readonly prisma: PrismaService) {}

  async search(params: SearchMentorsParams): Promise<{
    items: Array<{
      id: string;
      displayName: string;
      bio: string | null;
      skills: string[];
      expertise: string[];
      createdAt: Date;
      updatedAt: Date;
    }>;
    page: number;
    limit: number;
    total: number;
  }> {
    const { q, skill, expertise, page, limit } = params;

    const where = {
      ...(q
        ? {
            OR: [
              {
                displayName: {
                  contains: q,
                  mode: 'insensitive' as const,
                },
              },
              {
                bio: {
                  contains: q,
                  mode: 'insensitive' as const,
                },
              },
            ],
          }
        : {}),
      ...(skill ? { skills: { has: skill } } : {}),
      ...(expertise ? { expertise: { has: expertise } } : {}),
    };

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.mentor.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.mentor.count({ where }),
    ]);

    return { items, page, limit, total };
  }

  parsePagination(params: { pageRaw?: string; limitRaw?: string }): {
    page: number;
    limit: number;
  } {
    const { pageRaw, limitRaw } = params;

    const page =
      pageRaw && Number.isFinite(Number(pageRaw)) && Number(pageRaw) > 0
        ? Number(pageRaw)
        : 1;

    const limit =
      limitRaw && Number.isFinite(Number(limitRaw)) && Number(limitRaw) > 0
        ? Number(limitRaw)
        : 10;

    if (!Number.isFinite(page) || !Number.isFinite(limit)) {
      throw new BadRequestException('Invalid pagination params');
    }

    return { page, limit };
  }
}
