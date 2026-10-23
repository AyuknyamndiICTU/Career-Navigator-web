'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import DashboardLayout from '@/components/DashboardLayout';
import { apiFetch, apiFetchFile } from '@/lib/auth';
import { resizeProfilePhoto } from '@/lib/image-resize';
import SuccessToast from '@/components/SuccessToast';

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
  fieldOfStudy?: string | null;
  institution?: string | null;
  startYear?: number | null;
  endYear?: number | null;
  grade?: string | null;
  description?: string | null;
  isCurrent?: boolean;
};

type WorkExperience = {
  id?: string;
  company?: string | null;
  jobTitle?: string | null;
  location?: string | null;
  startYear?: number | null;
  endYear?: number | null;
  description?: string | null;
  isCurrent?: boolean;
};

const inputClass =
  'w-full px-5 py-3.5 bg-slate-50 rounded-2xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 transition-all font-medium text-slate-800 shadow-sm';

const inputErrorClass =
  'w-full px-5 py-3.5 bg-red-50 rounded-2xl text-sm border border-red-300 focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400 transition-all font-medium text-slate-800 shadow-sm';

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
  return Number.isInteger(year) && year >= 1900 && year <= 2100 ? year : undefined;
}

function compactCvData(data: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => {
      if (Array.isArray(value)) return value.length > 0;
      return value !== undefined && value !== null && value !== '';
    }),
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  className = '',
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  className?: string;
  error?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-sm font-bold text-slate-700 mb-2 block">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={error ? inputErrorClass : inputClass}
        placeholder={placeholder}
      />
      {error && <p className="mt-1 text-xs text-red-600 font-medium">{error}</p>}
    </label>
  );
}

function TextAreaField({ label, value, onChange, placeholder, className = '' }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
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

function SectionTitle({ title, description }: { title: string; description?: string }) {
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
  const [deletingId, setDeletingId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [sectionSuccess, setSectionSuccess] = useState('');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [education, setEducation] = useState<Education[]>([]);
  const [workExperience, setWorkExperience] = useState<WorkExperience[]>([]);
  const [phoneError, setPhoneError] = useState('');
  const [dirty, setDirty] = useState(false);

  // Photo upload
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Education & Experience form toggle
  const [showEduForm, setShowEduForm] = useState(false);
  const [showExpForm, setShowExpForm] = useState(false);

  // Year validation
  const [eduYearError, setEduYearError] = useState('');
  const [expYearError, setExpYearError] = useState('');

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

  useEffect(() => {
    setDraft(form);
    // form.photoUrl is a private storage key: ask the API for a short-lived download link.
    if (!form.photoUrl) return;
    let active = true;
    apiFetch(`/upload/url?key=${encodeURIComponent(form.photoUrl)}`, { method: 'GET' })
      .then((res: { url: string }) => {
        if (active) setPhotoPreview(res.url);
      })
      .catch((e: unknown) => console.warn('Could not load the profile photo:', e));
    return () => {
      active = false;
    };
  }, [form]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  function markDirty() {
    if (!dirty) setDirty(true);
  }

  function validatePhone(value: string): boolean {
    if (!value.trim()) {
      setPhoneError('');
      return true;
    }
    const valid = /^\+?[\d\s\-().]{7,20}$/.test(value.trim());
    if (!valid) {
      setPhoneError('Enter a valid phone number (e.g. +234 800 555 1234)');
    } else {
      setPhoneError('');
    }
    return valid;
  }

  function validateYears(startRaw: string, endRaw: string, isCurrent: boolean): string {
    const startYear = optionalYear(startRaw);
    const endYear = optionalYear(endRaw);
    if (startYear && endYear && !isCurrent && endYear < startYear) {
      return 'End year must be after start year';
    }
    return '';
  }

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

  // ---- PHOTO UPLOAD ----
  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoUploading(true);
    setError('');
    try {
      const upload = await resizeProfilePhoto(file);
      const formData = new FormData();
      formData.append('file', upload);
      const res = (await apiFetchFile('/upload/picture', formData)) as { objectKey?: string };
      const objectKey = res?.objectKey;
      if (objectKey) {
        setPhotoPreview(URL.createObjectURL(upload));
        // Store objectKey in draft (will be saved with Save Changes)
        setDraft((d) => ({ ...d, photoUrl: objectKey }));
        markDirty();
        setSectionSuccess('Photo uploaded! Click Save Changes to keep it.');
        setTimeout(() => setSectionSuccess(''), 4000);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to upload photo');
    } finally {
      setPhotoUploading(false);
      // Reset file input
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  }

  // ---- SAVE ALL ----
  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    if (!validatePhone(draft.phone)) {
      setError('Please fix the phone number format before saving.');
      setSaving(false);
      return;
    }

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
      setDirty(false);
      setSuccess('Profile saved successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  }

  // ---- EDUCATION ----
  async function onCreateEducation(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSectionSuccess('');
    setEduYearError('');

    const degreeVal = optionalString(eduDraft.degree);
    const institutionVal = optionalString(eduDraft.institution);
    if (!degreeVal && !institutionVal) {
      setError('Add at least a degree or institution for education.');
      return;
    }

    const yearErr = validateYears(eduDraft.startYear, eduDraft.endYear, eduDraft.isCurrent);
    if (yearErr) {
      setEduYearError(yearErr);
      return;
    }

    try {
      const payload = {
        degree: degreeVal,
        fieldOfStudy: optionalString(eduDraft.fieldOfStudy),
        institution: institutionVal,
        grade: optionalString(eduDraft.grade),
        startYear: optionalYear(eduDraft.startYear),
        endYear: eduDraft.isCurrent ? undefined : optionalYear(eduDraft.endYear),
        description: optionalString(eduDraft.description),
        isCurrent: eduDraft.isCurrent,
      };

      await apiFetch('/profile/education', { method: 'POST', body: payload });
      setEduDraft({ degree: '', fieldOfStudy: '', institution: '', grade: '', startYear: '', endYear: '', description: '', isCurrent: false });
      setEduYearError('');
      setShowEduForm(false);
      await loadEducation();
      setSectionSuccess('Education added!');
      setTimeout(() => setSectionSuccess(''), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add education');
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

  // ---- EXPERIENCE ----
  async function onCreateExperience(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSectionSuccess('');
    setExpYearError('');

    const companyVal = optionalString(expDraft.company);
    const jobVal = optionalString(expDraft.jobTitle);
    if (!companyVal && !jobVal) {
      setError('Add at least a company or job title for experience.');
      return;
    }

    const yearErr = validateYears(expDraft.startYear, expDraft.endYear, expDraft.isCurrent);
    if (yearErr) {
      setExpYearError(yearErr);
      return;
    }

    try {
      const details = {
        company: companyVal,
        jobTitle: jobVal,
        location: optionalString(expDraft.location),
        startYear: optionalYear(expDraft.startYear),
        endYear: expDraft.isCurrent ? undefined : optionalYear(expDraft.endYear),
        description: optionalString(expDraft.description),
      };

      await apiFetch('/profile/work-experience', {
        method: 'POST',
        body: { ...details, isCurrent: expDraft.isCurrent },
      });
      setExpDraft({ company: '', jobTitle: '', location: '', startYear: '', endYear: '', description: '', isCurrent: false });
      setExpYearError('');
      setShowExpForm(false);
      await loadWorkExperience();
      setSectionSuccess('Experience added!');
      setTimeout(() => setSectionSuccess(''), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add experience');
    }
  }

  async function onDeleteExperience(workExperienceId: string) {
    setDeletingId(`experience:${workExperienceId}`);
    setError('');
    try {
      await apiFetch(`/profile/work-experience/${workExperienceId}`, { method: 'DELETE' });
      await loadWorkExperience();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete experience');
    } finally {
      setDeletingId('');
    }
  }

  // Education draft state
  const [eduDraft, setEduDraft] = useState({
    degree: '', fieldOfStudy: '', institution: '', grade: '',
    startYear: '', endYear: '', description: '', isCurrent: false,
  });

  // Experience draft state
  const [expDraft, setExpDraft] = useState({
    company: '', jobTitle: '', location: '',
    startYear: '', endYear: '', description: '', isCurrent: false,
  });

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto pb-12">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative overflow-hidden rounded-3xl p-8 md:p-10 mb-8"
          style={{ background: 'linear-gradient(135deg, #e11d48 0%, #f43f5e 50%, #fb7185 100%)' }}
        >
          <div className="relative z-10 max-w-3xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/15 backdrop-blur-sm rounded-full text-white/90 text-xs font-semibold mb-4"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Resume Profile
            </motion.div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-white leading-tight">Your Profile</h1>
            <p className="mt-3 text-white/85 text-sm md:text-base leading-relaxed max-w-2xl">
              Manage your personal details, CV sections, education, and work experience from one place. All saved together.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/profile" className="px-5 py-2.5 rounded-xl bg-white text-rose-600 text-sm font-bold shadow-lg transition-transform hover:-translate-y-0.5">Personal Details</Link>
              <Link href="/profile/cv" className="px-5 py-2.5 rounded-xl bg-white/15 text-white text-sm font-bold hover:bg-white/20 transition-all border border-white/20">CV Upload</Link>
              <Link href="/profile/projects" className="px-5 py-2.5 rounded-xl bg-white/15 text-white text-sm font-bold hover:bg-white/20 transition-all border border-white/20">Projects</Link>
              <Link href="/profile/references" className="px-5 py-2.5 rounded-xl bg-white/15 text-white text-sm font-bold hover:bg-white/20 transition-all border border-white/20">References</Link>
            </div>
          </div>
        </motion.div>

        <SuccessToast message={success} />
        <SuccessToast message={sectionSuccess} />
        <SuccessToast message={error ? error : ''} isError />

        {/* Account Details */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="bg-white rounded-3xl shadow-card overflow-hidden border border-surface-border"
        >
          <div className="px-8 py-5 border-b border-surface-border bg-slate-50/50 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-500">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Account Details</h2>
              <p className="text-sm text-slate-500">Personal details, photo, and CV wizard information.</p>
            </div>
          </div>

          <div className="p-8">
            {busy ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center shadow-lg animate-pulse mb-4">
                  <svg className="w-8 h-8 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
                <div className="text-sm font-bold text-slate-700">Loading profile data...</div>
              </div>
            ) : (
              <form onSubmit={onSave} className="space-y-8">
                {/* Professional Identity */}
                <section>
                  <SectionTitle title="Professional Identity" description="Appears at the top of your resume and profile." />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <TextField label="First name" value={draft.firstName} onChange={(v) => { setDraft((d) => ({ ...d, firstName: v })); markDirty(); }} />
                    <TextField label="Last name" value={draft.lastName} onChange={(v) => { setDraft((d) => ({ ...d, lastName: v })); markDirty(); }} />
                    <TextField label="Headline" value={draft.headline} onChange={(v) => { setDraft((d) => ({ ...d, headline: v })); markDirty(); }} placeholder="e.g. Senior Software Engineer" className="sm:col-span-2" />
                    <TextField label="Phone" value={draft.phone} onChange={(v) => { setDraft((d) => ({ ...d, phone: v })); markDirty(); validatePhone(v); }} placeholder="e.g. +234 800 555 1234" error={phoneError} />
                    <TextField label="Location" value={draft.location} onChange={(v) => { setDraft((d) => ({ ...d, location: v })); markDirty(); }} placeholder="e.g. Lagos, Nigeria" />
                    <TextAreaField label="Professional Summary" value={draft.summary} onChange={(v) => { setDraft((d) => ({ ...d, summary: v })); markDirty(); }} placeholder="Briefly describe your career goals..." className="sm:col-span-2" />
                  </div>
                </section>

                {/* Photo Upload */}
                <section className="border-t border-slate-100 pt-7">
                  <SectionTitle title="Profile Photo" description="Upload a photo from your device instead of pasting a URL." />
                  <div className="flex items-start gap-6 flex-wrap">
                    {/* Preview */}
                    <div className="w-24 h-24 rounded-2xl bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden shrink-0">
                      {photoPreview ? (
                        <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-[200px]">
                      <input
                        ref={photoInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handlePhotoUpload}
                        className="hidden"
                        id="photo-upload-input"
                      />
                      <label
                        htmlFor="photo-upload-input"
                        className="inline-flex items-center gap-2 px-5 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-bold text-slate-700 cursor-pointer transition-colors border border-slate-200"
                      >
                        {photoUploading ? (
                          <>
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Uploading...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                            </svg>
                            Choose Photo
                          </>
                        )}
                      </label>
                      <p className="mt-2 text-xs text-slate-400">JPEG, PNG, or WebP. Max 5MB.</p>
                      {draft.photoUrl && (
                        <p className="mt-1 text-xs text-slate-500 truncate max-w-xs">
                          Stored: {draft.photoUrl}
                        </p>
                      )}
                    </div>
                  </div>
                </section>

                {/* Personal Details */}
                <section className="border-t border-slate-100 pt-7">
                  <SectionTitle title="Personal Details" description="Optional contact and identity fields." />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <TextField label="Email" type="email" value={draft.email} onChange={(v) => { setDraft((d) => ({ ...d, email: v })); markDirty(); }} placeholder="you@example.com" />
                    <TextField label="Address" value={draft.address} onChange={(v) => { setDraft((d) => ({ ...d, address: v })); markDirty(); }} placeholder="Street, city, country" />
                    <TextField label="Date of Birth" type="date" value={draft.dateOfBirth} onChange={(v) => { setDraft((d) => ({ ...d, dateOfBirth: v })); markDirty(); }} />
                    <TextField label="Website" type="url" value={draft.website} onChange={(v) => { setDraft((d) => ({ ...d, website: v })); markDirty(); }} placeholder="https://your-site.com" />
                    <TextField label="LinkedIn" type="url" value={draft.linkedIn} onChange={(v) => { setDraft((d) => ({ ...d, linkedIn: v })); markDirty(); }} placeholder="https://linkedin.com/in/you" />
                  </div>
                </section>

                {/* CV Sections */}
                <section className="border-t border-slate-100 pt-7">
                  <SectionTitle title="CV Sections" description="Comma-separated lists for skills, interests, etc." />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <TextAreaField label="Objective" value={draft.objective} onChange={(v) => { setDraft((d) => ({ ...d, objective: v })); markDirty(); }} placeholder="Your resume objective..." className="sm:col-span-2" />
                    <TextField label="Skills" value={draft.skillsText} onChange={(v) => { setDraft((d) => ({ ...d, skillsText: v })); markDirty(); }} placeholder="JavaScript, React, Communication" className="sm:col-span-2" />
                    <TextAreaField label="Additional Information" value={draft.additionalInformation} onChange={(v) => { setDraft((d) => ({ ...d, additionalInformation: v })); markDirty(); }} placeholder="Other resume details..." className="sm:col-span-2" />
                    <TextField label="Interests" value={draft.interestsText} onChange={(v) => { setDraft((d) => ({ ...d, interestsText: v })); markDirty(); }} placeholder="Mentoring, open source" />
                    <TextField label="Languages" value={draft.languagesText} onChange={(v) => { setDraft((d) => ({ ...d, languagesText: v })); markDirty(); }} placeholder="English, French" />
                    <TextField label="Achievements & Awards" value={draft.achievementsAwardsText} onChange={(v) => { setDraft((d) => ({ ...d, achievementsAwardsText: v })); markDirty(); }} placeholder="Dean's List, Hackathon Winner" />
                    <TextField label="Activities" value={draft.activitiesText} onChange={(v) => { setDraft((d) => ({ ...d, activitiesText: v })); markDirty(); }} placeholder="Volunteer tutor, tech club" />
                    <TextField label="Publications" value={draft.publicationsText} onChange={(v) => { setDraft((d) => ({ ...d, publicationsText: v })); markDirty(); }} placeholder="Article title, paper title" />
                    <TextField label="Signature" value={draft.signature} onChange={(v) => { setDraft((d) => ({ ...d, signature: v })); markDirty(); }} placeholder="Name or sign-off" />
                  </div>
                </section>

                {/* Education Section */}
                <section className="border-t border-slate-100 pt-7">
                  <div className="flex items-center justify-between mb-4">
                    <SectionTitle title="Education" description="Degrees, courses, and academic history." />
                    <button type="button" onClick={() => setShowEduForm(!showEduForm)}
                      className="px-4 py-2 rounded-xl bg-rose-50 text-rose-600 text-sm font-bold border border-rose-100 hover:bg-rose-100 transition">
                      {showEduForm ? 'Cancel' : '+ Add Education'}
                    </button>
                  </div>

                  {showEduForm && (
                    <div className="mb-4 p-5 bg-slate-50 rounded-2xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <TextField label="Degree" value={eduDraft.degree} onChange={(v) => setEduDraft((d) => ({ ...d, degree: v }))} placeholder="BSc Computer Science" className="sm:col-span-2" />
                      <TextField label="Field of Study" value={eduDraft.fieldOfStudy} onChange={(v) => setEduDraft((d) => ({ ...d, fieldOfStudy: v }))} placeholder="Software Engineering" />
                      <TextField label="Institution" value={eduDraft.institution} onChange={(v) => setEduDraft((d) => ({ ...d, institution: v }))} placeholder="University of Lagos" />
                      <TextField label="Grade" value={eduDraft.grade} onChange={(v) => setEduDraft((d) => ({ ...d, grade: v }))} placeholder="First Class" />
                      <TextField label="Start Year" value={eduDraft.startYear} onChange={(v) => setEduDraft((d) => ({ ...d, startYear: v }))} placeholder="2020" />
                      <TextField label="End Year" value={eduDraft.endYear} onChange={(v) => setEduDraft((d) => ({ ...d, endYear: v }))} placeholder="2024" />
                      <label className="flex items-center gap-3 sm:col-span-2">
                        <input type="checkbox" checked={eduDraft.isCurrent} onChange={(e) => setEduDraft((d) => ({ ...d, isCurrent: e.target.checked }))} className="w-5 h-5" />
                        <span className="text-sm font-bold text-slate-700">I am currently studying here</span>
                      </label>
                      <TextAreaField label="Description" value={eduDraft.description} onChange={(v) => setEduDraft((d) => ({ ...d, description: v }))} placeholder="Relevant coursework, activities..." className="sm:col-span-2" />
                      {eduYearError && <p className="sm:col-span-2 text-xs text-red-600 font-medium">{eduYearError}</p>}
                      <div className="sm:col-span-2 flex justify-end">
                        <button type="button" onClick={onCreateEducation}
                          className="px-6 py-2.5 bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-xl text-sm font-bold hover:shadow-lg transition-all">
                          Save Education
                        </button>
                      </div>
                    </div>
                  )}

                  {education.length === 0 ? (
                    <div className="rounded-2xl bg-slate-50 border border-surface-border p-4 text-sm text-slate-500">No education entries yet.</div>
                  ) : (
                    <div className="space-y-3">
                      {education.map((item) => (
                        <div key={item.id} className="rounded-2xl border border-surface-border p-4 bg-white shadow-sm flex items-start justify-between gap-4">
                          <div>
                            <h3 className="font-extrabold text-slate-900">{item.degree || 'Education'}</h3>
                            {item.fieldOfStudy && <p className="text-sm text-slate-600 mt-1">{item.fieldOfStudy}</p>}
                            {item.institution && <p className="text-sm text-slate-600 mt-1">{item.institution}</p>}
                            <p className="text-sm text-slate-500 mt-1">
                              {[item.grade, formatYears(item.startYear, item.endYear, item.isCurrent)].filter(Boolean).join(' - ')}
                            </p>
                            {item.description && <p className="text-sm text-slate-600 mt-2 whitespace-pre-wrap">{item.description}</p>}
                          </div>
                          {item.id && (
                            <button type="button" disabled={deletingId === `education:${item.id}`}
                              onClick={() => void onDeleteEducation(item.id as string)}
                              className="px-4 py-2 rounded-xl bg-rose-50 text-rose-700 text-sm font-bold border border-rose-100 hover:bg-rose-100 transition disabled:opacity-50 shrink-0">
                              {deletingId === `education:${item.id}` ? 'Deleting...' : 'Delete'}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* Experience Section */}
                <section className="border-t border-slate-100 pt-7">
                  <div className="flex items-center justify-between mb-4">
                    <SectionTitle title="Experience" description="Work history, roles, and achievements." />
                    <button type="button" onClick={() => setShowExpForm(!showExpForm)}
                      className="px-4 py-2 rounded-xl bg-rose-50 text-rose-600 text-sm font-bold border border-rose-100 hover:bg-rose-100 transition">
                      {showExpForm ? 'Cancel' : '+ Add Experience'}
                    </button>
                  </div>

                  {showExpForm && (
                    <div className="mb-4 p-5 bg-slate-50 rounded-2xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <TextField label="Company" value={expDraft.company} onChange={(v) => setExpDraft((d) => ({ ...d, company: v }))} placeholder="Acme Corp" className="sm:col-span-2" />
                      <TextField label="Job Title" value={expDraft.jobTitle} onChange={(v) => setExpDraft((d) => ({ ...d, jobTitle: v }))} placeholder="Product Designer" className="sm:col-span-2" />
                      <TextField label="Location" value={expDraft.location} onChange={(v) => setExpDraft((d) => ({ ...d, location: v }))} placeholder="Lagos, Nigeria" />
                      <TextField label="Start Year" value={expDraft.startYear} onChange={(v) => setExpDraft((d) => ({ ...d, startYear: v }))} placeholder="2021" />
                      <TextField label="End Year" value={expDraft.endYear} onChange={(v) => setExpDraft((d) => ({ ...d, endYear: v }))} placeholder="2024" />
                      <label className="flex items-center gap-3 sm:col-span-2">
                        <input type="checkbox" checked={expDraft.isCurrent} onChange={(e) => setExpDraft((d) => ({ ...d, isCurrent: e.target.checked }))} className="w-5 h-5" />
                        <span className="text-sm font-bold text-slate-700">I currently work here</span>
                      </label>
                      <TextAreaField label="Details" value={expDraft.description} onChange={(v) => setExpDraft((d) => ({ ...d, description: v }))} placeholder="Responsibilities, achievements..." className="sm:col-span-2" />
                      {expYearError && <p className="sm:col-span-2 text-xs text-red-600 font-medium">{expYearError}</p>}
                      <div className="sm:col-span-2 flex justify-end">
                        <button type="button" onClick={onCreateExperience}
                          className="px-6 py-2.5 bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-xl text-sm font-bold hover:shadow-lg transition-all">
                          Save Experience
                        </button>
                      </div>
                    </div>
                  )}

                  {workExperience.length === 0 ? (
                    <div className="rounded-2xl bg-slate-50 border border-surface-border p-4 text-sm text-slate-500">No work experience entries yet.</div>
                  ) : (
                    <div className="space-y-3">
                      {workExperience.map((item) => (
                        <div key={item.id} className="rounded-2xl border border-surface-border p-4 bg-white shadow-sm flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <h3 className="font-extrabold text-slate-900">{item.jobTitle || 'Experience'}</h3>
                            {item.company && <p className="text-sm text-slate-600 mt-1">{item.company}</p>}
                            {item.location && <p className="text-sm text-slate-500 mt-1">{item.location}</p>}
                            <p className="text-sm text-slate-500 mt-1">{formatYears(item.startYear, item.endYear, item.isCurrent)}</p>
                            {item.description && <p className="text-sm text-slate-600 mt-2 whitespace-pre-wrap">{item.description}</p>}
                          </div>
                          {item.id && (
                            <button type="button" disabled={deletingId === `experience:${item.id}`}
                              onClick={() => void onDeleteExperience(item.id as string)}
                              className="px-4 py-2 rounded-xl bg-rose-50 text-rose-700 text-sm font-bold border border-rose-100 hover:bg-rose-100 transition disabled:opacity-50 shrink-0">
                              {deletingId === `experience:${item.id}` ? 'Deleting...' : 'Delete'}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* More Sections */}
                <section className="border-t border-slate-100 pt-7">
                  <SectionTitle title="More Resume Sections" description="Projects and references are available as focused profile pages." />
                  <div className="flex flex-wrap gap-3">
                    <Link href="/profile/projects" className="px-5 py-3 rounded-2xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-700 hover:border-rose-200 hover:text-rose-600">Manage Projects</Link>
                    <Link href="/profile/references" className="px-5 py-3 rounded-2xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-700 hover:border-rose-200 hover:text-rose-600">Manage References</Link>
                  </div>
                </section>

                {/* Save All Button */}
                <div className="pt-4 border-t border-slate-100 flex justify-end">
                  <button disabled={saving} type="submit"
                    className="px-8 py-3.5 bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-2xl text-sm font-bold hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-md flex items-center gap-2">
                    {saving ? (
                      <>
                        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
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
      </div>
    </DashboardLayout>
  );
}
