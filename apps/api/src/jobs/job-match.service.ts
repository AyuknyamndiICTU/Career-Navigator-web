import { Injectable } from '@nestjs/common';
import { CvScanStatus, MediaType } from '../prisma/client';
import { AiGatewayService } from '../ai/gateway/ai-gateway.service';
import { env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { RerankJobsDto } from './dto/rerank-jobs.dto';
import { recentJobFallbackCatalog, skillMatches } from './job-catalog';
import { seedJobScrapeCandidatesFromActiveJobs } from './job-scrape-seed.service';

const DEFAULT_SKILLS = [
  'General Career Guidance',
  'Resume Building',
  'Interview Preparation',
  'Job Search Strategies',
  'Professional Development',
];

const MATCH_SYSTEM = `You are "Career Navigator AI", a job matching assistant.

Task:
- Create a concise matchReason for each job recommendation.
- The matchReason must be grounded in the candidate's career-path skills.
- If the job has matched skills, explicitly mention at least ONE of those skills verbatim.
- Keep it short (1-2 sentences).`;

type Ranked = {
  jobId: string;
  title: string;
  company: string;
  score: number;
  matchedSkills: string[];
  location: string | null;
  description: string | null;
  updatedAt: Date;
  externalUrl: string;
  matchReason: string;
};

function parseJsonObject(text: string): Record<string, unknown> | null {
  const stripped = text.replace(/```(?:json)?/gi, '').replace(/```/g, '');
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(stripped.slice(start, end + 1)) as Record<
      string,
      unknown
    >;
  } catch {
    return null;
  }
}

/** Skill-based job ranking for a user, with optional AI-written match reasons. */
@Injectable()
export class JobMatchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: AiGatewayService,
  ) {}

  async rerankJobs(userId: string, dto: RerankJobsDto) {
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

    const ranked = activeJobs
      .map((job) => {
        const matched = job.skills.filter((s) => requestSkills.includes(s));
        return {
          jobId: job.id,
          title: job.title,
          company: job.company,
          score: matched.length,
          matchedSkills: matched,
          location: job.location,
          description: job.description,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

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

  /** CV skills first, then skills from the jobs the user applied to. */
  private async careerSkills(userId: string): Promise<string[]> {
    try {
      const [cvMedia] = await this.prisma.uploadMedia.findMany({
        where: {
          userId,
          type: MediaType.CV,
          cvScanStatus: CvScanStatus.COMPLETED,
          cvExtractedText: { not: null },
        },
        select: { cvExtractedText: true },
        orderBy: { cvScanCompletedAt: 'desc' },
        take: 1,
      });
      const parsed = JSON.parse(cvMedia?.cvExtractedText ?? '{}') as {
        skills?: unknown;
      };
      const skills = Array.isArray(parsed.skills)
        ? [
            ...new Set(
              parsed.skills
                .filter((s): s is string => typeof s === 'string')
                .map((s) => s.trim())
                .filter(Boolean),
            ),
          ]
        : [];
      if (skills.length > 0) return skills.slice(0, 50);
    } catch {
      // No usable CV data; fall back to job applications.
    }

    const jobApplications = await this.prisma.jobApplication.findMany({
      where: { userId },
      select: { job: { select: { skills: true } } },
    });
    return Array.from(
      new Set(
        jobApplications.flatMap((a) => a.job.skills).map((s) => s.trim()),
      ),
    )
      .filter(Boolean)
      .slice(0, 50);
  }

  async matchedJobs(userId: string): Promise<unknown> {
    const allowedSkills = await this.careerSkills(userId);
    const fallbackSkills =
      allowedSkills.length > 0 ? allowedSkills : DEFAULT_SKILLS;
    const studentGoal = null;
    const prismaAny = this.prisma as any;

    // Keeps the internal JobScrapeCandidate table filled; best-effort.
    try {
      await seedJobScrapeCandidatesFromActiveJobs(this.prisma);
    } catch {
      // ignore
    }

    const cacheRecord = await prismaAny.jobRecommendationCache?.findFirst?.({
      where: { userId, studentGoal },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });

    const isCacheFresh =
      cacheRecord?.expiresAt instanceof Date &&
      cacheRecord.expiresAt.getTime() > Date.now();

    if (
      cacheRecord?.jobs &&
      isCacheFresh &&
      (cacheRecord.allowedSkills ?? []).join('\n') === allowedSkills.join('\n')
    ) {
      const cachedJobsAny = cacheRecord.jobs as unknown;

      if (
        Array.isArray(cachedJobsAny) &&
        cachedJobsAny.every(
          (j) =>
            j &&
            typeof j === 'object' &&
            typeof (j as any).jobId === 'string' &&
            typeof (j as any).title === 'string' &&
            typeof (j as any).externalUrl === 'string' &&
            typeof (j as any).matchReason === 'string',
        )
      ) {
        return {
          items: cachedJobsAny,
          allowedSkills: fallbackSkills,
          notificationsCreated: 0,
        };
      }
    }

    const candidateJobsRaw =
      (await prismaAny.jobScrapeCandidate?.findMany?.({
        select: {
          id: true,
          title: true,
          company: true,
          location: true,
          description: true,
          skills: true,
          externalUrl: true,
          updatedAt: true,
          source: true,
        },
        take: 500,
      })) ?? [];

    const candidateJobs = Array.isArray(candidateJobsRaw)
      ? candidateJobsRaw
      : [];

    let filteredCandidateJobs = candidateJobs.filter((j: unknown) => {
      const any = j as { source?: unknown; platform?: unknown } | undefined;
      // Prefer schema-backed field `source`, but tolerate legacy `platform`.
      return (
        any?.source === 'internal' ||
        any?.platform === 'internal' ||
        // If nothing is set (legacy/older rows), keep it.
        !any?.source
      );
    });

    if (filteredCandidateJobs.length === 0) {
      filteredCandidateJobs = recentJobFallbackCatalog();
    }

    const allowedLower = fallbackSkills.map((s) => s.toLowerCase());

    const rankedAll: Ranked[] = filteredCandidateJobs
      .map((job) => {
        const jobSkills: string[] = Array.isArray(job.skills) ? job.skills : [];
        const matched = jobSkills.filter((s) =>
          allowedLower.some((allowed) => skillMatches(s, allowed)),
        );

        // Until platform-specific job scraping exists, provide a reliable external discovery link.
        const externalUrl =
          job.externalUrl ??
          `https://www.google.com/search?q=${encodeURIComponent(`${job.title} ${job.company} jobs`)}`;

        const matchReason =
          matched.length > 0
            ? `This looks relevant because it connects with your career-path skills: ${matched.join(', ')}.`
            : `This is a broader search to explore while you keep building your career-path skills: ${fallbackSkills.join(', ')}.`;

        return {
          jobId: job.id,
          title: job.title,
          company: job.company,
          score: matched.length,
          matchedSkills: matched,
          location: job.location,
          description: job.description,
          updatedAt:
            job.updatedAt instanceof Date
              ? job.updatedAt
              : new Date(job.updatedAt ?? 0),
          externalUrl,
          matchReason,
        };
      })
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.updatedAt.getTime() - a.updatedAt.getTime();
      });

    const ranked = rankedAll.slice(0, 10);

    // Optional AI match reasons: one batched call for all jobs (AI_JOB_MATCH_ENABLED=true).
    if (env.ai.jobMatchEnabled && ranked.length > 0) {
      await this.addAiMatchReasons(userId, ranked, fallbackSkills);
    }

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

    try {
      await prismaAny.jobRecommendationCache?.create?.({
        data: {
          userId,
          studentGoal,
          allowedSkills,
          jobs: ranked,
          expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), // 7 days
        },
      });
    } catch {
      // ignore cache write failures
    }

    return {
      items: ranked,
      allowedSkills: fallbackSkills,
      notificationsCreated: notifyTargets.length,
    };
  }

  private async addAiMatchReasons(
    userId: string,
    ranked: Ranked[],
    skills: string[],
  ): Promise<void> {
    const jobsInput = ranked.map((r) => ({
      jobId: r.jobId,
      title: r.title,
      company: r.company,
      externalUrl: r.externalUrl,
      jobSkills: r.matchedSkills,
    }));

    const userMessage =
      `Career-path skills: ${skills.join(', ')}.\n\n` +
      `Jobs to evaluate (return same jobId order/values):\n` +
      `${JSON.stringify(jobsInput)}\n\n` +
      `Return ONLY valid JSON with this exact shape:\n` +
      `{\n  "jobs": [\n    {\n      "jobId": string,\n      "matchReason": string\n    }\n  ]\n}\n`;

    try {
      const { text } = await this.gateway.generate({
        task: 'job-rerank',
        userId,
        system: MATCH_SYSTEM,
        messages: [{ role: 'user', content: userMessage }],
        cache: {
          key: JSON.stringify({
            skills: [...skills].sort(),
            jobs: ranked.map((r) => r.jobId).sort(),
          }),
          ttlMs: 24 * 3_600_000,
        },
      });

      const jobsArr = parseJsonObject(text)?.jobs;
      if (!Array.isArray(jobsArr)) return;

      const byJobId = new Map<string, string>();
      for (const row of jobsArr as Array<Record<string, unknown>>) {
        if (
          typeof row?.jobId === 'string' &&
          typeof row.matchReason === 'string'
        ) {
          byJobId.set(row.jobId, row.matchReason);
        }
      }
      for (const r of ranked) {
        r.matchReason = byJobId.get(r.jobId) ?? r.matchReason;
      }
    } catch {
      // AI unavailable or out of allowance: keep the heuristic matchReason.
    }
  }
}
