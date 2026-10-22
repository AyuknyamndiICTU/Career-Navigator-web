import type { LineInput } from './types';
import { collapseSpaces } from './normalize';

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  bull: '•',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  hellip: '…',
};

export function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : '';
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

const LINE_TAGS = new Set(['p', 'li', 'td', 'th', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div', 'tr', 'ul', 'ol', 'table', 'br', 'blockquote']);
const BOLD_TAGS = new Set(['strong', 'b']);

/**
 * Converts mammoth's HTML (headings, paragraphs, lists, tables, bold) into lines.
 * A tiny tokenizer instead of a DOM, so it runs the same in Node and the browser.
 */
export function htmlToLines(html: string): LineInput[] {
  const lines: LineInput[] = [];
  let text = '';
  let chars = 0;
  let boldChars = 0;
  let boldDepth = 0;
  let blockTag = '';

  const flush = () => {
    const clean = collapseSpaces(text);
    if (clean) {
      lines.push({
        text: clean,
        bold: chars > 0 && boldChars / chars >= 0.8,
        heading: /^h[1-6]$/.test(blockTag),
        bullet: blockTag === 'li',
      });
    }
    text = '';
    chars = 0;
    boldChars = 0;
  };

  for (const token of html.replace(/<!--[\s\S]*?-->/g, '').split(/(<[^>]*>)/)) {
    if (!token) continue;
    if (token.startsWith('<')) {
      const match = /^<\s*(\/)?\s*([a-z0-9]+)/i.exec(token);
      if (!match) continue;
      const closing = Boolean(match[1]);
      const name = match[2].toLowerCase();
      if (BOLD_TAGS.has(name)) {
        boldDepth = Math.max(0, boldDepth + (closing ? -1 : 1));
      } else if (LINE_TAGS.has(name)) {
        flush();
        if (name !== 'br') blockTag = closing ? '' : name;
      }
      continue;
    }
    const decoded = decodeEntities(token);
    text += decoded;
    const len = decoded.replace(/\s/g, '').length;
    chars += len;
    if (boldDepth > 0) boldChars += len;
  }
  flush();
  return lines;
}
