import { Injectable } from '@nestjs/common';
import { CvScanStatus, MediaType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AiResult, AiStreamEvent } from './gateway/ai-gateway.service';
import type { ChatTurn } from './gateway/types';
import type { ChatHistoryItemDto } from './dto/chat-request.dto';

export type AiMeta = Pick<
  AiResult,
  'provider' | 'model' | 'viaOwnKey' | 'cached' | 'latencyMs' | 'usage'
>;

/** Stream events plus the skills the answer was scoped to (sent with the final event). */
export type ChatStreamEvent =
  | AiStreamEvent
  | { type: 'context'; allowedSkills: string[] };

const KEEP_TURNS = 6;

const DEFAULT_SKILLS = [
  'General Career Guidance',
  'Resume Building',
  'Interview Preparation',
  'Job Search Strategies',
  'Professional Development',
];

export function aiMeta(result: AiResult): AiMeta {
  const { provider, model, viaOwnKey, cached, latencyMs, usage } = result;
  return { provider, model, viaOwnKey, cached, latencyMs, usage };
}

/**
 * Last 6 turns verbatim; older user turns are condensed into one line appended to the new
 * message, so long chats don't resend the whole history on every request.
 */
export function buildTurns(
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

/**
 * Waits for the gateway's first event (planning, quota and the first token) before emitting
 * anything, so allowance and availability errors become normal JSON errors instead of a stream.
 */
export async function* withContext(
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

/** The user's career-path skills, which scope every AI answer. */
@Injectable()
export class CareerSkillsService {
  constructor(private readonly prisma: PrismaService) {}

  private async derive(userId: string): Promise<string[]> {
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

  /** Requested skills narrowed to the user's own; their full list when none match. */
  async resolve(
    userId: string,
    requestedSkills: string[] | undefined,
  ): Promise<string[]> {
    const careerSkills = await this.derive(userId);
    if (!requestedSkills?.length) return careerSkills;

    const careerLower = new Set(careerSkills.map((s) => s.toLowerCase()));
    const allowed = requestedSkills
      .map((s) => s.trim())
      .filter((s) => s && careerLower.has(s.toLowerCase()));
    return allowed.length > 0 ? allowed : careerSkills;
  }

  /** Off-topic answers are replaced by a nudge back to the user's skills. */
  enforce(responseText: string, allowedSkills: string[]): string {
    if (allowedSkills.length === 0) return responseText;
    const lower = responseText.toLowerCase();
    if (allowedSkills.some((skill) => lower.includes(skill.toLowerCase())))
      return responseText;

    return `I can help with that through the lens of your career-path skills: ${allowedSkills.join(
      ', ',
    )}. Tell me the role, goal, or deadline you are working toward, and I will make the next steps practical.`;
  }
}
