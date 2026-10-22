import type { Line, ParsedEducation, ParsedExperience } from './types';
import { findDateRange, withoutDate, type DateRange } from './dates';
import { clamp01, normKey, stripBullet, words } from './normalize';

type Group = { header: Line[]; body: Line[]; date: DateRange | null };

export const TITLE_RE =
  /\b(engineer|developer|programmer|manager|intern|internship|trainee|apprentice|analyst|designer|consultant|assistant|associate|lead|head|director|officer|specialist|coordinator|administrator|architect|scientist|researcher|technician|teacher|lecturer|tutor|instructor|accountant|auditor|nurse|doctor|pharmacist|sales|marketer|representative|agent|advisor|adviser|supervisor|executive|founder|co-founder|ceo|cto|cfo|owner|freelance|freelancer|volunteer|secretary|clerk|cashier|operator|editor|writer|journalist|translator|attendant|stagiaire|stage|ingenieur|developpeur|chef|responsable|charge|chargee|directeur|directrice|gestionnaire|technicien|technicienne|enseignant|enseignante|professeur|comptable|commercial|commerciale|conseiller|conseillere|assistante|benevole|alternant|alternante)\b/;
const COMPANY_RE =
  /\b(inc|ltd|llc|plc|gmbh|sarl|s a r l|sa|s a|sas|corp|corporation|company|co|group|groupe|bank|banque|agency|agence|technologies|technology|tech|solutions|systems|services|consulting|labs?|studio|university|universite|ministry|ministere|hospital|hopital|clinic|clinique|school|ecole|ngo|ong|foundation|fondation|association|institute|institut|enterprises?|entreprise|holdings?|industries|international|limited|cooperative|council|county|organisation|organization|center|centre|soft|engineering|forall)\b/;
const DEGREE_RE =
  /\b(ph\.?\s?d|doctorat|doctorate|m\.?\s?sc|m\.?\s?eng|mba|master'?s?|mastere|m\.?a\b|m\.?s\b|b\.?\s?sc|b\.?\s?eng|b\.?\s?tech|b\.?a\b|b\.?s\b|bachelor'?s?|licence|license|hnd|higher national diploma|bts|dut|dts|deug|deust|ingenieur|engineering degree|degree|diploma|diplome|baccalaureat|bac|gce|(?:ordinary|advanced) levels?|[ao]\s*levels?|associate degree|certificate|certificat|bepc|probatoire|cap)\b/;
const INSTITUTION_RE =
  /\b(university|universite|universidad|college|school|ecole|institute|institut|polytechnic|polytechnique|academy|academie|faculty|faculte|lycee|high school|college|campus|iut|enset|ensp|esstic|iuc|school of)\b/;
const GRADE_RE =
  /\b(?:c?gpa|moyenne|mention|grade)\s*[:：]?\s*([\w.,/ ]{1,20}?)(?=$|[|,;)])|\b(first class(?: honou?rs)?|second class (?:upper|lower)(?: division)?|upper second|lower second|with distinction|distinction|merit|cum laude|magna cum laude|summa cum laude)\b/i;
/** A line that is only a grade: "17/20", "4.3/ 5.0", "3.14 GPA", "GPA: 3.5", "6 A's and 5 B's". */
const GRADE_LINE_RE =
  /^(?:\d{1,3}(?:[.,]\d{1,2})?\s*\/\s*\d{1,3}(?:[.,]\d{1,2})?|\d(?:[.,]\d{1,2})?\s*c?gpa|c?gpa\s*[:：]?\s*\d(?:[.,]\d{1,2})?(?:\s*\/\s*\d(?:[.,]\d)?)?|(?:\d{1,2}\s*[a-f]\*?(?:'?s)?(?:\s*(?:,|and|et|&)\s*)?){1,6}|(?:mention\s+)?(?:tres bien|bien|assez bien|passable))$/i;
const LOCATION_HINT_RE = /\b(remote|teletravail|hybrid|hybride)\b/;
const SPLIT_RE = /\s+[|•·]\s+|\s+[–—-]\s+|\s{3,}|\s+@\s+|\s+(?:at|chez|with)\s+(?=\p{Lu})/u;

/** Prose ("Built internal tools with React for the sales team") even when OCR lost its bullet. */
function sentenceLike(text: string, now: Date): boolean {
  const list = words(text);
  if (list.length < 5 || findDateRange(text, now)) return false;
  // Headers rarely end with a full stop; prose full of capitalised tech names often does.
  if (/[\p{L}\d)]\.$/u.test(text.trim()) && !/\b(?:inc|ltd|corp|co|s\.?a)\.$/i.test(text.trim())) return true;
  const lower = list.filter((w) => /^[\p{Ll}]/u.test(w)).length;
  return lower / list.length >= 0.5;
}

function shortHeaderLine(line: Line, now: Date): boolean {
  if (line.bullet || words(line.text).length > 14) return false;
  // "Intern as a Software engineer" reads like prose but is a role.
  const roleLike = TITLE_RE.test(normKey(line.text)) && words(line.text).length <= 7 && !/[.!?]$/.test(line.text.trim());
  return roleLike || !sentenceLike(line.text, now);
}

const GAP = /\s{3,}/;
/** Pieces of a date that a narrow date column wrapped onto the next lines ("Till", "present", "- 2021"). */
const DATE_FRAGMENT_RE = new RegExp(
  `^(?:-+|–|—|to|a|au|until|till|jusqu'?\\s?(?:a|au|en)?|present|current|now|today|date|aujourd'?\\s?hui|a ce jour|en cours|(?:\\d{1,2}\\s*[/.]\\s*){0,2}\\d{3,4}|[a-z]{3,9}\\.?\\s+\\d{4})(?:\\s+(?:-+|–|to|a|au|till|until|present|now|\\d{4}))*$`,
  'i',
);

function dateComplete(text: string, now: Date): boolean {
  const range = findDateRange(text, now);
  return Boolean(range && !range.single);
}

/**
 * Narrow right-aligned date columns wrap: "Acme   2022 -" / "Engineer   Till" / "present".
 * Moves such fragments back onto the line that opened the date.
 */
export function joinWrappedDates(lines: Line[], now: Date): Line[] {
  const out = lines.map((l) => ({ ...l }));
  for (let i = 0; i < out.length; i += 1) {
    const open = out[i];
    const tail = open.text.split(GAP).pop() ?? '';
    if (
      dateComplete(open.text, now) || !findDateRange(tail, now) ||
      !/(?:-|–|—|\bto|\ba|\bau|\btill|\buntil)\s*$/i.test(tail)
    ) continue;
    let date = tail;
    for (let j = i + 1; j < Math.min(out.length, i + 4) && !dateComplete(date, now); j += 1) {
      const parts = out[j].text.split(GAP);
      const fragment = parts.length > 1 ? parts[parts.length - 1] : out[j].text;
      if (!DATE_FRAGMENT_RE.test(stripAccentsLower(fragment.trim()))) break;
      date = `${date} ${fragment.trim()}`;
      out[j] = { ...out[j], text: parts.length > 1 ? parts.slice(0, -1).join('   ') : '' };
    }
    out[i] = { ...open, text: `${open.text.slice(0, open.text.length - tail.length)}${date}` };
  }
  // Separators left behind by the wrap ("Engineer   -").
  return out
    .map((l) => ({ ...l, text: l.text.replace(/\s{3,}[-–—]+\s*$/, '').replace(/^[-–—]+$/, '') }))
    .filter((l) => l.text.trim());
}

const DANGLING_END_RE = /(?:\b(?:and|or|with|of|the|to|in|for|on|by|using|as|a|an|et|ou|de|des|du|la|le|les|avec|pour|en|dans|sur|par)|[,;:–-])$/i;

/**
 * Splits a section into entries. Two layouts are handled: dates that open each entry
 * ("2019 – 2021" then title lines), and dates inside or after the title lines.
 */
export function groupEntries(input: Line[], now: Date): Group[] {
  const lines = joinWrappedDates(input, now);
  const firstHeader = lines.find((l) => shortHeaderLine(l, now));
  const dateFirst = Boolean(firstHeader && findDateRange(firstHeader.text, now) && words(withoutDate(firstHeader.text, findDateRange(firstHeader.text, now))).length <= 1);
  const groups: Group[] = [];
  let cur: Group | null = null;
  let previous: Line | null = null;

  for (const line of lines) {
    const date = findDateRange(line.text, now);
    if (!cur) {
      cur = { header: [], body: [], date: null };
      groups.push(cur);
    }
    // A wrapped bullet continues on an unbulleted line: lowercase start or indented under the bullet text.
    const lastBody = cur.body[cur.body.length - 1];
    const lastText = lastBody?.text.trim() ?? '';
    if (
      lastBody && previous === lastBody && !line.bullet && !date &&
      (/^[\p{Ll}(&,;]/u.test(line.text) ||
        (line.x > lastBody.x + 4 && !line.bold) ||
        // Prose cut mid-sentence ("… using python and" / "Django.").
        DANGLING_END_RE.test(lastText) ||
        (!/[.!?:;]$/.test(lastText) && /[.!?]$/.test(line.text.trim()) && words(line.text).length <= 6))
    ) {
      cur.body[cur.body.length - 1] = { ...lastBody, text: `${lastBody.text} ${line.text}` };
      previous = cur.body[cur.body.length - 1];
      continue;
    }
    previous = line;
    if (!shortHeaderLine(line, now)) {
      cur.body.push(line);
      continue;
    }
    const startNew =
      cur.header.length > 0 &&
      (cur.body.length > 0 ||
        (dateFirst && date !== null && cur.date !== null) ||
        (!dateFirst && cur.date !== null && date === null && cur.header.length >= 2 && lastLineHadDate(cur, now)) ||
        (date !== null && cur.date !== null) ||
        cur.header.length >= 4);
    if (startNew) {
      cur = { header: [], body: [], date: null };
      groups.push(cur);
    }
    cur.header.push(line);
    if (date && !cur.date) cur.date = date;
  }

  // A lone short line after a dated entry (e.g. its location) belongs to the previous entry.
  const merged: Group[] = [];
  for (const group of groups) {
    const prev = merged[merged.length - 1];
    if (prev && !group.date && group.body.length === 0 && group.header.length === 1 && words(group.header[0].text).length <= 4 && prev.header.length < 5) {
      prev.header.push(group.header[0]);
    } else {
      merged.push(group);
    }
  }
  return merged.filter((g) => g.header.length > 0 || g.body.length > 0);
}

function lastLineHadDate(group: Group, now: Date): boolean {
  const last = group.header[group.header.length - 1];
  return Boolean(last && findDateRange(last.text, now));
}

/** Header lines without the date, split on separators ("Engineer | Acme", "Engineer at Acme", "Acme, Douala"). */
function headerParts(group: Group, now: Date): string[] {
  return headerLineParts(group, now).flat();
}

/** The same parts, kept per header line. */
function headerLineParts(group: Group, now: Date): string[][] {
  const clean = (part: string) => part.replace(/^[\s,;:|–—-]+|[\s,;:|–—-]+$/g, '').trim();
  return group.header
    .map((line) => {
      const parts = withoutDate(line.text, findDateRange(line.text, now)).split(SPLIT_RE).map(clean).filter(Boolean);
      // "Acme Corp, Douala, Cameroon": the first comma separates the name from the place.
      if (parts.length === 1 && /,\s+\p{Lu}/u.test(parts[0])) {
        const at = parts[0].indexOf(',');
        return [parts[0].slice(0, at), parts[0].slice(at + 1)].map(clean);
      }
      return parts;
    })
    .map((parts) => parts.filter((part) => part.length > 1 && /\p{L}/u.test(part)))
    .filter((parts) => parts.length > 0);
}

/** Index (in the flat parts) of the first part of the first two header lines, or of the first two parts. */
function leadIndexes(group: Group, now: Date): [number, number] | null {
  const byLine = headerLineParts(group, now);
  if (byLine.length >= 2) return [0, byLine[0].length];
  return byLine[0]?.length >= 2 ? [0, 1] : null;
}

function description(group: Group): string | null {
  const text = group.body.map((l) => stripBullet(l.text)).filter(Boolean).join('\n');
  return text ? text.slice(0, 4000) : null;
}

function sourceOf(group: Group): string {
  return [...group.header, ...group.body.slice(0, 2)].map((l) => l.text).join(' / ').slice(0, 300);
}

type Orientation = 'orgFirst' | 'roleFirst' | null;

/**
 * Whether this CV puts the organisation or the role on the first header line, decided by the entries
 * whose two lines are clear, then applied to ambiguous ones ("GCE Catchment Center" / "Secrétariat").
 */
function orientation(groups: Group[], now: Date, roleRe: RegExp, orgRe: RegExp): Orientation {
  let org = 0;
  let role = 0;
  for (const group of groups) {
    const parts = headerParts(group, now);
    const lead = leadIndexes(group, now);
    if (!lead) continue;
    const [a, b] = [normKey(parts[lead[0]]), normKey(parts[lead[1]])];
    const aRole = roleRe.test(a);
    const bRole = roleRe.test(b);
    const aOrg = orgRe.test(a);
    const bOrg = orgRe.test(b);
    if ((aOrg && !bOrg) || (bRole && !aRole)) org += 1;
    if ((aRole && !bRole) || (bOrg && !aOrg)) role += 1;
  }
  return org > role ? 'orgFirst' : role > org ? 'roleFirst' : null;
}

export function parseExperience(lines: Line[], now: Date): ParsedExperience[] {
  const groups = groupEntries(lines, now);
  const orient = orientation(groups, now, TITLE_RE, COMPANY_RE);
  return groups
    .map((group) => {
      const parts = headerParts(group, now);
      const key = (p: string) => normKey(p);
      let titleIdx = parts.findIndex((p) => TITLE_RE.test(key(p)));
      let companyIdx = parts.findIndex((p, i) => i !== titleIdx && COMPANY_RE.test(key(p)));
      const clearTitle = titleIdx >= 0;
      const clearCompany = companyIdx >= 0;
      const lead = leadIndexes(group, now);
      if (orient && lead) {
        const [orgI, roleI] = orient === 'orgFirst' ? lead : [lead[1], lead[0]];
        if (titleIdx < 0 && companyIdx < 0) {
          titleIdx = roleI;
          companyIdx = orgI;
        } else if (titleIdx < 0 && companyIdx === orgI) {
          titleIdx = roleI;
        } else if (companyIdx < 0 && titleIdx === roleI) {
          companyIdx = orgI;
        }
      }
      let jobTitle: string | null = titleIdx >= 0 ? parts[titleIdx] : null;
      let company: string | null = companyIdx >= 0 ? parts[companyIdx] : null;
      const rest = parts.filter((_, i) => i !== titleIdx && i !== companyIdx);
      if (!jobTitle && rest.length > 0) jobTitle = rest.shift() ?? null;
      if (!company && rest.length > 0) company = rest.shift() ?? null;
      const locationIdx = rest.findIndex((p) => LOCATION_HINT_RE.test(key(p)) || words(p).length <= 4);
      const location = locationIdx >= 0 ? rest[locationIdx] : null;

      const range = group.date;
      const confidence = clamp01(
        0.25 +
          (range ? 0.25 : 0) +
          (clearTitle ? 0.2 : jobTitle ? 0.1 : 0) +
          (clearCompany ? 0.2 : company ? 0.1 : 0) +
          (group.body.length > 0 ? 0.1 : 0),
      );
      return {
        jobTitle,
        company,
        location,
        startYear: range?.single ? range.endYear : (range?.startYear ?? null),
        endYear: range?.single ? null : (range?.endYear ?? null),
        isCurrent: range?.isCurrent ?? false,
        description: description(group),
        confidence,
        source: sourceOf(group),
      };
    })
    .filter((e) => e.jobTitle || e.company);
}

function splitDegree(text: string): { degree: string; field: string | null } {
  // Greedy for in/en so "Bachelor of Education in Mathematics" keeps "Bachelor of Education".
  const inEn = /^(.*)\s+(?:in|en|major(?:ing)? in)\s+(.+)$/iu.exec(text);
  if (inEn && DEGREE_RE.test(normKey(inEn[1]))) return { degree: inEn[1].trim(), field: inEn[2].trim() };
  const match = /^(.*?)\s+(?:of|de|d'|option|specialite|spécialité)\s+(.+)$/iu.exec(text);
  if (match && DEGREE_RE.test(normKey(match[1]))) return { degree: match[1].trim(), field: match[2].trim() };
  const colon = /^(.*?)\s*[:：]\s*(.+)$/.exec(text);
  if (colon && DEGREE_RE.test(normKey(colon[1]))) return { degree: colon[1].trim(), field: colon[2].trim() };
  return { degree: text.trim(), field: null };
}

export function parseEducation(lines: Line[], now: Date): ParsedEducation[] {
  const groups = groupEntries(lines, now);
  const orient = orientation(groups, now, DEGREE_RE, INSTITUTION_RE);
  return groups
    .map((group) => {
      const isGrade = (text: string) => GRADE_LINE_RE.test(stripAccentsLower(text).trim());
      const parts = headerParts(group, now).filter((p) => !isGrade(p));
      const key = (p: string) => normKey(p);
      const degreeIdx = parts.findIndex((p) => DEGREE_RE.test(key(p)));
      let institutionIdx = parts.findIndex((p, i) => i !== degreeIdx && INSTITUTION_RE.test(key(p)));
      const clearInstitution = institutionIdx >= 0;
      let fieldIdx = -1;
      const lead = leadIndexes({ ...group, header: group.header.filter((l) => !isGrade(l.text)) }, now);
      // Institution-first CVs: the line under the school is the subject ("Science", "Software Engineering").
      if (orient === 'orgFirst' && lead) {
        if (institutionIdx < 0 && degreeIdx !== lead[0]) institutionIdx = lead[0];
        if (degreeIdx < 0 && institutionIdx === lead[0]) fieldIdx = lead[1];
      } else if (orient === 'roleFirst' && lead && institutionIdx < 0 && degreeIdx === lead[0]) {
        institutionIdx = lead[1];
      }
      const rest = parts.filter(
        (p, i) => i !== degreeIdx && i !== institutionIdx && i !== fieldIdx && !GRADE_RE.test(p),
      );

      let degree: string | null = null;
      let fieldOfStudy: string | null = fieldIdx >= 0 ? parts[fieldIdx] : null;
      if (degreeIdx >= 0) {
        const split = splitDegree(parts[degreeIdx]);
        degree = split.degree;
        fieldOfStudy = split.field ?? fieldOfStudy;
      }
      let institution: string | null = institutionIdx >= 0 ? parts[institutionIdx] : null;
      if (!degree && !fieldOfStudy && rest.length > 0) degree = rest.shift() ?? null;
      if (!institution && rest.length > 0) institution = rest.shift() ?? null;
      if (!fieldOfStudy && rest.length > 0 && words(rest[0]).length <= 6) fieldOfStudy = rest.shift() ?? null;

      const groupLines = [...group.header, ...group.body];
      const gradeLine = groupLines.find((l) => isGrade(l.text));
      const allText = groupLines.map((l) => l.text).join(' | ');
      const gradeMatch = GRADE_RE.exec(stripAccentsLower(allText));
      const grade = gradeLine
        ? gradeLine.text.trim()
        : gradeMatch
          ? (gradeMatch[1] ?? gradeMatch[2] ?? '').trim() || null
          : null;
      const range = group.date;

      const confidence = clamp01(
        0.25 +
          (range ? 0.25 : 0) +
          (degreeIdx >= 0 ? 0.25 : degree || fieldOfStudy ? 0.1 : 0) +
          (clearInstitution ? 0.2 : institution ? 0.1 : 0),
      );
      return {
        degree,
        fieldOfStudy,
        institution,
        startYear: range?.single ? null : (range?.startYear ?? null),
        endYear: range?.endYear ?? null,
        isCurrent: range?.isCurrent ?? false,
        grade: grade ? grade.slice(0, 60) : null,
        description: description(group),
        confidence,
        source: sourceOf(group),
      };
    })
    .filter((e) => e.degree || e.institution);
}

function stripAccentsLower(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
