import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { MessagingGateway } from '../realtime/messaging.gateway';
import { mintLivekitToken } from './livekit';

export type VideoJoin = {
  provider: 'livekit';
  url: string;
  token: string;
  room: string;
  sessionId: string;
  expiresAt: string;
};

const MINUTE_MS = 60_000;

/** Calls belong to conversations: only their participants can get a token for the room. */
@Injectable()
export class VideoService {
  private readonly logger = new Logger(VideoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: MessagingGateway,
  ) {}

  private async participantIds(conversationId: string): Promise<string[]> {
    const rows = await this.prisma.conversationParticipant.findMany({
      where: { conversationId },
      select: { userId: true },
    });
    return rows.map((r) => r.userId);
  }

  /** A session is open until LiveKit reports the room finished, or for one token lifetime at most. */
  private openSince(): Date {
    return new Date(Date.now() - env.video.tokenTtlMinutes * MINUTE_MS);
  }

  async activeSession(userId: string, conversationId: string) {
    const ids = await this.participantIds(conversationId);
    if (!ids.includes(userId))
      throw new BadRequestException('Conversation not found');
    const session = await this.prisma.videoSession.findFirst({
      where: {
        conversationId,
        endedAt: null,
        startedAt: { gt: this.openSince() },
      },
      orderBy: { startedAt: 'desc' },
      select: { id: true, startedAt: true, createdById: true },
    });
    return { session };
  }

  async join(userId: string, conversationId: string): Promise<VideoJoin> {
    const { livekitUrl, apiKey, apiSecret } = env.video;
    if (!livekitUrl || !apiKey || !apiSecret) {
      throw new ServiceUnavailableException(
        'Video calls are not configured on this server.',
      );
    }
    const ids = await this.participantIds(conversationId);
    if (!ids.includes(userId))
      throw new BadRequestException('Conversation not found');

    let session = await this.prisma.videoSession.findFirst({
      where: {
        conversationId,
        endedAt: null,
        startedAt: { gt: this.openSince() },
      },
      orderBy: { startedAt: 'desc' },
    });
    const created = !session;
    // Random room names: knowing a conversation id is not enough to guess the room.
    session ??= await this.prisma.videoSession.create({
      data: { room: `cn-${randomUUID()}`, conversationId, createdById: userId },
    });

    const name = await this.displayName(userId);
    const { token, expiresAt } = mintLivekitToken({
      apiKey,
      apiSecret,
      identity: userId,
      name,
      grant: {
        room: session.room,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      },
      ttlSeconds: env.video.tokenTtlMinutes * 60,
    });

    if (created) {
      for (const other of ids.filter((id) => id !== userId)) {
        this.gateway.emitToUser(other, 'call:incoming', {
          conversationId,
          sessionId: session.id,
          from: { id: userId, name },
        });
      }
    }

    return {
      provider: 'livekit',
      url: livekitUrl,
      token,
      room: session.room,
      sessionId: session.id,
      expiresAt: expiresAt.toISOString(),
    };
  }

  private async displayName(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        profile: { select: { firstName: true, lastName: true } },
      },
    });
    const full = [user?.profile?.firstName, user?.profile?.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();
    return (full || user?.email?.split('@')[0] || 'Participant').slice(0, 80);
  }

  /** Applies a verified LiveKit webhook event (17.4). Unknown rooms and events are ignored. */
  async handleWebhook(event: Record<string, unknown>): Promise<void> {
    const type = String(event.event ?? '');
    const room = (event.room as { name?: string } | undefined)?.name;
    if (!room) return;
    const session = await this.prisma.videoSession.findUnique({
      where: { room },
    });
    if (!session) return;
    const at = eventTime(event);
    const identity = (event.participant as { identity?: string } | undefined)
      ?.identity;

    switch (type) {
      case 'participant_joined':
        // Webhooks can be retried: one open connection per user and session.
        if (
          identity &&
          !(await this.prisma.videoParticipant.findFirst({
            where: { sessionId: session.id, userId: identity, leftAt: null },
          }))
        ) {
          await this.prisma.videoParticipant.create({
            data: { sessionId: session.id, userId: identity, joinedAt: at },
          });
        }
        break;
      case 'participant_left':
        if (identity) await this.closeParticipants(session.id, at, identity);
        break;
      case 'room_finished':
        await this.closeParticipants(session.id, at);
        await this.prisma.videoSession.update({
          where: { id: session.id },
          data: { endedAt: at },
        });
        break;
      default:
        break;
    }
  }

  /** Closes open connections and adds their minutes (rounded up, as LiveKit bills) to the session. */
  private async closeParticipants(
    sessionId: string,
    at: Date,
    userId?: string,
  ): Promise<void> {
    const open = await this.prisma.videoParticipant.findMany({
      where: { sessionId, leftAt: null, ...(userId ? { userId } : {}) },
    });
    let minutes = 0;
    for (const p of open) {
      minutes += Math.max(
        1,
        Math.ceil((at.getTime() - p.joinedAt.getTime()) / MINUTE_MS),
      );
      await this.prisma.videoParticipant.update({
        where: { id: p.id },
        data: { leftAt: at },
      });
    }
    if (minutes > 0) {
      await this.prisma.videoSession.update({
        where: { id: sessionId },
        data: { participantMinutes: { increment: minutes } },
      });
    }
  }

  /** Participant-minutes this calendar month (UTC) against the free allowance (17.4). */
  async monthlyUsage(now = new Date()) {
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const [closed, open, sessions] = await Promise.all([
      this.prisma.videoSession.aggregate({
        where: { startedAt: { gte: monthStart } },
        _sum: { participantMinutes: true },
      }),
      this.prisma.videoParticipant.findMany({
        where: { leftAt: null, joinedAt: { gte: monthStart } },
        select: { joinedAt: true },
      }),
      this.prisma.videoSession.count({
        where: { startedAt: { gte: monthStart } },
      }),
    ]);
    const live = open.reduce(
      (sum, p) =>
        sum + Math.ceil((now.getTime() - p.joinedAt.getTime()) / MINUTE_MS),
      0,
    );
    const minutes = (closed._sum.participantMinutes ?? 0) + live;
    const allowance = env.video.freeMinutes;
    const percent = Math.round((minutes / allowance) * 1000) / 10;
    if (percent >= 80)
      this.logger.warn(
        `Video usage at ${percent}% of the monthly free allowance.`,
      );
    return {
      month: monthStart.toISOString().slice(0, 7),
      participantMinutes: minutes,
      freeMinutes: allowance,
      percent,
      alert: percent >= 80,
      sessions,
      activeConnections: open.length,
      configured: env.video.enabled,
    };
  }
}

function eventTime(event: Record<string, unknown>): Date {
  const seconds = Number(event.createdAt);
  return Number.isFinite(seconds) && seconds > 0
    ? new Date(seconds * 1000)
    : new Date();
}
