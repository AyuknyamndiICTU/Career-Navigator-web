/* global Buffer, NodeJS */
import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { env } from '../../config/env';
import { createMinioClient } from '../../lib/minio-client';

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream as AsyncIterable<unknown>) {
    chunks.push(
      chunk instanceof Buffer ? chunk : Buffer.from(chunk as Uint8Array),
    );
  }
  return Buffer.concat(chunks);
}

/** Downloads an uploaded CV and reads its text layer (PDF or DOCX). */
@Injectable()
export class CvTextExtractor {
  async extract(objectKey: string): Promise<{ text: string; sha256: string }> {
    const minio = createMinioClient();
    if (!minio) throw new Error('MinIO is not configured (missing env vars).');

    const objectStream = await minio.getObject(env.minio.bucket, objectKey);
    const buffer = await streamToBuffer(
      objectStream as unknown as NodeJS.ReadableStream,
    );
    const sha256 = createHash('sha256').update(buffer).digest('hex');

    if (objectKey.toLowerCase().endsWith('.docx')) {
      // Mammoth's input types are awkward; the runtime call is simple.
      const mammoth = (await import('mammoth')) as any;
      const result = await mammoth.extractRawText(buffer);
      return { text: result?.value?.trim() ? result.value : '', sha256 };
    }

    const pdfParseMod = await import('pdf-parse');
    const pdfParse = (pdfParseMod as any).default ?? pdfParseMod;
    const parsed = await pdfParse(buffer);
    return { text: parsed?.text ?? '', sha256 };
  }
}
