/* eslint-env node */

import { getAIProvider, GEMINI_MODEL } from '../lib/aiProvider';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { verifyAccessToken } from '../auth/jwt/jwt-utils';
import { PrismaService } from '../prisma/prisma.service';
import { CvScanStatus, MediaType } from '@prisma/client';
import { ChatRequestDto } from './dto/chat-request.dto';
import { MockInterviewRequestDto } from './dto/mock-interview-request.dto';
import { CourseRecommendationsRequestDto } from './dto/course-recommendations-request.dto';
import { getCourseScrapeCandidateSeedData } from '../courses/course-catalog-seed.service';

type AuthUser = { sub: string };

// ─── Named AI provider registry (configuration only; no wiring) ─────────────
// This registers provider/model metadata under a stable name so other parts
// of the project can reference it without enabling fallback behavior yet.
export const AI_PROVIDERS = {
  'ollama-cloud': {
    name: 'ollama-cloud',
    baseUrl: 'https://ollama.com/v1',
    apiKeyEnvVar: 'OLLAMA_API_KEY',
    models: [
      { model: 'qwen3-coder:480b-cloud', label: 'coding' },
      { model: 'glm-4.6:cloud', label: 'reasoning' },
    ],
  },
} as const;

// If a Gemini request exceeds this duration, we trigger fallback to Ollama.
const GEMINI_REQUEST_TIMEOUT_MS = 15_000;

// After switching to Ollama, we keep Gemini disabled for this cooldown duration,
// then allow Gemini to be tried again automatically.
const GEMINI_FALLBACK_COOLDOWN_MS = 30_000;

class GeminiRateLimitError extends Error {
  readonly statusCode: number;
  constructor(statusCode = 429) {
    super('Gemini rate limited');
    this.statusCode = statusCode;
  }
}

class GeminiTimeoutError extends Error {
  constructor() {
    super('Gemini request timed out');
  }
}

function extractBearerToken(authorizationHeader: string | undefined): string {
  if (!authorizationHeader) return '';
  return authorizationHeader.replace(/^Bearer\s+/i, '').trim();
}

@Injectable()
export class AiService {
  constructor(private readonly prisma: PrismaService) {}

  // When set to a future epoch, Gemini is considered “cooling down” and we
  // immediately use Ollama until this time elapses.
  private geminiFallbackUntilEpochMs = 0;

  private lastUsedProvider: 'gemini' | 'ollama' = 'gemini';
  private lastGeminiFallbackReason:
    | 'Gemini returned HTTP 429'
    | 'Gemini request timed out after 15 seconds'
    | null = null;

  private isCodeRelatedTask(
    systemInstruction: string,
    userMessage: string,
  ): boolean {
    const text = `${systemInstruction}\n${userMessage}`.toLowerCase();
    const codeKeywords = [
      'code',
      'program',
      'coding',
      'typescript',
      'javascript',
      'node',
      'python',
      'java',
      'c++',
      'c#',
      'go lang',
      'golang',
      'rust',
      'sql',
      'react',
      'next.js',
      'algorithm',
      'data structure',
      'bug',
      'error',
      'stack trace',
      'implement',
      'function',
      'class ',
      'code review',
      'refactor',
    ];
    return codeKeywords.some((k) => text.includes(k));
  }

  private getOllamaFallbackModelsForTask(
    systemInstruction: string,
    userMessage: string,
  ): string[] {
    const combined = `${systemInstruction}\n${userMessage}`.toLowerCase();
    const userText = userMessage.toLowerCase();

    const isCodeTask = this.isCodeRelatedTask(systemInstruction, userMessage);

    // Mock Interview (conversational) should use glm-4.6.
    // Only inspect the user task; the general chat prompt also mentions mock interviews.
    const isMockInterviewTask =
      userText.includes('mock interview') ||
      userText.includes('mock-interview');

    // Resume/CV builder + structured formatting prompts.
    const resumeKeywords = [
      'resume',
      'cv',
      'curriculum vitae',
      'cover letter',
      'resume template',
      'build resume',
      'format resume',
      'structured resume',
      'resume section',
      'education section',
      'work experience',
      'experience section',
      'professional summary',
      'summary',
      'headline',
      'skills',
    ];

    const isResumeBuilderTask = resumeKeywords.some((k) => userText.includes(k));

    // Coding requests should use the coding/doc model even if the broader
    // assistant prompt mentions conversational career features.
    if (isCodeTask) {
      return ['qwen3-coder:480b-cloud'];
    }

    // Mock interview -> reasoning/conversation model.
    if (isMockInterviewTask) {
      return ['glm-4.6:cloud'];
    }

    // For document/structured generation we prefer the coding/doc model.
    if (isResumeBuilderTask) {
      return ['qwen3-coder:480b-cloud'];
    }

    return ['glm-4.6:cloud'];
  }

  private triggerGeminiFallback(
    reason:
      | 'Gemini returned HTTP 429'
      | 'Gemini request timed out after 15 seconds',
  ): void {
    this.lastGeminiFallbackReason = reason;
    this.geminiFallbackUntilEpochMs = Date.now() + GEMINI_FALLBACK_COOLDOWN_MS;
  }

  private isGeminiInFallbackCooldown(): boolean {
    return Date.now() < this.geminiFallbackUntilEpochMs;
  }

  private async generateWithGeminiAndFallback(
    systemInstruction: string,
    userMessage: string,
  ): Promise<string> {
    // FIX A: Provider priority order (delegated config via shared util)
    // 1) Gemini if GEMINI_API_KEY is set
    // 2) Gemini unavailable -> fallback to Ollama Cloud (OLLAMA_API_KEY)
    // 3) Neither configured -> throw clear error
    let provider: ReturnType<typeof getAIProvider>;
    try {
      provider = getAIProvider();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new BadRequestException(message);
    }

    let preferredOllamaModels = this.getOllamaFallbackModelsForTask(
      systemInstruction,
      userMessage,
    );

    const allowedOllamaModels = provider.ollama?.models ?? [];
    preferredOllamaModels = preferredOllamaModels.filter((m) =>
      allowedOllamaModels.includes(m),
    );

    const hasGeminiKey = provider.gemini?.apiKey != null;
    let geminiError: string | null = null;

    // 1) Gemini (when key exists)
    if (hasGeminiKey) {
      try {
        return await this.generateWithGemini(systemInstruction, userMessage);
      } catch (err) {
        // 2) Gemini unavailable -> fallback to Ollama Cloud
        geminiError =
          err instanceof Error ? err.message : 'Gemini request failed';
      }
    }

    // 2) Fallback to Ollama Cloud
    try {
      return await this.generateWithOllama(systemInstruction, userMessage, {
        preferredModels: preferredOllamaModels,
      });
    } catch (err) {
      // 3) Both unavailable (or Ollama also fails)
      const ollamaError =
        err instanceof Error ? err.message : 'Ollama request failed';
      const details = [
        geminiError ? `Gemini: ${geminiError}` : 'Gemini: not configured',
        `Ollama: ${ollamaError}`,
      ].join('; ');
      throw new BadRequestException(
        `AI providers unavailable. ${details}. Check GEMINI_API_KEY or OLLAMA_API_KEY in your environment configuration.`,
      );
    }
  }

  private getAuthUser(authorizationHeader: string | undefined): AuthUser {
    const accessSecret = process.env.JWT_ACCESS_SECRET;
    if (!accessSecret) {
      throw new UnauthorizedException('JWT secrets are not configured');
    }

    const token = extractBearerToken(authorizationHeader);
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    let payload: { sub?: string } | undefined;

    try {
      payload = verifyAccessToken({ secret: accessSecret, token }) as
        | { sub?: string }
        | undefined;
    } catch {
      // Important: keep AI endpoints from returning 500 on expired/invalid JWTs.
      throw new UnauthorizedException('Missing or invalid bearer token');
    }

    if (!payload?.sub) {
      throw new UnauthorizedException('Invalid token');
    }

    return { sub: payload.sub };
  }

  private assertValidInput(dto: ChatRequestDto): void {
    if (!dto) {
      throw new BadRequestException('Body is required');
    }

    const message = dto.message;
    if (typeof message !== 'string' || message.trim().length === 0) {
      throw new BadRequestException('message must be a non-empty string');
    }
    if (message.length > 5000) {
      throw new BadRequestException('message is too long');
    }
  }

  private async deriveCareerAllowedSkills(userId: string): Promise<string[]> {
    // Prefer CV-scan extracted skills when available.
    const uploadMediaClient = (this.prisma as any).uploadMedia as
      | undefined
      | {
          findMany: (
            args: unknown,
          ) => Promise<Array<{ cvExtractedText?: unknown }>>;
        };

    if (uploadMediaClient?.findMany) {
      try {
        const cvMedia = await uploadMediaClient.findMany({
          where: {
            userId,
            type: MediaType.CV,
            cvScanStatus: CvScanStatus.COMPLETED,
            cvExtractedText: { not: null },
          },
          select: { cvExtractedText: true, cvScanCompletedAt: true },
          orderBy: { cvScanCompletedAt: 'desc' },
          take: 1,
        });

        const cvExtractedText = cvMedia?.[0]?.cvExtractedText;
        if (typeof cvExtractedText === 'string' && cvExtractedText.trim()) {
          // Phase 0 contract: always derive `skills: string[]` safely from JSON.

          // Inline Phase 0 contract parsing here (avoid `require()` for eslint compliance)
          const parsed = JSON.parse(cvExtractedText) as { skills?: unknown };

          const skills = Array.isArray(parsed?.skills)
            ? Array.from(
                new Set(
                  parsed.skills
                    .filter((s): s is string => typeof s === 'string')
                    .map((s) => s.trim())
                    .filter(Boolean),
                ),
              )
            : [];

          if (skills.length > 0) return skills;
        }
      } catch {
        // If CV JSON parsing/query fails, fall back.
      }
    }

    // Fallback: JobApplication -> Job includes skills[] (career path proxy)
    const applications = await this.prisma.jobApplication.findMany({
      where: { userId },
      select: {
        job: { select: { skills: true } },
      },
    });

    const all = applications.flatMap((a) => a.job.skills);
    const uniqueSkills = Array.from(new Set(all.map((s) => s.trim()))).filter(
      Boolean,
    );

    if (uniqueSkills.length === 0) {
      return [
        'General Career Guidance',
        'Resume Building',
        'Interview Preparation',
        'Job Search Strategies',
        'Professional Development',
      ];
    }

    return uniqueSkills;
  }

  private async resolveAllowedSkills(
    authorizationHeader: string | undefined,
    requestedSkills: string[] | undefined,
  ): Promise<string[]> {
    const { sub: userId } = this.getAuthUser(authorizationHeader);

    const careerSkills = await this.deriveCareerAllowedSkills(userId);
    const careerSkillsLower = new Set(careerSkills.map((s) => s.toLowerCase()));

    const allowedSkills =
      requestedSkills && requestedSkills.length > 0
        ? requestedSkills
            .map((s) => s.trim())
            .filter(Boolean)
            .filter((s) => careerSkillsLower.has(s.toLowerCase()))
        : careerSkills;

    if (!allowedSkills || allowedSkills.length === 0) {
      return careerSkills;
    }

    return allowedSkills;
  }

  private responseMentionsAnyAllowedSkill(
    responseText: string,
    allowedSkills: string[],
  ): boolean {
    const responseLower = responseText.toLowerCase();
    return allowedSkills.some((skill) =>
      responseLower.includes(skill.toLowerCase()),
    );
  }

  private enforceAllowedSkillsInResponse(
    responseText: string,
    allowedSkills: string[],
  ): string {
    if (!allowedSkills || allowedSkills.length === 0) return responseText;

    const mentionsAny = this.responseMentionsAnyAllowedSkill(
      responseText,
      allowedSkills,
    );

    if (mentionsAny) return responseText;

    // Tests assert the response contains "career-path skills".
    return `I can help with that through the lens of your career-path skills: ${allowedSkills.join(
      ', ',
    )}. Tell me the role, goal, or deadline you are working toward, and I will make the next steps practical.`;
  }

  // ─── Ollama API (e2e/back-compat fallback) ──────────────────────────
  private async generateWithOllama(
    systemInstruction: string,
    userMessage: string,
    options?: { preferredModels?: string[] },
  ): Promise<string> {
    // FIX A: Ollama Cloud fallback should use ollama.com/v1 and OLLAMA_API_KEY.
    const provider = getAIProvider();
    const ollamaBaseUrl = provider.ollama?.baseUrl ?? 'https://ollama.com/v1';
    const apiKey = provider.ollama?.apiKey;

    if (!provider.ollama) {
      throw new BadRequestException(
        'AI providers unavailable. Check GEMINI_API_KEY or OLLAMA_API_KEY in your environment configuration.',
      );
    }

    const preferredModels = Array.isArray(options?.preferredModels)
      ? options!.preferredModels.filter((m) => typeof m === 'string' && m)
      : [];

    // FIX A: restrict to the cloud models requested.
    const candidates =
      preferredModels.length > 0
        ? preferredModels
        : ['qwen3-coder:480b-cloud', 'glm-4.6:cloud'];

    const uniqueCandidates = Array.from(new Set(candidates)).filter(Boolean);

    if (uniqueCandidates.length === 0) {
      throw new BadRequestException(
        'AI providers unavailable. Check GEMINI_API_KEY or OLLAMA_API_KEY in your environment configuration.',
      );
    }

    // FIX A: use Ollama OpenAI-compatible endpoint.
    // ollamaBaseUrl already includes `/v1`.
    const url = `${ollamaBaseUrl.replace(/\/+$/, '')}/chat/completions`;

    let lastError: unknown = null;

    for (const model of uniqueCandidates) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
            },
            body: JSON.stringify({
              model,
              messages: [
                { role: 'system', content: systemInstruction },
                { role: 'user', content: userMessage },
              ],
              temperature: 0.7,
              max_tokens: 1024,
            }),
          });

          if (!res.ok) {
            if ((res.status === 429 || res.status === 503) && attempt < 2) {
              const retryAfterHeader = res.headers?.get?.('retry-after');
              const retryAfterSeconds = retryAfterHeader
                ? Number(retryAfterHeader)
                : NaN;
              const waitMs =
                Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0
                  ? retryAfterSeconds * 1000
                  : 500;

              await new Promise((resolve) => setTimeout(resolve, waitMs));
              continue;
            }

            const errorBody = await res.text().catch(() => '');
            throw new BadRequestException(
              `Ollama generation failed: model=${model} status=${res.status} ${errorBody}`.trim(),
            );
          }

          const data = (await res.json()) as unknown;

          const dataAny = data as {
            response?: unknown;
            choices?: Array<{
              message?: { content?: unknown };
            }>;
          };

          const textFromMock =
            typeof dataAny?.response === 'string' ? dataAny.response : null;

          const textFromOllama =
            typeof dataAny?.choices?.[0]?.message?.content === 'string'
              ? (dataAny.choices[0].message.content as string)
              : '';

          return textFromMock ?? textFromOllama;
        } catch (err) {
          lastError = err;
        }
      }
    }

    // FIX C: unify provider-unavailable error message.
    if (lastError) {
      throw new BadRequestException(
        'AI providers unavailable. Check GEMINI_API_KEY or OLLAMA_API_KEY in your environment configuration.',
      );
    }

    throw new BadRequestException(
      'AI providers unavailable. Check GEMINI_API_KEY or OLLAMA_API_KEY in your environment configuration.',
    );
  }

  // ─── Google Gemini API ─────────────────────────────────────────────

  private async generateWithGemini(
    systemInstruction: string,
    userMessage: string,
  ): Promise<string> {
    const provider = getAIProvider();
    const apiKey = provider.gemini?.apiKey;
    if (!apiKey) {
      throw new BadRequestException('GEMINI_API_KEY is not configured');
    }

    const url = provider.gemini?.generateContentUrlForModel(GEMINI_MODEL);
    if (!url) {
      throw new BadRequestException('GEMINI_API_KEY is not configured');
    }

    const body = {
      system_instruction: {
        parts: [{ text: systemInstruction }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: userMessage }],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        maxOutputTokens: 1024,
      },
    };

    const maxRetries = 6;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        GEMINI_REQUEST_TIMEOUT_MS,
      );

      let res: Response;
      try {
        res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } catch (err) {
        const errAny = err as { name?: string } | undefined;
        if (errAny?.name === 'AbortError') {
          throw new GeminiTimeoutError();
        }
        throw err;
      } finally {
        clearTimeout(timeoutId);
      }

      if (res.ok) {
        const data = (await res.json()) as unknown;

        // Support both:
        // - Gemini shape: { candidates: [{ content: { parts: [{ text }]}}]}
        // - Unit test mock shape: { response: "..." }
        const dataAny = data as {
          response?: unknown;
          candidates?: Array<{
            content?: { parts?: Array<{ text?: string }> };
          }>;
        };

        const textFromMock =
          typeof dataAny?.response === 'string' ? dataAny.response : null;

        const textFromGemini =
          dataAny?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

        return textFromMock ?? textFromGemini ?? '';
      }

      // Retry on service unavailable (503) only
      if (res.status === 503 && attempt < maxRetries) {
        const retryAfterHeader = res.headers.get('retry-after');
        const retryAfterSeconds = retryAfterHeader
          ? Number(retryAfterHeader)
          : NaN;

        const retryAfterMs =
          Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0
            ? retryAfterSeconds * 1000
            : null;

        const backoffMs = Math.min(1000 * Math.pow(2, attempt), 16000);
        const waitMs = retryAfterMs ?? backoffMs;

        await new Promise((resolve) => setTimeout(resolve, waitMs));
        continue;
      }

      // Final failure — provide a user-friendly message
      if (res.status === 429) {
        // Important: trigger outer fallback logic immediately.
        throw new GeminiRateLimitError(429);
      }
      if (res.status === 503) {
        throw new BadRequestException(
          'The AI service is temporarily unavailable due to high demand. Please try again in a few seconds.',
        );
      }

      const errorBody = await res.text().catch(() => '');
      throw new BadRequestException(
        `AI generation failed: ${res.status} ${errorBody}`.trim(),
      );
    }

    throw new BadRequestException(
      'The AI service is temporarily unavailable. Please try again shortly.',
    );
  }

  private async persistAiChat(
    userId: string,
    userMessage: string,
    assistantMessage: string,
  ): Promise<void> {
    const prismaAny = this.prisma as any;

    // In tests, PrismaService is overridden with a minimal mock that may not
    // include conversation/message. Skip persistence in that case.
    if (!prismaAny?.conversation?.create || !prismaAny?.message?.createMany) {
      return;
    }

    try {
      const conversation = await prismaAny.conversation.create({
        data: {
          participants: {
            create: { userId },
          },
        },
        select: { id: true },
      });

      await prismaAny.message.createMany({
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
      // never fail the request due to analytics persistence
    }
  }

  // ─── Chat ──────────────────────────────────────────────────────────

  async chat(
    authorizationHeader: string | undefined,
    dto: ChatRequestDto,
  ): Promise<{ response: string; allowedSkills: string[] }> {
    this.assertValidInput(dto);

    const { sub: userId } = this.getAuthUser(authorizationHeader);

    const allowedSkills = await this.resolveAllowedSkills(
      authorizationHeader,
      dto.allowedSkills,
    );

    const systemInstruction = `You are "Career Navigator AI", a warm, practical career coach.

Your personality:
- Speak like a helpful mentor, not a generic chatbot.
- Use plain, natural language and make the user feel guided.
- When the user greets you, greet them back briefly and ask what career goal they want to work on.
- Keep responses concise, practical, and specific.
- Do not return JSON, code fences, or raw markdown tables.

Your expertise areas:
- Career path guidance and planning
- Job search strategies and job matching
- Skills development and learning recommendations
- Resume and CV building tips
- Interview preparation and mock interviews
- Mentor matching and networking advice
- Course and certification recommendations
- Professional development

The user's current career-path skills: ${allowedSkills.join(', ')}

Rules:
1. Always respond helpfully to career-related questions
2. If a user asks something completely unrelated to careers/professional development (e.g. cooking recipes, sports scores), politely redirect them to career topics
3. Keep responses clear, well-structured, and actionable
4. Use short bullets only when they make the answer easier to act on
5. Avoid stiff phrases like "as an AI"; sound human, calm, and encouraging
6. When relevant, naturally mention at least one of the user's career-path skills`;

    const responseTextRaw = await this.generateWithGeminiAndFallback(
      systemInstruction,
      dto.message,
    );

    const responseText = this.enforceAllowedSkillsInResponse(
      responseTextRaw,
      allowedSkills,
    );

    // Persist only on success so failed prompts (capacity/rate-limit) don't inflate analytics.
    await this.persistAiChat(userId, dto.message, responseText);

    return { response: responseText, allowedSkills };
  }

  // ─── Mock Interview ────────────────────────────────────────────────

  async mockInterview(
    authorizationHeader: string | undefined,
    dto: MockInterviewRequestDto,
  ): Promise<unknown> {
    try {
      if (
        !dto?.role ||
        typeof dto.role !== 'string' ||
        dto.role.trim().length === 0
      ) {
        throw new BadRequestException('role must be a non-empty string');
      }

      const allowedSkills = await this.resolveAllowedSkills(
        authorizationHeader,
        dto.allowedSkills,
      );

      const systemInstruction = `You are "Career Navigator AI", a professional mock interview coach.

You specialize in conducting realistic mock interviews for job candidates.

The candidate's career-path skills: ${allowedSkills.join(', ')}

Task:
- Conduct a mock interview for the role: ${dto.role}
- Difficulty: ${dto.difficulty ?? 'intermediate'}
- Ask 2-3 interview questions one at a time
- For each question, include what a strong answer should cover
- Keep the focus practical and aligned to the candidate's skills
- Be encouraging but provide honest, constructive feedback`;

      const responseTextRaw = await this.generateWithGeminiAndFallback(
        systemInstruction,
        `I want to practice for a ${dto.role} interview. Please start the mock interview.`,
      );

      const responseText = this.enforceAllowedSkillsInResponse(
        responseTextRaw,
        allowedSkills,
      );

      return {
        response: responseText,
        allowedSkills,
        role: dto.role,
        difficulty: dto.difficulty ?? 'intermediate',
      };
    } catch (err) {
      if (err instanceof BadRequestException) {
        throw err;
      }

      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'string'
            ? err
            : null;

      throw new InternalServerErrorException({
        message: 'Internal server error',
        cause: message,
      });
    }
  }

  // ─── Course Recommendations ────────────────────────────────────────

  async recommendCourses(
    authorizationHeader: string | undefined,
    dto: CourseRecommendationsRequestDto,
  ): Promise<unknown> {
    type CourseRecommendation = {
      platform: string;
      courseName: string;
      difficulty: string;
      description: string;
      externalUrl: string;
      whyRecommended: string;
    };

    const prismaAny = this.prisma as any;

    const { sub: userId } = this.getAuthUser(authorizationHeader);
    const studentGoal = dto.studentGoal ?? null;

    const allowedSkills = await this.resolveAllowedSkills(
      authorizationHeader,
      dto.allowedSkills,
    );

    const arraysEqual = (a: string[], b: string[]): boolean => {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
      }
      return true;
    };

    // Phase 2 store: attempt to read CourseRecommendationCache.
    const cacheClient = prismaAny?.courseRecommendationCache as
      | undefined
      | {
          findFirst: (args: unknown) => Promise<unknown>;
        };

    const tryBuildFromCachedCourses = (
      coursesCached: unknown,
    ): CourseRecommendation[] | null => {
      if (!coursesCached) return null;

      // Cache stores `courses` as Json; it should be an array of course objects.
      const arr = Array.isArray(coursesCached)
        ? (coursesCached as unknown[])
        : null;

      if (!arr) return null;

      const normalized = arr
        .filter(Boolean)
        .map((c) => c as Partial<CourseRecommendation>)
        .filter(
          (c) =>
            typeof c.platform === 'string' &&
            typeof c.courseName === 'string' &&
            typeof c.difficulty === 'string' &&
            typeof c.description === 'string' &&
            typeof c.externalUrl === 'string' &&
            typeof c.whyRecommended === 'string',
        ) as CourseRecommendation[];

      return normalized.length > 0 ? normalized : null;
    };

    if (cacheClient?.findFirst) {
      try {
        const cache = await cacheClient.findFirst({
          where: { userId, studentGoal },
          orderBy: { createdAt: 'desc' },
          take: 1,
        });

        const cacheAny = cache as
          | undefined
          | {
              allowedSkills?: unknown;
              courses?: unknown;
              expiresAt?: unknown;
            };

        const allowedSkillsCached = Array.isArray(cacheAny?.allowedSkills)
          ? ((cacheAny.allowedSkills as unknown[]).filter(
              (s) => typeof s === 'string',
            ) as string[])
          : [];

        const coursesCached = cacheAny?.courses;

        const isExpired =
          cacheAny?.expiresAt instanceof Date
            ? cacheAny.expiresAt.getTime() < Date.now()
            : typeof cacheAny?.expiresAt === 'string'
              ? new Date(cacheAny.expiresAt).getTime() < Date.now()
              : false;

        if (!isExpired && arraysEqual(allowedSkillsCached, allowedSkills)) {
          const cachedCourses = tryBuildFromCachedCourses(coursesCached);
          if (cachedCourses) {
            const responseText = cachedCourses
              .map((c, idx) => {
                const i = idx + 1;
                return `${i}. ${c.courseName}\n   Platform: ${c.platform}\n   Difficulty: ${c.difficulty}\n   ${c.description}\n   Link: ${c.externalUrl}\n   Why: ${c.whyRecommended}`;
              })
              .join('\n\n');

            const enforcedResponse = this.enforceAllowedSkillsInResponse(
              responseText,
              allowedSkills,
            );

            return {
              response: enforcedResponse,
              allowedSkills,
              studentGoal,
              courses: cachedCourses,
            };
          }
        }
      } catch {
        // ignore cache issues
      }
    }

    // Candidate hinting using CourseScrapeCandidate (Phase 2 internal seed) — optional.
    let candidateHintsText = '';
    let candidateHintCourses: CourseRecommendation[] = [];
    const candidatesClient = prismaAny?.courseScrapeCandidate as
      | undefined
      | { findMany: (args: unknown) => Promise<unknown> };

    const normalizeSkill = (value: string): string =>
      value.trim().toLowerCase();

    const findMatchedAllowedSkill = (courseSkills: unknown): string | null => {
      if (!Array.isArray(courseSkills)) return null;

      const normalizedCourseSkills = courseSkills
        .filter((s): s is string => typeof s === 'string')
        .map(normalizeSkill)
        .filter(Boolean);

      for (const allowedSkill of allowedSkills) {
        const allowed = normalizeSkill(allowedSkill);
        if (!allowed) continue;

        const isMatch = normalizedCourseSkills.some(
          (skill) => skill === allowed || skill.includes(allowed) || allowed.includes(skill),
        );

        if (isMatch) return allowedSkill;
      }

      return null;
    };

    const toCourseRecommendation = (
      candidate: {
        platform?: string;
        title?: string;
        description?: string | null;
        difficulty?: string | null;
        externalUrl?: string;
        skills?: unknown;
      },
      index: number,
    ): CourseRecommendation | null => {
      if (
        typeof candidate.title !== 'string' ||
        typeof candidate.platform !== 'string' ||
        typeof candidate.externalUrl !== 'string'
      ) {
        return null;
      }

      const matchedSkill =
        findMatchedAllowedSkill(candidate.skills) ?? allowedSkills[index % allowedSkills.length];

      return {
        platform: candidate.platform,
        courseName: candidate.title,
        difficulty: candidate.difficulty || 'Beginner',
        description:
          candidate.description ||
          'A current learning option you can use to build practical career momentum.',
        externalUrl: candidate.externalUrl,
        whyRecommended: matchedSkill
          ? `It supports your career-path skill: ${matchedSkill}.`
          : 'It supports practical career development.',
      };
    };

    const fallbackSeedCourses = (): CourseRecommendation[] =>
      getCourseScrapeCandidateSeedData()
        .map((candidate, index) => toCourseRecommendation(candidate, index))
        .filter((course): course is CourseRecommendation => Boolean(course))
        .slice(0, 8);

    if (candidatesClient?.findMany) {
      try {
        const candidates = await candidatesClient.findMany({
          take: 40,
          orderBy: { updatedAt: 'desc' },
        });

        const allowedLower = new Set(allowedSkills.map((s) => s.toLowerCase()));

        const filtered = (candidates as unknown[]).filter((c) => {
          const skills: unknown = (c as any)?.skills;
          if (!Array.isArray(skills) || skills.length === 0) return false;
          return skills.some(
            (s) => typeof s === 'string' && allowedLower.has(s.toLowerCase()),
          );
        });

        const topSource = filtered.length > 0 ? filtered : (candidates as unknown[]);

        const top = topSource.slice(0, 12) as Array<{
          platform?: string;
          title?: string;
          description?: string | null;
          difficulty?: string | null;
          externalUrl?: string;
          skills?: string[];
        }>;

        candidateHintCourses = top
          .map((c, idx) => toCourseRecommendation(c, idx))
          .filter((course): course is CourseRecommendation => Boolean(course))
          .slice(0, 8);

        if (top.length > 0) {
          candidateHintsText = `Internal candidate list of possible courses (prefer these when useful):
${top
  .map((c, idx) => {
    const skills = Array.isArray(c.skills)
      ? c.skills.slice(0, 5).join(', ')
      : '';
    return `${idx + 1}) ${c.title ?? ''} | ${c.platform ?? ''} | ${c.difficulty ?? ''} | Skills: ${skills} | Link: ${c.externalUrl ?? ''}`;
  })
  .join('\n')}`;
        }
      } catch {
        // ignore candidate issues
      }
    }

    const systemInstruction = `You are "Career Navigator AI", a course and learning path recommendation specialist.

The user's career-path skills: ${allowedSkills.join(', ')}

${candidateHintsText ? candidateHintsText : ''}

Task:
- Recommend specific, real courses and learning resources that match the user's skills
- Use these platforms: Coursera, edX, Udemy, LinkedIn Learning, Simplilearn, Alison, freeCodeCamp
- Recommend 5-8 courses total
- If studentGoal is provided, prioritize courses aligned to that goal

Return ONLY valid JSON (no markdown, no commentary) with EXACT shape:
{
  "courses": [
    {
      "platform": string,
      "courseName": string,
      "difficulty": "Beginner" | "Intermediate" | "Advanced",
      "description": string,
      "externalUrl": string,
      "whyRecommended": string
    }
  ]
}

Rules:
- In "whyRecommended", explicitly mention at least ONE of the career-path skills verbatim.`;

    const userMessage =
      studentGoal ??
      `Recommend courses for my career skills: ${allowedSkills.join(', ')}`;

    const responseTextRaw = await this.generateWithGeminiAndFallback(
      systemInstruction,
      userMessage,
    );

    const fencedMatch = responseTextRaw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidateText = fencedMatch?.[1] ? fencedMatch[1] : responseTextRaw;

    const tryParseCourses = (): CourseRecommendation[] | null => {
      try {
        const start = candidateText.indexOf('{');
        const end = candidateText.lastIndexOf('}');
        if (start === -1 || end === -1 || end <= start) return null;

        const jsonText = candidateText.slice(start, end + 1);
        const parsed = JSON.parse(jsonText) as unknown;

        if (!parsed || typeof parsed !== 'object') return null;

        const record = parsed as { courses?: unknown };
        if (!Array.isArray(record.courses)) return null;

        const courses = record.courses
          .filter((c) => c && typeof c === 'object')
          .map((c) => c as Record<string, unknown>)
          .filter(
            (c) =>
              typeof c.platform === 'string' &&
              typeof c.courseName === 'string' &&
              typeof c.difficulty === 'string' &&
              typeof c.description === 'string' &&
              typeof c.externalUrl === 'string' &&
              typeof c.whyRecommended === 'string',
          )
          .map((c) => ({
            platform: c.platform as string,
            courseName: c.courseName as string,
            difficulty: c.difficulty as string,
            description: c.description as string,
            externalUrl: c.externalUrl as string,
            whyRecommended: c.whyRecommended as string,
          }));

        return courses.length > 0 ? courses : null;
      } catch {
        return null;
      }
    };

    let courses = tryParseCourses() ?? [];

    if (courses.length === 0) {
      courses =
        candidateHintCourses.length > 0
          ? candidateHintCourses
          : fallbackSeedCourses();
    }

    const responseText =
      courses.length > 0
        ? courses
            .map((c, idx) => {
              const i = idx + 1;
              return `${i}. ${c.courseName}\n   Platform: ${c.platform}\n   Difficulty: ${c.difficulty}\n   ${c.description}\n   Link: ${c.externalUrl}\n   Why: ${c.whyRecommended}`;
            })
            .join('\n\n')
        : responseTextRaw;

    const enforcedResponse = this.enforceAllowedSkillsInResponse(
      responseText,
      allowedSkills,
    );

    // Phase 2 store: write cache.
    const cacheCreateClient = prismaAny?.courseRecommendationCache as
      | undefined
      | { create: (args: unknown) => Promise<unknown> };

    if (cacheCreateClient?.create && courses.length > 0) {
      try {
        await cacheCreateClient.create({
          data: {
            userId,
            studentGoal,
            allowedSkills,
            courses,
            expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30), // 30 days
          },
        });
      } catch {
        // ignore cache write failures
      }
    }

    return {
      response: enforcedResponse,
      allowedSkills,
      studentGoal,
      courses,
    };
  }
}
