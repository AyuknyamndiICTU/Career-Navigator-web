import { hasTextLayer, tesseractToWords, OCR_LIMITS, type OcrWord } from '@career-navigator/cv-parser';

export type OcrProgress = { stage: 'checking' | 'loading' | 'reading'; page: number; pages: number; progress: number };

const PDF_RENDER_SCALE = 2;
const isImage = (file: File) => /^image\/(jpeg|png)$/.test(file.type);
const isPdf = (file: File) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

/** Scans and photos have no usable text layer, so they need OCR before upload (16.3). */
export async function needsOcr(file: File): Promise<boolean> {
  if (isImage(file)) return true;
  if (!isPdf(file)) return false;
  const { getDocumentProxy } = await import('unpdf');
  const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
  try {
    const pageTexts: string[] = [];
    for (let p = 1; p <= Math.min(pdf.numPages, OCR_LIMITS.maxPages); p += 1) {
      const content = await (await pdf.getPage(p)).getTextContent();
      pageTexts.push(content.items.map((i) => ('str' in i ? i.str : '')).join(' '));
    }
    return !hasTextLayer(pageTexts);
  } finally {
    await pdf.cleanup();
  }
}

/** Page images to read: the image itself, or each PDF page rendered to PNG. */
async function pageImages(file: File): Promise<Array<() => Promise<Blob>>> {
  if (isImage(file)) return [async () => file];
  const { getDocumentProxy, renderPageAsImage } = await import('unpdf');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdf = await getDocumentProxy(bytes.slice());
  const pages = Math.min(pdf.numPages, OCR_LIMITS.maxPages);
  await pdf.cleanup();
  return Array.from({ length: pages }, (_, i) => async () => {
    // pdf.js may transfer (detach) the buffer it is given, so pass a fresh copy per page.
    const png = await renderPageAsImage(bytes.slice(), i + 1, { scale: PDF_RENDER_SCALE });
    return new Blob([png as ArrayBuffer], { type: 'image/png' });
  });
}

/**
 * Reads a scanned CV in the browser with tesseract.js (English + French).
 * The file never leaves the device for OCR; only the language models are downloaded.
 */
export async function recognizeCv(
  file: File,
  onProgress: (p: OcrProgress) => void,
  signal?: AbortSignal,
): Promise<OcrWord[]> {
  const pages = await pageImages(file);
  let page = 0;
  onProgress({ stage: 'loading', page: 0, pages: pages.length, progress: 0 });

  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker(['eng', 'fra'], undefined, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') {
        onProgress({ stage: 'reading', page, pages: pages.length, progress: m.progress });
      }
    },
  });
  const abort = () => void worker.terminate();
  signal?.addEventListener('abort', abort, { once: true });
  try {
    const words: OcrWord[] = [];
    for (const [i, load] of pages.entries()) {
      signal?.throwIfAborted();
      page = i + 1;
      onProgress({ stage: 'reading', page, pages: pages.length, progress: 0 });
      const { data } = await worker.recognize(await load(), {}, { blocks: true });
      words.push(...tesseractToWords(data as Parameters<typeof tesseractToWords>[0], page));
      if (words.length >= OCR_LIMITS.maxWords) break;
    }
    return words.slice(0, OCR_LIMITS.maxWords);
  } finally {
    signal?.removeEventListener('abort', abort);
    await worker.terminate().catch(() => undefined);
  }
}
