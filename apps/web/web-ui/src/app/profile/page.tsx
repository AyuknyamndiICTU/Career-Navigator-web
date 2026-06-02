// @ts-nocheck
'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import DashboardLayout from '@/components/DashboardLayout';
import { apiFetch } from '@/lib/auth';
import ErrorAlert from '@/components/ErrorAlert';

type CvWizardData = {
  email?: string | null;
  address?: string | null;
  dateOfBirth?: string | null;
  website?: string | null;
  linkedIn?: string | null;
  photoUrl?: string | null;
  objective?: string | null;
  skills?: string[];
  additionalInformation?: string | null;
  interests?: string[];
  languages?: string[];
  achievementsAwards?: string[];
  activities?: string[];
  publications?: string[];
  signature?: string | null;
};

type Profile = {
  firstName?: string | null;
  lastName?: string | null;
  headline?: string | null;
  phone?: string | null;
  location?: string | null;
  summary?: string | null;
  cvWizardData?: CvWizardData | null;
};

type Education = {
  id?: string;
  degree?: string | null;
  institution?: string | null;
  startYear?: number | null;
  endYear?: number | null;
  grade?: string | null;
};

type WorkExperience = {
  id?: string;
  company?: string | null;
  jobTitle?: string | null;
  startYear?: number | null;
  endYear?: number | null;
  description?: string | null;
  isCurrent?: boolean;
};

const inputClass =
  'w-full px-5 py-3.5 bg-slate-50 rounded-2xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 transition-all font-medium text-slate-800 shadow-sm';

const textareaClass =
  'w-full px-5 py-4 bg-slate-50 rounded-2xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 transition-all font-medium text-slate-800 shadow-sm min-h-[120px]';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

function listToText(value: unknown): string {
  return asStringList(value).join(', ');
}

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function optionalString(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function optionalYear(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const year = Number(trimmed);
  return Number.isInteger(year) ? year : undefined;
}

function compactCvData(data: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => {
      if (Array.isArray(value)) return value.length > 0;
      return value !== undefined && value !== null && value !== '';
    }),
  );
}

function hasValues(data: Record<string, unknown>): boolean {
  return Object.values(data).some(
    (value) => value !== undefined && value !== null && value !== '',
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  className = '',
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-sm font-bold text-slate-700 mb-2 block">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
        placeholder={placeholder}
      />
    </label>
  );
}

function TextAreaField({ label, value, onChange, placeholder, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-sm font-bold text-slate-700 mb-2 block">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={textareaClass}
        placeholder={placeholder}
      />
    </label>
  );
}

function SectionTitle({ title, description }) {
  return (
    <div className="mb-5">
      <h3 className="text-base font-extrabold text-slate-900">{title}</h3>
      {description ? (
        <p className="mt-1 text-sm leading-relaxed text-slate-500">{description}</p>
      ) : null}
    </div>
  );
}

function formatYears(startYear?: number | null, endYear?: number | null, isCurrent?: boolean) {
  if (isCurrent) return startYear ? `${startYear} - Present` : 'Present';
  if (startYear && endYear) return `${startYear} - ${endYear}`;
  if (startYear) return String(startYear);
  if (endYear) return String(endYear);
  return '';
}

export default function ProfilePage() {
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sectionSaving, setSectionSaving] = useState('');
  const [deletingId, setDeletingId] = useState('');
  const [error, setError] = useState('');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [education, setEducation] = useState<Education[]>([]);
  const [workExperience, setWorkExperience] = useState<WorkExperience[]>([]);

  const form = useMemo(() => {
    const cv = asRecord(profile?.cvWizardData);

    return {
      firstName: profile?.firstName ?? '',
      lastName: profile?.lastName ?? '',
      headline: profile?.headline ?? '',
      phone: profile?.phone ?? '',
      location: profile?.location ?? '',
      summary: profile?.summary ?? '',
      email: asString(cv.email),
      address: asString(cv.address),
      dateOfBirth: asString(cv.dateOfBirth),
      website: asString(cv.website),
      linkedIn: asString(cv.linkedIn),
      photoUrl: asString(cv.photoUrl),
      objective: asString(cv.objective),
      skillsText: listToText(cv.skills),
      additionalInformation: asString(cv.additionalInformation),
      interestsText: listToText(cv.interests),
      languagesText: listToText(cv.languages),
      achievementsAwardsText: listToText(cv.achievementsAwards),
      activitiesText: listToText(cv.activities),
      publicationsText: listToText(cv.publications),
      signature: asString(cv.signature),
    };
  }, [profile]);

  const [draft, setDraft] = useState(form);
  const [educationDraft, setEducationDraft] = useState({
    degree: '',
    institution: '',
    grade: '',
    startYear: '',
    endYear: '',
  });
  const [experienceDraft, setExperienceDraft] = useState({
    company: '',
    jobTitle: '',
    startYear: '',
    endYear: '',
    description: '',
    isCurrent: false,
  });

  useEffect(() => {
    setDraft(form);
  }, [form]);

  async function loadEducation() {
    const res = (await apiFetch('/profile/education', { method: 'GET' })) as Education[];
    setEducation(Array.isArray(res) ? res : []);
  }

  async function loadWorkExperience() {
    const res = (await apiFetch('/profile/work-experience', { method: 'GET' })) as WorkExperience[];
    setWorkExperience(Array.isArray(res) ? res : []);
  }

  useEffect(() => {
    let mounted = true;

    async function load() {
      setBusy(true);
      setError('');
      try {
        const [profileRes, educationRes, workExperienceRes] = await Promise.all([
          apiFetch('/profile', { method: 'GET' }),
          apiFetch('/profile/education', { method: 'GET' }),
          apiFetch('/profile/work-experience', { method: 'GET' }),
        ]);

        if (!mounted) return;
        setProfile(profileRes as Profile);
        setEducation(Array.isArray(educationRes) ? educationRes : []);
        setWorkExperience(Array.isArray(workExperienceRes) ? workExperienceRes : []);
      } catch (e) {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : 'Failed to load profile');
      } finally {
        if (mounted) setBusy(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  async function onSave(e) {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const cvWizardData = compactCvData({
        email: optionalString(draft.email),
        address: optionalString(draft.address),
        dateOfBirth: optionalString(draft.dateOfBirth),
        website: optionalString(draft.website),
        linkedIn: optionalString(draft.linkedIn),
        photoUrl: optionalString(draft.photoUrl),
        objective: optionalString(draft.objective),
        skills: splitList(draft.skillsText),
        additionalInformation: optionalString(draft.additionalInformation),
        interests: splitList(draft.interestsText),
        languages: splitList(draft.languagesText),
        achievementsAwards: splitList(draft.achievementsAwardsText),
        activities: splitList(draft.activitiesText),
        publications: splitList(draft.publicationsText),
        signature: optionalString(draft.signature),
      });

      const payload = {
        firstName: draft.firstName.trim() || undefined,
        lastName: draft.lastName.trim() || undefined,
        headline: draft.headline.trim() || undefined,
        phone: draft.phone.trim() || undefined,
        location: draft.location.trim() || undefined,
        summary: draft.summary.trim() || undefined,
        cvWizardData,
      };

      const res = await apiFetch('/profile', { method: 'PUT', body: payload });
      setProfile(res as Profile);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  }

  async function onCreateEducation(e) {
    e.preventDefault();
    setSectionSaving('education');
    setError('');

    try {
      const payload = {
        degree: optionalString(educationDraft.degree),
        institution: optionalString(educationDraft.institution),
        grade: optionalString(educationDraft.grade),
        startYear: optionalYear(educationDraft.startYear),
        endYear: optionalYear(educationDraft.endYear),
      };

      if (!hasValues(payload)) {
        throw new Error('Add at least one education detail');
      }

      await apiFetch('/profile/education', { method: 'POST', body: payload });
      setEducationDraft({
        degree: '',
        institution: '',
        grade: '',
        startYear: '',
        endYear: '',
      });
      await loadEducation();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add education');
    } finally {
      setSectionSaving('');
    }
  }

  async function onCreateExperience(e) {
    e.preventDefault();
    setSectionSaving('experience');
    setError('');

    try {
      const details = {
        company: optionalString(experienceDraft.company),
        jobTitle: optionalString(experienceDraft.jobTitle),
        startYear: optionalYear(experienceDraft.startYear),
        endYear: experienceDraft.isCurrent
          ? undefined
          : optionalYear(experienceDraft.endYear),
        description: optionalString(experienceDraft.description),
      };

      if (!hasValues(details)) {
        throw new Error('Add at least one experience detail');
      }

      await apiFetch('/profile/work-experience', {
        method: 'POST',
        body: {
          ...details,
          isCurrent: experienceDraft.isCurrent,
        },
      });
      setExperienceDraft({
        company: '',
        jobTitle: '',
        startYear: '',
        endYear: '',
        description: '',
        isCurrent: false,
      });
      await loadWorkExperience();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add experience');
    } finally {
      setSectionSaving('');
    }
  }

  async function onDeleteEducation(educationId: string) {
    setDeletingId(`education:${educationId}`);
    setError('');
    try {
      await apiFetch(`/profile/education/${educationId}`, { method: 'DELETE' });
      await loadEducation();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete education');
    } finally {
      setDeletingId('');
    }
  }

  async function onDeleteExperience(workExperienceId: string) {
    setDeletingId(`experience:${workExperienceId}`);
    setError('');
    try {
      await apiFetch(`/profile/work-experience/${workExperienceId}`, {
        method: 'DELETE',
      });
      await loadWorkExperience();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete experience');
    } finally {
      setDeletingId('');
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto pb-12">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative overflow-hidden rounded-3xl p-8 md:p-10 mb-8"
          style={{
            background:
              'linear-gradient(135deg, #e11d48 0%, #f43f5e 50%, #fb7185 100%)',
          }}
        >
          <div className="relative z-10 max-w-3xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/15 backdrop-blur-sm rounded-full text-white/90 text-xs font-semibold mb-4"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              Resume Profile
            </motion.div>

            <h1 className="text-3xl md:text-4xl font-extrabold text-white leading-tight">
              Your Profile
            </h1>
            <p className="mt-3 text-white/85 text-sm md:text-base leading-relaxed max-w-2xl">
              Manage your personal details, CV sections, education, and work
              experience from one place.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/profile"
                className="px-5 py-2.5 rounded-xl bg-white text-rose-600 text-sm font-bold shadow-lg transition-transform hover:-translate-y-0.5"
              >
                Personal Details
              </Link>
              <Link
                href="/profile/cv"
                className="px-5 py-2.5 rounded-xl bg-white/15 text-white text-sm font-bold hover:bg-white/20 transition-all border border-white/20"
              >
                CV Upload
              </Link>
              <Link
                href="/profile/projects"
                className="px-5 py-2.5 rounded-xl bg-white/15 text-white text-sm font-bold hover:bg-white/20 transition-all border border-white/20"
              >
                Projects
              </Link>
              <Link
                href="/profile/references"
                className="px-5 py-2.5 rounded-xl bg-white/15 text-white text-sm font-bold hover:bg-white/20 transition-all border border-white/20"
              >
                References
              </Link>
            </div>
          </div>
        </motion.div>

        <ErrorAlert error={error} />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-3xl shadow-card overflow-hidden border border-surface-border"
        >
          <div className="px-8 py-5 border-b border-surface-border bg-slate-50/50 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-500">
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                Account Details
              </h2>
              <p className="text-sm text-slate-500">
                Personal details and CV wizard information.
              </p>
            </div>
          </div>

          <div className="p-8">
            {busy ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center shadow-lg animate-pulse mb-4">
                  <svg
                    className="w-8 h-8 text-white animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                </div>
                <div className="text-sm font-bold text-slate-700">
                  Loading profile data...
                </div>
              </div>
            ) : (
              <form onSubmit={onSave} className="space-y-8">
                <section>
                  <SectionTitle
                    title="Professional Identity"
                    description="This information appears at the top of your resume and profile."
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <TextField
                      label="First name"
                      value={draft.firstName}
                      onChange={(value) =>
                        setDraft((d) => ({ ...d, firstName: value }))
                      }
                    />
                    <TextField
                      label="Last name"
                      value={draft.lastName}
                      onChange={(value) =>
                        setDraft((d) => ({ ...d, lastName: value }))
                      }
                    />
                    <TextField
                      label="Headline"
                      value={draft.headline}
                      onChange={(value) =>
                        setDraft((d) => ({ ...d, headline: value }))
                      }
                      placeholder="e.g. Senior Software Engineer at Tech Corp"
                      className="sm:col-span-2"
                    />
                    <TextField
                      label="Phone"
                      value={draft.phone}
                      onChange={(value) =>
                        setDraft((d) => ({ ...d, phone: value }))
                      }
                    />
                    <TextField
                      label="Location"
                      value={draft.location}
                      onChange={(value) =>
                        setDraft((d) => ({ ...d, location: value }))
                      }
                      placeholder="e.g. Lagos, Nigeria"
                    />
                    <TextAreaField
                      label="Professional Summary"
                      value={draft.summary}
                      onChange={(value) =>
                        setDraft((d) => ({ ...d, summary: value }))
                      }
                      placeholder="Briefly describe your career goals and background..."
                      className="sm:col-span-2"
                    />
                  </div>
                </section>

                <section className="border-t border-slate-100 pt-7">
                  <SectionTitle
                    title="Personal Details"
                    description="Optional contact and identity fields inspired by the CV builder screens."
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <TextField
                      label="Email"
                      type="email"
                      value={draft.email}
                      onChange={(value) =>
                        setDraft((d) => ({ ...d, email: value }))
                      }
                      placeholder="e.g. you@example.com"
                    />
                    <TextField
                      label="Address"
                      value={draft.address}
                      onChange={(value) =>
                        setDraft((d) => ({ ...d, address: value }))
                      }
                      placeholder="Street, city, country"
                    />
                    <TextField
                      label="Date of Birth"
                      type="date"
                      value={draft.dateOfBirth}
                      onChange={(value) =>
                        setDraft((d) => ({ ...d, dateOfBirth: value }))
                      }
                    />
                    <TextField
                      label="Website"
                      type="url"
                      value={draft.website}
                      onChange={(value) =>
                        setDraft((d) => ({ ...d, website: value }))
                      }
                      placeholder="https://your-site.com"
                    />
                    <TextField
                      label="LinkedIn"
                      type="url"
                      value={draft.linkedIn}
                      onChange={(value) =>
                        setDraft((d) => ({ ...d, linkedIn: value }))
                      }
                      placeholder="https://linkedin.com/in/you"
                    />
                    <TextField
                      label="Photo URL"
                      type="url"
                      value={draft.photoUrl}
                      onChange={(value) =>
                        setDraft((d) => ({ ...d, photoUrl: value }))
                      }
                      placeholder="https://..."
                    />
                  </div>
                </section>

                <section className="border-t border-slate-100 pt-7">
                  <SectionTitle
                    title="CV Sections"
                    description="Use comma-separated lists for skills, interests, languages, awards, activities, and publications."
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <TextAreaField
                      label="Objective"
                      value={draft.objective}
                      onChange={(value) =>
                        setDraft((d) => ({ ...d, objective: value }))
                      }
                      placeholder="Your resume objective..."
                      className="sm:col-span-2"
                    />
                    <TextField
                      label="Skills"
                      value={draft.skillsText}
                      onChange={(value) =>
                        setDraft((d) => ({ ...d, skillsText: value }))
                      }
                      placeholder="JavaScript, React, Communication"
                      className="sm:col-span-2"
                    />
                    <TextAreaField
                      label="Additional Information"
                      value={draft.additionalInformation}
                      onChange={(value) =>
                        setDraft((d) => ({
                          ...d,
                          additionalInformation: value,
                        }))
                      }
                      placeholder="Other resume details..."
                      className="sm:col-span-2"
                    />
                    <TextField
                      label="Interests"
                      value={draft.interestsText}
                      onChange={(value) =>
                        setDraft((d) => ({ ...d, interestsText: value }))
                      }
                      placeholder="Mentoring, open source"
                    />
                    <TextField
                      label="Languages"
                      value={draft.languagesText}
                      onChange={(value) =>
                        setDraft((d) => ({ ...d, languagesText: value }))
                      }
                      placeholder="English, French"
                    />
                    <TextField
                      label="Achievements & Awards"
                      value={draft.achievementsAwardsText}
                      onChange={(value) =>
                        setDraft((d) => ({
                          ...d,
                          achievementsAwardsText: value,
                        }))
                      }
                      placeholder="Dean's List, Hackathon Winner"
                    />
                    <TextField
                      label="Activities"
                      value={draft.activitiesText}
                      onChange={(value) =>
                        setDraft((d) => ({ ...d, activitiesText: value }))
                      }
                      placeholder="Volunteer tutor, tech club"
                    />
                    <TextField
                      label="Publication"
                      value={draft.publicationsText}
                      onChange={(value) =>
                        setDraft((d) => ({ ...d, publicationsText: value }))
                      }
                      placeholder="Article title, paper title"
                    />
                    <TextField
                      label="Signature"
                      value={draft.signature}
                      onChange={(value) =>
                        setDraft((d) => ({ ...d, signature: value }))
                      }
                      placeholder="Name or sign-off"
                    />
                  </div>
                </section>

                <section className="border-t border-slate-100 pt-7">
                  <SectionTitle
                    title="More Resume Sections"
                    description="Projects and references are available as focused profile pages."
                  />
                  <div className="flex flex-wrap gap-3">
                    <Link
                      href="/profile/projects"
                      className="px-5 py-3 rounded-2xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-700 hover:border-rose-200 hover:text-rose-600"
                    >
                      Manage Projects
                    </Link>
                    <Link
                      href="/profile/references"
                      className="px-5 py-3 rounded-2xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-700 hover:border-rose-200 hover:text-rose-600"
                    >
                      Manage References
                    </Link>
                  </div>
                </section>

                <div className="pt-4 border-t border-slate-100 flex justify-end">
                  <button
                    disabled={saving}
                    type="submit"
                    className="px-8 py-3.5 bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-2xl text-sm font-bold hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-md flex items-center gap-2"
                  >
                    {saving ? (
                      <>
                        <svg
                          className="w-5 h-5 animate-spin"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                          />
                        </svg>
                        Saving...
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </motion.div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-3xl shadow-card overflow-hidden border border-surface-border"
          >
            <div className="px-6 py-4 border-b border-surface-border bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-800">Education</h2>
              <p className="text-sm text-slate-500">
                Course, school, grade, and years.
              </p>
            </div>

            <form className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-5" onSubmit={onCreateEducation}>
              <TextField
                label="Course / Degree"
                value={educationDraft.degree}
                onChange={(value) =>
                  setEducationDraft((d) => ({ ...d, degree: value }))
                }
                placeholder="e.g. BSc Computer Science"
                className="sm:col-span-2"
              />
              <TextField
                label="School / University"
                value={educationDraft.institution}
                onChange={(value) =>
                  setEducationDraft((d) => ({ ...d, institution: value }))
                }
                placeholder="e.g. University of Lagos"
                className="sm:col-span-2"
              />
              <TextField
                label="Grade / Score"
                value={educationDraft.grade}
                onChange={(value) =>
                  setEducationDraft((d) => ({ ...d, grade: value }))
                }
                placeholder="e.g. First Class"
              />
              <TextField
                label="Start Year"
                value={educationDraft.startYear}
                onChange={(value) =>
                  setEducationDraft((d) => ({ ...d, startYear: value }))
                }
                placeholder="2020"
              />
              <TextField
                label="End Year"
                value={educationDraft.endYear}
                onChange={(value) =>
                  setEducationDraft((d) => ({ ...d, endYear: value }))
                }
                placeholder="2024"
                className="sm:col-span-2"
              />

              <div className="sm:col-span-2 flex justify-end pt-2 border-t border-slate-100">
                <button
                  disabled={sectionSaving === 'education'}
                  type="submit"
                  className="px-6 py-3 bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-2xl text-sm font-bold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                >
                  {sectionSaving === 'education' ? 'Adding...' : 'Add Education'}
                </button>
              </div>
            </form>

            <div className="px-6 pb-6 space-y-3">
              {education.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 border border-surface-border p-4 text-sm text-slate-500">
                  No education entries yet.
                </div>
              ) : (
                education.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-surface-border p-4 bg-white shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-extrabold text-slate-900">
                          {item.degree || 'Education'}
                        </h3>
                        {item.institution ? (
                          <p className="text-sm text-slate-600 mt-1">
                            {item.institution}
                          </p>
                        ) : null}
                        <p className="text-sm text-slate-500 mt-1">
                          {[item.grade, formatYears(item.startYear, item.endYear)]
                            .filter(Boolean)
                            .join(' - ')}
                        </p>
                      </div>
                      {item.id ? (
                        <button
                          type="button"
                          disabled={deletingId === `education:${item.id}`}
                          onClick={() => void onDeleteEducation(item.id as string)}
                          className="px-4 py-2 rounded-xl bg-rose-50 text-rose-700 text-sm font-bold border border-rose-100 hover:bg-rose-100 transition disabled:opacity-50"
                        >
                          {deletingId === `education:${item.id}`
                            ? 'Deleting...'
                            : 'Delete'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="bg-white rounded-3xl shadow-card overflow-hidden border border-surface-border"
          >
            <div className="px-6 py-4 border-b border-surface-border bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-800">Experience</h2>
              <p className="text-sm text-slate-500">
                Company, job title, dates, and details.
              </p>
            </div>

            <form className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-5" onSubmit={onCreateExperience}>
              <TextField
                label="Company Name"
                value={experienceDraft.company}
                onChange={(value) =>
                  setExperienceDraft((d) => ({ ...d, company: value }))
                }
                placeholder="e.g. Acme"
                className="sm:col-span-2"
              />
              <TextField
                label="Job Title"
                value={experienceDraft.jobTitle}
                onChange={(value) =>
                  setExperienceDraft((d) => ({ ...d, jobTitle: value }))
                }
                placeholder="e.g. Product Designer"
                className="sm:col-span-2"
              />
              <TextField
                label="Start Year"
                value={experienceDraft.startYear}
                onChange={(value) =>
                  setExperienceDraft((d) => ({ ...d, startYear: value }))
                }
                placeholder="2021"
              />
              <TextField
                label="End Year"
                value={experienceDraft.endYear}
                onChange={(value) =>
                  setExperienceDraft((d) => ({ ...d, endYear: value }))
                }
                placeholder="2024"
              />
              <label className="flex items-center gap-3 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={experienceDraft.isCurrent}
                  onChange={(e) =>
                    setExperienceDraft((d) => ({
                      ...d,
                      isCurrent: e.target.checked,
                    }))
                  }
                  className="w-5 h-5"
                />
                <span className="text-sm font-bold text-slate-700">
                  I currently work here
                </span>
              </label>
              <TextAreaField
                label="Details"
                value={experienceDraft.description}
                onChange={(value) =>
                  setExperienceDraft((d) => ({ ...d, description: value }))
                }
                placeholder="Responsibilities, achievements, tools..."
                className="sm:col-span-2"
              />

              <div className="sm:col-span-2 flex justify-end pt-2 border-t border-slate-100">
                <button
                  disabled={sectionSaving === 'experience'}
                  type="submit"
                  className="px-6 py-3 bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-2xl text-sm font-bold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                >
                  {sectionSaving === 'experience'
                    ? 'Adding...'
                    : 'Add Experience'}
                </button>
              </div>
            </form>

            <div className="px-6 pb-6 space-y-3">
              {workExperience.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 border border-surface-border p-4 text-sm text-slate-500">
                  No work experience entries yet.
                </div>
              ) : (
                workExperience.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-surface-border p-4 bg-white shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="font-extrabold text-slate-900">
                          {item.jobTitle || 'Experience'}
                        </h3>
                        {item.company ? (
                          <p className="text-sm text-slate-600 mt-1">
                            {item.company}
                          </p>
                        ) : null}
                        <p className="text-sm text-slate-500 mt-1">
                          {formatYears(
                            item.startYear,
                            item.endYear,
                            item.isCurrent,
                          )}
                        </p>
                        {item.description ? (
                          <p className="text-sm text-slate-600 mt-2 whitespace-pre-wrap">
                            {item.description}
                          </p>
                        ) : null}
                      </div>
                      {item.id ? (
                        <button
                          type="button"
                          disabled={deletingId === `experience:${item.id}`}
                          onClick={() =>
                            void onDeleteExperience(item.id as string)
                          }
                          className="px-4 py-2 rounded-xl bg-rose-50 text-rose-700 text-sm font-bold border border-rose-100 hover:bg-rose-100 transition disabled:opacity-50"
                        >
                          {deletingId === `experience:${item.id}`
                            ? 'Deleting...'
                            : 'Delete'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  );
}
