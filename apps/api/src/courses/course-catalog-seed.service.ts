import { PrismaService } from '../prisma/prisma.service';

export type CourseScrapeCandidateSeed = {
  platform: string;
  title: string;
  description?: string;
  difficulty?: string | null;
  externalUrl: string;
  skills: string[];
  source?: string;
};

const NORMALIZE_SKILL = (s: string): string => s.trim().toLowerCase();

export function getCourseScrapeCandidateSeedData(): CourseScrapeCandidateSeed[] {
  // Phase 2 bootstrap: internal seed candidates so the system has a stable
  // candidate list even before full web scrapers are added.
  // Later, replace each platform block with real HTML scraping output.
  return [
    // Node / TypeScript
    {
      platform: 'coursera',
      title: 'Node.js & Backend Development (Search-based Catalog)',
      description:
        'Backend course recommendations for Node.js learners. Use this catalog to pick a course matching your current level.',
      difficulty: null,
      externalUrl: 'https://www.coursera.org/search?query=nodejs',
      skills: ['node', 'javascript', 'backend', 'api'],
      source: 'seed:internal',
    },
    {
      platform: 'udemy',
      title: 'TypeScript for Developers (Catalog Search)',
      description:
        'Find a TypeScript course aligned to frontend or backend development.',
      difficulty: null,
      externalUrl: 'https://www.udemy.com/courses/search/?q=typescript',
      skills: ['typescript', 'javascript'],
      source: 'seed:internal',
    },
    {
      platform: 'freecodecamp',
      title: 'JavaScript & Algorithms (Learning Path)',
      description:
        'A structured path to build strong JavaScript fundamentals (great precursor for TypeScript/Node).',
      difficulty: null,
      externalUrl:
        'https://www.freecodecamp.org/learn/javascript-algorithms-and-data-structures/',
      skills: ['javascript', 'frontend', 'data structures'],
      source: 'seed:internal',
    },
    {
      platform: 'edx',
      title: 'Software Engineering & APIs (Catalog Search)',
      description: 'Browse edX software engineering and API-focused courses.',
      difficulty: null,
      externalUrl: 'https://www.edx.org/search?q=apis',
      skills: ['api', 'backend', 'software engineering'],
      source: 'seed:internal',
    },

    // React / Frontend
    {
      platform: 'udemy',
      title: 'React Development (Catalog Search)',
      description:
        'Choose a React course that matches your current frontend skills.',
      difficulty: null,
      externalUrl: 'https://www.udemy.com/courses/search/?q=react',
      skills: ['react', 'frontend', 'javascript'],
      source: 'seed:internal',
    },
    {
      platform: 'coursera',
      title: 'Frontend Development (Catalog Search)',
      description:
        'Find courses on modern frontend development topics and frameworks.',
      difficulty: null,
      externalUrl:
        'https://www.coursera.org/search?query=front%20end%20development',
      skills: ['frontend', 'communication', 'web'],
      source: 'seed:internal',
    },

    // Data / SQL / Python
    {
      platform: 'simplilearn',
      title: 'SQL for Data (Catalog Search)',
      description: 'Start with SQL fundamentals and progress to data querying.',
      difficulty: null,
      externalUrl: 'https://www.simplilearn.com/search?query=sql',
      skills: ['sql', 'data', 'analytics'],
      source: 'seed:internal',
    },
    {
      platform: 'alison',
      title: 'Python Programming Basics (Catalog Search)',
      description:
        'Learn Python basics and then progress to data/application-focused tracks.',
      difficulty: null,
      externalUrl: 'https://alison.com/search?query=python',
      skills: ['python', 'programming', 'data'],
      source: 'seed:internal',
    },

    // Career skills (soft-skill aligned “courses”)
    {
      platform: 'linkedin',
      title: 'Career Skills & Professional Development (Catalog Search)',
      description:
        'Search for career development topics aligned with communication and leadership growth.',
      difficulty: null,
      externalUrl:
        'https://www.linkedin.com/learning/search?keywords=communication%20skills',
      skills: ['communication', 'leadership', 'career guidance'],
      source: 'seed:internal',
    },
  ].map((c) => ({
    ...c,
    skills: c.skills.map(NORMALIZE_SKILL),
    platform: c.platform.trim().toLowerCase(),
  }));
}

/**
 * Persists seed candidates into `CourseScrapeCandidate`.
 *
 * Notes:
 * - This is safe to call on demand (endpoint / admin job).
 * - If tables don’t exist yet (migrations not applied), this should be wrapped
 *   by the caller in try/catch.
 */
export async function seedCourseScrapeCandidates(
  prisma: PrismaService,
  opts?: { truncateExisting?: boolean },
): Promise<number> {
  const data = getCourseScrapeCandidateSeedData();

  const prismaAny = prisma as any;
  const candidatesClient = prismaAny?.courseScrapeCandidate as
    | undefined
    | {
        deleteMany: (args?: unknown) => Promise<unknown>;
        createMany: (args: unknown) => Promise<unknown>;
      };

  if (!candidatesClient?.createMany) {
    throw new Error('Prisma courseScrapeCandidate model is not available');
  }

  if (opts?.truncateExisting && candidatesClient?.deleteMany) {
    await candidatesClient.deleteMany({});
  }

  // createMany will not dedupe unless we have unique constraints.
  // That’s okay for the bootstrap phase.
  await candidatesClient.createMany({
    data: data.map((c) => ({
      platform: c.platform,
      title: c.title,
      description: c.description ?? null,
      difficulty: c.difficulty ?? null,
      externalUrl: c.externalUrl,
      skills: c.skills,
      source: c.source ?? 'seed:internal',
    })),
  });

  return data.length;
}
