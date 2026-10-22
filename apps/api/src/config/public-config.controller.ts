import { Controller, Get, Header } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/jwt-auth.guard';
import { env } from './env';

export type PublicConfig = {
  videoEnabled: boolean;
  aiByokEnabled: boolean;
  cvAiAssistEnabled: boolean;
};

/** Browser-safe runtime settings, so one web image works in every environment. */
@ApiTags('config')
@Controller('config')
export class PublicConfigController {
  @Get('public')
  @Public()
  @Header('Cache-Control', 'public, max-age=300')
  @ApiOkResponse({ description: 'Public runtime settings for the web app.' })
  getPublic(): PublicConfig {
    return {
      videoEnabled: env.video.enabled,
      aiByokEnabled: env.ai.byokEnabled,
      cvAiAssistEnabled: env.cvScan.aiAssistEnabled,
    };
  }
}
