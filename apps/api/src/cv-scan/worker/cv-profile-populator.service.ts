import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const str = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() ? v.trim() : null;

const year = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null;

const records = (v: unknown): Array<Record<string, unknown>> =>
  Array.isArray(v)
    ? v.filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === 'object',
      )
    : [];

/**
 * Writes parsed CV data into Profile, Education and WorkExperience so the profile page and
 * resume builder show it immediately. Each section is replaced atomically (no duplicates on re-upload).
 */
@Injectable()
export class CvProfilePopulator {
  constructor(private readonly prisma: PrismaService) {}

  async apply(userId: string, structuredJson: string): Promise<void> {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(structuredJson) as Record<string, unknown>;
    } catch {
      return;
    }
    if (!parsed || typeof parsed !== 'object') return;

    const [firstName, ...rest] = (str(parsed.fullName) ?? '')
      .split(/\s+/)
      .filter(Boolean);
    const skills = Array.isArray(parsed.skills)
      ? parsed.skills.filter(
          (s): s is string => typeof s === 'string' && Boolean(s.trim()),
        )
      : [];

    const summary = str(parsed.summary);
    const profileData: {
      firstName?: string;
      lastName?: string;
      summary?: string;
      cvWizardData?: Prisma.InputJsonValue;
    } = {
      ...(firstName ? { firstName } : {}),
      ...(rest.length > 0 ? { lastName: rest.join(' ') } : {}),
      ...(summary ? { summary } : {}),
      ...(skills.length > 0 ? { cvWizardData: { skills } } : {}),
    };

    const education = records(parsed.education).map((e) => ({
      userId,
      degree: str(e.degree),
      fieldOfStudy: str(e.fieldOfStudy),
      institution: str(e.institution),
      startYear: year(e.startYear),
      endYear: year(e.endYear),
      grade: str(e.grade),
      description: str(e.description),
      isCurrent: e.isCurrent === true,
    }));

    const experience = records(parsed.experience).map((w) => ({
      userId,
      jobTitle: str(w.jobTitle),
      company: str(w.company),
      location: str(w.location),
      startYear: year(w.startYear),
      endYear: year(w.endYear),
      description: str(w.description),
      isCurrent: w.isCurrent === true,
    }));

    await this.prisma.$transaction(async (tx) => {
      if (Object.keys(profileData).length > 0) {
        await tx.profile.upsert({
          where: { userId },
          create: { userId, ...profileData },
          update: profileData,
        });
      }
      if (education.length > 0) {
        await tx.education.deleteMany({ where: { userId } });
        await tx.education.createMany({ data: education });
      }
      if (experience.length > 0) {
        await tx.workExperience.deleteMany({ where: { userId } });
        await tx.workExperience.createMany({ data: experience });
      }
    });
  }
}
