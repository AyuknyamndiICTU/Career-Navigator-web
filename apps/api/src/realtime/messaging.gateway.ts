import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger, Injectable } from '@nestjs/common';
import type { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { verifyAccessToken } from '../auth/jwt/jwt-utils';

type AuthPayload = { sub: string };

function extractToken(socket: Socket): string | undefined {
  const authToken =
    socket.handshake.auth && typeof socket.handshake.auth === 'object'
      ? (socket.handshake.auth as Record<string, unknown>).token
      : undefined;

  if (typeof authToken === 'string' && authToken.trim()) return authToken;

  const queryToken = socket.handshake.query?.token;
  if (typeof queryToken === 'string' && queryToken.trim()) return queryToken;

  return undefined;
}

@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: process.env.CORS_ALLOWED_ORIGINS ?? '*',
    credentials: true,
  },
})
@Injectable()
export class MessagingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private server!: Server;

  private readonly logger = new Logger(MessagingGateway.name);

  // Track online users across multiple sockets
  private readonly userSockets = new Map<string, Set<string>>();

  constructor(private readonly prisma: PrismaService) {}

  async handleConnection(client: Socket): Promise<void> {
    const tokenSecret = process.env.JWT_ACCESS_SECRET;
    if (!tokenSecret) {
      this.logger.warn('JWT_ACCESS_SECRET missing; disconnecting socket.');
      client.disconnect(true);
      return;
    }

    const token = extractToken(client);
    if (!token) {
      client.disconnect(true);
      return;
    }

    try {
      const payload = verifyAccessToken({ secret: tokenSecret, token });
      const userId = payload.sub;

      client.data.userId = userId;

      const room = this.userRoom(userId);
      client.join(room);

      const set = this.userSockets.get(userId) ?? new Set<string>();
      set.add(client.id);
      this.userSockets.set(userId, set);

      client.emit('user:status', { userId, online: true });
      // Broadcast to other sockets in room (including self) is fine for now.
      this.server.to(this.userRoom(userId)).emit('user:status', { userId, online: true });
    } catch {
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const userId = client.data?.userId as string | undefined;
    if (!userId) return;

    const set = this.userSockets.get(userId);
    if (!set) return;

    set.delete(client.id);
    if (set.size === 0) {
      this.userSockets.delete(userId);
      this.server.to(this.userRoom(userId)).emit('user:status', { userId, online: false });
    } else {
      this.userSockets.set(userId, set);
    }
  }

  private userRoom(userId: string): string {
    return `user:${userId}`;
  }

  private conversationRoom(conversationId: string): string {
    return `conversation:${conversationId}`;
  }

  async isParticipant(userId: string, conversationId: string): Promise<boolean> {
    const participant = await this.prisma.conversationParticipant.findFirst({
      where: { conversationId, userId },
      select: { id: true },
    });

    return Boolean(participant);
  }

  @SubscribeMessage('conversation:typing')
  async onTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      conversationId: string;
      isTyping: boolean;
    },
  ): Promise<void> {
    const userId = client.data?.userId as string | undefined;
    if (!userId) return;

    const { conversationId, isTyping } = payload;

    const ok = await this.isParticipant(userId, conversationId);
    if (!ok) return;

    // Ensure participants receive typing events:
    // For simplicity, broadcast to all sockets in the conversation room.
    client.join(this.conversationRoom(conversationId));
    client.to(this.conversationRoom(conversationId)).emit('typing', {
      conversationId,
      userId,
      isTyping,
    });
  }

  @SubscribeMessage('conversation:join')
  async onJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: { conversationId: string },
  ): Promise<void> {
    const userId = client.data?.userId as string | undefined;
    if (!userId) return;

    const { conversationId } = payload;

    const ok = await this.isParticipant(userId, conversationId);
    if (!ok) return;

    client.join(this.conversationRoom(conversationId));
  }

  // Called from REST (ConversationsService) after message is persisted
  async emitNewMessage(conversationId: string, message: any): Promise<void> {
    if (!this.server) return;

    const participants = await this.prisma.conversationParticipant.findMany({
      where: { conversationId },
      select: { userId: true },
    });

    for (const p of participants) {
      this.server
        .to(this.userRoom(p.userId))
        .emit('message:new', { conversationId, message });
    }
  }
}
