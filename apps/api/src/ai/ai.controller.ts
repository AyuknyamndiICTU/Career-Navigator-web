import { Body, Controller, HttpCode, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../auth/jwt-auth.guard';
import {
  ApiOkResponse,
  ApiProduces,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ChatStreamEvent } from './career-skills.service';
import { ChatService } from './chat.service';
import { InterviewService } from './interview.service';
import { CourseRecsService } from './course-recs.service';
import { sendSse } from './sse';
import { ChatRequestDto } from './dto/chat-request.dto';
import { MockInterviewRequestDto } from './dto/mock-interview-request.dto';
import { CourseRecommendationsRequestDto } from './dto/course-recommendations-request.dto';

/** Client-facing shape of the final stream event. */
function streamEvent(event: ChatStreamEvent) {
  if (event.type !== 'done') return event;
  const { text, ...meta } = event.result;
  return { type: 'done', response: text, ai: meta };
}

@ApiTags('ai')
@ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
@ApiTooManyRequestsResponse({
  description: "Today's free AI allowance for this feature is used up.",
})
@Controller('ai')
export class AiController {
  constructor(
    private readonly chatService: ChatService,
    private readonly interviews: InterviewService,
    private readonly courses: CourseRecsService,
  ) {}

  @Post('chat')
  @ApiOkResponse({ description: 'Career-path-only AI chat response.' })
  chat(@Body() dto: ChatRequestDto, @CurrentUser('sub') userId: string) {
    return this.chatService.chat(userId, dto);
  }

  @Post('chat/stream')
  @HttpCode(200)
  @ApiProduces('text/event-stream')
  @ApiOkResponse({
    description:
      'Server-Sent Events: context, start, delta (text), usage (running output-token estimate), done (full answer + exact usage and cost), error.',
  })
  chatStream(
    @Body() dto: ChatRequestDto,
    @CurrentUser('sub') userId: string,
    @Res() res: Response,
  ): Promise<void> {
    return sendSse(
      res,
      (signal) => this.chatService.chatStream(userId, dto, signal),
      (e) => streamEvent(e as ChatStreamEvent),
    );
  }

  @Post('mock-interview')
  @ApiOkResponse({ description: 'Career-path-only mock interview response.' })
  mockInterview(
    @Body() dto: MockInterviewRequestDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.interviews.mockInterview(userId, dto);
  }

  @Post('mock-interview/stream')
  @HttpCode(200)
  @ApiProduces('text/event-stream')
  @ApiOkResponse({
    description:
      'Mock interview as Server-Sent Events (same events as chat/stream).',
  })
  mockInterviewStream(
    @Body() dto: MockInterviewRequestDto,
    @CurrentUser('sub') userId: string,
    @Res() res: Response,
  ): Promise<void> {
    return sendSse(
      res,
      (signal) => this.interviews.mockInterviewStream(userId, dto, signal),
      (e) => streamEvent(e as ChatStreamEvent),
    );
  }

  @Post('course-recommendations')
  @ApiOkResponse({
    description: 'Career-path-only course recommendations response.',
  })
  courseRecommendations(
    @Body() dto: CourseRecommendationsRequestDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.courses.recommendCourses(userId, dto);
  }
}
