import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AgoraService } from './agora.service';

type StartAgoraSessionDto = {
  channelName: string;
  uid?: number;
  role?: 'publisher' | 'subscriber';
  tokenExpireSeconds?: number;
  privilegeExpireSeconds?: number;
};

@ApiTags('agora')
@Controller('agora')
export class AgoraController {
  constructor(private readonly agoraService: AgoraService) {}

  @Post('sessions')
  @ApiOkResponse({
    description: 'Start/join video session (mint Agora RTC token).',
  })
  async startSession(@Body() dto: StartAgoraSessionDto) {
    if (!dto?.channelName || typeof dto.channelName !== 'string') {
      return { error: 'channelName is required' };
    }

    return this.agoraService.startSession({
      channelName: dto.channelName,
      uid: dto.uid,
      role: dto.role ?? 'publisher',
      tokenExpireSeconds: dto.tokenExpireSeconds,
      privilegeExpireSeconds: dto.privilegeExpireSeconds,
    });
  }

  @Post('sessions/:sessionId/end')
  @ApiOkResponse({ description: 'End video session.' })
  async endSession(@Param('sessionId') sessionId: string) {
    return this.agoraService.endSession(sessionId);
  }
}
