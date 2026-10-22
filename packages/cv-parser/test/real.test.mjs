// Regression set from real CVs (anonymised layouts: positions, sizes and bold kept; personal data replaced).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const P = require('../dist/index.js');
const NOW = new Date('2026-10-20T00:00:00Z');

function parse(name) {
  const { items } = JSON.parse(readFileSync(new URL(`./fixtures/real/${name}.json`, import.meta.url), 'utf8'));
  return P.parseCv({ kind: 'items', items }, { defaultCountry: 'CM', now: NOW });
}

const pick = (list, keys) => list.map((e) => Object.fromEntries(keys.map((k) => [k, e[k]])));
const skillNames = (cv) => cv.skills.map((s) => s.name);

describe('real CV: one column, organisation first, three pages', () => {
  const cv = parse('en-1col-3page');

  it('reads the contact block', () => {
    assert.equal(cv.contact.fullName.value, 'Ngono Amina Mbarga');
    assert.equal(cv.contact.email.value, 'jane.doe@example.com');
    assert.equal(cv.contact.phone.value, '+237 6 77 00 00 00');
  });

  it('puts organisation and role the right way round and reads dd/mm/yyyy and "Till Present"', () => {
    assert.deepEqual(pick(cv.experience, ['jobTitle', 'company', 'startYear', 'endYear', 'isCurrent']), [
      { jobTitle: 'IT Security Technician', company: 'Hotel des Arts', startYear: 2020, endYear: 2023, isCurrent: false },
      { jobTitle: 'Software Engineer (Intern-Full Time)', company: 'BETA ENGINEERING S.A.R.L', startYear: 2021, endYear: 2021, isCurrent: false },
      { jobTitle: 'Secrétariat', company: 'GCE Catchment Center', startYear: 2021, endYear: 2024, isCurrent: false },
      { jobTitle: 'Software Engineer', company: 'KORA SOFT', startYear: 2021, endYear: 2022, isCurrent: false },
      { jobTitle: 'Software Engineer', company: 'NOVA TECH FORALL', startYear: 2022, endYear: null, isCurrent: true },
      { jobTitle: 'Head of Logistics Manager and IT Specialist', company: 'Green Leaf Association', startYear: 2022, endYear: null, isCurrent: true },
    ]);
    assert.match(cv.experience[3].description, /python and\s+Django\.$/, 'a wrapped last word stays in the description');
  });

  it('reads institution-first education with grades on their own line', () => {
    assert.deepEqual(pick(cv.education, ['degree', 'fieldOfStudy', 'institution', 'startYear', 'endYear', 'grade']), [
      { degree: null, fieldOfStudy: 'Science', institution: 'MOUNT HOPE COLLEGE LIMBE', startYear: 2012, endYear: 2017, grade: '17/20' },
      { degree: 'GCE Ordinary and Advanced level', fieldOfStudy: null, institution: 'Saint Luc Bilingual International College', startYear: 2018, endYear: 2020, grade: "6 A's and 5 B's" },
      { degree: null, fieldOfStudy: 'Software Engineering', institution: 'ESTEC Higher Institute of Technology and Management', startYear: 2020, endYear: 2021, grade: '3.14GPA' },
      { degree: null, fieldOfStudy: 'Software Engineering', institution: 'Atlantic University', startYear: 2023, endYear: 2026, grade: '3.51 GPA' },
    ]);
  });

  it('drops self-ratings ("7/10") from skills', () => {
    for (const name of ['Microsoft Word', 'Microsoft Excel', 'Microsoft PowerPoint', 'Python', 'Django', 'React', 'Problem Solving']) {
      assert.ok(skillNames(cv).includes(name), name);
    }
    assert.ok(skillNames(cv).every((s) => !/\d/.test(s)), skillNames(cv).join(', '));
  });
});

describe('real CV: two-column template with a narrow, wrapping date column', () => {
  const cv = parse('en-2col-sidebar');

  it('joins a name that wraps onto two lines and finds the city', () => {
    assert.equal(cv.contact.fullName.value, 'Ngono Amina Mbarga Clarisse');
    assert.match(cv.contact.location.value ?? '', /Yaoundé, Cameroon/);
  });

  it('rebuilds dates split across lines ("2022 -" / "Till", "2012 to" / "2016")', () => {
    assert.deepEqual(pick(cv.experience, ['jobTitle', 'company', 'startYear', 'isCurrent']), [
      { jobTitle: 'Software Engineering', company: 'NOVA TECH FORALL', startYear: 2022, isCurrent: true },
      { jobTitle: 'Intern as a Software engineer', company: 'BETA ENGINEERING', startYear: null, isCurrent: false },
      { jobTitle: 'Secrétariat', company: 'GCE Catchment Center', startYear: null, isCurrent: false },
    ]);
    assert.deepEqual(pick(cv.education, ['fieldOfStudy', 'institution', 'startYear', 'endYear', 'grade']), [
      { fieldOfStudy: 'Science', institution: 'Mount Hope College Limbe', startYear: 2012, endYear: 2016, grade: '4.3/ 5.0' },
      { fieldOfStudy: 'Science', institution: 'Saint Luc Bilingual International College', startYear: 2017, endYear: 2020, grade: '4.2/ 5.0' },
      { fieldOfStudy: 'Software Engineering', institution: 'ESTEC Higher Institute of Technology and Management', startYear: 2020, endYear: 2022, grade: '3.25/ 5.0' },
    ]);
  });

  it('splits a wrapped list of run-together names and strips percentages', () => {
    for (const name of ['Microsoft Word', 'Microsoft Excel', 'Microsoft Access', 'Microsoft PowerPoint', 'C', 'C++', 'HTML']) {
      assert.ok(skillNames(cv).includes(name), name);
    }
    assert.ok(skillNames(cv).every((s) => !/%|\d/.test(s)), skillNames(cv).join(', '));
  });
});

describe('real CV: short one-column layout', () => {
  const cv = parse('en-1col-short');

  it('reads the references heading so referees are not skills', () => {
    assert.ok(cv.sections.some((s) => s.kind === 'references'));
    assert.deepEqual(
      skillNames(cv).filter((s) => s !== 'PQt').sort(),
      ['C', 'C++', 'CSS', 'Django', 'HTML', 'Java', 'Microsoft Access', 'Microsoft Excel', 'Microsoft PowerPoint', 'Microsoft Word', 'PHP', 'Python'],
    );
  });

  it('separates degree and field ("HND in Software Engineering")', () => {
    assert.deepEqual(pick(cv.education, ['degree', 'fieldOfStudy', 'endYear']).slice(1), [
      { degree: 'GCE Ordinary Level', fieldOfStudy: null, endYear: 2020 },
      { degree: 'HND', fieldOfStudy: 'Software Engineering', endYear: 2021 },
      { degree: 'Degree', fieldOfStudy: 'Software Engineering', endYear: 2023 },
    ]);
  });
});

describe('real CV: one column with projects', () => {
  const cv = parse('en-1col-projects');

  it('keeps every experience entry with its company', () => {
    assert.equal(cv.experience.length, 5);
    assert.ok(cv.experience.every((e) => e.company && e.jobTitle && e.startYear));
  });

  it('stays confident enough that the review screen only flags real doubts', () => {
    assert.ok(cv.confidence.experience >= 0.85, String(cv.confidence.experience));
    assert.ok(cv.confidence.education >= 0.8, String(cv.confidence.education));
  });
});

describe('ESCO skills', () => {
  it('recognises ESCO ICT names (and French labels) inside a skills section only', () => {
    const lines = [{ text: 'SKILLS', bold: true }, { text: 'Joomla, SAP R3, ABAP' }];
    const cv = P.parseCv({ kind: 'lines', lines: [{ text: 'Jane Doe', fontSize: 20 }, ...lines] }, { now: NOW });
    const joomla = cv.skills.find((s) => s.name === 'Joomla');
    assert.ok(joomla && joomla.confidence >= 0.9, JSON.stringify(cv.skills));
    const prose = P.parseCv(
      { kind: 'lines', lines: [{ text: 'Jane Doe', fontSize: 20 }, { text: 'EXPERIENCE', bold: true }, { text: 'I used Joomla daily.' }] },
      { now: NOW },
    );
    assert.ok(!prose.skills.some((s) => s.name === 'Joomla'));
  });
});
