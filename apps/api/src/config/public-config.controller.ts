import { Controller, Get, Header } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/jwt-auth.guard';
import { env } from './env';

export type PublicConfig = {
  agoraAppId: string | null;
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
      agoraAppId: env.agora.appId ?? null,
      aiByokEnabled: env.ai.byokEnabled,
      cvAiAssistEnabled: env.cvScan.aiAssistEnabled,
    };
  }
}
