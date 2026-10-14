import { Injectable } from '@nestjs/common';
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
}
