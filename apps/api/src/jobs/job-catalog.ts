import type { JobStatus } from '@prisma/client';

export type JobCatalogItem = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  description: string | null;
  status: JobStatus;
  skills: string[];
  externalUrl: string;
  source: 'fallback';
  createdAt: Date;
  updatedAt: Date;
};

export function makeJobSearchUrl(query: string): string {
  return `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(
    query,
  )}`;
}

/** Shown when the database has no jobs yet, so job pages are never empty. */
export function recentJobFallbackCatalog(): JobCatalogItem[] {
  const now = new Date();

  return [
    {
      id: 'fallback-frontend-engineer',
      title: 'Frontend Developer Roles',
      company: 'LinkedIn Jobs',
      location: 'Remote / Hybrid',
      description:
        'Recent frontend openings for candidates building React, TypeScript, UI, and product development skills.',
      status: 'ACTIVE',
      skills: ['react', 'typescript', 'javascript', 'frontend'],
      externalUrl: makeJobSearchUrl('frontend developer react typescript'),
      source: 'fallback',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'fallback-backend-engineer',
      title: 'Backend Developer Roles',
      company: 'LinkedIn Jobs',
      location: 'Remote / On-site',
      description:
        'Recent backend openings focused on Node.js, APIs, databases, and production service development.',
      status: 'ACTIVE',
      skills: ['node', 'typescript', 'api', 'backend'],
      externalUrl: makeJobSearchUrl('backend developer node.js api'),
      source: 'fallback',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'fallback-data-analyst',
      title: 'Data Analyst Roles',
      company: 'LinkedIn Jobs',
      location: 'Remote / Hybrid',
      description:
        'Recent data roles for people growing SQL, Python, analytics, reporting, and problem-solving skills.',
      status: 'ACTIVE',
      skills: ['sql', 'python', 'analytics', 'data'],
      externalUrl: makeJobSearchUrl('data analyst sql python'),
      source: 'fallback',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'fallback-career-development',
      title: 'Early Career & Graduate Roles',
      company: 'LinkedIn Jobs',
      location: 'Entry-level / Remote',
      description:
        'Recent entry-level searches that are useful when you are still building experience, resumes, and interview confidence.',
      status: 'ACTIVE',
      skills: [
        'general career guidance',
        'resume building',
        'interview preparation',
        'job search strategies',
        'professional development',
      ],
      externalUrl: makeJobSearchUrl('entry level graduate trainee remote'),
      source: 'fallback',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'fallback-project-manager',
      title: 'Project Coordinator Roles',
      company: 'LinkedIn Jobs',
      location: 'Remote / Hybrid',
      description:
        'Recent coordinator roles for candidates with communication, leadership, organization, and problem-solving strengths.',
      status: 'ACTIVE',
      skills: ['communication', 'leadership', 'problem solving'],
      externalUrl: makeJobSearchUrl(
        'project coordinator communication leadership',
      ),
      source: 'fallback',
      createdAt: now,
      updatedAt: now,
    },
  ];
}

export function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

export function skillMatches(
  candidateSkill: string,
  requestedSkill: string,
): boolean {
  const candidate = normalizeText(candidateSkill);
  const requested = normalizeText(requestedSkill);
  return (
    candidate === requested ||
    candidate.includes(requested) ||
    requested.includes(candidate)
  );
}
