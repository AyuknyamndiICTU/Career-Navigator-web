/* global Buffer */
import { parseCv } from '@career-navigator/cv-parser';
import { pdfToItems } from './cv-text-extractor.service';
import { tsvToItems } from './cv-server-ocr.service';

/** Builds a minimal one-page PDF with Helvetica (F1) and Helvetica-Bold (F2) text lines. */
function makePdf(
  lines: Array<{
    text: string;
    x: number;
    y: number;
    size: number;
    bold?: boolean;
  }>,
): Buffer {
  const esc = (s: string) => s.replace(/[\\()]/g, (c) => `\\${c}`);
  const stream = lines
    .map(
      (l) =>
        `BT /${l.bold ? 'F2' : 'F1'} ${l.size} Tf ${l.x} ${l.y} Td (${esc(l.text)}) Tj ET`,
    )
    .join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets
    .map((o) => `${String(o).padStart(10, '0')} 00000 n \n`)
    .join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

describe('CV extraction', () => {
  it('reads positioned, bold-aware items from a PDF and parses them', async () => {
    const buffer = makePdf([
      { text: 'Jane Doe', x: 50, y: 790, size: 20, bold: true },
      {
        text: 'jane.doe@example.com  +237 6 71 23 45 67',
        x: 50,
        y: 765,
        size: 10,
      },
      { text: 'EXPERIENCE', x: 50, y: 730, size: 13, bold: true },
      {
        text: 'Software Engineer, Acme Corp',
        x: 50,
        y: 712,
        size: 10,
        bold: true,
      },
      { text: 'Jan 2020 - Present', x: 450, y: 712, size: 10 },
      {
        text: 'Built payment APIs with Node.js and PostgreSQL.',
        x: 60,
        y: 698,
        size: 10,
      },
      { text: 'EDUCATION', x: 50, y: 665, size: 13, bold: true },
      {
        text: 'BSc Computer Science, University of Buea',
        x: 50,
        y: 647,
        size: 10,
        bold: true,
      },
      { text: '2015 - 2019', x: 450, y: 647, size: 10 },
      { text: 'SKILLS', x: 50, y: 615, size: 13, bold: true },
      {
        text: 'JavaScript, TypeScript, Docker, React',
        x: 50,
        y: 597,
        size: 10,
      },
    ]);

    const { items, pageTexts } = await pdfToItems(buffer);
    expect(pageTexts).toHaveLength(1);
    const name = items.find((i) => i.text === 'Jane Doe');
    expect(name?.bold).toBe(true);
    expect(name?.height).toBeCloseTo(20, 0);
    expect(items.find((i) => i.text.startsWith('jane.doe'))?.bold).toBe(false);
    // y grows downward
    expect(name!.y).toBeLessThan(items.find((i) => i.text === 'SKILLS')!.y);

    const cv = parseCv(
      { kind: 'items', items },
      { defaultCountry: 'CM', now: new Date('2026-10-01') },
    );
    expect(cv.contact.fullName.value).toBe('Jane Doe');
    expect(cv.contact.email.value).toBe('jane.doe@example.com');
    expect(cv.experience[0]).toMatchObject({
      jobTitle: 'Software Engineer',
      company: 'Acme Corp',
      startYear: 2020,
      isCurrent: true,
    });
    expect(cv.education[0]).toMatchObject({
      institution: 'University of Buea',
      startYear: 2015,
      endYear: 2019,
    });
    expect(cv.skills.map((s) => s.name)).toEqual(
      expect.arrayContaining(['JavaScript', 'TypeScript', 'Docker', 'React']),
    );
  });

  it('turns tesseract TSV into words, skipping low-confidence noise', () => {
    const tsv = [
      'level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext',
      '4\t1\t1\t1\t1\t0\t10\t10\t200\t20\t-1\t',
      '5\t1\t1\t1\t1\t1\t10\t10\t60\t20\t95.2\tJane',
      '5\t1\t1\t1\t1\t2\t80\t10\t60\t20\t12.0\t~~',
    ].join('\n');
    expect(tsvToItems(tsv, 2)).toEqual([
      { text: 'Jane', x: 10, y: 10, width: 60, height: 20, page: 2 },
    ]);
  });
});
