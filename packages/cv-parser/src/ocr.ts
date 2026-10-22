import type { TextItem } from './types';

export type OcrWord = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
};

/** Loose shape of tesseract.js `recognize(..., { blocks: true })` output. */
type TesseractWord = { text?: string; confidence?: number; bbox?: { x0: number; y0: number; x1: number; y1: number } };
type TesseractPage = {
  blocks?: Array<{ paragraphs?: Array<{ lines?: Array<{ words?: TesseractWord[] }> }> }> | null;
};

/** Flattens tesseract.js output to positioned words, dropping noise below `minConfidence`. */
export function tesseractToWords(page: TesseractPage, pageNumber: number, minConfidence = 35): OcrWord[] {
  const result: OcrWord[] = [];
  for (const block of page.blocks ?? []) {
    for (const paragraph of block.paragraphs ?? []) {
      for (const line of paragraph.lines ?? []) {
        for (const word of line.words ?? []) {
          const text = (word.text ?? '').trim();
          if (!text || !word.bbox || (word.confidence ?? 100) < minConfidence) continue;
          result.push({
            text,
            x: word.bbox.x0,
            y: word.bbox.y0,
            width: Math.max(1, word.bbox.x1 - word.bbox.x0),
            height: Math.max(1, word.bbox.y1 - word.bbox.y0),
            page: pageNumber,
          });
        }
      }
    }
  }
  return result;
}

export const OCR_LIMITS = { maxWords: 15000, maxPages: 10, maxTextLength: 120 };

/**
 * Validates OCR words sent by a browser (untrusted): exact shape, finite numbers, bounded counts,
 * control characters removed. Returns null when the payload is unusable.
 */
export function validateOcrWords(value: unknown): TextItem[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > OCR_LIMITS.maxWords) return null;
  const items: TextItem[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') return null;
    const w = raw as Record<string, unknown>;
    const nums = [w.x, w.y, w.width, w.height, w.page];
    if (typeof w.text !== 'string' || nums.some((n) => typeof n !== 'number' || !Number.isFinite(n))) return null;
    const page = w.page as number;
    if (!Number.isInteger(page) || page < 1 || page > OCR_LIMITS.maxPages) return null;
    const text = w.text.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, OCR_LIMITS.maxTextLength);
    if (!text) continue;
    items.push({
      text,
      x: Math.max(0, w.x as number),
      y: Math.max(0, w.y as number),
      width: Math.max(1, w.width as number),
      height: Math.max(1, Math.min(500, w.height as number)),
      page,
    });
  }
  return items.length > 0 ? items : null;
}

/** A PDF whose pages carry too little real text is a scan: route it to OCR. */
export function hasTextLayer(pageTexts: string[]): boolean {
  if (pageTexts.length === 0) return false;
  const letters = pageTexts.map((t) => (t.match(/\p{L}/gu) ?? []).length);
  const total = letters.reduce((a, b) => a + b, 0);
  return total >= 100 && total / pageTexts.length >= 40;
}
