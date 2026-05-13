import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import {
  ApiBody,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { BuildResumeDto } from './dto/build-resume.dto';
import { ResumeService } from './resume.service';

@ApiTags('resume')
@Controller('resume')
export class ResumeController {
  constructor(private readonly resumeService: ResumeService) {}

  @Post('build')
  @HttpCode(200)
  @ApiOkResponse({
    description: 'Build a structured resume from profile data.',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  @ApiBody({
    description: 'Resume build request',
    schema: {
      type: 'object',
      properties: {
        template: { type: 'string' },
      },
    },
  })
  build(
    @Body() dto: BuildResumeDto,
    @Headers('authorization') authorization?: string,
  ): Promise<unknown> {
    return this.resumeService.buildResume(authorization, dto);
  }
}
