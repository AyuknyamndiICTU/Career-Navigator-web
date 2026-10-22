import { findPhoneNumbersInText, type CountryCode } from 'libphonenumber-js/min';
import type { Line, Scored } from './types';
import { clamp01, collapseSpaces, isAllCaps, normKey, titleCase, words } from './normalize';
import { matchHeading } from './sections';
import { TITLE_RE } from './entries';

export const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const LINK_RE =
  /(?:https?:\/\/)?(?:www\.)?(?:linkedin\.com\/(?:in|pub)\/[\w%-]+|github\.com\/[\w-]+|gitlab\.com\/[\w-]+|behance\.net\/[\w-]+|dribbble\.com\/[\w-]+|medium\.com\/@?[\w-]+|stackoverflow\.com\/users\/\d+(?:\/[\w-]+)?)\/?|https?:\/\/[^\s,;|()<>]+/gi;
const LOCATION_LABEL_RE = /^(?:address|adresse|location|lieu|ville|city|residence|résidence|domicile)\s*[:：]\s*(.+)$/i;
const RAW_PHONE_RE = /\+?\d[\d\s().-]{6,}\d/;
// Cities common in our users' CVs (accent-free keys); a header segment naming one is a location.
const CITIES = new Set([
  'yaounde', 'douala', 'buea', 'bamenda', 'limbe', 'bafoussam', 'garoua', 'maroua', 'ngaoundere', 'bertoua', 'ebolowa',
  'kribi', 'kumba', 'dschang', 'nkongsamba', 'edea', 'mbalmayo', 'kumbo', 'tiko', 'mutengene', 'foumban', 'sangmelima',
  'lagos', 'abuja', 'accra', 'nairobi', 'kigali', 'dakar', 'abidjan', 'kinshasa', 'brazzaville', 'libreville', 'malabo',
  'ndjamena', 'bangui', 'lome', 'cotonou', 'niamey', 'bamako', 'ouagadougou', 'conakry', 'johannesburg', 'cape town',
  'paris', 'lyon', 'marseille', 'brussels', 'bruxelles', 'montreal', 'quebec', 'toronto', 'london', 'berlin',
]);
const NON_NAME_WORDS = new Set([
  'curriculum', 'vitae', 'resume', 'cv', 'email', 'e-mail', 'phone', 'tel', 'telephone', 'mobile', 'address',
  'adresse', 'linkedin', 'github', 'portfolio', 'www',
]);

function none(): Scored<string | null> {
  return { value: null, confidence: 0, source: null };
}

/** Splits "Jane Doe | Engineer | jane@x.com" style header lines into separate segments. */
function segments(line: string): string[] {
  return line
    .split(/\s*(?:\||•|·|◆|♦|\u2022|\s{3,}|\t)\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function findEmail(lines: Line[]): Scored<string | null> {
  for (const line of lines) {
    const match = EMAIL_RE.exec(line.text);
    if (match) return { value: match[0].toLowerCase(), confidence: 0.98, source: line.text };
  }
  return none();
}

export function findPhone(lines: Line[], defaultCountry?: string, rawFallback = true): Scored<string | null> {
  for (const line of lines) {
    const text = line.text.replace(EMAIL_RE, ' ');
    const found = findPhoneNumbersInText(text, defaultCountry ? (defaultCountry.toUpperCase() as CountryCode) : undefined);
    if (found.length > 0) {
      return { value: found[0].number.formatInternational(), confidence: 0.95, source: line.text };
    }
  }
  if (!rawFallback) return none();
  // Numbers without a country prefix and no default country: keep the raw digits, flagged for review.
  for (const line of lines) {
    const match = RAW_PHONE_RE.exec(line.text.replace(EMAIL_RE, ' '));
    const digits = match?.[0].replace(/\D/g, '') ?? '';
    if (match && digits.length >= 8 && digits.length <= 15 && !/^(?:19|20)\d{2}\s*[-–/]/.test(match[0])) {
      return { value: collapseSpaces(match[0]), confidence: 0.6, source: line.text };
    }
  }
  return none();
}

export function findLinks(lines: Line[]): string[] {
  const links = new Set<string>();
  for (const line of lines) {
    for (const match of line.text.replace(EMAIL_RE, ' ').matchAll(LINK_RE)) {
      const url = match[0].replace(/[.)]+$/, '');
      links.add(/^https?:\/\//i.test(url) ? url : `https://${url.replace(/^www\./i, 'www.')}`);
    }
  }
  return [...links].slice(0, 10);
}

/** "City, Country" in the header, or an explicit "Address: …" line. */
export function findLocation(header: Line[]): Scored<string | null> {
  for (const line of header) {
    const labelled = LOCATION_LABEL_RE.exec(line.text);
    if (labelled) return { value: collapseSpaces(labelled[1]).slice(0, 120), confidence: 0.8, source: line.text };
  }
  for (const line of header) {
    for (const segment of segments(line.text)) {
      if (EMAIL_RE.test(segment) || /\d{4,}|https?:|www\./i.test(segment)) continue;
      if (/^[\p{Lu}][\p{L}' .-]+,\s*[\p{Lu}][\p{L}' .-]+$/u.test(segment) && words(segment).length <= 6) {
        return { value: segment, confidence: 0.55, source: line.text };
      }
    }
  }
  // "⌂ Tradex Eleveur, Yaoundé, Camer" + "oon": a known city, with a word wrapped onto the next line.
  for (const [index, line] of header.entries()) {
    if (EMAIL_RE.test(line.text)) continue;
    const next = header[index + 1]?.text.trim() ?? '';
    const text = /^\p{Ll}{1,6}$/u.test(next) ? `${line.text.trim()}${next}` : line.text;
    for (const segment of segments(text)) {
      const value = segment.replace(/^[^\p{L}]+/u, '').trim();
      const parts = value.split(/\s*,\s*/);
      const cityAt = parts.findIndex((p) => CITIES.has(normKey(p)));
      if (cityAt >= 0 && words(value).length <= 8) {
        return { value: parts.slice(cityAt).join(', '), confidence: 0.7, source: line.text };
      }
    }
  }
  return none();
}

function looksLikeName(segment: string): boolean {
  const parts = words(segment);
  if (parts.length < 2 || parts.length > 5) return false;
  if (!/^[\p{L}][\p{L}'’. -]+$/u.test(segment)) return false;
  if (parts.some((w) => NON_NAME_WORDS.has(normKey(w)))) return false;
  if (matchHeading(segment)) return false;
  return parts.every((w) => /^[\p{Lu}]/u.test(w) || /^(?:de|da|del|van|von|le|la|du|bin|ben|el)$/i.test(w));
}

/** The name is usually the largest, boldest text near the top that is not contact data. */
export function findName(header: Line[], fallback: Line[]): Scored<string | null> {
  const pool = (header.length > 0 ? header : fallback).slice(0, 14);
  if (pool.length === 0) return none();
  const maxSize = Math.max(...pool.map((l) => l.fontSize));
  let best: { value: string; score: number; source: string } | null = null;

  pool.forEach((line, index) => {
    let segment = segments(line.text)[0] ?? '';
    // Large names often wrap: "AYUKEYONG DOHBILA" / "NYAMNDI BENJUNIOR".
    const next = pool[index + 1];
    if (
      next && (line.fontSize >= maxSize - 0.5 || index === 0) && Math.abs(next.fontSize - line.fontSize) < 0.5 && next.bold === line.bold &&
      isAllCaps(next.text) === isAllCaps(segment) && !TITLE_RE.test(normKey(next.text)) &&
      looksLikeName(`${segment} ${next.text.trim()}`) && words(next.text).length <= 3
    ) {
      segment = `${segment} ${next.text.trim()}`;
    }
    if (!looksLikeName(segment)) return;
    let score = 0.45;
    if (line.fontSize >= maxSize && maxSize > 0) score += 0.25;
    if (line.bold) score += 0.1;
    if (index === 0) score += 0.15;
    else if (index <= 2) score += 0.05;
    if (segment === line.text.trim()) score += 0.05;
    if (!best || score > best.score) {
      best = { value: isAllCaps(segment) ? titleCase(segment) : segment, score, source: line.text };
    }
  });

  const chosen = best as { value: string; score: number; source: string } | null;
  return chosen ? { value: chosen.value, confidence: clamp01(chosen.score), source: chosen.source } : none();
}
