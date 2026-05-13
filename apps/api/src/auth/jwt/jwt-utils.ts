import { createHash, randomUUID } from 'node:crypto';
import type { JwtPayload } from 'jsonwebtoken';
import { sign, verify } from 'jsonwebtoken';

export type AccessTokenPayload = {
  sub: string;
  email: string;
  isActive: boolean;
};

export type RefreshTokenPayload = {
  sub: string;
  jti: string;
};

export function parseDurationToMs(input: string): number {
  const trimmed = input.trim();
  const match = /^(\d+)\s*([smhd])$/i.exec(trimmed);
  if (!match) {
    throw new Error(`Unsupported duration format: "${input}"`);
  }

  const value = Number(match[1]);
  const unit = match[2].toLowerCase();

  const msPerUnit: Record<string, number> = {
    s: 1_000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };

  return value * msPerUnit[unit];
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function signAccessToken(params: {
  secret: string;
  expiresIn: string;
  userId: string;
  email: string;
  isActive: boolean;
}): string {
  const { secret, expiresIn, userId, email, isActive } = params;

  const payload: AccessTokenPayload = {
    sub: userId,
    email,
    isActive,
  };

  return sign(payload, secret, { expiresIn } as any);
}

export function signRefreshToken(params: {
  secret: string;
  expiresIn: string;
  userId: string;
}): { token: string; jti: string } {
  const { secret, expiresIn, userId } = params;

  const jti = randomUUID();
  const payload = { sub: userId };

  const token = sign(payload, secret, {
    expiresIn,
    jwtid: jti,
  } as any);

  return { token, jti };
}

export function verifyAccessToken(params: {
  secret: string;
  token: string;
}): AccessTokenPayload {
  const { secret, token } = params;

  const decoded = verify(token, secret) as AccessTokenPayload;
  return decoded;
}

export function verifyRefreshToken(params: {
  secret: string;
  token: string;
}): RefreshTokenPayload {
  const { secret, token } = params;

  const decoded = verify(token, secret) as JwtPayload & {
    sub: string;
    jti?: string;
  };

  const jti = decoded.jti;
  if (!jti) {
    throw new Error('Refresh token missing jti');
  }

  return { sub: decoded.sub, jti };
}
