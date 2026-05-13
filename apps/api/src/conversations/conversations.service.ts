import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { verifyAccessToken } from '../auth/jwt/jwt-utils';
import { PrismaService } from '../prisma/prisma.service';
import { MessagingGateway } from '../realtime/messaging.gateway';
import { SendMessageDto } from './dto/send-message.dto';

type AuthUser = { sub: string };

function extractBearerToken(authorizationHeader: string | undefined): string {
  if (!authorizationHeader) return '';
  return authorizationHeader.replace(/^Bearer\s+/i, '').trim();
}

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly messagingGateway: MessagingGateway,
  ) {}

  private getAuthUser(authorizationHeader: string | undefined): AuthUser {
    const accessSecret = process.env.JWT_ACCESS_SECRET;
    if (!accessSecret) {
      throw new UnauthorizedException('JWT secrets are not configured');
    }

    const token = extractBearerToken(authorizationHeader);
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const payload = verifyAccessToken({ secret: accessSecret, token });

    if (!payload?.sub) {
      throw new UnauthorizedException('Invalid token');
    }

    return { sub: payload.sub };
  }

  private async assertParticipant(
    userId: string,
    conversationId: string,
  ): Promise<void> {
    const participant = await this.prisma.conversationParticipant.findFirst({
      where: { conversationId, userId },
      select: { id: true },
    });

    if (!participant) {
      throw new BadRequestException('Conversation not found');
    }
  }

  async listConversations(authorizationHeader: string | undefined): Promise<{
    items: Array<{
      id: string;
      createdAt: Date;
      updatedAt: Date;
    }>;
  }> {
    const { sub: userId } = this.getAuthUser(authorizationHeader);

    const items = await this.prisma.conversation.findMany({
      where: { participants: { some: { userId } } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true, updatedAt: true },
    });

    return { items };
  }

  async getMessageHistory(
    authorizationHeader: string | undefined,
    conversationId: string,
  ): Promise<{
    items: Array<{
      id: string;
      senderId: string;
      content: string;
      createdAt: Date;
      updatedAt: Date;
    }>;
  }> {
    const { sub: userId } = this.getAuthUser(authorizationHeader);

    await this.assertParticipant(userId, conversationId);

    const items = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        senderId: true,
        content: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return { items };
  }

  async sendMessage(
    authorizationHeader: string | undefined,
    conversationId: string,
    dto: SendMessageDto,
  ): Promise<{
    id: string;
    senderId: string;
    content: string;
    createdAt: Date;
  }> {
    const { sub: userId } = this.getAuthUser(authorizationHeader);

    await this.assertParticipant(userId, conversationId);

    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId: userId,
        content: dto.content,
      },
      select: {
        id: true,
        senderId: true,
        content: true,
        createdAt: true,
      },
    });

    await this.messagingGateway.emitNewMessage(conversationId, message);

    return message;
  }
}
