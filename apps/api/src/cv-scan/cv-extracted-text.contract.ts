export type CvExtractedStructuredData = {
  fullName?: string | null;
  education?: Array<{
    degree?: string | null;
    fieldOfStudy?: string | null;
    institution?: string | null;
    startYear?: number | null;
    endYear?: number | null;
    grade?: string | null;
    description?: string | null;
    isCurrent?: boolean;
  }>;
  experience?: Array<{
    jobTitle?: string | null;
    company?: string | null;
    location?: string | null;
    startYear?: number | null;
    endYear?: number | null;
    description?: string | null;
    isCurrent?: boolean;
  }>;
  skills?: string[];
  summary?: string | null;
};

function coerceStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === 'string')
    .map((v) => v.trim())
    .filter(Boolean);
}

/**
 * Phase 0 contract lock:
 * - `UploadMedia.cvExtractedText` must be JSON parseable
 * - Must always be able to derive `skills: string[]` (even if other fields are missing)
 */
export function parseCvExtractedTextSkills(
  cvExtractedText: string | null | undefined,
): string[] {
  if (typeof cvExtractedText !== 'string' || !cvExtractedText.trim()) return [];

  try {
    const parsed = JSON.parse(cvExtractedText) as unknown;

    if (!parsed || typeof parsed !== 'object') return [];

    const record = parsed as CvExtractedStructuredData;
    const skills = coerceStringArray(record.skills);

    // Ensure stable, normalized output.
    return Array.from(new Set(skills));
  } catch {
    return [];
  }
}
