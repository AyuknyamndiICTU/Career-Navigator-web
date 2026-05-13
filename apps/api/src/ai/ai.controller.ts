import { Body, Controller, Headers, Post } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AiService } from './ai.service';
import { ChatRequestDto } from './dto/chat-request.dto';
import { MockInterviewRequestDto } from './dto/mock-interview-request.dto';
import { CourseRecommendationsRequestDto } from './dto/course-recommendations-request.dto';

@ApiTags('ai')
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat')
  @ApiOkResponse({ description: 'Career-path-only AI chat response.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  async chat(
    @Body() dto: ChatRequestDto,
    @Headers('authorization') authorization?: string,
  ): Promise<unknown> {
    return this.aiService.chat(authorization, dto);
  }

  @Post('mock-interview')
  @ApiOkResponse({ description: 'Career-path-only mock interview response.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  async mockInterview(
    @Body() dto: MockInterviewRequestDto,
    @Headers('authorization') authorization?: string,
  ): Promise<unknown> {
    return this.aiService.mockInterview(authorization, dto);
  }

  @Post('course-recommendations')
  @ApiOkResponse({
    description: 'Career-path-only course recommendations response.',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  async courseRecommendations(
    @Body() dto: CourseRecommendationsRequestDto,
    @Headers('authorization') authorization?: string,
  ): Promise<unknown> {
    return this.aiService.recommendCourses(authorization, dto);
  }
}
