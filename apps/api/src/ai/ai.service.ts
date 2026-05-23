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

type AuthUser = { sub: string };

function extractBearerToken(authorizationHeader: string | undefined): string {
  if (!authorizationHeader) return '';
  return authorizationHeader.replace(/^Bearer\s+/i, '').trim();
}

@Injectable()
export class AiService {
  constructor(private readonly prisma: PrismaService) {}

  private getAuthUser(authorizationHeader: string | undefined): AuthUser {
    const accessSecret = process.env.JWT_ACCESS_SECRET;
    if (!accessSecret) {
      throw new UnauthorizedException('JWT secrets are not configured');
    }

    const token = extractBearerToken(authorizationHeader);
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const payload = verifyAccessToken({ secret: accessSecret, token });

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
          const parsed = JSON.parse(cvExtractedText) as {
            skills?: unknown;
          };

          const skills = Array.isArray(parsed?.skills) ? parsed.skills : [];
          const cleaned = skills
            .map((s) => (typeof s === 'string' ? s.trim() : ''))
            .filter(Boolean);

          const unique = Array.from(new Set(cleaned));
          if (unique.length > 0) return unique;
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
    const uniqueSkills = Array.from(new Set(all.map((s) => s.trim()))).filter(Boolean);

    if (uniqueSkills.length === 0) {
      return ['General Career Guidance', 'Resume Building', 'Interview Preparation', 'Job Search Strategies', 'Professional Development'];
    }

    return uniqueSkills;
  }

  // ─── Google Gemini API ─────────────────────────────────────────────

  private async generateWithGemini(
    systemInstruction: string,
    userMessage: string,
  ): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new BadRequestException('GEMINI_API_KEY is not configured');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

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

    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = (await res.json()) as {
          candidates?: Array<{
            content?: { parts?: Array<{ text?: string }> };
          }>;
        };

        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        return text;
      }

      // Retry on rate-limit (429) or service unavailable (503)
      if ((res.status === 429 || res.status === 503) && attempt < maxRetries) {
        const waitMs = Math.min(1000 * Math.pow(2, attempt), 8000);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        continue;
      }

      // Final failure — provide a user-friendly message
      if (res.status === 429) {
        throw new BadRequestException(
          'The AI service is currently at capacity. Please wait a moment and try again.',
        );
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

  // ─── Chat ──────────────────────────────────────────────────────────

  async chat(authorizationHeader: string | undefined, dto: ChatRequestDto) {
    this.assertValidInput(dto);

    const { sub: userId } = this.getAuthUser(authorizationHeader);
    const careerSkills = await this.deriveCareerAllowedSkills(userId);

    const systemInstruction = `You are "Career Navigator AI", a friendly, professional career guidance assistant.

Your personality:
- Warm, encouraging, and supportive
- When the user greets you (e.g. "hi", "hello", "hey"), greet them back warmly and introduce yourself briefly. For example: "Hello! 👋 I'm your Career Navigator AI assistant. I'm here to help you with career guidance, job search strategies, skill development, resume tips, and more. How can I help you today?"
- Always be concise and practical

Your expertise areas:
- Career path guidance and planning
- Job search strategies and job matching
- Skills development and learning recommendations
- Resume and CV building tips
- Interview preparation and mock interviews
- Mentor matching and networking advice
- Course and certification recommendations
- Professional development

The user's current career-path skills: ${careerSkills.join(', ')}

Rules:
1. Always respond helpfully to career-related questions
2. If a user asks something completely unrelated to careers/professional development (e.g. cooking recipes, sports scores), politely redirect them to career topics
3. Keep responses clear, well-structured, and actionable
4. Use bullet points and formatting for readability
5. Be encouraging and motivational`;

    const responseText = await this.generateWithGemini(
      systemInstruction,
      dto.message,
    );

    return { response: responseText, allowedSkills: careerSkills };
  }

  // ─── Allowed Skills Resolver ───────────────────────────────────────

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

      const responseText = await this.generateWithGemini(
        systemInstruction,
        `I want to practice for a ${dto.role} interview. Please start the mock interview.`,
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
    const allowedSkills = await this.resolveAllowedSkills(
      authorizationHeader,
      dto.allowedSkills,
    );

    const systemInstruction = `You are "Career Navigator AI", a course and learning path recommendation specialist.

The user's career-path skills: ${allowedSkills.join(', ')}

Task:
- Recommend specific, real courses and learning resources that match the user's skills
- Use these platforms: Coursera, edX, Udemy, LinkedIn Learning, Simplilearn, Alison, freeCodeCamp
- For each recommendation provide:
  • Course name
  • Platform
  • Brief description (1-2 sentences)
  • Difficulty level (Beginner/Intermediate/Advanced)
- Recommend 5-8 courses total
- If studentGoal is provided, prioritize courses aligned to that goal
- Format the output as a clean, readable list
- Focus on high-quality, popular, well-reviewed courses`;

    const responseText = await this.generateWithGemini(
      systemInstruction,
      dto.studentGoal ?? `Recommend courses for my career skills: ${allowedSkills.join(', ')}`,
    );

    return {
      response: responseText,
      allowedSkills,
      studentGoal: dto.studentGoal ?? null,
    };
  }
}
