import { HttpException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getCourseScrapeCandidateSeedData } from '../courses/course-catalog-seed.service';
import { AiGatewayService, AiResult } from './gateway/ai-gateway.service';
import { aiMeta, CareerSkillsService } from './career-skills.service';
import { CourseRecommendationsRequestDto } from './dto/course-recommendations-request.dto';

type CourseRecommendation = {
  platform: string;
  courseName: string;
  difficulty: string;
  description: string;
  externalUrl: string;
  whyRecommended: string;
};

const COURSE_CACHE_MS = 7 * 24 * 3_600_000;

const COURSE_SYSTEM = `You are "Career Navigator AI", a course and learning path recommendation specialist.
Recommend 5-8 specific, real courses from Coursera, edX, Udemy, LinkedIn Learning, Simplilearn, Alison or freeCodeCamp that match the user's skills (prioritise the stated goal when given).
Return ONLY JSON: {"courses":[{"platform":string,"courseName":string,"difficulty":"Beginner"|"Intermediate"|"Advanced","description":string,"externalUrl":string,"whyRecommended":string}]}
In "whyRecommended" mention at least one of the career-path skills verbatim.`;

function formatCourses(courses: CourseRecommendation[]): string {
  return courses
    .map(
      (c, idx) =>
        `${idx + 1}. ${c.courseName}\n   Platform: ${c.platform}\n   Difficulty: ${c.difficulty}\n   ${c.description}\n   Link: ${c.externalUrl}\n   Why: ${c.whyRecommended}`,
    )
    .join('\n\n');
}

function parseCourses(text: string): CourseRecommendation[] {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? text;
  const start = fenced.indexOf('{');
  const end = fenced.lastIndexOf('}');
  if (start === -1 || end <= start) return [];
  try {
    const parsed = JSON.parse(fenced.slice(start, end + 1)) as {
      courses?: unknown;
    };
    if (!Array.isArray(parsed.courses)) return [];
    return parsed.courses
      .filter(
        (c): c is Record<string, unknown> =>
          Boolean(c) && typeof c === 'object',
      )
      .filter((c) =>
        [
          'platform',
          'courseName',
          'difficulty',
          'description',
          'externalUrl',
          'whyRecommended',
        ].every((field) => typeof c[field] === 'string'),
      )
      .map((c) => ({
        platform: c.platform as string,
        courseName: c.courseName as string,
        difficulty: c.difficulty as string,
        description: c.description as string,
        externalUrl: c.externalUrl as string,
        whyRecommended: c.whyRecommended as string,
      }));
  } catch {
    return [];
  }
}

@Injectable()
export class CourseRecsService {
  private readonly logger = new Logger(CourseRecsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: AiGatewayService,
    private readonly skills: CareerSkillsService,
  ) {}

  private toCourse(
    candidate: {
      platform?: string;
      title?: string;
      description?: string | null;
      difficulty?: string | null;
      externalUrl?: string;
      skills?: unknown;
    },
    index: number,
    allowedSkills: string[],
  ): CourseRecommendation | null {
    if (
      typeof candidate.title !== 'string' ||
      typeof candidate.platform !== 'string' ||
      typeof candidate.externalUrl !== 'string'
    ) {
      return null;
    }
    const courseSkills = Array.isArray(candidate.skills)
      ? candidate.skills
          .filter((s): s is string => typeof s === 'string')
          .map((s) => s.trim().toLowerCase())
      : [];
    const matched =
      allowedSkills.find((skill) => {
        const s = skill.trim().toLowerCase();
        return (
          s &&
          courseSkills.some((c) => c === s || c.includes(s) || s.includes(c))
        );
      }) ?? allowedSkills[index % allowedSkills.length];

    return {
      platform: candidate.platform,
      courseName: candidate.title,
      difficulty: candidate.difficulty || 'Beginner',
      description:
        candidate.description ||
        'A current learning option you can use to build practical career momentum.',
      externalUrl: candidate.externalUrl,
      whyRecommended: matched
        ? `It supports your career-path skill: ${matched}.`
        : 'It supports practical career development.',
    };
  }

  private async cachedCourses(
    userId: string,
    studentGoal: string | null,
    allowedSkills: string[],
  ): Promise<CourseRecommendation[] | null> {
    try {
      const cache = await this.prisma.courseRecommendationCache.findFirst({
        where: { userId, studentGoal },
        orderBy: { createdAt: 'desc' },
      });
      if (!cache || (cache.expiresAt && cache.expiresAt.getTime() < Date.now()))
        return null;
      if (cache.allowedSkills.join('\n') !== allowedSkills.join('\n'))
        return null;
      const courses = parseCourses(JSON.stringify({ courses: cache.courses }));
      return courses.length > 0 ? courses : null;
    } catch {
      return null;
    }
  }

  async recommendCourses(userId: string, dto: CourseRecommendationsRequestDto) {
    const studentGoal = dto.studentGoal ?? null;
    const allowedSkills = await this.skills.resolve(userId, dto.allowedSkills);

    const cached = await this.cachedCourses(userId, studentGoal, allowedSkills);
    if (cached) {
      return {
        response: this.skills.enforce(formatCourses(cached), allowedSkills),
        allowedSkills,
        studentGoal,
        courses: cached,
        ai: null,
      };
    }

    // Internal candidates give the model real links to prefer and a no-AI fallback.
    let hintCourses: CourseRecommendation[] = [];
    let hintsText = '';
    try {
      const candidates = await this.prisma.courseScrapeCandidate.findMany({
        take: 40,
        orderBy: { updatedAt: 'desc' },
      });
      const allowedLower = new Set(allowedSkills.map((s) => s.toLowerCase()));
      const matching = candidates.filter((c) =>
        c.skills.some((s) => allowedLower.has(s.toLowerCase())),
      );
      const top = (matching.length > 0 ? matching : candidates).slice(0, 12);
      hintCourses = top
        .map((c, idx) => this.toCourse(c, idx, allowedSkills))
        .filter((c): c is CourseRecommendation => Boolean(c))
        .slice(0, 8);
      if (top.length > 0) {
        hintsText = `\nInternal candidate courses (prefer these when useful):\n${top
          .map(
            (c, idx) =>
              `${idx + 1}) ${c.title} | ${c.platform} | ${c.difficulty ?? ''} | Skills: ${c.skills.slice(0, 5).join(', ')} | Link: ${c.externalUrl}`,
          )
          .join('\n')}`;
      }
    } catch {
      // Candidate table unavailable; the model works without hints.
    }

    let result: AiResult | null = null;
    let courses: CourseRecommendation[] = [];
    try {
      result = await this.gateway.generate({
        task: 'course-recs',
        userId,
        system: `${COURSE_SYSTEM}\nThe user's career-path skills: ${allowedSkills.join(', ')}${hintsText}`,
        messages: [
          {
            role: 'user',
            content:
              studentGoal ??
              `Recommend courses for my career skills: ${allowedSkills.join(', ')}`,
          },
        ],
        cache: {
          key: JSON.stringify({
            skills: [...allowedSkills].sort(),
            goal: studentGoal,
            hintsText,
          }),
          ttlMs: COURSE_CACHE_MS,
        },
      });
      courses = parseCourses(result.text);
    } catch (err) {
      // Out of free allowance or every model busy: still show curated courses.
      if (!(err instanceof HttpException)) throw err;
      this.logger.warn(`Course recommendations without AI: ${err.message}`);
    }

    if (courses.length === 0) {
      courses =
        hintCourses.length > 0
          ? hintCourses
          : getCourseScrapeCandidateSeedData()
              .map((c, idx) => this.toCourse(c, idx, allowedSkills))
              .filter((c): c is CourseRecommendation => Boolean(c))
              .slice(0, 8);
    }

    if (courses.length > 0) {
      try {
        await this.prisma.courseRecommendationCache.create({
          data: {
            userId,
            studentGoal,
            allowedSkills,
            courses,
            expiresAt: new Date(Date.now() + COURSE_CACHE_MS),
          },
        });
      } catch {
        // Cache writes never fail the request.
      }
    }

    const text =
      courses.length > 0 ? formatCourses(courses) : (result?.text ?? '');
    return {
      response: this.skills.enforce(text, allowedSkills),
      allowedSkills,
      studentGoal,
      courses,
      ai: result ? aiMeta(result) : null,
    };
  }
}
