import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../auth/jwt-auth.guard';
import {
  ApiOkResponse,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ConversationsService } from './conversations.service';
import { SendMessageDto } from './dto/send-message.dto';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { parsePagination } from '../lib/pagination';

@ApiTags('conversations')
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Post()
  @ApiOkResponse({
    description: 'Create a new conversation with another user.',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  async createConversation(
    @Body() dto: CreateConversationDto,
    @CurrentUser('sub') userId: string,
  ): Promise<unknown> {
    return this.conversationsService.createConversation(userId, dto);
  }

  @Get()
  @ApiOkResponse({ description: 'List conversations for the current user.' })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid bearer token.',
  })
  async listConversations(
    @CurrentUser('sub') userId: string,
  ): Promise<unknown> {
    return this.conversationsService.listConversations(userId);
  }

  @Get(':conversationId/messages')
  @ApiOkResponse({
    description:
      'Message history, oldest first. Returns the latest `limit` messages (default 50) before `before`; pass `nextBefore` to load older ones.',
  })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({
    name: 'before',
    required: false,
    description: 'ISO timestamp cursor',
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid bearer token.',
  })
  async getMessages(
    @Param('conversationId') conversationId: string,
    @CurrentUser('sub') userId: string,
    @Query('limit') limitRaw?: string,
    @Query('before') beforeRaw?: string,
  ): Promise<unknown> {
    const { limit } = parsePagination(undefined, limitRaw ?? '50');
    const before = beforeRaw ? new Date(beforeRaw) : undefined;
    if (before && Number.isNaN(before.getTime())) {
      throw new BadRequestException('before must be an ISO timestamp');
    }
    return this.conversationsService.getMessageHistory(userId, conversationId, {
      limit,
      before,
    });
  }

  @Post(':conversationId/messages')
  @ApiOkResponse({ description: 'Send a message in a conversation.' })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid bearer token.',
  })
  async sendMessage(
    @Param('conversationId') conversationId: string,
    @Body() dto: SendMessageDto,
    @CurrentUser('sub') userId: string,
  ): Promise<unknown> {
    return this.conversationsService.sendMessage(userId, conversationId, dto);
  }
}
