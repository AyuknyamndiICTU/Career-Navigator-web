import { Injectable } from '@nestjs/common';
import { AiGatewayService } from '../../ai/gateway/ai-gateway.service';
import { redactPii } from '../../ai/gateway/redact-pii';

// Asking again for the same file and section never calls a model again.
const CV_CACHE_MS = 30 * 24 * 3_600_000;
const MAX_SECTION_CHARS = 8_000;

export type CvAssistSection = 'summary' | 'education' | 'experience' | 'skills';

const SYSTEM = `You are a CV parser. You receive ONE section of a CV.
Return ONLY valid JSON. No markdown. No extra commentary.
Use null for missing fields and [] for empty arrays. Never invent information.`;

const SHAPES: Record<CvAssistSection, string> = {
  summary: `{ "summary": string | null }`,
  skills: `{ "skills": string[] }`,
  education: `{ "education": Array<{ "degree": string | null, "fieldOfStudy": string | null, "institution": string | null, "startYear": number | null, "endYear": number | null, "grade": string | null, "description": string | null, "isCurrent": boolean }> }`,
  experience: `{ "experience": Array<{ "jobTitle": string | null, "company": string | null, "location": string | null, "startYear": number | null, "endYear": number | null, "description": string | null, "isCurrent": boolean }> }`,
};

function extractJson(text: string): string {
  const unfenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? text;
  const start = unfenced.indexOf('{');
  const end = unfenced.lastIndexOf('}');
  return start === -1 || end <= start
    ? unfenced
    : unfenced.slice(start, end + 1);
}

const s = (v: unknown, max = 2000): string | null =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;
const y = (v: unknown): number | null =>
  typeof v === 'number' && Number.isInteger(v) && v >= 1950 && v <= 2100
    ? v
    : null;
const list = (v: unknown): Array<Record<string, unknown>> =>
  Array.isArray(v)
    ? v
        .filter(
          (x): x is Record<string, unknown> =>
            Boolean(x) && typeof x === 'object',
        )
        .slice(0, 30)
    : [];

/** Model output is untrusted: keep only the expected fields with bounded sizes. */
function sanitize(
  section: CvAssistSection,
  raw: Record<string, unknown>,
): Record<string, unknown> {
  switch (section) {
    case 'summary':
      return { summary: s(raw.summary, 3000) };
    case 'skills':
      return {
        skills: Array.isArray(raw.skills)
          ? [
              ...new Set(
                raw.skills
                  .map((v) => s(v, 60))
                  .filter((v): v is string => Boolean(v)),
              ),
            ].slice(0, 100)
          : [],
      };
    case 'education':
      return {
        education: list(raw.education).map((e) => ({
          degree: s(e.degree, 200),
          fieldOfStudy: s(e.fieldOfStudy, 200),
          institution: s(e.institution, 200),
          startYear: y(e.startYear),
          endYear: y(e.endYear),
          grade: s(e.grade, 100),
          description: s(e.description),
          isCurrent: e.isCurrent === true,
        })),
      };
    case 'experience':
      return {
        experience: list(raw.experience).map((w) => ({
          jobTitle: s(w.jobTitle, 200),
          company: s(w.company, 200),
          location: s(w.location, 200),
          startYear: y(w.startYear),
          endYear: y(w.endYear),
          description: s(w.description),
          isCurrent: w.isCurrent === true,
        })),
      };
  }
}

/** "Improve with AI" for one CV section, on request only (16.8). Contact details are redacted first. */
@Injectable()
export class CvAiParser {
  constructor(private readonly gateway: AiGatewayService) {}

  async assist(
    userId: string,
    section: CvAssistSection,
    sectionText: string,
    sha256: string,
  ): Promise<Record<string, unknown>> {
    const { text } = await this.gateway.generate({
      task: 'cv-assist',
      userId,
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: `Extract the ${section} section below.\n\nReturn ONLY valid JSON with this exact shape:\n\n${SHAPES[section]}\n\nSECTION TEXT:\n"""\n${redactPii(sectionText.slice(0, MAX_SECTION_CHARS))}\n"""`,
        },
      ],
      cache: { key: `${sha256}:${section}`, ttlMs: CV_CACHE_MS },
    });

    try {
      const parsed = JSON.parse(extractJson(text)) as unknown;
      if (parsed && typeof parsed === 'object') {
        return sanitize(section, parsed as Record<string, unknown>);
      }
    } catch {
      // fall through
    }
    return sanitize(section, {});
  }
}
