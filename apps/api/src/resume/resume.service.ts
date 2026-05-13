import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { verifyAccessToken } from '../auth/jwt/jwt-utils';
import { BuildResumeDto, ResumeTemplateId } from './dto/build-resume.dto';

type AuthUser = { sub: string };

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

    if (!profile && education.length === 0 && workExperience.length === 0) {
      return this.formatResume(template, {
        profile: null,
        education: [],
        workExperience: [],
      });
    }

    return this.formatResume(template, { profile, education, workExperience });
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
    },
  ): unknown {
    if (template !== 'STANDARD' && template !== 'DETAILED') {
      throw new BadRequestException('Invalid template');
    }

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

    return {
      template,
      sections: {
        header,
        summary,
        experience: experienceSections,
        education: educationSections,
      },
    };
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
