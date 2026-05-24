import { PrismaService } from '../prisma/prisma.service';
import { SeedCourseCatalogScraper } from './scrapers/seed-course-scraper';
import { ScrapedCourseCandidate } from './scrapers/seed-course-scraper';

export type ScrapeAndPersistCoursesParams = {
  platform?: string;
  truncateExisting?: boolean;
};

const normalizePlatform = (p: string): string => p.trim().toLowerCase();

const ALL_SEEDED_PLATFORMS = [
  'coursera',
  'edx',
  'udemy',
  'linkedin',
  'simplilearn',
  'alison',
  'freecodecamp',
];

export class CourseCatalogScrapeService {
  constructor(private readonly prisma: PrismaService) {}

  private getScraper(platform: string): SeedCourseCatalogScraper {
    return new SeedCourseCatalogScraper(platform);
  }

  async scrapeAndPersistCourses(
    params: ScrapeAndPersistCoursesParams,
  ): Promise<{
    platformResults: Array<{ platform: string; persisted: number }>;
  }> {
    const prismaAny = this.prisma as any;

    const candidatesClient = prismaAny?.courseScrapeCandidate as
      | undefined
      | {
          deleteMany: (args: unknown) => Promise<unknown>;
          createMany: (args: unknown) => Promise<unknown>;
        };

    if (!candidatesClient?.createMany || !candidatesClient?.deleteMany) {
      throw new Error('Prisma courseScrapeCandidate is not available');
    }

    const platformRaw = params.platform
      ? normalizePlatform(params.platform)
      : null;
    const platforms = platformRaw ? [platformRaw] : ALL_SEEDED_PLATFORMS;

    const platformResults: Array<{ platform: string; persisted: number }> = [];

    for (const platform of platforms) {
      const scraper = this.getScraper(platform);
      const candidates =
        (await scraper.scrapeCandidates()) as ScrapedCourseCandidate[];

      if (params.truncateExisting) {
        await candidatesClient.deleteMany({ where: { platform } });
      }

      if (candidates.length === 0) {
        platformResults.push({ platform, persisted: 0 });
        continue;
      }

      await candidatesClient.createMany({
        data: candidates.map((c) => ({
          platform: c.platform,
          title: c.title,
          description: c.description ?? null,
          difficulty: c.difficulty ?? null,
          externalUrl: c.externalUrl,
          skills: c.skills,
          source: c.source ?? 'seed:internal',
        })),
      });

      platformResults.push({ platform, persisted: candidates.length });
    }

    return { platformResults };
  }
}
