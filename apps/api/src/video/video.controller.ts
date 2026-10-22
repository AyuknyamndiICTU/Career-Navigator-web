import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiProperty,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import type { Request } from 'express';
import { CurrentUser, Public } from '../auth/jwt-auth.guard';
import { env } from '../config/env';
import { Roles } from '../rbac/roles.decorator';
import { RolesGuard } from '../rbac/roles.guard';
import { verifyLivekitWebhook, WebhookSignatureError } from './livekit';
import { VideoService } from './video.service';

class StartVideoSessionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  conversationId!: string;
}

const MAX_WEBHOOK_BYTES = 64 * 1024;

/** LiveKit posts `application/webhook+json`, which the JSON parser skips, so the raw body is still unread. */
async function readRawBody(req: Request): Promise<Buffer> {
  if (
    req.readableEnded ||
    (req.body !== undefined && Object.keys(req.body as object).length > 0)
  ) {
    throw new BadRequestException('Unexpected body encoding');
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > MAX_WEBHOOK_BYTES)
      throw new BadRequestException('Body too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

@ApiTags('video')
@Controller('video')
export class VideoController {
  constructor(private readonly video: VideoService) {}

  @Post('sessions')
  @HttpCode(200)
  @ApiOkResponse({
    description:
      'Join (or start) the video call of a conversation: LiveKit URL, room and a 2 h token.',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  join(@CurrentUser('sub') userId: string, @Body() dto: StartVideoSessionDto) {
    return this.video.join(userId, dto.conversationId);
  }

  @Get('sessions/active')
  @ApiOkResponse({ description: 'The open call of a conversation, if any.' })
  active(
    @CurrentUser('sub') userId: string,
    @Query() query: StartVideoSessionDto,
  ) {
    return this.video.activeSession(userId, query.conversationId);
  }

  @Get('usage')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOkResponse({
    description:
      'Participant-minutes this month vs. the free allowance (admin).',
  })
  usage() {
    return this.video.monthlyUsage();
  }

  @Post('webhook')
  @Public()
  @HttpCode(200)
  @ApiOkResponse({
    description: 'LiveKit webhook (signed with the API secret).',
  })
  async webhook(@Req() req: Request) {
    const { apiKey, apiSecret } = env.video;
    if (!apiKey || !apiSecret) throw new UnauthorizedException();
    const rawBody = await readRawBody(req);
    let event: Record<string, unknown>;
    try {
      event = verifyLivekitWebhook({
        rawBody,
        authorization: req.headers.authorization,
        apiKey,
        apiSecret,
      });
    } catch (err) {
      if (err instanceof WebhookSignatureError)
        throw new UnauthorizedException('Invalid webhook signature');
      throw err;
    }
    await this.video.handleWebhook(event);
    return { ok: true };
  }
}
