import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { personas } from './fixtures/personas.mjs';
import { renderItems } from './fixtures/render.mjs';

const require = createRequire(import.meta.url);
const P = require('../dist/index.js');
const NOW = new Date('2026-10-20T00:00:00Z');

describe('dates', () => {
  const cases = [
    ['Jan 2020 – Present', { startYear: 2020, endYear: null, isCurrent: true }],
    ['2019-2021', { startYear: 2019, endYear: 2021, isCurrent: false }],
    ['09/2018 à 06/2020', { startYear: 2018, endYear: 2020, isCurrent: false }],
    ["Septembre 2022 – Aujourd'hui", { startYear: 2022, endYear: null, isCurrent: true }],
    ['Févr. 2019 au Déc 2020', { startYear: 2019, endYear: 2020, isCurrent: false }],
    ['Depuis 2021', { startYear: 2021, endYear: null, isCurrent: true }],
    ['March 2017 to date', { startYear: 2017, endYear: null, isCurrent: true }],
    ['2015 – en cours', { startYear: 2015, endYear: null, isCurrent: true }],
    ['05/07/2021 - 18/09/2021', { startYear: 2021, endYear: 2021, isCurrent: false }],
    ['2022 - Till Present', { startYear: 2022, endYear: null, isCurrent: true }],
    ['2022 - Till', { startYear: 2022, endYear: null, isCurrent: true }],
    ['2012 TO 2017', { startYear: 2012, endYear: 2017, isCurrent: false }],
  ];
  for (const [text, expected] of cases) {
    it(text, () => {
      const r = P.findDateRange(text, NOW);
      assert.ok(r, 'a range is found');
      assert.equal(r.startYear, expected.startYear);
      assert.equal(r.endYear, expected.endYear);
      assert.equal(r.isCurrent, expected.isCurrent);
    });
  }
  it('treats a lone year as an end date and ignores implausible years', () => {
    assert.deepEqual(P.findDateRange('GCE A Level, 2014', NOW)?.endYear, 2014);
    assert.equal(P.findDateRange('Room 1234, building 7', NOW), null);
  });
});

describe('section headings', () => {
  it('keeps tight OCR boxes for "-" and "•" on their row and tolerates "Frangais"', () => {
    const word = (text, x, y, h = 14) => ({ text, x, y, width: text.length * 8, height: h, page: 1 });
    const items = [
      word('Amina', 50, 40, 24), word('Ngono', 130, 40, 24),
      word('EXPÉRIENCE', 50, 100, 16),
      word('Développeuse,', 50, 130), word('Orange', 170, 130), word('Cameroun', 230, 130),
      word('Janv.', 600, 130), word('2019', 645, 130), { text: '-', x: 685, y: 137, width: 5, height: 2, page: 1 },
      word('Déc.', 700, 130), word('2020', 740, 130),
      { text: '•', x: 70, y: 162, width: 5, height: 5, page: 1 }, word('Maintenance', 85, 158), word('des', 180, 158), word('applications', 215, 158), word('web', 315, 158), word('internes.', 350, 158),
      word('LANGUES', 50, 200, 16),
      word('Frangais,', 50, 230), word('Anglais', 130, 230),
    ];
    const cv = P.parseCv({ kind: 'items', items }, { now: NOW });
    assert.equal(cv.experience.length, 1);
    assert.deepEqual([cv.experience[0].company, cv.experience[0].startYear, cv.experience[0].endYear], ['Orange Cameroun', 2019, 2020]);
    assert.equal(cv.experience[0].description, 'Maintenance des applications web internes.');
    assert.deepEqual(cv.languages, ['French', 'English']);
  });

  it('keeps an unbulleted description line full of tech names out of the header (no fake location)', () => {
    const cv = P.parseCv(
      {
        kind: 'lines',
        lines: [
          { text: 'Jane Doe', fontSize: 20, bold: true },
          { text: 'EXPERIENCE', fontSize: 13, bold: true },
          { text: 'Software Engineer, Acme Corp   Jan 2020 - Present', bold: true },
          { text: 'Built payment APIs with Node.js and PostgreSQL.' },
        ],
      },
      { now: NOW },
    );
    assert.equal(cv.experience.length, 1);
    assert.equal(cv.experience[0].location, null);
    assert.equal(cv.experience[0].description, 'Built payment APIs with Node.js and PostgreSQL.');
  });
  it('matches English and French headings, accents and case insensitive', () => {
    assert.equal(P.matchHeading('WORK EXPERIENCE')?.kind, 'experience');
    assert.equal(P.matchHeading('Expérience professionnelle :')?.kind, 'experience');
    assert.equal(P.matchHeading('Études')?.kind, 'education');
    assert.equal(P.matchHeading('Compétences')?.kind, 'skills');
    assert.equal(P.matchHeading("Centres d'intérêt")?.kind, 'interests');
  });
  it('tolerates OCR typos but not unrelated words', () => {
    assert.equal(P.matchHeading('EXPERIENCF')?.kind, 'experience');
    assert.equal(P.matchHeading('Acme Corporation'), null);
  });
});

describe('DOCX HTML', () => {
  it('keeps headings, bold lines and list items', () => {
    const lines = P.htmlToLines('<h2>Skills</h2><p><strong>Engineer</strong></p><ul><li>Built &amp; shipped</li></ul>');
    assert.deepEqual(lines.map((l) => [l.text, l.heading, l.bold, l.bullet]), [
      ['Skills', true, false, false],
      ['Engineer', false, true, false],
      ['Built & shipped', false, false, true],
    ]);
  });
});

describe('layout', () => {
  it('does not split a one-column CV with right-aligned dates into two columns', () => {
    const items = renderItems(personas[0], 0);
    assert.equal(P.itemsToLines(items).columns, 1);
  });
});

describe('skills', () => {
  it('splits lists, drops levels and maps aliases', () => {
    assert.deepEqual(P.skillTokens('Languages: JS (advanced), Node / C++ | CI/CD'), ['JS', 'Node', 'C++', 'CI/CD']);
    const skills = P.parseCv({ kind: 'text', text: 'SKILLS\nJS, Node, Travail en équipe, Javascipt' }, { now: NOW }).skills.map((s) => s.name);
    assert.deepEqual(skills, ['JavaScript', 'Node.js', 'Teamwork']);
  });
  it('matches ambiguous words such as Go or Excel only inside a skills section', () => {
    const parsed = P.parseCv({ kind: 'text', text: 'SUMMARY\nI excel at teamwork and like to go fast.\nSKILLS\nGo, Excel' }, { now: NOW });
    assert.deepEqual(parsed.skills.map((s) => [s.name, s.confidence]), [['Go', 0.95], ['Microsoft Excel', 0.95]]);
  });
});

describe('OCR input validation', () => {
  it('accepts well-formed words and strips control characters', () => {
    const items = P.validateOcrWords([{ text: 'Jane\u0007', x: 1, y: 2, width: 30, height: 12, page: 1 }]);
    assert.deepEqual(items, [{ text: 'Jane', x: 1, y: 2, width: 30, height: 12, page: 1 }]);
  });
  it('rejects malformed or oversized payloads', () => {
    assert.equal(P.validateOcrWords('not an array'), null);
    assert.equal(P.validateOcrWords([{ text: 'x', x: 'a', y: 0, width: 1, height: 1, page: 1 }]), null);
    assert.equal(P.validateOcrWords([{ text: 'x', x: 0, y: 0, width: 1, height: 1, page: 99 }]), null);
    assert.equal(P.validateOcrWords(Array.from({ length: P.OCR_LIMITS.maxWords + 1 }, () => ({ text: 'x', x: 0, y: 0, width: 1, height: 1, page: 1 }))), null);
  });
  it('detects a missing text layer', () => {
    assert.equal(P.hasTextLayer(['', '  ']), false);
    assert.equal(P.hasTextLayer(['Experience '.repeat(20)]), true);
  });
});

describe('structured output', () => {
  it('keeps the legacy shape used by job matching', () => {
    const parsed = P.parseCv({ kind: 'text', text: 'Jane Doe\nSKILLS\nPython, SQL' }, { now: NOW });
    const structured = P.toStructured(parsed);
    assert.deepEqual(Object.keys(structured).sort(), ['education', 'experience', 'fullName', 'skills', 'summary']);
    assert.deepEqual(structured.skills, ['Python', 'SQL']);
  });
});

describe('accuracy set (16.9)', () => {
  it('meets the field-level targets', () => {
    const script = fileURLToPath(new URL('./accuracy.mjs', import.meta.url));
    // Throws (failing the test) when a target is missed; the report is printed either way.
    const out = execFileSync(process.execPath, [script], { encoding: 'utf8' });
    assert.match(out, /contact .* ok/);
  });
});
