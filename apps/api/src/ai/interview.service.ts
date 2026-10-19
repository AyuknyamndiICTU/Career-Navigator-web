import { Injectable } from '@nestjs/common';
import { AiGatewayService } from './gateway/ai-gateway.service';
import {
  aiMeta,
  buildTurns,
  CareerSkillsService,
  ChatStreamEvent,
  withContext,
} from './career-skills.service';
import { MockInterviewRequestDto } from './dto/mock-interview-request.dto';

const MOCK_INTERVIEW_SYSTEM = `You are "Career Navigator AI", a professional mock interview coach.
Run a realistic interview: one question at a time (2-3 in total), each with what a strong answer should cover. After each candidate answer give honest, constructive, encouraging feedback, then the next question. Keep it practical and aligned to the candidate's skills.`;

@Injectable()
export class InterviewService {
  constructor(
    private readonly gateway: AiGatewayService,
    private readonly skills: CareerSkillsService,
  ) {}

  private async request(userId: string, dto: MockInterviewRequestDto) {
    const allowedSkills = await this.skills.resolve(userId, dto.allowedSkills);
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
    const { allowedSkills, difficulty, request } = await this.request(
      userId,
      dto,
    );
    const result = await this.gateway.generate(request);
    return {
      response: this.skills.enforce(result.text, allowedSkills),
      allowedSkills,
      role: dto.role,
      difficulty,
      ai: aiMeta(result),
    };
  }

  async *mockInterviewStream(
    userId: string,
    dto: MockInterviewRequestDto,
    signal: AbortSignal,
  ): AsyncGenerator<ChatStreamEvent> {
    const { allowedSkills, request } = await this.request(userId, dto);
    yield* withContext(
      allowedSkills,
      this.gateway.stream({ ...request, signal }),
    );
  }
}
