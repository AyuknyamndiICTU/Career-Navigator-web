import type { Line, SectionKind } from './types';
import { clamp01, isAllCaps, levenshtein, median, normKey, words } from './normalize';
import { LANGUAGE_NAMES } from './skills-data';
import { isKnownSkillName } from './skills';

function listsSpokenLanguages(text: string): boolean {
  return normKey(text).split(' ').some((w) => LANGUAGE_NAMES[w] !== undefined);
}

const HEADINGS: Record<SectionKind, string[]> = {
  summary: [
    'summary', 'professional summary', 'career summary', 'executive summary', 'profile', 'professional profile',
    'personal profile', 'about me', 'about', 'objective', 'career objective', 'personal statement', 'overview',
    'profil', 'profil professionnel', 'a propos', 'a propos de moi', 'objectif', 'objectif professionnel',
    'objectif de carriere', 'presentation', 'resume professionnel',
  ],
  experience: [
    'experience', 'experiences', 'work experience', 'professional experience', 'relevant experience',
    'employment', 'employment history', 'work history', 'career history', 'internships', 'internship',
    'professional background', 'experience professionnelle', 'experiences professionnelles', 'parcours',
    'parcours professionnel', 'stages', 'stage', 'emplois', 'experience de travail',
  ],
  education: [
    'education', 'academic background', 'academic qualifications', 'qualifications', 'academic history',
    'education and training', 'educational background', 'academics', 'formation', 'formations',
    'formation academique', 'etudes', 'parcours academique', 'parcours scolaire', 'diplomes',
    'diplomes et formations', 'cursus', 'cursus scolaire',
  ],
  skills: [
    'skills', 'technical skills', 'core skills', 'key skills', 'hard skills', 'soft skills', 'competencies',
    'core competencies', 'skills and competencies', 'skills and abilities', 'expertise', 'areas of expertise',
    'tools', 'technologies', 'tools and technologies', 'it skills', 'computer skills', 'competences',
    'competences techniques', 'competences cles', 'competences professionnelles', 'savoir faire',
    'aptitudes', 'outils', 'informatique', 'connaissances informatiques', 'competences informatiques',
  ],
  projects: [
    'projects', 'personal projects', 'academic projects', 'key projects', 'side projects', 'projets',
    'projets personnels', 'projets academiques', 'realisations',
  ],
  languages: ['languages', 'language skills', 'spoken languages', 'langues', 'competences linguistiques', 'langues parlees'],
  certifications: [
    'certifications', 'certificates', 'certification', 'licenses and certifications', 'courses', 'training',
    'certificats', 'certifications et formations', 'formations complementaires',
  ],
  references: [
    'references', 'reference', 'referees', 'referee', 'professional references', 'referents', 'references professionnelles',
    'personnes de reference',
  ],
  interests: [
    'interests', 'hobbies', 'activities', 'hobbies and interests', 'centres d interet', 'centres d interets',
    'centre d interet', 'loisirs', 'activites',
  ],
  other: [
    'awards', 'honors', 'honours', 'achievements', 'awards and achievements', 'publications', 'volunteering',
    'volunteer experience', 'leadership', 'extracurricular activities', 'distinctions', 'prix',
    'benevolat', 'vie associative', 'additional information', 'informations complementaires',
  ],
};

const TITLE_LINES = new Set(['curriculum vitae', 'resume', 'cv', 'curriculum vitae cv']);

const LOOKUP = new Map<string, SectionKind>();
for (const [kind, list] of Object.entries(HEADINGS) as Array<[SectionKind, string[]]>) {
  for (const heading of list) LOOKUP.set(heading, kind);
}

function headingKey(text: string): string {
  return normKey(text.replace(/[:：]\s*$/, '')).replace(/[.']/g, ' ').replace(/\s+/g, ' ').replace(/^\d+\s+/, '').trim();
}

/** Exact or near-exact (typos, OCR noise) match against the EN + FR heading dictionaries. */
export function matchHeading(text: string): { kind: SectionKind; exact: boolean } | null {
  const key = headingKey(text);
  if (!key || key.length > 45) return null;
  const exact = LOOKUP.get(key);
  if (exact) return { kind: exact, exact: true };
  if (key.length < 6) return null;
  const maxDistance = key.length >= 12 ? 2 : 1;
  for (const [heading, kind] of LOOKUP) {
    if (Math.abs(heading.length - key.length) <= maxDistance && levenshtein(heading, key, maxDistance) <= maxDistance) {
      return { kind, exact: false };
    }
  }
  return null;
}

export type Section = { kind: SectionKind; heading: string; lines: Line[]; confidence: number };

/**
 * Splits lines into the header block (name, contact) and titled sections. A dictionary match counts
 * as a heading when the line is short and either looks like a heading (bold, caps, larger, ends
 * with ":") or stands alone; "Skills: Python, Java" opens a section with its own content.
 */
export function splitSections(lines: Line[]): { header: Line[]; sections: Section[] } {
  const bodySize = median(lines.map((l) => l.fontSize)) || 11;
  const header: Line[] = [];
  const sections: Section[] = [];
  let current: Section | null = null;
  // In list sections a lone item ("Leadership", "Training") can equal a heading word; require heading styling there.
  const LIST_KINDS = new Set<SectionKind>(['skills', 'languages', 'interests', 'certifications', 'other']);
  // "Technologies: React, Node" inside a job is a label, not a new section.
  const ENTRY_KINDS = new Set<SectionKind>(['experience', 'projects', 'education']);

  lines.forEach((line, index) => {
    if (index < 3 && TITLE_LINES.has(headingKey(line.text))) return;

    const open: Section | null = current;
    const inline = /^([^:：]{2,40})[:：]\s*(.+)$/.exec(line.text);
    const candidate = line.bullet ? null : matchHeading(line.text);
    const inlineMatch =
      !candidate && inline && !line.bullet && !(open && ENTRY_KINDS.has(open.kind)) ? matchHeading(inline[1]) : null;
    // "Languages: JavaScript, Python" inside a skills section means programming languages.
    const keepInSkills =
      inlineMatch && inline && open?.kind === 'skills' &&
      (inlineMatch.kind !== 'languages' || !listsSpokenLanguages(inline[2]));
    const looksLikeHeading =
      line.heading || line.bold || isAllCaps(line.text) || line.fontSize > bodySize * 1.15 || /[:：]\s*$/.test(line.text);
    const allowed =
      looksLikeHeading || !(open && LIST_KINDS.has(open.kind)) || (candidate?.exact === true && !isKnownSkillName(line.text));

    if (candidate && allowed && words(line.text).length <= 6) {
      const confidence = clamp01(0.55 + (candidate.exact ? 0.2 : 0) + (looksLikeHeading ? 0.2 : 0));
      current = { kind: candidate.kind, heading: line.text.replace(/[:：]\s*$/, ''), lines: [], confidence };
      sections.push(current);
      return;
    }
    if (inlineMatch && inline && !keepInSkills) {
      current = {
        kind: inlineMatch.kind,
        heading: inline[1].trim(),
        lines: [{ ...line, text: inline[2].trim() }],
        confidence: clamp01(0.6 + (inlineMatch.exact ? 0.2 : 0)),
      };
      sections.push(current);
      return;
    }
    if (current) (current as Section).lines.push(line);
    else header.push(line);
  });

  return { header, sections };
}
