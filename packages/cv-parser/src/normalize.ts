/** NFC first so removing combining marks keeps string length (indexes stay valid on the original). */
export function stripAccents(value: string): string {
  return value
    .normalize('NFC')
    .replace(/[\u00C0-\u024F]/g, (ch) => ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '').slice(0, 1) || ch);
}

/** Lowercase, accent-free, single-spaced; keeps characters that matter in skill names (+ # .). */
export function normKey(value: string): string {
  return stripAccents(value)
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/[^a-z0-9+#.']+/g, ' ')
    .replace(/(^|\s)[.']+|[.']+(?=\s|$)/g, '$1')
    .trim();
}

export function collapseSpaces(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function words(value: string): string[] {
  return collapseSpaces(value).split(' ').filter(Boolean);
}

/** Edit distance, stopping early once it exceeds `max`. */
export function levenshtein(a: string, b: string, max = Infinity): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

// The last alternative covers OCR misreading a bullet glyph as "e", "o", "°", "«" or "+".
export const BULLET_RE =
  /^\s*(?:[•●▪■◦○◆◇►▸‣⁃∙·➢✓✔→]\s*|[*–—-]\s+|\(?\d{1,2}[.)]\s+|[eo°«»+]\s+(?=\p{Lu}))/u;

export function stripBullet(value: string): string {
  return value.replace(BULLET_RE, '').trim();
}

export function isAllCaps(value: string): boolean {
  const letters = value.replace(/[^\p{L}]/gu, '');
  return letters.length >= 2 && letters === letters.toUpperCase() && letters !== letters.toLowerCase();
}

export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/(^|[\s'-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Math.round(value * 100) / 100));
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
