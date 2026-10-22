import type { Line, ParsedSkill } from './types';
import { GENERAL_SKILL_ENTRIES, LANGUAGE_NAMES, SKILL_ENTRIES } from './skills-data';
import { ESCO_SKILL_ENTRIES } from './skills-esco';
import { levenshtein, normKey, stripBullet, words } from './normalize';

type Entry = { canonical: string; sectionOnly: boolean };

function buildIndex(extra: string[]): Map<string, Entry> {
  const index = new Map<string, Entry>();
  const add = (raw: string, forceSectionOnly: boolean) => {
    const ambiguous = raw.startsWith('!');
    const [canonical, ...aliases] = raw.replace(/^!/, '').split('|');
    const entry = { canonical, sectionOnly: ambiguous || forceSectionOnly };
    for (const name of [canonical, ...aliases]) {
      const key = normKey(name);
      if (key && !index.has(key)) index.set(key, entry);
    }
  };
  SKILL_ENTRIES.forEach((raw) => add(raw, false));
  GENERAL_SKILL_ENTRIES.forEach((raw) => add(raw, true));
  // ESCO adds breadth (ERP, CMS, niche languages) but its names are often ordinary words: skills sections only.
  ESCO_SKILL_ENTRIES.forEach((raw) => add(raw, true));
  // Platform job skills are trusted names but may be ordinary words: section-only unless already known.
  extra.forEach((name) => {
    const key = normKey(name);
    if (key && !index.has(key)) index.set(key, { canonical: name.trim(), sectionOnly: true });
  });
  return index;
}

let defaultIndex: Map<string, Entry> | null = null;

/** True for names in the built-in dictionary ("Leadership", "Training"), used to tell list items from headings. */
export function isKnownSkillName(text: string): boolean {
  defaultIndex ??= buildIndex([]);
  return defaultIndex.has(normKey(text.replace(/[:：]\s*$/, '')));
}

const PROTECTED_SLASH = /\b(ci\/cd|tcp\/ip|ui\/ux|pl\/sql|i\/o)\b/gi;
// Self-ratings: "7/10", "8.7/10", "4 / 5", "80%".
const RATING_RE = /\(?\b\d{1,3}(?:[.,]\d)?\s*\/\s*(?:5|10|20|100)\b\)?|\(?\d{1,3}\s*%\)?/g;
const LEVEL_RE =
  /\((?:[^)]{0,30})\)|\b(?:beginner|intermediate|advanced|expert|proficient|fluent|native|basic|good|excellent|notions?|debutant|intermediaire|avance|courant|bilingue|maternelle|langue maternelle|bon|tres bon|excellent|niveau\s+\w+|[abc][12])\b|\d{1,3}\s*%|[★☆●○]+/gi;
const CONNECTOR_RE = /\s+(?:and|et|&|with|avec)\s+/i;
const FILLER = new Set(['with', 'avec', 'and', 'et', 'using', 'the', 'of', 'de', 'in', 'en', 'programming', 'microsoft', 'google', 'adobe']);

let tokenIndex: Map<string, Entry> | null = null;

/**
 * "C and C++" or "Python with Django" split into known names; "Installation and maintenance of cameras"
 * stays one skill because its parts are not known names.
 */
function splitConnectors(token: string): string[] {
  tokenIndex ??= buildIndex([]);
  const parts = token.split(CONNECTOR_RE).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return [token];
  const known = (p: string) => tokenIndex!.has(normKey(p)) || LANGUAGE_NAMES[normKey(p)] !== undefined || segmentKnown(p).length > 0;
  return parts.some(known) ? parts : [token];
}

/**
 * Reads run-together known names: "Microsoft Word Microsoft" (wrapped list), "Django Python".
 * Returns [] unless every word is part of a known name or a filler word.
 */
function segmentKnown(token: string): string[] {
  tokenIndex ??= buildIndex([]);
  const list = normKey(token).split(' ').filter(Boolean);
  if (list.length < 2) return [];
  const found: string[] = [];
  for (let i = 0; i < list.length; ) {
    let matched = 0;
    for (let n = Math.min(4, list.length - i); n >= 1; n -= 1) {
      if (tokenIndex.has(list.slice(i, i + n).join(' '))) {
        found.push(token.split(/\s+/).slice(i, i + n).join(' '));
        matched = n;
        break;
      }
    }
    if (matched === 0) {
      if (!FILLER.has(list[i])) return [];
      matched = 1;
    }
    i += matched;
  }
  return found;
}

/** Splits a skills line into candidate tokens ("Languages: Python, Java / C++ | SQL"). */
export function skillTokens(text: string): string[] {
  const withoutLabel = /^[^:：]{2,30}[:：]\s*(.+)$/.exec(text)?.[1] ?? text;
  const guarded = stripBullet(withoutLabel)
    .replace(RATING_RE, '   ')
    .replace(PROTECTED_SLASH, (m) => m.replace('/', '\u2044'));
  return guarded
    .split(/\s{3,}|\s*(?:[,;|•·●▪/]|\s-\s|\s–\s)\s*/i)
    .map((t) => t.replace(/\u2044/g, '/').replace(LEVEL_RE, ' ').replace(/[.:]+$/, '').replace(/\s+/g, ' ').trim())
    .flatMap((t) => splitConnectors(t))
    .flatMap((t) => {
      const segmented = segmentKnown(t);
      return segmented.length > 0 ? segmented : [t];
    })
    .filter((t) => t.length >= 1 && t.length <= 40 && /\p{L}/u.test(t));
}

function fuzzyLookup(key: string, index: Map<string, Entry>): Entry | null {
  if (key.length < 5) return null;
  const max = key.length >= 9 ? 2 : 1;
  for (const [name, entry] of index) {
    if (Math.abs(name.length - key.length) <= max && levenshtein(name, key, max) <= max) return entry;
  }
  return null;
}

/**
 * Skills from skills sections (dictionary, fuzzy or kept as written) plus technical skills named
 * anywhere else in the CV. Case-insensitive de-duplication; the highest confidence wins.
 */
export function extractSkills(
  skillLines: Line[],
  otherLines: Line[],
  extra: string[] = [],
): ParsedSkill[] {
  const index = buildIndex(extra);
  const found = new Map<string, ParsedSkill>();
  const add = (name: string, confidence: number, source: string) => {
    const key = normKey(name);
    const existing = found.get(key);
    if (!existing || existing.confidence < confidence) found.set(key, { name, confidence, source: source.slice(0, 200) });
  };

  for (const line of skillLines) {
    for (const token of skillTokens(line.text)) {
      const key = normKey(token);
      const exact = index.get(key);
      if (exact) {
        add(exact.canonical, 0.95, line.text);
        continue;
      }
      const fuzzy = fuzzyLookup(key, index);
      if (fuzzy) {
        add(fuzzy.canonical, 0.8, line.text);
      } else if (words(token).length <= 4 && token.length >= 2 && !LANGUAGE_NAMES[key]) {
        add(token, 0.6, line.text);
      }
    }
  }

  // Elsewhere only unambiguous technical names count, matched as whole 1–3 word phrases.
  for (const line of otherLines) {
    const tokens = normKey(line.text).split(' ').filter(Boolean);
    for (let i = 0; i < tokens.length; i += 1) {
      for (let n = 3; n >= 1; n -= 1) {
        if (i + n > tokens.length) continue;
        const phrase = tokens.slice(i, i + n).join(' ');
        const entry = index.get(phrase);
        if (entry && !entry.sectionOnly && (phrase.length >= 3 || /[+#.]/.test(phrase))) {
          add(entry.canonical, 0.7, line.text);
          i += n - 1;
          break;
        }
      }
    }
  }

  return [...found.values()].sort((a, b) => b.confidence - a.confidence).slice(0, 60);
}

/** Exact name, else one OCR-style edit away ("Frangais" → French) for names of 5+ letters. */
function knownLanguage(key: string): string | undefined {
  const exact = LANGUAGE_NAMES[key] ?? LANGUAGE_NAMES[key.split(' ')[0]];
  if (exact || key.length < 5) return exact;
  const first = key.split(' ')[0];
  const near = Object.keys(LANGUAGE_NAMES).find((name) => name.length >= 5 && levenshtein(first, name) <= 1);
  return near ? LANGUAGE_NAMES[near] : undefined;
}

/** "English (native), Français – courant" → ["English", "French"]. */
export function extractLanguages(lines: Line[]): string[] {
  const result = new Set<string>();
  for (const line of lines) {
    for (const token of skillTokens(line.text)) {
      const known = knownLanguage(normKey(token));
      if (known) result.add(known);
      else if (words(token).length <= 2 && /^\p{L}+$/u.test(token.replace(/\s/g, ''))) result.add(token);
    }
  }
  return [...result].slice(0, 15);
}
