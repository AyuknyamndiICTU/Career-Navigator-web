import { HttpException, Injectable, Logger } from '@nestjs/common';
import { CvScanStatus, MediaType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { getCourseScrapeCandidateSeedData } from '../courses/course-catalog-seed.service';
import {
  AiGatewayService,
  AiResult,
  AiStreamEvent,
} from './gateway/ai-gateway.service';
import { ChatTurn } from './gateway/types';
import { ChatHistoryItemDto, ChatRequestDto } from './dto/chat-request.dto';
import { MockInterviewRequestDto } from './dto/mock-interview-request.dto';
import { CourseRecommendationsRequestDto } from './dto/course-recommendations-request.dto';

type CourseRecommendation = {
  platform: string;
  courseName: string;
  difficulty: string;
  description: string;
  externalUrl: string;
  whyRecommended: string;
};

export type AiMeta = Pick<
  AiResult,
  'provider' | 'model' | 'viaOwnKey' | 'cached' | 'latencyMs' | 'usage'
>;

/** Stream events plus the skills the answer was scoped to (sent with the final event). */
export type ChatStreamEvent =
  | AiStreamEvent
  | { type: 'context'; allowedSkills: string[] };

/**
 * Waits for the gateway's first event (planning, quota and the first token) before emitting
 * anything, so allowance and availability errors become normal JSON errors instead of a stream.
 */
async function* withContext(
  allowedSkills: string[],
  events: AsyncGenerator<AiStreamEvent>,
  onEvent?: (event: AiStreamEvent) => Promise<void>,
): AsyncGenerator<ChatStreamEvent> {
  const first = await events.next();
  yield { type: 'context', allowedSkills };
  if (first.done) return;
  await onEvent?.(first.value);
  yield first.value;
  for await (const event of events) {
    await onEvent?.(event);
    yield event;
  }
}

const KEEP_TURNS = 6;
const COURSE_CACHE_MS = 7 * 24 * 3_600_000;

const DEFAULT_SKILLS = [
  'General Career Guidance',
  'Resume Building',
  'Interview Preparation',
  'Job Search Strategies',
  'Professional Development',
];

// Static prompt prefixes keep providers' prompt caches warm; per-user details go last.
const CHAT_SYSTEM = `You are "Career Navigator AI", a warm, practical career coach.
Style: helpful mentor, plain language, concise and specific. No JSON, code fences or markdown tables. Short bullets only when they help. Never say "as an AI".
Scope: career paths, job search and matching, skills and courses, resumes/CVs, interviews and mock interviews, mentoring, networking, professional development. Politely steer unrelated questions back to careers.
Greet briefly when greeted and ask which career goal to work on. When relevant, mention at least one of the user's career-path skills.`;

const MOCK_INTERVIEW_SYSTEM = `You are "Career Navigator AI", a professional mock interview coach.
Run a realistic interview: one question at a time (2-3 in total), each with what a strong answer should cover. After each candidate answer give honest, constructive, encouraging feedback, then the next question. Keep it practical and aligned to the candidate's skills.`;

const COURSE_SYSTEM = `You are "Career Navigator AI", a course and learning path recommendation specialist.
Recommend 5-8 specific, real courses from Coursera, edX, Udemy, LinkedIn Learning, Simplilearn, Alison or freeCodeCamp that match the user's skills (prioritise the stated goal when given).
Return ONLY JSON: {"courses":[{"platform":string,"courseName":string,"difficulty":"Beginner"|"Intermediate"|"Advanced","description":string,"externalUrl":string,"whyRecommended":string}]}
In "whyRecommended" mention at least one of the career-path skills verbatim.`;

function meta(result: AiResult): AiMeta {
  const { provider, model, viaOwnKey, cached, latencyMs, usage } = result;
  return { provider, model, viaOwnKey, cached, latencyMs, usage };
}

/**
 * Last 6 turns verbatim; older user turns are condensed into one line appended to the new
 * message, so long chats don't resend the whole history on every request.
 */
function buildTurns(
  history: ChatHistoryItemDto[] | undefined,
  message: string,
): ChatTurn[] {
  const turns = (history ?? []).filter((t) => t.content?.trim());
  const recent = turns.slice(-KEEP_TURNS).map((t) => ({
    role: t.role,
    content: t.content.slice(0, 4_000),
  }));
  const older = turns.slice(0, -KEEP_TURNS).filter((t) => t.role === 'user');
  const summary = older
    .map((t) => t.content.replace(/\s+/g, ' ').slice(0, 100))
    .join(' | ')
    .slice(0, 600);

  const content = summary
    ? `${message}\n\n(Earlier in this chat the user asked about: ${summary})`
    : message;
  return [...recent, { role: 'user', content }];
}

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
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: AiGatewayService,
  ) {}

  // ─── Career-path skills ─────────────────────────────────────────────────────

  private async deriveCareerAllowedSkills(userId: string): Promise<string[]> {
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
      if (skills.length > 0) return skills;
    } catch {
      // No CV data (or unreadable); fall back to job applications.
    }

    const applications = await this.prisma.jobApplication.findMany({
      where: { userId },
      select: { job: { select: { skills: true } } },
    });
    const skills = [
      ...new Set(
        applications.flatMap((a) => a.job.skills).map((s) => s.trim()),
      ),
    ].filter(Boolean);
    return skills.length > 0 ? skills : DEFAULT_SKILLS;
  }

  private async resolveAllowedSkills(
    userId: string,
    requestedSkills: string[] | undefined,
  ): Promise<string[]> {
    const careerSkills = await this.deriveCareerAllowedSkills(userId);
    if (!requestedSkills?.length) return careerSkills;

    const careerLower = new Set(careerSkills.map((s) => s.toLowerCase()));
    const allowed = requestedSkills
      .map((s) => s.trim())
      .filter((s) => s && careerLower.has(s.toLowerCase()));
    return allowed.length > 0 ? allowed : careerSkills;
  }

  private enforceAllowedSkillsInResponse(
    responseText: string,
    allowedSkills: string[],
  ): string {
    if (allowedSkills.length === 0) return responseText;
    const lower = responseText.toLowerCase();
    if (allowedSkills.some((skill) => lower.includes(skill.toLowerCase())))
      return responseText;

    return `I can help with that through the lens of your career-path skills: ${allowedSkills.join(
      ', ',
    )}. Tell me the role, goal, or deadline you are working toward, and I will make the next steps practical.`;
  }

  private async persistAiChat(
    userId: string,
    userMessage: string,
    assistantMessage: string,
  ) {
    try {
      const conversation = await this.prisma.conversation.create({
        data: { participants: { create: { userId } } },
        select: { id: true },
      });
      await this.prisma.message.createMany({
        data: [
          {
            conversationId: conversation.id,
            senderId: userId,
            content: userMessage,
          },
          {
            conversationId: conversation.id,
            senderId: userId,
            content: assistantMessage,
          },
        ],
      });
    } catch {
      // Analytics persistence never fails the request.
    }
  }

  // ─── Chat ───────────────────────────────────────────────────────────────────

  private async chatRequest(userId: string, dto: ChatRequestDto) {
    const allowedSkills = await this.resolveAllowedSkills(
      userId,
      dto.allowedSkills,
    );
    return {
      allowedSkills,
      request: {
        task: 'chat' as const,
        userId,
        system: `${CHAT_SYSTEM}\nThe user's career-path skills: ${allowedSkills.join(', ')}`,
        messages: buildTurns(dto.history, dto.message),
      },
    };
  }

  async chat(userId: string, dto: ChatRequestDto) {
    const { allowedSkills, request } = await this.chatRequest(userId, dto);
    const result = await this.gateway.generate(request);
    const response = this.enforceAllowedSkillsInResponse(
      result.text,
      allowedSkills,
    );

    // Persist only on success so failed prompts don't inflate analytics.
    await this.persistAiChat(userId, dto.message, response);
    return { response, allowedSkills, ai: meta(result) };
  }

  async *chatStream(
    userId: string,
    dto: ChatRequestDto,
    signal: AbortSignal,
  ): AsyncGenerator<ChatStreamEvent> {
    const { allowedSkills, request } = await this.chatRequest(userId, dto);
    yield* withContext(
      allowedSkills,
      this.gateway.stream({ ...request, signal }),
      async (event) => {
        if (event.type === 'done')
          await this.persistAiChat(userId, dto.message, event.result.text);
      },
    );
  }

  // ─── Mock interview ─────────────────────────────────────────────────────────

  private async mockInterviewRequest(
    userId: string,
    dto: MockInterviewRequestDto,
  ) {
    const allowedSkills = await this.resolveAllowedSkills(
      userId,
      dto.allowedSkills,
    );
    const difficulty = dto.difficulty ?? 'intermediate';
    const opening = `I want to practice for a ${dto.role} interview. Please start the mock interview.`;
    return {
      allowedSkills,
      difficulty,
      request: {
        task: 'mock-interview' as const,
        userId,
        system: `${MOCK_INTERVIEW_SYSTEM}\nRole: ${dto.role}. Difficulty: ${difficulty}.\nThe candidate's career-path skills: ${allowedSkills.join(', ')}`,
        messages: dto.message?.trim()
          ? buildTurns(
              dto.history?.length
                ? dto.history
                : [{ role: 'user', content: opening }],
              dto.message,
            )
          : [{ role: 'user' as const, content: opening }],
      },
    };
  }

  async mockInterview(userId: string, dto: MockInterviewRequestDto) {
    const { allowedSkills, difficulty, request } =
      await this.mockInterviewRequest(userId, dto);
    const result = await this.gateway.generate(request);
    return {
      response: this.enforceAllowedSkillsInResponse(result.text, allowedSkills),
      allowedSkills,
      role: dto.role,
      difficulty,
      ai: meta(result),
    };
  }

  async *mockInterviewStream(
    userId: string,
    dto: MockInterviewRequestDto,
    signal: AbortSignal,
  ): AsyncGenerator<ChatStreamEvent> {
    const { allowedSkills, request } = await this.mockInterviewRequest(
      userId,
      dto,
    );
    yield* withContext(
      allowedSkills,
      this.gateway.stream({ ...request, signal }),
    );
  }

  // ─── Course recommendations ─────────────────────────────────────────────────

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
    const allowedSkills = await this.resolveAllowedSkills(
      userId,
      dto.allowedSkills,
    );

    const cached = await this.cachedCourses(userId, studentGoal, allowedSkills);
    if (cached) {
      return {
        response: this.enforceAllowedSkillsInResponse(
          formatCourses(cached),
          allowedSkills,
        ),
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
      response: this.enforceAllowedSkillsInResponse(text, allowedSkills),
      allowedSkills,
      studentGoal,
      courses,
      ai: result ? meta(result) : null,
    };
  }
}
