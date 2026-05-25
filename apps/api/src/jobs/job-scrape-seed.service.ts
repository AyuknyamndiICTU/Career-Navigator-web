import { PrismaService } from '../prisma/prisma.service';

export type JobScrapeCandidateSeed = {
  title: string;
  company: string;
  location: string | null;
  description: string | null;
  externalUrl: string;

  skills: string[];
  source?: string;
};

const NORMALIZE_SKILL = (s: string): string => s.trim().toLowerCase();

export function getJobScrapeCandidateSeedDataFromJobs(
  jobs: Array<{
    id: string;
    title: string;
    company: string;
    location: string | null;
    description: string | null;
    skills: string[];
  }>,
): JobScrapeCandidateSeed {
  // Until platform-specific job scrapers exist, we treat internal Job rows as
  // “scraped candidates” and generate an external discovery link.
  const jobsArr = Array.isArray(jobs) ? jobs : [];

  return {
    seeds: jobsArr.map((j) => {
      const q = `${j.title} ${j.company} jobs`;
      return {
        title: j.title,
        company: j.company,
        location: j.location,
        description: j.description,
        externalUrl: `https://www.google.com/search?q=${encodeURIComponent(q)}`,
        skills: Array.from(
          new Set((j.skills ?? []).map(NORMALIZE_SKILL).filter(Boolean)),
        ),
        source: 'seed:internal',
      } satisfies JobScrapeCandidateSeed;
    }),
  } as unknown as JobScrapeCandidateSeed;
}

// NOTE: Prisma client generated fields:
// - JobScrapeCandidate: title, company, location?, description?, externalUrl, skills, platform, source?
// We set `platform` to "internal" consistently.
export async function seedJobScrapeCandidatesFromActiveJobs(
  prisma: PrismaService,
  opts?: { truncateExisting?: boolean },
): Promise<number> {
  const prismaAny = prisma as any;

  const candidatesClient = prismaAny?.jobScrapeCandidate as
    | undefined
    | {
        deleteMany: (args?: unknown) => Promise<unknown>;
        createMany: (args: unknown) => Promise<unknown>;
      };

  if (!candidatesClient?.createMany) {
    throw new Error('Prisma jobScrapeCandidate model is not available');
  }

  const activeJobs = await prismaAny.job.findMany({
    where: { status: 'ACTIVE' },
    select: {
      title: true,
      company: true,
      location: true,
      description: true,
      skills: true,
    },
    take: 1000,
  });

  const truncateExisting = Boolean(opts?.truncateExisting);

  if (truncateExisting && candidatesClient?.deleteMany) {
    await candidatesClient.deleteMany({});
  }

  const data = (activeJobs as unknown[]).map((job: any) => {
    const q = `${job.title} ${job.company} jobs`;
    return {
      platform: 'internal',
      title: job.title,
      company: job.company,
      location: job.location ?? null,
      description: job.description ?? null,
      externalUrl: `https://www.google.com/search?q=${encodeURIComponent(q)}`,
      skills: Array.from(
        new Set((job.skills ?? []).map(NORMALIZE_SKILL).filter(Boolean)),
      ),
      source: 'seed:internal',
    };
  });

  if (data.length === 0) return 0;

  await candidatesClient.createMany({ data });
  return data.length;
}
