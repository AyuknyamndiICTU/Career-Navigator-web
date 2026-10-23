import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Prisma } from '../prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  keyOwner,
  OBJECT_STORAGE,
  type ObjectStorage,
} from '../storage/object-storage';
import { BuildResumeDto, ResumeTemplateId } from './dto/build-resume.dto';

type CvWizardData = Record<string, unknown>;

const DEFAULT_TEMPLATE: ResumeTemplateId = 'CLASSIC';

@Injectable()
export class ResumeService {
  private readonly logger = new Logger(ResumeService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  async buildResume(userId: string, dto: BuildResumeDto): Promise<unknown> {
    const template: ResumeTemplateId = dto.template ?? DEFAULT_TEMPLATE;

    // Projects + references are best-effort so existing e2e mocks without them don't break.
    const prismaAny = this.prisma as any;

    // Independent reads run in parallel: one round-trip of latency instead of five.
    const [profile, education, workExperience, projects, references] =
      await Promise.all([
        this.prisma.profile.findUnique({
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
        }),
        this.prisma.education.findMany({
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
        }),
        this.prisma.workExperience.findMany({
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
        }),
        (prismaAny.project
          ?.findMany?.({ where: { userId }, orderBy: { createdAt: 'desc' } })
          .catch(() => []) ?? Promise.resolve([])) as Promise<
          Array<{
            id?: string;
            title: string;
            description: string | null;
            externalUrl: string | null;
            skills: string[];
            isCurrent: boolean;
            createdAt?: Date;
            updatedAt?: Date;
          }>
        >,
        (prismaAny.reference
          ?.findMany?.({ where: { userId }, orderBy: { createdAt: 'desc' } })
          .catch(() => []) ?? Promise.resolve([])) as Promise<
          Array<{
            id?: string;
            name: string;
            relationship: string | null;
            company: string | null;
            email: string | null;
            phone: string | null;
            notes: string | null;
            createdAt?: Date;
            updatedAt?: Date;
          }>
        >,
      ]);

    if (
      !profile &&
      education.length === 0 &&
      workExperience.length === 0 &&
      projects.length === 0 &&
      references.length === 0
    ) {
      return this.formatResume(
        template,
        {
          profile: null,
          education: [],
          workExperience: [],
          projects: [],
          references: [],
        },
        null,
      );
    }

    return this.formatResume(
      template,
      {
        profile,
        education,
        workExperience,
        projects,
        references,
      },
      await this.photoUrl(userId, profile?.cvWizardData ?? null),
    );
  }

  /** Presigned link to the user's own photo; keys of other users are never signed. */
  private async photoUrl(
    userId: string,
    cvWizardData: Prisma.JsonValue | null,
  ): Promise<string | null> {
    const key = this.asCvWizardData(cvWizardData)?.photoUrl;
    if (
      typeof key !== 'string' ||
      keyOwner(key) !== userId ||
      !this.storage.configured
    )
      return null;
    try {
      // Long enough to view and print the resume.
      return await this.storage.presignGet(key, { expiresInSeconds: 3600 });
    } catch (err) {
      this.logger.warn(`Could not sign the resume photo: ${String(err)}`);
      return null;
    }
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
    photoUrl: string | null,
  ): unknown {
    const VALID_TEMPLATES = [
      'CLASSIC',
      'MODERN',
      'MINIMAL',
      'CREATIVE',
      'PROFESSIONAL',
      'EXECUTIVE',
    ] as const;
    if (!(VALID_TEMPLATES as readonly string[]).includes(template)) {
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
        photoUrl,
      },
    };

    const summary = data.profile?.summary ?? null;

    const educationSections = data.education.map((e) => ({
      degree: e.degree ?? null,
      fieldOfStudy: e.fieldOfStudy ?? null,
      institution: e.institution ?? null,
      years: this.formatYears(e.startYear, e.endYear, e.isCurrent),
      grade: e.grade ?? null,
      description: e.description ?? null,
    }));

    const experienceSections = data.workExperience.map((w) => ({
      jobTitle: w.jobTitle ?? null,
      company: w.company ?? null,
      location: w.location ?? null,
      years: this.formatYears(w.startYear, w.endYear, w.isCurrent),
      description: w.description ?? null,
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
    const achievementsAwards = cv
      ? coerceStringArray(cv.achievementsAwards)
      : [];
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
