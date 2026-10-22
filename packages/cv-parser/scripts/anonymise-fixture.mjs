// Turns a real CV PDF into an anonymised text-item fixture for the regression set (test/fixtures/real).
// Usage: node scripts/anonymise-fixture.mjs <cv.pdf> <out.json> <map.json>
//   map.json: {"Real Name": "Fake Name", ...} — keep it outside the repo; it contains the real values.
// Emails, URLs and phone numbers are replaced generically. Review the output before committing it.
import { readFileSync, writeFileSync } from 'node:fs';
import { getDocumentProxy } from 'unpdf';

const [input, output, mapFile] = process.argv.slice(2);
if (!input || !output || !mapFile) {
  console.error('usage: node scripts/anonymise-fixture.mjs <cv.pdf> <out.json> <map.json>');
  process.exit(1);
}
const map = Object.entries(JSON.parse(readFileSync(mapFile, 'utf8'))).sort((a, b) => b[0].length - a[0].length);

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function anonymise(text) {
  let out = text
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, 'jane.doe@example.com')
    .replace(/https?:\/\/\S+|(?:www\.)?linkedin\.com\/\S+/gi, 'https://example.com/profile')
    .replace(/\+?\d[\d ().-]{6,}\d/g, (m) => {
      // Year ranges ("2020 - 2023") look like phone numbers to the pattern above.
      if (/^(?:19|20)\d{2}\s*[-–]\s*(?:19|20)\d{2}$/.test(m.trim()) || m.replace(/\D/g, '').length < 8) return m;
      return m.startsWith('+') ? '+237 6 77 00 00 00' : '6 77 00 00 00';
    });
  for (const [from, to] of map) {
    out = out.replace(new RegExp(`(?<![\\p{L}])${escape(from)}(?![\\p{L}])`, 'giu'), (m) =>
      m === m.toUpperCase() && m !== m.toLowerCase() ? to.toUpperCase() : to,
    );
  }
  return out;
}

const pdf = await getDocumentProxy(new Uint8Array(readFileSync(input)));
const items = [];
for (let p = 1; p <= Math.min(pdf.numPages, 10); p += 1) {
  const page = await pdf.getPage(p);
  const { height } = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  await page.getOperatorList();
  const bold = new Set();
  for (const [name, style] of Object.entries(content.styles)) {
    let font;
    try {
      font = page.commonObjs.has(name) ? page.commonObjs.get(name) : undefined;
    } catch {
      font = undefined;
    }
    if (font?.bold || font?.black || /bold|black|heavy|semibold|demi/i.test(`${font?.name ?? ''} ${style.fontFamily ?? ''}`)) bold.add(name);
  }
  for (const it of content.items) {
    if (!it.str?.trim() || !it.transform) continue;
    const [a, b, c, d, e, f] = it.transform;
    const size = Math.hypot(c, d) || Math.hypot(a, b) || 10;
    const round = (n) => Math.round(n * 10) / 10;
    items.push({
      text: anonymise(it.str),
      x: round(e),
      y: round(height - f - size),
      width: round(it.width ?? it.str.length * size * 0.5),
      height: round(size),
      page: p,
      bold: bold.has(it.fontName),
    });
  }
}
writeFileSync(output, `${JSON.stringify({ source: 'real CV, anonymised', items }, null, 0).replace(/\},\{/g, '},\n{')}\n`);
console.log(`wrote ${items.length} items to ${output}`);
