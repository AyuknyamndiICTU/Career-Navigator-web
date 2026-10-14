import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/jwt-auth.guard';
import {
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ConversationsService } from './conversations.service';
import { SendMessageDto } from './dto/send-message.dto';
import { CreateConversationDto } from './dto/create-conversation.dto';

@ApiTags('conversations')
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Post()
  @ApiOkResponse({ description: 'Create a new conversation with another user.' })
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
  @ApiOkResponse({ description: 'Fetch message history for a conversation.' })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid bearer token.',
  })
  async getMessages(
    @Param('conversationId') conversationId: string,
    @CurrentUser('sub') userId: string,
  ): Promise<unknown> {
    return this.conversationsService.getMessageHistory(
      userId,
      conversationId,
    );
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
    return this.conversationsService.sendMessage(
      userId,
      conversationId,
      dto,
    );
  }
}
