import { Injectable, Logger } from '@nestjs/common';
import {
  hasTextLayer,
  parseCv,
  toStructured,
  PARSER_VERSION,
  type CvInput,
  type ParsedCv,
  type TextItem,
} from '@career-navigator/cv-parser';
import { env } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { CvServerOcr } from './cv-server-ocr.service';
import { CvTextExtractor } from './cv-text-extractor.service';

/** Errors whose message is safe and useful to show the user. */
export class CvScanUserError extends Error {}

export const NO_TEXT_MESSAGE =
  'This file has no readable text layer (it looks like a scan or photo). Upload it again from the CV page so your browser can read it, or upload a PDF/DOCX exported from your editor.';

const SKILL_CACHE_MS = 10 * 60_000;

/** The JSON stored in UploadMedia.cvExtractedText: the legacy structured shape plus the full parse. */
export type StoredCvScan = ReturnType<typeof toStructured> & {
  parsed: ParsedCv;
  fileSha256: string;
  parserVersion: number;
  ocr: 'none' | 'browser' | 'server';
};

/**
 * Rule-based CV scan (Phase 16): extract layout → OCR when needed → parse → store for review.
 * Nothing is written to the profile here; the user confirms on the review screen.
 */
@Injectable()
export class CvScanProcessor {
  private readonly logger = new Logger(CvScanProcessor.name);
  private skillCache?: { at: number; skills: string[] };

  constructor(
    private readonly prisma: PrismaService,
    private readonly extractor: CvTextExtractor,
    private readonly serverOcr: CvServerOcr,
  ) {}

  /** Worker path: read the stored file. */
  async processFile(uploadMediaId: string, objectKey: string): Promise<void> {
    await this.run(uploadMediaId, async () => {
      const file = await this.extractor.extract(objectKey);
      if (file.kind === 'docx') {
        return {
          input: { kind: 'html', html: file.html },
          sha256: file.sha256,
          ocr: 'none',
        };
      }
      if (file.kind === 'pdf' && hasTextLayer(file.pageTexts)) {
        return {
          input: { kind: 'items', items: file.items },
          sha256: file.sha256,
          ocr: 'none',
        };
      }
      if (!this.serverOcr.enabled) throw new CvScanUserError(NO_TEXT_MESSAGE);
      const items = await this.serverOcr.recognize(file.buffer, file.kind);
      if (items.length === 0) throw new CvScanUserError(NO_TEXT_MESSAGE);
      return {
        input: { kind: 'items', items },
        sha256: file.sha256,
        ocr: 'server',
      };
    });
  }

  /** Upload path: the browser already ran OCR and sent validated words. */
  async processOcrWords(
    uploadMediaId: string,
    items: TextItem[],
    sha256: string,
  ): Promise<void> {
    await this.run(uploadMediaId, () =>
      Promise.resolve({
        input: { kind: 'items', items },
        sha256,
        ocr: 'browser',
      }),
    );
  }

  private async run(
    uploadMediaId: string,
    load: () => Promise<{
      input: CvInput;
      sha256: string;
      ocr: StoredCvScan['ocr'];
    }>,
  ): Promise<void> {
    await this.prisma.uploadMedia.update({
      where: { id: uploadMediaId },
      data: {
        cvScanStatus: 'PROCESSING',
        cvScanRequestedAt: new Date(),
        cvConfirmedAt: null,
      },
    });
    try {
      const { input, sha256, ocr } = await load();
      const parsed = parseCv(input, {
        extraSkills: await this.platformSkills(),
        defaultCountry: env.cvScan.defaultPhoneCountry,
      });
      if (parsed.stats.characters < 50)
        throw new CvScanUserError(NO_TEXT_MESSAGE);
      const stored: StoredCvScan = {
        ...toStructured(parsed),
        parsed,
        fileSha256: sha256,
        parserVersion: PARSER_VERSION,
        ocr,
      };
      await this.prisma.uploadMedia.update({
        where: { id: uploadMediaId },
        data: {
          cvScanStatus: 'COMPLETED',
          cvScanCompletedAt: new Date(),
          cvExtractedText: JSON.stringify(stored),
          cvScanError: null,
        },
      });
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `cv-scan failed. uploadMediaId=${uploadMediaId} err=${raw}`,
      );
      await this.prisma.uploadMedia.update({
        where: { id: uploadMediaId },
        data: {
          cvScanStatus: 'FAILED',
          cvScanCompletedAt: new Date(),
          cvScanError:
            err instanceof CvScanUserError
              ? raw
              : 'We could not read this file. Try exporting it again as PDF or DOCX.',
        },
      });
    }
  }

  /** Skills used by job posts, so the parser recognises platform vocabulary. Cached briefly. */
  private async platformSkills(): Promise<string[]> {
    if (this.skillCache && Date.now() - this.skillCache.at < SKILL_CACHE_MS) {
      return this.skillCache.skills;
    }
    try {
      const rows = await this.prisma.$queryRaw<Array<{ skill: string }>>`
        SELECT DISTINCT unnest(skills) AS skill FROM "Job" LIMIT 2000`;
      const skills = rows
        .map((r) => r.skill)
        .filter((s) => s && s.length <= 60);
      this.skillCache = { at: Date.now(), skills };
      return skills;
    } catch {
      return [];
    }
  }
}
