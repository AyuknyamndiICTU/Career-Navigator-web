/* global Buffer */
import { Injectable, Logger } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { OCR_LIMITS, type TextItem } from '@career-navigator/cv-parser';
import { env } from '../../config/env';

const run = promisify(execFile);
const CLI_TIMEOUT_MS = 60_000;
const MIN_WORD_CONFIDENCE = 35;

/** Parses `tesseract ... tsv` output (level 5 rows are words). */
export function tsvToItems(tsv: string, page: number): TextItem[] {
  const items: TextItem[] = [];
  for (const row of tsv.split(/\r?\n/).slice(1)) {
    const cols = row.split('\t');
    if (cols.length < 12 || cols[0] !== '5') continue;
    const text = cols.slice(11).join('\t').trim();
    const conf = Number(cols[10]);
    if (!text || conf < MIN_WORD_CONFIDENCE) continue;
    const [x, y, width, height] = cols.slice(6, 10).map(Number);
    items.push({
      text,
      x,
      y,
      width: Math.max(1, width),
      height: Math.max(1, height),
      page,
    });
  }
  return items;
}

/**
 * Optional server-side OCR (16.3) for scanned CVs when the browser did not send OCR words.
 * Needs the `tesseract` and `pdftoppm` binaries (API image built with WITH_OCR=true) and CV_OCR_SERVER=true.
 * Runs one file at a time so a burst of scans cannot exhaust the CPU.
 */
@Injectable()
export class CvServerOcr {
  private readonly logger = new Logger(CvServerOcr.name);
  private queue: Promise<unknown> = Promise.resolve();

  get enabled(): boolean {
    return env.cvScan.serverOcr;
  }

  recognize(buffer: Buffer, kind: 'pdf' | 'image'): Promise<TextItem[]> {
    const next = this.queue.then(() => this.recognizeNow(buffer, kind));
    this.queue = next.catch(() => undefined);
    return next;
  }

  private async recognizeNow(
    buffer: Buffer,
    kind: 'pdf' | 'image',
  ): Promise<TextItem[]> {
    const dir = await mkdtemp(join(tmpdir(), 'cv-ocr-'));
    try {
      let images: string[];
      if (kind === 'pdf') {
        const input = join(dir, 'in.pdf');
        await writeFile(input, buffer);
        await run(
          'pdftoppm',
          [
            '-r',
            '200',
            '-png',
            '-l',
            String(OCR_LIMITS.maxPages),
            input,
            join(dir, 'page'),
          ],
          {
            timeout: CLI_TIMEOUT_MS,
          },
        );
        images = (await readdir(dir))
          .filter((f) => f.startsWith('page') && f.endsWith('.png'))
          .sort()
          .map((f) => join(dir, f));
      } else {
        const input = join(dir, 'in.img');
        await writeFile(input, buffer);
        images = [input];
      }
      const items: TextItem[] = [];
      for (const [i, image] of images.entries()) {
        const { stdout } = await run(
          'tesseract',
          [image, 'stdout', '-l', 'eng+fra', 'tsv'],
          {
            timeout: CLI_TIMEOUT_MS,
            maxBuffer: 20 * 1024 * 1024,
          },
        );
        items.push(...tsvToItems(stdout, i + 1));
      }
      return items;
    } catch (err) {
      this.logger.warn(`server OCR failed: ${(err as Error).message}`);
      throw new Error('Text recognition failed on the server.');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
}
