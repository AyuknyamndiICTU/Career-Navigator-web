import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { verifyAccessToken } from '../auth/jwt/jwt-utils';
import { BuildResumeDto, ResumeTemplateId } from './dto/build-resume.dto';

type AuthUser = { sub: string };
type CvWizardData = Record<string, unknown>;

const DEFAULT_TEMPLATE: ResumeTemplateId = 'STANDARD';

function extractBearerToken(authorizationHeader: string | undefined): string {
  if (!authorizationHeader) return '';
  return authorizationHeader.replace(/^Bearer\s+/i, '').trim();
}

@Injectable()
export class ResumeService {
  constructor(private readonly prisma: PrismaService) {}

  private getAuthUser(authorizationHeader: string | undefined): AuthUser {
    const accessSecret = process.env.JWT_ACCESS_SECRET;
    if (!accessSecret) {
      throw new UnauthorizedException('JWT secrets are not configured');
    }

    const token = extractBearerToken(authorizationHeader);
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const payload = verifyAccessToken({ secret: accessSecret, token });
    if (!payload?.sub) {
      throw new UnauthorizedException('Invalid token');
    }

    return { sub: payload.sub };
  }

  async buildResume(
    authorizationHeader: string | undefined,
    dto: BuildResumeDto,
  ): Promise<unknown> {
    const { sub: userId } = this.getAuthUser(authorizationHeader);

    const template: ResumeTemplateId = dto.template ?? DEFAULT_TEMPLATE;

    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: {
        firstName: true,
        lastName: true,
        headline: true,
        phone: true,
        location: true,
        summary: true,
        cvWizardData: true,
      },
    });

    const education = await this.prisma.education.findMany({
      where: { userId },
      orderBy: { startYear: 'desc' },
      select: {
        degree: true,
        fieldOfStudy: true,
        institution: true,
        startYear: true,
        endYear: true,
        grade: true,
        description: true,
        isCurrent: true,
      },
    });

    const workExperience = await this.prisma.workExperience.findMany({
      where: { userId },
      orderBy: { startYear: 'desc' },
      select: {
        jobTitle: true,
        company: true,
        location: true,
        startYear: true,
        endYear: true,
        description: true,
        isCurrent: true,
      },
    });

    // Phase 4: Projects + References (best-effort so existing e2e mocks don't break)
    const prismaAny = this.prisma as any;

    const projects: Array<{
      id?: string;
      title: string;
      description: string | null;
      externalUrl: string | null;
      skills: string[];
      isCurrent: boolean;
      createdAt?: Date;
      updatedAt?: Date;
    }> =
      (await prismaAny.project
        ?.findMany?.({
          where: { userId },
          orderBy: { createdAt: 'desc' },
        })
        .catch(() => [])) ?? [];

    const references: Array<{
      id?: string;
      name: string;
      relationship: string | null;
      company: string | null;
      email: string | null;
      phone: string | null;
      notes: string | null;
      createdAt?: Date;
      updatedAt?: Date;
    }> =
      (await prismaAny.reference
        ?.findMany?.({
          where: { userId },
          orderBy: { createdAt: 'desc' },
        })
        .catch(() => [])) ?? [];

    if (
      !profile &&
      education.length === 0 &&
      workExperience.length === 0 &&
      projects.length === 0 &&
      references.length === 0
    ) {
      return this.formatResume(template, {
        profile: null,
        education: [],
        workExperience: [],
        projects: [],
        references: [],
      });
    }

    return this.formatResume(template, {
      profile,
      education,
      workExperience,
      projects,
      references,
    });
  }

  private formatResume(
    template: ResumeTemplateId,
    data: {
      profile: {
        firstName: string | null;
        lastName: string | null;
        headline: string | null;
        phone: string | null;
        location: string | null;
        summary: string | null;
        cvWizardData: Prisma.JsonValue | null;
      } | null;
      education: Array<{
        degree: string | null;
        fieldOfStudy: string | null;
        institution: string | null;
        startYear: number | null;
        endYear: number | null;
        grade: string | null;
        description: string | null;
        isCurrent: boolean;
      }>;
      workExperience: Array<{
        jobTitle: string | null;
        company: string | null;
        location: string | null;
        startYear: number | null;
        endYear: number | null;
        description: string | null;
        isCurrent: boolean;
      }>;
      projects: Array<{
        title: string;
        description: string | null;
        externalUrl: string | null;
        skills: string[];
        isCurrent: boolean;
      }>;
      references: Array<{
        name: string;
        relationship: string | null;
        company: string | null;
        email: string | null;
        phone: string | null;
        notes: string | null;
      }>;
    },
  ): unknown {
    if (template !== 'STANDARD' && template !== 'DETAILED') {
      throw new BadRequestException('Invalid template');
    }

    const cv = this.asCvWizardData(data.profile?.cvWizardData ?? null);

    const coerceStringArray = (value: unknown): string[] => {
      if (!Array.isArray(value)) return [];
      return value
        .filter((v): v is string => typeof v === 'string')
        .map((v) => v.trim())
        .filter(Boolean);
    };

    const coerceNullableString = (value: unknown): string | null => {
      if (typeof value !== 'string') return null;
      const t = value.trim();
      return t.length === 0 ? null : t;
    };

    const fullName =
      [data.profile?.firstName, data.profile?.lastName]
        .filter(Boolean)
        .join(' ') || null;

    const header = {
      fullName,
      headline: data.profile?.headline ?? null,
      contact: {
        phone: data.profile?.phone ?? null,
        location: data.profile?.location ?? null,
        email: cv ? coerceNullableString(cv.email) : null,
        address: cv ? coerceNullableString(cv.address) : null,
        dateOfBirth: cv ? coerceNullableString(cv.dateOfBirth) : null,
        website: cv ? coerceNullableString(cv.website) : null,
        linkedIn: cv ? coerceNullableString(cv.linkedIn) : null,
        photoUrl: cv ? coerceNullableString(cv.photoUrl) : null,
      },
    };

    const summary = data.profile?.summary ?? null;

    const educationSections =
      template === 'DETAILED'
        ? data.education.map((e) => ({
            degree: e.degree ?? null,
            fieldOfStudy: e.fieldOfStudy ?? null,
            institution: e.institution ?? null,
            years: this.formatYears(e.startYear, e.endYear, e.isCurrent),
            grade: e.grade ?? null,
            description: e.description ?? null,
          }))
        : data.education.map((e) => ({
            degree: e.degree ?? null,
            institution: e.institution ?? null,
            years: this.formatYears(e.startYear, e.endYear, e.isCurrent),
          }));

    const experienceSections =
      template === 'DETAILED'
        ? data.workExperience.map((w) => ({
            jobTitle: w.jobTitle ?? null,
            company: w.company ?? null,
            location: w.location ?? null,
            years: this.formatYears(w.startYear, w.endYear, w.isCurrent),
            description: w.description ?? null,
          }))
        : data.workExperience.map((w) => ({
            jobTitle: w.jobTitle ?? null,
            company: w.company ?? null,
            years: this.formatYears(w.startYear, w.endYear, w.isCurrent),
          }));

    const projectsSections = template
      ? data.projects.map((p) => ({
          title: p.title ?? null,
          description: p.description ?? null,
          externalUrl: p.externalUrl ?? null,
          skills: Array.isArray(p.skills) ? p.skills : [],
          isCurrent: p.isCurrent,
        }))
      : [];

    const referencesSections = data.references.map((r) => ({
      name: r.name ?? null,
      relationship: r.relationship ?? null,
      company: r.company ?? null,
      email: r.email ?? null,
      phone: r.phone ?? null,
      notes: r.notes ?? null,
    }));

    const skills = cv ? coerceStringArray(cv.skills) : [];
    const objective = cv ? coerceNullableString(cv.objective) : null;
    const interests = cv ? coerceStringArray(cv.interests) : [];
    const languages = cv ? coerceStringArray(cv.languages) : [];
    const achievementsAwards = cv ? coerceStringArray(cv.achievementsAwards) : [];
    const activities = cv ? coerceStringArray(cv.activities) : [];
    const publications = cv ? coerceStringArray(cv.publications) : [];
    const signature = cv ? coerceNullableString(cv.signature) : null;
    const additionalInformation = cv
      ? coerceNullableString(cv.additionalInformation)
      : null;

    return {
      template,
      sections: {
        header,
        summary,
        objective,
        skills,
        interests,
        languages,
        achievementsAwards,
        activities,
        publications,
        signature,
        additionalInformation,

        experience: experienceSections,
        education: educationSections,
        projects: projectsSections,
        references: referencesSections,

        // Raw CVwizard “extra sections” from the profile UI.
        cvWizardData: data.profile?.cvWizardData ?? null,
      },
    };
  }

  private asCvWizardData(
    value: Prisma.JsonValue | null | undefined,
  ): CvWizardData | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    return value as CvWizardData;
  }

  private formatYears(
    startYear: number | null,
    endYear: number | null,
    isCurrent: boolean,
  ): string | null {
    if (!startYear && !endYear) return null;
    if (isCurrent) return startYear ? `${startYear} — Present` : 'Present';
    if (!endYear) return startYear ? `${startYear} —` : null;
    return startYear ? `${startYear} — ${endYear}` : null;
  }
}
