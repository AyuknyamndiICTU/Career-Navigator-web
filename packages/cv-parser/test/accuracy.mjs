// Field-level precision/recall over the synthetic accuracy set (16.9).
// Usage: npm run accuracy -w @career-navigator/cv-parser   (exits 1 when a target is missed)
import { createRequire } from 'node:module';
import { personas } from './fixtures/personas.mjs';
import { RENDERERS } from './fixtures/render.mjs';

const require = createRequire(import.meta.url);
const { parseCv } = require('../dist/index.js');

const NOW = new Date('2026-10-20T00:00:00Z');
const TARGETS = { contact: 0.95, education: 0.85, experience: 0.85, skills: 0.8 };
const VARIANTS = [0, 1, 2];

const norm = (s) =>
  (s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9+#/.' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const digits = (s) => (s ?? '').replace(/\D/g, '');
const close = (a, b) => {
  const x = norm(a);
  const y = norm(b);
  return Boolean(x && y && (x === y || x.includes(y) || y.includes(x)));
};

function score() {
  return { tp: 0, fp: 0, fn: 0 };
}
const totals = { contact: score(), education: score(), experience: score(), skills: score() };
const failures = [];

function countSet(bucket, expected, predicted, matches, label, acceptExtra = () => false) {
  const used = new Set();
  for (const exp of expected) {
    const idx = predicted.findIndex((pred, i) => !used.has(i) && matches(exp, pred));
    if (idx >= 0) {
      used.add(idx);
      bucket.tp += 1;
    } else {
      bucket.fn += 1;
      failures.push(`${label} missed: ${JSON.stringify(exp)}`);
    }
  }
  predicted.forEach((pred, i) => {
    if (used.has(i) || acceptExtra(pred)) return;
    bucket.fp += 1;
    failures.push(`${label} extra: ${JSON.stringify(pred)}`);
  });
}

let cases = 0;
for (const persona of personas) {
  for (const [format, render] of Object.entries(RENDERERS)) {
    for (const variant of VARIANTS) {
      cases += 1;
      const label = `${persona.id}/${format}/v${variant}`;
      const parsed = parseCv(render(persona, variant), { now: NOW, defaultCountry: 'CM' });

      // Contact: name, email and phone, each either right or wrong.
      const c = parsed.contact;
      const contact = [
        ['name', close(c.fullName.value, persona.name) && norm(c.fullName.value).split(' ').length === norm(persona.name).split(' ').length, c.fullName.value],
        ['email', c.email.value === persona.email.toLowerCase(), c.email.value],
        ['phone', digits(c.phone.value).endsWith(digits(persona.phone).slice(-8)), c.phone.value],
      ];
      for (const [field, ok, got] of contact) {
        if (ok) totals.contact.tp += 1;
        else {
          totals.contact.fn += 1;
          if (got) totals.contact.fp += 1;
          failures.push(`${label} contact.${field}: got ${JSON.stringify(got)}`);
        }
      }

      countSet(
        totals.experience,
        persona.experience,
        parsed.experience,
        (e, p) => close(p.jobTitle, e.title) && close(p.company, e.company) && p.startYear === e.startYear && p.isCurrent === e.current,
        `${label} experience`,
      );
      countSet(
        totals.education,
        persona.education,
        parsed.education,
        (e, p) => close(p.degree, e.degree) && close(p.institution, e.institution) && p.endYear === e.endYear,
        `${label} education`,
      );
      // A skill found in the job bullets or summary is correct when the CV really names it there.
      const prose = ` ${norm([persona.summary, ...persona.experience.flatMap((e) => e.bullets)].join(' ').replace(/[.,;:!?](?=\s|$)/g, ' '))} `;
      countSet(
        totals.skills,
        persona.skills,
        parsed.skills.filter((s) => s.confidence >= 0.6),
        (expected, got) => norm(got.name) === norm(expected),
        `${label} skills`,
        (got) => got.confidence <= 0.7 && prose.includes(` ${norm(got.name)} `),
      );
    }
  }
}

const pct = (n) => `${(n * 100).toFixed(1)}%`;
let failed = false;
console.log(`CV parser accuracy — ${cases} cases (${personas.length} personas × ${Object.keys(RENDERERS).length} formats × ${VARIANTS.length} layouts)\n`);
console.log('field        precision  recall   target');
for (const [field, s] of Object.entries(totals)) {
  const precision = s.tp / Math.max(1, s.tp + s.fp);
  const recall = s.tp / Math.max(1, s.tp + s.fn);
  const ok = precision >= TARGETS[field] && recall >= TARGETS[field];
  if (!ok) failed = true;
  console.log(`${field.padEnd(12)} ${pct(precision).padStart(9)}  ${pct(recall).padStart(7)}   ${pct(TARGETS[field])} ${ok ? 'ok' : 'BELOW TARGET'}`);
}
if (process.argv.includes('--details') || failed) {
  console.log(`\n${failures.length} mismatches${failures.length > 40 ? ' (first 40)' : ''}:`);
  for (const line of failures.slice(0, 40)) console.log('  ' + line);
}
process.exitCode = failed ? 1 : 0;
