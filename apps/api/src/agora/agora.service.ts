import { BadRequestException, Injectable } from '@nestjs/common';
import { createHmac, randomInt } from 'crypto';
import { deflateSync } from 'zlib';
import { PrismaService } from '../prisma/prisma.service';

type AgoraRole = 'publisher' | 'subscriber';

type AgoraRtcTokenParams = {
  channelName: string;
  uid: number;
  role: AgoraRole;
  tokenExpireSeconds?: number;
  privilegeExpireSeconds?: number;
};

type AgoraPrivileges = Record<number, number>;

const VERSION = '007';

type Pack = Buffer;

function packUint16(x: number): Pack {
  const b = Buffer.alloc(2);
  b.writeUInt16BE(x, 0);
  return b;
}

function packUint32(x: number): Pack {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(x >>> 0, 0);
  return b;
}

function packString(s: string): Pack {
  const bytes = Buffer.from(s, 'utf8');
  return Buffer.concat([packUint16(bytes.length), bytes]);
}

function packMapUint32(privileges: AgoraPrivileges): Pack {
  const entries = Object.entries(privileges)
    .map(([k, v]) => [Number(k), Number(v)] as const)
    .sort((a, b) => a[0] - b[0]);

  return Buffer.concat([
    packUint16(entries.length),
    ...entries.map(([k, v]) => {
      return Buffer.concat([packUint16(k), packUint32(v)]);
    }),
  ]);
}

function agoraBuildAccessToken(params: {
  appId: string;
  appCertificate: string;
  issueTs: number;
  expire: number;
  services: Array<{
    serviceType: number;
    privileges: AgoraPrivileges;
    channelName?: string;
    uid?: number;
  }>;
}): string {
  const { appId, appCertificate, issueTs, expire, services } = params;

  const salt = randomInt(1, 99999999);

  const appCertBytes = Buffer.from(appCertificate, 'utf8');

  const signing2 = createHmac('sha256', appCertBytes)
    .update(packUint32(issueTs))
    .digest();

  const signing = createHmac('sha256', appCertBytes)
    .update(packUint32(salt))
    .update(signing2)
    .digest();

  const serviceCount = services.length;

  const appIdBytes = Buffer.from(appId, 'utf8');

  let signingInfo = Buffer.concat([
    packString(appIdBytes.toString('utf8')),
    packUint32(issueTs),
    packUint32(expire),
    packUint32(salt),
    packUint16(serviceCount),
  ]);

  const servicePacks = services
    .slice()
    .sort((a, b) => a.serviceType - b.serviceType)
    .map((svc) => {
      const privilegesPacked = packMapUint32(svc.privileges);

      const channelPacked = svc.channelName
        ? packString(svc.channelName)
        : packString('');

      const uidStr = typeof svc.uid === 'number' ? String(svc.uid) : '0';
      const uidPacked = packString(uidStr);

      return Buffer.concat([
        packUint16(svc.serviceType),
        privilegesPacked,
        channelPacked,
        uidPacked,
      ]);
    });

  signingInfo = Buffer.concat([signingInfo, ...servicePacks]);

  const signature = createHmac('sha256', signing).update(signingInfo).digest();

  const packed = deflateSync(
    Buffer.concat([packString(signature.toString('base64')), signingInfo]),
  );

  return VERSION + packed.toString('base64');
}

@Injectable()
export class AgoraService {
  // Milestone 6.1: minimal in-memory sessions (still useful, but DB is source of truth for 6.2)
  private readonly sessions = new Map<
    string,
    {
      ended: boolean;
      createdAt: number;
      channelName: string;
      uid: number;
      role: AgoraRole;
    }
  >();

  constructor(private readonly prisma: PrismaService) {}

  async startSession(params: {
    channelName: string;
    uid?: number;
    role?: AgoraRole;
    tokenExpireSeconds?: number;
    privilegeExpireSeconds?: number;
  }): Promise<{
    sessionId: string;
    channelName: string;
    uid: number;
    role: AgoraRole;
    token: string;
  }> {
    const sessionId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const uid = params.uid ?? randomInt(1, 2 ** 16);
    const role: AgoraRole = params.role ?? 'publisher';

    this.sessions.set(sessionId, {
      ended: false,
      createdAt: Date.now(),
      channelName: params.channelName,
      uid,
      role,
    });

    // Persist for Milestone 6.2
    // AgoraSession.uid is BigInt in Prisma schema
    await this.prisma.agoraSession.create({
      data: {
        sessionId,
        channelName: params.channelName,
        uid: BigInt(uid),
        role,
      },
    });

    const token = this.mintRtcTokenInternal({
      channelName: params.channelName,
      uid,
      role,
      tokenExpireSeconds: params.tokenExpireSeconds,
      privilegeExpireSeconds: params.privilegeExpireSeconds,
    });

    return {
      sessionId,
      channelName: params.channelName,
      uid,
      role,
      token,
    };
  }

  async endSession(sessionId: string): Promise<{ ended: true }> {
    const existing = this.sessions.get(sessionId);
    if (!existing) {
      throw new BadRequestException('Session not found');
    }

    this.sessions.delete(sessionId);

    // Persist for Milestone 6.2
    await this.prisma.agoraSession.update({
      where: { sessionId },
      data: { endedAt: new Date() },
    });

    return { ended: true };
  }

  // Milestone 6.1: RTC token minting
  mintRtcToken(params: {
    channelName: string;
    uid: number;
    role: AgoraRole;
    tokenExpireSeconds?: number;
    privilegeExpireSeconds?: number;
  }): string {
    return this.mintRtcTokenInternal(params);
  }

  private mintRtcTokenInternal(params: AgoraRtcTokenParams): string {
    const appId = process.env.AGORA_APP_ID;
    const appCertificate = process.env.AGORA_APP_CERTIFICATE;

    if (!appId || !appCertificate) {
      throw new BadRequestException(
        'Agora env vars missing (AGORA_APP_ID/AGORA_APP_CERTIFICATE)',
      );
    }

    const channelName = params.channelName.trim();
    if (!channelName) {
      throw new BadRequestException('channelName is required');
    }

    const uid = params.uid;
    if (!Number.isFinite(uid) || uid < 0 || uid > 2 ** 32 - 1) {
      throw new BadRequestException(
        'uid must be a valid 32-bit unsigned integer (or 0)',
      );
    }

    const tokenExpireSeconds = params.tokenExpireSeconds ?? 3600;
    const privilegeExpireSeconds =
      params.privilegeExpireSeconds ?? tokenExpireSeconds;

    const privileges: AgoraPrivileges = {
      1: privilegeExpireSeconds, // JoinChannel
    };

    if (params.role === 'publisher') {
      privileges[2] = privilegeExpireSeconds;
      privileges[3] = privilegeExpireSeconds;
      privileges[4] = privilegeExpireSeconds;
    }

    const issueTs = Math.floor(Date.now() / 1000);

    return agoraBuildAccessToken({
      appId,
      appCertificate,
      issueTs,
      expire: tokenExpireSeconds,
      services: [
        {
          serviceType: 1, // ServiceRtc
          privileges,
          channelName,
          uid,
        },
      ],
    });
  }
}
