const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE = /(?<![\w])(?:\+?\d[\d\s().-]{6,}\d)(?![\w])/g;
// House number + capitalised street name + street type ("12 Old Mill Road", "5 Rue Ave").
const STREET =
  /\b\d{1,5}\s+(?:[A-Z][\w'.-]*\s+){1,4}(?:[Ss]treet|St|[Aa]venue|Ave|[Rr]oad|Rd|[Bb]oulevard|Blvd|[Ll]ane|Ln|[Dd]rive|Dr|[Ww]ay|[Cc]lose|[Cc]rescent|[Cc]ourt|Ct|[Pp]lace|Pl)\b\.?/g;
const PO_BOX = /\bP\.?\s?O\.?\s+Box\s+\d+\b/gi;

// Date ranges such as "2018 - 2021" look like phone numbers; keep them.
function looksLikePhone(match: string): boolean {
  const groups = match.match(/\d+/g) ?? [];
  if (groups.every((g) => /^(19|20)\d{2}$/.test(g))) return false;
  return groups.join('').length >= 9;
}

/**
 * Masks emails, phone numbers and street addresses before CV text goes to an external
 * (often free-tier) AI provider. Names, skills, employers and dates are kept for parsing.
 */
export function redactPii(text: string): string {
  return text
    .replace(EMAIL, '[email]')
    .replace(PO_BOX, '[address]')
    .replace(STREET, '[address]')
    .replace(PHONE, (match) => (looksLikePhone(match) ? '[phone]' : match));
}
