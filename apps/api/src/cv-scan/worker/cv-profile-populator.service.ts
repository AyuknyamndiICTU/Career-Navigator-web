import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type ConfirmedEducation = {
  degree?: string | null;
  fieldOfStudy?: string | null;
  institution?: string | null;
  startYear?: number | null;
  endYear?: number | null;
  isCurrent?: boolean;
  grade?: string | null;
  description?: string | null;
};

export type ConfirmedExperience = {
  jobTitle?: string | null;
  company?: string | null;
  location?: string | null;
  startYear?: number | null;
  endYear?: number | null;
  isCurrent?: boolean;
  description?: string | null;
};

/** What the user approved on the review screen (16.7). */
export type ConfirmedCv = {
  fullName?: string | null;
  phone?: string | null;
  location?: string | null;
  summary?: string | null;
  linkedIn?: string | null;
  website?: string | null;
  skills?: string[];
  languages?: string[];
  education?: ConfirmedEducation[];
  experience?: ConfirmedExperience[];
};

const str = (v: string | null | undefined): string | null =>
  typeof v === 'string' && v.trim() ? v.trim() : null;

const key = (v: string | null | undefined): string =>
  (v ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

/** Same entry when the organisation matches and the title or start year matches. */
function sameEntry(
  a: { org: string | null; title: string | null; startYear: number | null },
  b: { org: string | null; title: string | null; startYear: number | null },
): boolean {
  const orgA = key(a.org);
  if (!orgA || orgA !== key(b.org)) return false;
  const titleA = key(a.title);
  return (
    (titleA !== '' && titleA === key(b.title)) ||
    (a.startYear != null && a.startYear === b.startYear)
  );
}

function mergeList(
  existing: unknown,
  added: string[] | undefined,
): string[] | undefined {
  if (!added) return undefined;
  const out = Array.isArray(existing)
    ? existing.filter((s): s is string => typeof s === 'string')
    : [];
  const seen = new Set(out.map(key));
  for (const item of added.map((s) => s.trim()).filter(Boolean)) {
    if (!seen.has(key(item))) {
      seen.add(key(item));
      out.push(item);
    }
  }
  return out;
}

/** Fills only fields the user left empty in the stored row; never blanks existing values. */
function fillMissing<T extends Record<string, unknown>>(
  current: T,
  incoming: Partial<T>,
): Partial<T> {
  const update: Partial<T> = {};
  for (const [k, v] of Object.entries(incoming) as Array<
    [keyof T, T[keyof T]]
  >) {
    if (v == null || v === '') continue;
    const cur = current[k];
    if (
      cur == null ||
      cur === '' ||
      (k === 'isCurrent' && cur !== v) ||
      (k === 'endYear' && cur !== v)
    ) {
      update[k] = v;
    }
  }
  return update;
}

/**
 * Applies a confirmed CV review to Profile, Education and WorkExperience.
 * Merges instead of replacing: matching entries are updated, new ones added, nothing deleted,
 * and other cvWizardData keys are kept.
 */
@Injectable()
export class CvProfilePopulator {
  constructor(private readonly prisma: PrismaService) {}

  async apply(
    userId: string,
    cv: ConfirmedCv,
  ): Promise<{ educationAdded: number; experienceAdded: number }> {
    return this.prisma.$transaction(async (tx) => {
      const profile = await tx.profile.findUnique({ where: { userId } });
      const wizard =
        profile?.cvWizardData &&
        typeof profile.cvWizardData === 'object' &&
        !Array.isArray(profile.cvWizardData)
          ? (profile.cvWizardData as Record<string, unknown>)
          : {};

      const [firstName, ...rest] = (str(cv.fullName) ?? '')
        .split(/\s+/)
        .filter(Boolean);
      const nextWizard: Record<string, unknown> = { ...wizard };
      const skills = mergeList(wizard.skills, cv.skills);
      const languages = mergeList(wizard.languages, cv.languages);
      if (skills) nextWizard.skills = skills;
      if (languages) nextWizard.languages = languages;
      if (str(cv.linkedIn)) nextWizard.linkedIn = str(cv.linkedIn);
      if (str(cv.website)) nextWizard.website = str(cv.website);

      const profileData = {
        ...(firstName ? { firstName } : {}),
        ...(rest.length > 0 ? { lastName: rest.join(' ') } : {}),
        ...(str(cv.phone) ? { phone: str(cv.phone) } : {}),
        ...(str(cv.location) ? { location: str(cv.location) } : {}),
        ...(str(cv.summary) ? { summary: str(cv.summary) } : {}),
        cvWizardData: nextWizard as Prisma.InputJsonValue,
      };
      await tx.profile.upsert({
        where: { userId },
        create: { userId, ...profileData },
        update: profileData,
      });

      let educationAdded = 0;
      const educations = await tx.education.findMany({ where: { userId } });
      for (const e of cv.education ?? []) {
        const row = {
          degree: str(e.degree),
          fieldOfStudy: str(e.fieldOfStudy),
          institution: str(e.institution),
          startYear: e.startYear ?? null,
          endYear: e.endYear ?? null,
          grade: str(e.grade),
          description: str(e.description),
          isCurrent: e.isCurrent === true,
        };
        if (!row.degree && !row.institution) continue;
        const match = educations.find((x) =>
          sameEntry(
            { org: x.institution, title: x.degree, startYear: x.startYear },
            {
              org: row.institution,
              title: row.degree,
              startYear: row.startYear,
            },
          ),
        );
        if (match) {
          const update = fillMissing(match, row);
          if (Object.keys(update).length > 0) {
            await tx.education.update({
              where: { id: match.id },
              data: update,
            });
          }
        } else {
          educations.push(
            await tx.education.create({ data: { userId, ...row } }),
          );
          educationAdded += 1;
        }
      }

      let experienceAdded = 0;
      const experiences = await tx.workExperience.findMany({
        where: { userId },
      });
      for (const w of cv.experience ?? []) {
        const row = {
          jobTitle: str(w.jobTitle),
          company: str(w.company),
          location: str(w.location),
          startYear: w.startYear ?? null,
          endYear: w.endYear ?? null,
          description: str(w.description),
          isCurrent: w.isCurrent === true,
        };
        if (!row.jobTitle && !row.company) continue;
        const match = experiences.find((x) =>
          sameEntry(
            { org: x.company, title: x.jobTitle, startYear: x.startYear },
            { org: row.company, title: row.jobTitle, startYear: row.startYear },
          ),
        );
        if (match) {
          const update = fillMissing(match, row);
          if (Object.keys(update).length > 0) {
            await tx.workExperience.update({
              where: { id: match.id },
              data: update,
            });
          }
        } else {
          experiences.push(
            await tx.workExperience.create({ data: { userId, ...row } }),
          );
          experienceAdded += 1;
        }
      }

      return { educationAdded, experienceAdded };
    });
  }
}
