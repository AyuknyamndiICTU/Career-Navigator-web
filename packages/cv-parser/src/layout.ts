import type { Line, LineInput, TextItem } from './types';
import { BULLET_RE, collapseSpaces, median } from './normalize';

type Row = { y: number; height: number; items: TextItem[] };

/**
 * Groups items into visual rows (same top within half a line height), left to right.
 * OCR boxes hug the ink, so a small glyph ("-", "•", ".") joins the row whose band holds its centre.
 */
function buildRows(items: TextItem[]): Row[] {
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const rows: Row[] = [];
  for (const item of sorted) {
    const row = rows[rows.length - 1];
    const tolerance = Math.max(2, 0.5 * Math.min(item.height, row?.height ?? item.height));
    const centre = item.y + item.height / 2;
    const smallInBand =
      row !== undefined && item.height < 0.6 * row.height && centre >= row.y && centre <= row.y + row.height;
    if (row && (Math.abs(item.y - row.y) <= tolerance || smallInBand)) {
      row.items.push(item);
    } else {
      rows.push({ y: item.y, height: item.height, items: [item] });
    }
  }
  return rows;
}

function rowToLine(row: Row, page: number, column: number): Line {
  const items = [...row.items].sort((a, b) => a.x - b.x);
  let text = '';
  let prevEnd = -Infinity;
  let boldChars = 0;
  let chars = 0;
  for (const item of items) {
    const gap = item.x - prevEnd;
    if (text && gap > 0.15 * item.height && !text.endsWith(' ') && !item.text.startsWith(' ')) {
      // A wide gap inside a row is a column of its own (e.g. right-aligned dates): keep it visibly apart.
      text += gap > 2.5 * item.height ? '   ' : ' ';
    }
    text += item.text;
    prevEnd = item.x + item.width;
    const len = item.text.trim().length;
    chars += len;
    if (item.bold) boldChars += len;
  }
  const clean = text.replace(/\s{3,}/g, '   ').trim();
  return {
    text: clean,
    page,
    y: row.y,
    x: items[0]?.x ?? 0,
    fontSize: Math.max(...items.map((i) => i.height)),
    bold: chars > 0 && boldChars / chars >= 0.8,
    bullet: BULLET_RE.test(clean),
    heading: false,
    column,
  };
}

/**
 * Finds a vertical gutter that splits a page into two independent columns, or null.
 * Right-aligned dates in a one-column CV share rows with the left text, so a real split also
 * needs many rows that exist on only one side.
 */
export function findGutter(items: TextItem[]): number | null {
  if (items.length < 20) return null;
  const minX = Math.min(...items.map((i) => i.x));
  const maxX = Math.max(...items.map((i) => i.x + i.width));
  const width = maxX - minX;
  if (width <= 0) return null;

  let best: { x: number; crossing: number } | null = null;
  for (let step = 25; step <= 75; step += 1) {
    const x = minX + (width * step) / 100;
    let crossing = 0;
    let left = 0;
    let right = 0;
    for (const item of items) {
      if (item.x + item.width <= x) left += 1;
      else if (item.x >= x) right += 1;
      else crossing += 1;
    }
    if (left < 0.15 * items.length || right < 0.2 * items.length) continue;
    if (crossing > 0.03 * items.length) continue;
    if (!best || crossing < best.crossing) best = { x, crossing };
  }
  if (!best) return null;

  const gutter = best.x;
  const leftRows = buildRows(items.filter((i) => i.x + i.width / 2 < gutter));
  const rightRows = buildRows(items.filter((i) => i.x + i.width / 2 >= gutter));
  if (leftRows.length < 6 || rightRows.length < 6) return null;
  const shares = (row: Row, others: Row[]) =>
    others.some((o) => Math.abs(o.y - row.y) <= Math.max(2, 0.5 * row.height));
  const rightOnly = rightRows.filter((r) => !shares(r, leftRows)).length;
  if (rightOnly / rightRows.length >= 0.4) return gutter;
  // Rows may line up across a sidebar layout; then a real column still carries a large share of the text,
  // unlike right-aligned dates in a one-column CV (~10 %).
  const chars = (list: TextItem[]) => list.reduce((n, i) => n + i.text.trim().length, 0);
  const total = chars(items);
  const right = chars(items.filter((i) => i.x + i.width / 2 >= gutter));
  return right / total >= 0.3 && (total - right) / total >= 0.12 ? gutter : null;
}

/** A later page of a two-column template often has too little text to detect the split on its own. */
function fitsGutter(items: TextItem[], gutter: number): boolean {
  let left = 0;
  let right = 0;
  let crossing = 0;
  for (const item of items) {
    if (item.x + item.width <= gutter) left += 1;
    else if (item.x >= gutter) right += 1;
    else crossing += 1;
  }
  return left >= 2 && right >= 2 && crossing <= Math.max(1, 0.03 * items.length);
}

/** Positioned items → reading-order lines; two-column pages are read left column first. */
export function itemsToLines(items: TextItem[]): { lines: Line[]; columns: number } {
  const pages = [...new Set(items.map((i) => i.page))].sort((a, b) => a - b);
  const lines: Line[] = [];
  let columns = 1;
  let previousGutter: number | null = null;
  for (const page of pages) {
    const pageItems = items.filter((i) => i.page === page && i.text.trim());
    const gutter: number | null =
      findGutter(pageItems) ?? (previousGutter !== null && fitsGutter(pageItems, previousGutter) ? previousGutter : null);
    previousGutter = gutter;
    const groups =
      gutter === null
        ? [pageItems]
        : [
            pageItems.filter((i) => i.x + i.width / 2 < gutter),
            pageItems.filter((i) => i.x + i.width / 2 >= gutter),
          ];
    if (gutter !== null) columns = 2;
    groups.forEach((group, column) => {
      for (const row of buildRows(group)) lines.push(rowToLine(row, page, column));
    });
  }
  return { lines: lines.filter((l) => l.text), columns };
}

/** Fills defaults for lines that come without layout data (DOCX HTML, plain text). */
export function normalizeLines(input: LineInput[]): Line[] {
  const sizes = input.map((l) => l.fontSize).filter((s): s is number => typeof s === 'number');
  const fallbackSize = median(sizes) || 11;
  return input
    .map((l, index) => {
      const text = collapseSpaces(l.text);
      return {
        text,
        page: l.page ?? 1,
        y: l.y ?? index,
        x: l.x ?? 0,
        fontSize: l.fontSize ?? fallbackSize,
        bold: l.bold ?? false,
        bullet: l.bullet ?? BULLET_RE.test(text),
        heading: l.heading ?? false,
        column: l.column ?? 0,
      };
    })
    .filter((l) => l.text);
}

export function textToLines(text: string): Line[] {
  return normalizeLines(text.split(/\r?\n/).map((t) => ({ text: t })));
}
