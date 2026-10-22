import type {
  CvInput,
  Line,
  ParseOptions,
  ParsedCv,
  ParsedSection,
  Scored,
  SectionKind,
  StructuredCv,
} from './types';
import { itemsToLines, normalizeLines, textToLines } from './layout';
import { htmlToLines } from './html';
import { splitSections, type Section } from './sections';
import { findEmail, findLinks, findLocation, findName, findPhone } from './contact';
import { parseEducation, parseExperience } from './entries';
import { extractLanguages, extractSkills } from './skills';
import { clamp01, stripBullet, words } from './normalize';

export const PARSER_VERSION = 1;

function toLines(input: CvInput): { lines: Line[]; columns: number } {
  switch (input.kind) {
    case 'items':
      return itemsToLines(input.items);
    case 'lines':
      return { lines: normalizeLines(input.lines), columns: 1 };
    case 'html':
      return { lines: normalizeLines(htmlToLines(input.html)), columns: 1 };
    case 'text':
      return { lines: textToLines(input.text), columns: 1 };
  }
}

function linesOf(sections: Section[], kind: SectionKind): Line[] {
  return sections.filter((s) => s.kind === kind).flatMap((s) => s.lines);
}

function average(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function summaryOf(sections: Section[], header: Line[]): Scored<string | null> {
  const section = sections.find((s) => s.kind === 'summary');
  if (section && section.lines.length > 0) {
    const text = section.lines.map((l) => stripBullet(l.text)).join(' ').slice(0, 2000);
    return { value: text, confidence: clamp01(section.confidence + 0.1), source: section.heading };
  }
  // No titled summary: a long paragraph in the header block is usually one.
  const paragraph = header.filter((l) => words(l.text).length >= 12);
  if (paragraph.length > 0) {
    const text = paragraph.map((l) => l.text).join(' ').slice(0, 2000);
    return { value: text, confidence: 0.5, source: paragraph[0].text };
  }
  return { value: null, confidence: 0, source: null };
}

/** Parses a CV with layout heuristics and dictionaries only (no AI). */
export function parseCv(input: CvInput, options: ParseOptions = {}): ParsedCv {
  const now = options.now ?? new Date();
  const { lines, columns } = toLines(input);
  const { header, sections } = splitSections(lines);
  const contactArea = header.length > 0 ? header : lines.slice(0, 8);

  // In sidebar layouts the name sits atop the main column, after the sidebar in reading order.
  const topOfPage = lines
    .filter((l) => l.page === lines[0]?.page)
    .sort((a, b) => a.y - b.y)
    .slice(0, 6);
  const nameArea = [...header.slice(0, 8), ...topOfPage.filter((l) => !header.includes(l))];
  const fullName = findName(nameArea, lines);
  const email = findEmail(contactArea).value ? findEmail(contactArea) : findEmail(lines);
  let phone = findPhone(contactArea, options.defaultCountry);
  if (!phone.value) phone = findPhone(lines, options.defaultCountry, false);
  const location = findLocation(contactArea);
  const links = findLinks(lines);

  const experience = parseExperience(linesOf(sections, 'experience'), now);
  const education = parseEducation(linesOf(sections, 'education'), now);
  const skillLines = linesOf(sections, 'skills');
  const otherLines = sections
    .filter((s) => !['skills', 'languages', 'references', 'interests', 'education'].includes(s.kind))
    .flatMap((s) => s.lines);
  const skills = extractSkills(skillLines, otherLines, options.extraSkills);
  const languages = extractLanguages(linesOf(sections, 'languages'));
  const certifications = linesOf(sections, 'certifications')
    .map((l) => stripBullet(l.text))
    .filter((t) => t.length >= 3)
    .slice(0, 20);
  const summary = summaryOf(sections, header);

  const hasSection = (kind: SectionKind) => sections.some((s) => s.kind === kind);
  const entryConfidence = (kind: SectionKind, entries: Array<{ confidence: number }>) =>
    entries.length > 0 ? clamp01(average(entries.map((e) => e.confidence))) : hasSection(kind) ? 0.2 : 0;

  const parsedSections: ParsedSection[] = sections.map((s) => ({
    kind: s.kind,
    heading: s.heading,
    text: s.lines.map((l) => l.text).join('\n').slice(0, 6000),
    confidence: s.confidence,
  }));

  return {
    version: PARSER_VERSION,
    contact: { fullName, email, phone, location, links },
    summary,
    education,
    experience,
    skills,
    languages,
    certifications,
    sections: parsedSections,
    confidence: {
      contact: clamp01(average([fullName.confidence, Math.max(email.confidence, phone.confidence)])),
      summary: summary.confidence,
      education: entryConfidence('education', education),
      experience: entryConfidence('experience', experience),
      skills: skills.length === 0 ? 0 : hasSection('skills') ? 0.9 : 0.6,
    },
    stats: {
      lines: lines.length,
      columns,
      characters: lines.reduce((n, l) => n + l.text.length, 0),
    },
  };
}

/** The legacy JSON shape read by job matching and career skills. */
export function toStructured(parsed: ParsedCv): StructuredCv {
  return {
    fullName: parsed.contact.fullName.value,
    summary: parsed.summary.value,
    skills: parsed.skills.map((s) => s.name),
    education: parsed.education.map(({ confidence: _c, source: _s, ...rest }) => rest),
    experience: parsed.experience.map(({ confidence: _c, source: _s, ...rest }) => rest),
  };
}
