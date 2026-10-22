import { normKey, stripAccents } from './normalize';

export type DateRange = {
  startYear: number | null;
  startMonth: number | null;
  endYear: number | null;
  endMonth: number | null;
  isCurrent: boolean;
  /** True when only one date was found (e.g. a graduation year). */
  single: boolean;
  index: number;
  length: number;
};

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, janv: 1, janvier: 1,
  feb: 2, february: 2, fev: 2, fevr: 2, fevrier: 2,
  mar: 3, march: 3, mars: 3,
  apr: 4, april: 4, avr: 4, avril: 4,
  may: 5, mai: 5,
  jun: 6, june: 6, juin: 6,
  jul: 7, july: 7, juil: 7, juillet: 7,
  aug: 8, august: 8, aou: 8, aout: 8,
  sep: 9, sept: 9, september: 9, septembre: 9,
  oct: 10, october: 10, octobre: 10,
  nov: 11, november: 11, novembre: 11,
  dec: 12, december: 12, decembre: 12,
};

const MONTH = '(jan(?:uary|v(?:ier)?)?|feb(?:ruary)?|fev(?:r(?:ier)?)?|mar(?:ch|s)?|apr(?:il)?|avr(?:il)?|may|mai|june?|juin|july?|juil(?:let)?|aug(?:ust)?|aout?|sept?(?:ember|embre)?|oct(?:ober|obre)?|nov(?:ember|embre)?|dec(?:ember|embre)?)\\.?';
const YEAR = '((?:19|20)\\d{2})';
const DATE = `(?:${MONTH}\\s*,?\\s*${YEAR}|\\d{1,2}\\s*[/.-]\\s*(\\d{1,2})\\s*[/.-]\\s*${YEAR}|(\\d{1,2})\\s*[/.-]\\s*${YEAR}|${YEAR}\\s*[/.-]\\s*(\\d{1,2})(?!\\d)|${YEAR})`;
/** Capture groups per DATE: month name+year | dd/mm/yyyy | mm/yyyy | yyyy/mm | yyyy. */
const G = 9;
const PRESENT = "(present|current(?:ly)?|now|today|ongoing|to date|date|aujourd'?\\s?hui|a ce jour|actuel(?:lement)?|en cours|maintenant)";
const SEP_WORD = "(?:-+|–|—|~|to|a|au|until|till|jusqu'?\\s?(?:a|au|en)|>|→)";
// "2022 - Till Present", "2019 to - 2021": separators may be chained.
const SEP = `\\s*${SEP_WORD}(?:\\s*${SEP_WORD})?\\s*`;

const RANGE_RE = new RegExp(`(?<![\\w/])${DATE}${SEP}(?:${DATE}|${PRESENT})(?![\\w])`, 'i');
const SINCE_RE = new RegExp(`(?<![\\w])(?:since|depuis|from|des)\\s+${DATE}(?![\\w])`, 'i');
// A range whose end wrapped away or reads "till"/"jusqu'à" with nothing after it still means "ongoing".
const OPEN_RE = new RegExp(`(?<![\\w/])${DATE}\\s*(?:-+|–|—)?\\s*(?:until|till|jusqu'?\\s?(?:a|au|en)?)\\s*$`, 'i');
const SINGLE_RE = new RegExp(`(?<![\\w\\d/.-])${DATE}(?![\\w\\d])`, 'i');

type DatePart = { year: number; month: number | null };

function readDate(groups: Array<string | undefined>): DatePart | null {
  const [monthName, yearA, mmD, yearD, mm, yearB, yearC, mm2, yearE] = groups;
  if (monthName && yearA) return { year: Number(yearA), month: MONTHS[normKey(monthName).replace(/\.$/, '')] ?? monthFromPrefix(monthName) };
  if (mmD && yearD) return { year: Number(yearD), month: validMonth(Number(mmD)) };
  if (mm && yearB) return { year: Number(yearB), month: validMonth(Number(mm)) };
  if (yearC && mm2) return { year: Number(yearC), month: validMonth(Number(mm2)) };
  if (yearE) return { year: Number(yearE), month: null };
  return null;
}

function monthFromPrefix(name: string): number | null {
  const key = normKey(name).replace(/\.$/, '');
  const hit = Object.entries(MONTHS).find(([k]) => k.startsWith(key.slice(0, 3)));
  return hit ? hit[1] : null;
}

function validMonth(n: number): number | null {
  return n >= 1 && n <= 12 ? n : null;
}

function plausible(year: number, now: Date): boolean {
  return year >= 1950 && year <= now.getFullYear() + 6;
}

/** Finds the first date range ("Jan 2020 – Present", "2019-2021", "09/2018 à 06/2020", "Depuis 2021") or a single date. */
export function findDateRange(text: string, now = new Date()): DateRange | null {
  // Same length as the original, so match indexes can be used to cut the date out of `text`.
  const haystack = stripAccents(text).replace(/[’`]/g, "'");

  const range = RANGE_RE.exec(haystack);
  if (range) {
    const start = readDate(range.slice(1, 1 + G));
    const end = readDate(range.slice(1 + G, 1 + 2 * G));
    const present = Boolean(range[1 + 2 * G]);
    if (start && plausible(start.year, now) && (present || (end && plausible(end.year, now) && end.year >= start.year))) {
      return {
        startYear: start.year,
        startMonth: start.month,
        endYear: present ? null : end!.year,
        endMonth: present ? null : end!.month,
        isCurrent: present,
        single: false,
        index: range.index,
        length: range[0].length,
      };
    }
  }

  const since = SINCE_RE.exec(haystack) ?? OPEN_RE.exec(haystack);
  if (since) {
    const start = readDate(since.slice(1, 1 + G));
    if (start && plausible(start.year, now)) {
      return { startYear: start.year, startMonth: start.month, endYear: null, endMonth: null, isCurrent: true, single: false, index: since.index, length: since[0].length };
    }
  }

  const single = SINGLE_RE.exec(haystack);
  if (single) {
    const date = readDate(single.slice(1, 1 + G));
    if (date && plausible(date.year, now)) {
      return { startYear: null, startMonth: null, endYear: date.year, endMonth: date.month, isCurrent: false, single: true, index: single.index, length: single[0].length };
    }
  }
  return null;
}

/** The text with the date (and dangling separators/brackets around it) removed. */
export function withoutDate(text: string, range: DateRange | null): string {
  if (!range) return text.trim();
  return (text.slice(0, range.index) + ' ' + text.slice(range.index + range.length))
    .replace(/[([]\s*[)\]]/g, ' ')
    .replace(/\s*[|,–—-]\s*$/g, '')
    .replace(/^\s*[|,–—-]\s*/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
