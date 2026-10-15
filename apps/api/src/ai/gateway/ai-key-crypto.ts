import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { env } from '../../config/env';

export type EncryptedKey = {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion: number;
};

function keyBytes(base64: string | undefined): Buffer | null {
  if (!base64) return null;
  const bytes = Buffer.from(base64, 'base64');
  return bytes.length === 32 ? bytes : null;
}

/**
 * AES-256-GCM for users' AI API keys. The master key lives only in env (AI_KEY_ENCRYPTION_KEY);
 * AI_KEY_ENCRYPTION_KEY_PREVIOUS keeps old rows readable during a rotation.
 */
@Injectable()
export class AiKeyCrypto {
  get enabled(): boolean {
    return keyBytes(env.ai.keyEncryptionKey) !== null;
  }

  encrypt(plaintext: string): EncryptedKey {
    const key = keyBytes(env.ai.keyEncryptionKey);
    if (!key) throw new Error('AI_KEY_ENCRYPTION_KEY is not configured');

    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    return {
      ciphertext: ciphertext.toString('base64'),
      iv: iv.toString('base64'),
      authTag: cipher.getAuthTag().toString('base64'),
      keyVersion: env.ai.keyEncryptionKeyVersion,
    };
  }

  /** Returns the plaintext and whether it was readable only with the previous master key. */
  decrypt(record: EncryptedKey): {
    plaintext: string;
    needsReencrypt: boolean;
  } {
    const current = keyBytes(env.ai.keyEncryptionKey);
    const previous = keyBytes(env.ai.keyEncryptionKeyPrevious);

    for (const [key, isPrevious] of [
      [current, false],
      [previous, true],
    ] as const) {
      if (!key) continue;
      try {
        const decipher = createDecipheriv(
          'aes-256-gcm',
          key,
          Buffer.from(record.iv, 'base64'),
        );
        decipher.setAuthTag(Buffer.from(record.authTag, 'base64'));
        const plaintext = Buffer.concat([
          decipher.update(Buffer.from(record.ciphertext, 'base64')),
          decipher.final(),
        ]).toString('utf8');
        return { plaintext, needsReencrypt: isPrevious };
      } catch {
        // Wrong key or tampered data; try the next key.
      }
    }
    throw new Error(
      'Stored AI key could not be decrypted (tampered or unknown master key)',
    );
  }
}
