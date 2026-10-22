import { createHash, timingSafeEqual } from 'node:crypto';
import { sign, verify, type JwtPayload } from 'jsonwebtoken';

/** LiveKit "video" grant (subset we use). */
export type VideoGrant = {
  room: string;
  roomJoin?: boolean;
  canPublish?: boolean;
  canSubscribe?: boolean;
  canPublishData?: boolean;
  roomAdmin?: boolean;
  roomList?: boolean;
};

/**
 * LiveKit access tokens are HS256 JWTs: iss = API key, sub = participant identity, `video` = grant.
 * Same format for LiveKit Cloud and self-hosted servers.
 */
export function mintLivekitToken(params: {
  apiKey: string;
  apiSecret: string;
  identity: string;
  name?: string;
  grant: VideoGrant;
  ttlSeconds: number;
}): { token: string; expiresAt: Date } {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + params.ttlSeconds;
  const token = sign(
    { video: params.grant, ...(params.name ? { name: params.name } : {}) },
    params.apiSecret,
    {
      algorithm: 'HS256',
      issuer: params.apiKey,
      subject: params.identity,
      notBefore: 0,
      expiresIn: params.ttlSeconds,
      jwtid: params.identity,
    },
  );
  return { token, expiresAt: new Date(exp * 1000) };
}

/** Admin token for server-to-server calls (RoomService). */
export function mintLivekitAdminToken(
  apiKey: string,
  apiSecret: string,
  room: string,
): string {
  return mintLivekitToken({
    apiKey,
    apiSecret,
    identity: 'career-navigator-api',
    grant: { room, roomAdmin: true, roomList: true },
    ttlSeconds: 60,
  }).token;
}

export class WebhookSignatureError extends Error {}

/**
 * LiveKit signs webhooks with a JWT in the Authorization header (iss = API key) whose `sha256` claim
 * is the base64 SHA-256 of the raw body. Returns the parsed event or throws WebhookSignatureError.
 */
export function verifyLivekitWebhook(params: {
  rawBody: Buffer;
  authorization: string | undefined;
  apiKey: string;
  apiSecret: string;
}): Record<string, unknown> {
  const token = params.authorization?.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new WebhookSignatureError('missing authorization');
  let claims: JwtPayload;
  try {
    claims = verify(token, params.apiSecret, {
      algorithms: ['HS256'],
      issuer: params.apiKey,
    }) as JwtPayload;
  } catch {
    throw new WebhookSignatureError('invalid token');
  }
  const expected = createHash('sha256').update(params.rawBody).digest();
  const claimed = Buffer.from(String(claims.sha256 ?? ''), 'base64');
  if (
    claimed.length !== expected.length ||
    !timingSafeEqual(claimed, expected)
  ) {
    throw new WebhookSignatureError('body hash mismatch');
  }
  try {
    const event = JSON.parse(params.rawBody.toString('utf8')) as unknown;
    if (!event || typeof event !== 'object') throw new Error();
    return event as Record<string, unknown>;
  } catch {
    throw new WebhookSignatureError('invalid body');
  }
}
