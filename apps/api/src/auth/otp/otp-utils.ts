import { randomInt, createHash } from 'node:crypto';

export function generate6DigitCode(): string {
  // 000000..999999 -> always 6 chars
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export function hashOtpCode(code: string): string {
  // One-way hash; we do not store the raw code.
  return createHash('sha256').update(`career-navigator:${code}`).digest('hex');
}
