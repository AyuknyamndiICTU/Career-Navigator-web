import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiGatewayService } from './gateway/ai-gateway.service';
import {
  aiMeta,
  buildTurns,
  CareerSkillsService,
  ChatStreamEvent,
  withContext,
} from './career-skills.service';
import { ChatRequestDto } from './dto/chat-request.dto';

// Static prompt prefix keeps providers' prompt caches warm; per-user details go last.
const CHAT_SYSTEM = `You are "Career Navigator AI", a warm, practical career coach.
Style: helpful mentor, plain language, concise and specific. No JSON, code fences or markdown tables. Short bullets only when they help. Never say "as an AI".
Scope: career paths, job search and matching, skills and courses, resumes/CVs, interviews and mock interviews, mentoring, networking, professional development. Politely steer unrelated questions back to careers.
Greet briefly when greeted and ask which career goal to work on. When relevant, mention at least one of the user's career-path skills.`;

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: AiGatewayService,
    private readonly skills: CareerSkillsService,
  ) {}

  private async request(userId: string, dto: ChatRequestDto) {
    const allowedSkills = await this.skills.resolve(userId, dto.allowedSkills);
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

  private async persist(
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

  async chat(userId: string, dto: ChatRequestDto) {
    const { allowedSkills, request } = await this.request(userId, dto);
    const result = await this.gateway.generate(request);
    const response = this.skills.enforce(result.text, allowedSkills);

    // Persist only on success so failed prompts don't inflate analytics.
    await this.persist(userId, dto.message, response);
    return { response, allowedSkills, ai: aiMeta(result) };
  }

  async *chatStream(
    userId: string,
    dto: ChatRequestDto,
    signal: AbortSignal,
  ): AsyncGenerator<ChatStreamEvent> {
    const { allowedSkills, request } = await this.request(userId, dto);
    yield* withContext(
      allowedSkills,
      this.gateway.stream({ ...request, signal }),
      async (event) => {
        if (event.type === 'done')
          await this.persist(userId, dto.message, event.result.text);
      },
    );
  }
}
