import { Injectable } from '@nestjs/common';
import { AiGatewayService } from '../../ai/gateway/ai-gateway.service';
import { redactPii } from '../../ai/gateway/redact-pii';

// Re-uploading the same file never calls a model again.
const CV_CACHE_MS = 30 * 24 * 3_600_000;

const SYSTEM = `You are a CV parser.
Return ONLY valid JSON. No markdown. No extra commentary.
If you cannot find a field, set it to null (for nullable fields) or [] (for arrays).`;

const SHAPE = `{
  "fullName": string | null,
  "education": Array<{
    "degree": string | null,
    "fieldOfStudy": string | null,
    "institution": string | null,
    "startYear": number | null,
    "endYear": number | null,
    "grade": string | null,
    "description": string | null,
    "isCurrent": boolean
  }>,
  "experience": Array<{
    "jobTitle": string | null,
    "company": string | null,
    "location": string | null,
    "startYear": number | null,
    "endYear": number | null,
    "description": string | null,
    "isCurrent": boolean
  }>,
  "skills": string[],
  "summary": string | null
}`;

function extractJson(text: string): string {
  const unfenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? text;
  const start = unfenced.indexOf('{');
  const end = unfenced.lastIndexOf('}');
  return start === -1 || end <= start
    ? unfenced
    : unfenced.slice(start, end + 1);
}

/** Turns CV text into the structured JSON the profile uses (contact details redacted first). */
@Injectable()
export class CvAiParser {
  constructor(private readonly gateway: AiGatewayService) {}

  /** Always returns a JSON object string with at least `skills: string[]`. */
  async parse(
    userId: string,
    cvText: string,
    sha256: string,
    signal: AbortSignal,
  ): Promise<string> {
    const { text } = await this.gateway.generate({
      task: 'cv-assist',
      userId,
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: `Extract structured data from the CV text below.\n\nReturn ONLY valid JSON with this exact shape:\n\n${SHAPE}\n\nCV TEXT:\n"""\n${redactPii(cvText)}\n"""`,
        },
      ],
      signal,
      cache: { key: sha256, ttlMs: CV_CACHE_MS },
    });

    try {
      const parsed = JSON.parse(extractJson(text)) as unknown;
      if (!parsed || typeof parsed !== 'object')
        return JSON.stringify({ skills: [] });

      const record = parsed as Record<string, unknown>;
      record.skills = Array.isArray(record.skills)
        ? record.skills
            .filter((v): v is string => typeof v === 'string')
            .map((v) => v.trim())
            .filter(Boolean)
        : [];
      return JSON.stringify(record);
    } catch {
      return JSON.stringify({ skills: [] });
    }
  }
}
