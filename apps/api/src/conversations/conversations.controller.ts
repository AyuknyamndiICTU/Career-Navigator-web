import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ConversationsService } from './conversations.service';
import { SendMessageDto } from './dto/send-message.dto';

@ApiTags('conversations')
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get()
  @ApiOkResponse({ description: 'List conversations for the current user.' })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid bearer token.',
  })
  async listConversations(
    @Headers('authorization') authorization?: string,
  ): Promise<unknown> {
    return this.conversationsService.listConversations(authorization);
  }

  @Get(':conversationId/messages')
  @ApiOkResponse({ description: 'Fetch message history for a conversation.' })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid bearer token.',
  })
  async getMessages(
    @Param('conversationId') conversationId: string,
    @Headers('authorization') authorization?: string,
  ): Promise<unknown> {
    return this.conversationsService.getMessageHistory(
      authorization,
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
    @Headers('authorization') authorization?: string,
  ): Promise<unknown> {
    return this.conversationsService.sendMessage(
      authorization,
      conversationId,
      dto,
    );
  }
}
