/* global Buffer */
import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { TextItem } from '@career-navigator/cv-parser';
import {
  OBJECT_STORAGE,
  type ObjectStorage,
} from '../../storage/object-storage';

const MAX_PDF_PAGES = 10;

export type ExtractedCv =
  | {
      sha256: string;
      kind: 'pdf';
      items: TextItem[];
      pageTexts: string[];
      buffer: Buffer;
    }
  | { sha256: string; kind: 'docx'; html: string }
  | { sha256: string; kind: 'image'; buffer: Buffer };

type PdfTextItem = {
  str?: string;
  transform?: number[];
  width?: number;
  fontName?: string;
};

type PdfPage = {
  getOperatorList: () => Promise<unknown>;
  commonObjs: { has: (k: string) => boolean; get: (k: string) => unknown };
};

/** Font names whose real font is bold (e.g. "ABCDEF+Calibri-Bold"); pdf.js knows them after loading fonts. */
async function boldFontNames(
  page: PdfPage,
  styles: Record<string, { fontFamily?: string }>,
): Promise<Set<string>> {
  const bold = new Set<string>();
  try {
    await page.getOperatorList();
  } catch {
    return bold;
  }
  for (const [name, style] of Object.entries(styles)) {
    let font: { name?: string; bold?: boolean; black?: boolean } | undefined;
    try {
      font = page.commonObjs.has(name)
        ? (page.commonObjs.get(name) as typeof font)
        : undefined;
    } catch {
      font = undefined;
    }
    const label = `${font?.name ?? ''} ${style.fontFamily ?? ''}`;
    if (
      font?.bold ||
      font?.black ||
      /bold|black|heavy|semibold|demi/i.test(label)
    ) {
      bold.add(name);
    }
  }
  return bold;
}

/** pdf.js text items with position, size and boldness, read with unpdf (16.2). */
export async function pdfToItems(
  buffer: Buffer,
): Promise<{ items: TextItem[]; pageTexts: string[] }> {
  // unpdf is ESM-only and pdf.js is large, so load it on first use.
  const { getDocumentProxy } = await import('unpdf');
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const items: TextItem[] = [];
  const pageTexts: string[] = [];
  try {
    for (let p = 1; p <= Math.min(pdf.numPages, MAX_PDF_PAGES); p += 1) {
      const page = await pdf.getPage(p);
      const { height: pageHeight } = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const boldFonts = await boldFontNames(
        page as unknown as PdfPage,
        content.styles,
      );
      let pageText = '';
      for (const raw of content.items as PdfTextItem[]) {
        const text = raw.str ?? '';
        if (!text.trim() || !raw.transform) continue;
        const [a, b, c, d, e, f] = raw.transform;
        const size = Math.hypot(c, d) || Math.hypot(a, b) || 10;
        items.push({
          text,
          x: e,
          y: pageHeight - f - size,
          width: raw.width ?? text.length * size * 0.5,
          height: size,
          page: p,
          bold: raw.fontName ? boldFonts.has(raw.fontName) : false,
        });
        pageText += `${text} `;
      }
      pageTexts.push(pageText);
    }
  } finally {
    await pdf.cleanup();
  }
  return { items, pageTexts };
}

/** Downloads an uploaded CV and turns it into parser input: PDF text items, DOCX HTML, or an image for OCR. */
@Injectable()
export class CvTextExtractor {
  constructor(
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  async extract(objectKey: string): Promise<ExtractedCv> {
    const buffer = await this.storage.getBuffer(objectKey);
    const sha256 = createHash('sha256').update(buffer).digest('hex');
    const ext = objectKey.toLowerCase().split('.').pop();

    if (ext === 'docx') {
      // convertToHtml keeps headings, bold and lists, which the parser uses as layout hints.
      const mammoth = (await import('mammoth')) as unknown as {
        convertToHtml: (input: {
          buffer: Buffer;
        }) => Promise<{ value: string }>;
      };
      const { value } = await mammoth.convertToHtml({ buffer });
      return { sha256, kind: 'docx', html: value ?? '' };
    }
    if (ext === 'jpg' || ext === 'png' || ext === 'webp') {
      return { sha256, kind: 'image', buffer };
    }
    const { items, pageTexts } = await pdfToItems(buffer);
    return { sha256, kind: 'pdf', items, pageTexts, buffer };
  }
}
