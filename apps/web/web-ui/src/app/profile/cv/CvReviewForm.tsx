'use client';

import { useMemo, useState } from 'react';
import type { ParsedCv, ReviewArea } from '@career-navigator/cv-parser';
import { apiFetch } from '@/lib/auth';

/** Fields below this confidence are highlighted for the user to check (16.7). */
const LOW = 0.7;
/** Sections below this confidence offer "Improve with AI" (16.8). */
const ASSIST_BELOW = 0.8;

type AssistSection = 'summary' | 'education' | 'experience' | 'skills';

type EduForm = {
  include: boolean;
  degree: string;
  fieldOfStudy: string;
  institution: string;
  startYear: string;
  endYear: string;
  isCurrent: boolean;
  grade: string;
  description: string;
  confidence: number;
  source: string;
};

type ExpForm = {
  include: boolean;
  jobTitle: string;
  company: string;
  location: string;
  startYear: string;
  endYear: string;
  isCurrent: boolean;
  description: string;
  confidence: number;
  source: string;
};

type SkillForm = { name: string; confidence: number };

type AssistResult = {
  summary?: string | null;
  skills?: string[];
  education?: Array<Partial<Record<'degree' | 'fieldOfStudy' | 'institution' | 'grade' | 'description', string | null>> & AssistYears>;
  experience?: Array<Partial<Record<'jobTitle' | 'company' | 'location' | 'description', string | null>> & AssistYears>;
};
type AssistYears = { startYear?: number | null; endYear?: number | null; isCurrent?: boolean };

type Form = {
  fullName: string;
  phone: string;
  location: string;
  linkedIn: string;
  website: string;
  summary: string;
  skills: SkillForm[];
  languages: string;
  education: EduForm[];
  experience: ExpForm[];
};

const txt = (v: string | null | undefined) => v ?? '';
const yr = (v: number | null | undefined) => (v == null ? '' : String(v));

function toForm(cv: ParsedCv): Form {
  const links = cv.contact.links ?? [];
  return {
    fullName: txt(cv.contact.fullName.value),
    phone: txt(cv.contact.phone.value),
    location: txt(cv.contact.location.value),
    linkedIn: links.find((l) => /linkedin\.com/i.test(l)) ?? '',
    website: links.find((l) => !/linkedin\.com/i.test(l)) ?? '',
    summary: txt(cv.summary.value),
    skills: cv.skills.map((s) => ({ name: s.name, confidence: s.confidence })),
    languages: cv.languages.join(', '),
    education: cv.education.map((e) => ({
      include: true,
      degree: txt(e.degree),
      fieldOfStudy: txt(e.fieldOfStudy),
      institution: txt(e.institution),
      startYear: yr(e.startYear),
      endYear: yr(e.endYear),
      isCurrent: e.isCurrent,
      grade: txt(e.grade),
      description: txt(e.description),
      confidence: e.confidence,
      source: e.source,
    })),
    experience: cv.experience.map((w) => ({
      include: true,
      jobTitle: txt(w.jobTitle),
      company: txt(w.company),
      location: txt(w.location),
      startYear: yr(w.startYear),
      endYear: yr(w.endYear),
      isCurrent: w.isCurrent,
      description: txt(w.description),
      confidence: w.confidence,
      source: w.source,
    })),
  };
}

const orNull = (v: string) => (v.trim() ? v.trim() : null);
function toYear(v: string): number | null {
  const n = Number.parseInt(v, 10);
  return Number.isInteger(n) && n >= 1950 && n <= 2100 ? n : null;
}

function toPayload(f: Form) {
  return {
    fullName: orNull(f.fullName),
    phone: orNull(f.phone),
    location: orNull(f.location),
    linkedIn: orNull(f.linkedIn),
    website: orNull(f.website),
    summary: orNull(f.summary),
    skills: f.skills.map((s) => s.name.trim()).filter(Boolean),
    languages: f.languages.split(',').map((s) => s.trim()).filter(Boolean),
    education: f.education
      .filter((e) => e.include)
      .map((e) => ({
        degree: orNull(e.degree),
        fieldOfStudy: orNull(e.fieldOfStudy),
        institution: orNull(e.institution),
        startYear: toYear(e.startYear),
        endYear: e.isCurrent ? null : toYear(e.endYear),
        isCurrent: e.isCurrent,
        grade: orNull(e.grade),
        description: orNull(e.description),
      })),
    experience: f.experience
      .filter((w) => w.include)
      .map((w) => ({
        jobTitle: orNull(w.jobTitle),
        company: orNull(w.company),
        location: orNull(w.location),
        startYear: toYear(w.startYear),
        endYear: w.isCurrent ? null : toYear(w.endYear),
        isCurrent: w.isCurrent,
        description: orNull(w.description),
      })),
  };
}

function ConfidenceBadge({ value }: { value: number }) {
  const [label, cls] =
    value >= 0.85
      ? ['High confidence', 'bg-emerald-100 text-emerald-700']
      : value >= LOW
        ? ['Medium confidence', 'bg-slate-100 text-slate-600']
        : ['Please check', 'bg-amber-100 text-amber-800'];
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{label}</span>;
}

function Field(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  confidence?: number;
  source?: string | null;
  multiline?: boolean;
  placeholder?: string;
}) {
  const low = props.confidence !== undefined && props.confidence < LOW && props.value !== '';
  const cls = `w-full rounded-lg border px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-300 ${
    low ? 'border-amber-400 bg-amber-50' : 'border-surface-border bg-white'
  }`;
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-slate-600 mb-1">{props.label}</span>
      {props.multiline ? (
        <textarea rows={4} className={cls} value={props.value} placeholder={props.placeholder} onChange={(e) => props.onChange(e.target.value)} />
      ) : (
        <input className={cls} value={props.value} placeholder={props.placeholder} onChange={(e) => props.onChange(e.target.value)} />
      )}
      {low && (
        <span className="block mt-1 text-xs text-amber-700">
          Please check this.{props.source ? ` Read from: “${props.source.slice(0, 140)}”` : ''}
        </span>
      )}
    </label>
  );
}

function Section(props: {
  title: string;
  area: ReviewArea;
  cv: ParsedCv;
  assist?: { available: boolean; busy: boolean; onClick: () => void; used: boolean };
  children: React.ReactNode;
}) {
  const confidence = props.cv.confidence[props.area] ?? 0;
  return (
    <section className="rounded-xl border border-surface-border p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-800">{props.title}</h3>
          <ConfidenceBadge value={confidence} />
          {props.assist?.used && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">AI suggestion — please review</span>}
        </div>
        {props.assist?.available && confidence < ASSIST_BELOW && (
          <button
            type="button"
            onClick={props.assist.onClick}
            disabled={props.assist.busy}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50"
          >
            {props.assist.busy ? 'Asking AI…' : 'Improve with AI'}
          </button>
        )}
      </div>
      {props.children}
    </section>
  );
}

export default function CvReviewForm(props: {
  review: ParsedCv;
  aiAssistAvailable: boolean;
  onConfirmed: (message: string) => void;
  onError: (message: string) => void;
}) {
  const { review } = props;
  const initial = useMemo(() => toForm(review), [review]);
  const [form, setForm] = useState<Form>(initial);
  const [newSkill, setNewSkill] = useState('');
  const [saving, setSaving] = useState(false);
  const [assisting, setAssisting] = useState<AssistSection | null>(null);
  const [assisted, setAssisted] = useState<Set<AssistSection>>(new Set());

  const sectionsFound = new Set(review.sections.map((s) => s.kind));
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));
  const editEdu = (i: number, patch: Partial<EduForm>) =>
    setForm((f) => ({ ...f, education: f.education.map((e, j) => (j === i ? { ...e, ...patch } : e)) }));
  const editExp = (i: number, patch: Partial<ExpForm>) =>
    setForm((f) => ({ ...f, experience: f.experience.map((w, j) => (j === i ? { ...w, ...patch } : w)) }));

  function addSkill() {
    const name = newSkill.trim();
    if (!name) return;
    setForm((f) =>
      f.skills.some((s) => s.name.toLowerCase() === name.toLowerCase())
        ? f
        : { ...f, skills: [...f.skills, { name, confidence: 1 }] },
    );
    setNewSkill('');
  }

  async function assist(section: AssistSection) {
    setAssisting(section);
    try {
      const res = (await apiFetch('/upload/cv/assist', { method: 'POST', body: { section } })) as {
        result: AssistResult;
      };
      const r = res.result;
      setForm((f) => {
        switch (section) {
          case 'summary':
            return r.summary ? { ...f, summary: r.summary } : f;
          case 'skills': {
            const have = new Set(f.skills.map((s) => s.name.toLowerCase()));
            const added = (r.skills ?? []).filter((s) => !have.has(s.toLowerCase()));
            return { ...f, skills: [...f.skills, ...added.map((name) => ({ name, confidence: 0.75 }))] };
          }
          case 'education':
            return !r.education?.length
              ? f
              : {
                  ...f,
                  education: r.education.map((e) => ({
                    include: true,
                    degree: txt(e.degree),
                    fieldOfStudy: txt(e.fieldOfStudy),
                    institution: txt(e.institution),
                    startYear: yr(e.startYear),
                    endYear: yr(e.endYear),
                    isCurrent: Boolean(e.isCurrent),
                    grade: txt(e.grade),
                    description: txt(e.description),
                    confidence: 0.75,
                    source: '',
                  })),
                };
          case 'experience':
            return !r.experience?.length
              ? f
              : {
                  ...f,
                  experience: r.experience.map((w) => ({
                    include: true,
                    jobTitle: txt(w.jobTitle),
                    company: txt(w.company),
                    location: txt(w.location),
                    startYear: yr(w.startYear),
                    endYear: yr(w.endYear),
                    isCurrent: Boolean(w.isCurrent),
                    description: txt(w.description),
                    confidence: 0.75,
                    source: '',
                  })),
                };
        }
      });
      setAssisted((s) => new Set(s).add(section));
    } catch (e) {
      props.onError(e instanceof Error ? e.message : 'AI assistance failed');
    } finally {
      setAssisting(null);
    }
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = (await apiFetch('/upload/cv/confirm', { method: 'POST', body: toPayload(form) })) as {
        message: string;
      };
      props.onConfirmed(res.message);
    } catch (err) {
      props.onError(err instanceof Error ? err.message : 'Could not save your CV');
    } finally {
      setSaving(false);
    }
  }

  const assistProps = (section: AssistSection) => ({
    available: props.aiAssistAvailable && sectionsFound.has(section),
    busy: assisting !== null,
    used: assisted.has(section),
    onClick: () => void assist(section),
  });

  return (
    <form onSubmit={confirm} className="space-y-4">
      <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 text-sm text-blue-900">
        We read your CV without AI. Check the highlighted fields, untick anything you don&apos;t want, then confirm.
        Nothing is saved to your profile until you confirm, and existing entries are updated rather than duplicated.
      </div>

      <Section title="Contact" area="contact" cv={review}>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Full name" value={form.fullName} onChange={(v) => set('fullName', v)} confidence={review.contact.fullName.confidence} source={review.contact.fullName.source} />
          <Field label="Phone" value={form.phone} onChange={(v) => set('phone', v)} confidence={review.contact.phone.confidence} source={review.contact.phone.source} />
          <Field label="Location" value={form.location} onChange={(v) => set('location', v)} confidence={review.contact.location.confidence} source={review.contact.location.source} />
          {review.contact.email.value && (
            <div className="text-xs text-slate-500 self-end pb-2">
              Email found: <span className="font-medium text-slate-700">{review.contact.email.value}</span> (your account email is kept)
            </div>
          )}
          <Field label="LinkedIn" value={form.linkedIn} onChange={(v) => set('linkedIn', v)} />
          <Field label="Website" value={form.website} onChange={(v) => set('website', v)} />
        </div>
      </Section>

      <Section title="Summary" area="summary" cv={review} assist={assistProps('summary')}>
        <Field label="Professional summary" multiline value={form.summary} onChange={(v) => set('summary', v)} confidence={review.summary.confidence} source={review.summary.source} />
      </Section>

      <Section title="Skills" area="skills" cv={review} assist={assistProps('skills')}>
        <div className="flex flex-wrap gap-2">
          {form.skills.map((s, i) => (
            <span
              key={`${s.name}-${i}`}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm border ${
                s.confidence < LOW ? 'bg-amber-50 border-amber-300 text-amber-900' : 'bg-primary-50 border-primary-200 text-primary-700'
              }`}
              title={s.confidence < LOW ? 'Not in our skills list. Keep it only if it is a real skill.' : undefined}
            >
              {s.name}
              <button type="button" aria-label={`Remove ${s.name}`} className="ml-1 text-slate-500 hover:text-red-600" onClick={() => set('skills', form.skills.filter((_, j) => j !== i))}>
                ×
              </button>
            </span>
          ))}
          {form.skills.length === 0 && <p className="text-sm text-slate-500">No skills found. Add them below.</p>}
        </div>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-lg border border-surface-border px-3 py-2 text-sm"
            placeholder="Add a skill"
            value={newSkill}
            onChange={(e) => setNewSkill(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addSkill();
              }
            }}
          />
          <button type="button" onClick={addSkill} className="px-4 py-2 rounded-lg bg-slate-100 text-sm font-semibold text-slate-700 border border-slate-200">
            Add
          </button>
        </div>
        <Field label="Languages (comma separated)" value={form.languages} onChange={(v) => set('languages', v)} />
      </Section>

      <Section title={`Experience (${form.experience.length})`} area="experience" cv={review} assist={assistProps('experience')}>
        {form.experience.length === 0 && <p className="text-sm text-slate-500">No work experience found.</p>}
        {form.experience.map((w, i) => (
          <div key={i} className={`rounded-lg border p-3 space-y-2 ${w.include ? 'border-surface-border' : 'border-dashed border-slate-300 opacity-60'}`}>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <input type="checkbox" checked={w.include} onChange={(e) => editExp(i, { include: e.target.checked })} />
              Add to my profile
              {w.confidence < LOW && <span className="text-amber-700 font-normal">— please check this entry</span>}
            </label>
            <div className="grid sm:grid-cols-2 gap-2">
              <Field label="Job title" value={w.jobTitle} onChange={(v) => editExp(i, { jobTitle: v })} confidence={w.confidence} source={w.source} />
              <Field label="Company" value={w.company} onChange={(v) => editExp(i, { company: v })} />
              <Field label="Location" value={w.location} onChange={(v) => editExp(i, { location: v })} />
              <div className="grid grid-cols-2 gap-2">
                <Field label="Start year" value={w.startYear} onChange={(v) => editExp(i, { startYear: v })} />
                {w.isCurrent ? (
                  <div className="text-xs text-slate-500 self-end pb-2">Present</div>
                ) : (
                  <Field label="End year" value={w.endYear} onChange={(v) => editExp(i, { endYear: v })} />
                )}
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input type="checkbox" checked={w.isCurrent} onChange={(e) => editExp(i, { isCurrent: e.target.checked })} />
              I currently work here
            </label>
            <Field label="Description" multiline value={w.description} onChange={(v) => editExp(i, { description: v })} />
          </div>
        ))}
      </Section>

      <Section title={`Education (${form.education.length})`} area="education" cv={review} assist={assistProps('education')}>
        {form.education.length === 0 && <p className="text-sm text-slate-500">No education found.</p>}
        {form.education.map((e, i) => (
          <div key={i} className={`rounded-lg border p-3 space-y-2 ${e.include ? 'border-surface-border' : 'border-dashed border-slate-300 opacity-60'}`}>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <input type="checkbox" checked={e.include} onChange={(ev) => editEdu(i, { include: ev.target.checked })} />
              Add to my profile
              {e.confidence < LOW && <span className="text-amber-700 font-normal">— please check this entry</span>}
            </label>
            <div className="grid sm:grid-cols-2 gap-2">
              <Field label="Degree" value={e.degree} onChange={(v) => editEdu(i, { degree: v })} confidence={e.confidence} source={e.source} />
              <Field label="Field of study" value={e.fieldOfStudy} onChange={(v) => editEdu(i, { fieldOfStudy: v })} />
              <Field label="Institution" value={e.institution} onChange={(v) => editEdu(i, { institution: v })} />
              <div className="grid grid-cols-2 gap-2">
                <Field label="Start year" value={e.startYear} onChange={(v) => editEdu(i, { startYear: v })} />
                {e.isCurrent ? (
                  <div className="text-xs text-slate-500 self-end pb-2">Present</div>
                ) : (
                  <Field label="End year" value={e.endYear} onChange={(v) => editEdu(i, { endYear: v })} />
                )}
              </div>
              <Field label="Grade" value={e.grade} onChange={(v) => editEdu(i, { grade: v })} />
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input type="checkbox" checked={e.isCurrent} onChange={(ev) => editEdu(i, { isCurrent: ev.target.checked })} />
              I am still studying here
            </label>
          </div>
        ))}
      </Section>

      <div className="flex flex-wrap gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-bold hover:bg-primary-700 transition-colors shadow-soft disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Confirm and add to my profile'}
        </button>
        <button type="button" onClick={() => setForm(initial)} className="px-5 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-sm font-bold border border-slate-200 hover:bg-slate-200">
          Reset changes
        </button>
      </div>
    </form>
  );
}
