// @ts-nocheck
'use client';

import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { apiFetch } from '@/lib/auth';

export default function LevelUpPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState<Array<any>>([]);
  const [careerSkills, setCareerSkills] = useState<Array<string>>([]);

  const summary = useMemo(() => {
    const applications = Array.isArray(items) ? items.length : 0;
    const skills = Array.isArray(careerSkills) ? careerSkills.length : 0;
    return { applications, skills };
  }, [items, careerSkills]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setBusy(true);
      setError('');
      try {
        const res = (await apiFetch('/jobs/my-applications', { method: 'GET' })) as any;
        if (!mounted) return;
        setItems(Array.isArray(res?.items) ? res.items : []);
        setCareerSkills(Array.isArray(res?.careerSkills) ? res.careerSkills : []);
      } catch (e) {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : 'Failed to load progress');
      } finally {
        if (mounted) setBusy(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-slate-800">Level Up</h1>
          <p className="text-sm text-slate-500">Your applied jobs and career-path skills</p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Summary */}
        <div className="bg-white rounded-2xl shadow-card overflow-hidden border border-surface-border mb-6">
          <div className="px-6 py-4 border-b border-surface-border">
            <div className="text-base font-semibold text-slate-800">Progress snapshot</div>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-surface rounded-2xl border border-surface-border p-4">
                <div className="text-2xl font-bold text-slate-800">{summary.applications}</div>
                <div className="text-xs text-slate-500 mt-1">Applications</div>
              </div>
              <div className="bg-surface rounded-2xl border border-surface-border p-4">
                <div className="text-2xl font-bold text-slate-800">{summary.skills}</div>
                <div className="text-xs text-slate-500 mt-1">Career skills</div>
              </div>
              <div className="bg-surface rounded-2xl border border-surface-border p-4">
                <div className="text-2xl font-bold text-slate-800">{items.filter((i) => i.jobStatus === 'ACTIVE').length}</div>
                <div className="text-xs text-slate-500 mt-1">Active roles</div>
              </div>
              <div className="bg-surface rounded-2xl border border-surface-border p-4">
                <div className="text-2xl font-bold text-slate-800">—</div>
                <div className="text-xs text-slate-500 mt-1">Next milestone</div>
              </div>
            </div>
          </div>
        </div>

        {/* Career skills */}
        <div className="bg-white rounded-2xl shadow-card overflow-hidden border border-surface-border mb-6">
          <div className="px-6 py-4 border-b border-surface-border">
            <h2 className="text-base font-semibold text-slate-800">Career-path skills</h2>
          </div>
          <div className="p-6">
            {busy ? (
              <div className="text-sm text-slate-500">Loading skills…</div>
            ) : careerSkills.length === 0 ? (
              <div className="text-sm text-slate-500">No skills available yet.</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {careerSkills.map((s) => (
                  <span
                    key={s}
                    className="text-xs px-2 py-1 rounded-xl bg-primary-50 text-primary-700 border border-primary-100"
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Applied jobs */}
        <div className="bg-white rounded-2xl shadow-card overflow-hidden border border-surface-border">
          <div className="px-6 py-4 border-b border-surface-border">
            <h2 className="text-base font-semibold text-slate-800">Your applied jobs</h2>
          </div>

          <div className="p-6">
            {busy ? (
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-primary-600 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-sm text-slate-500">Loading applications…</span>
              </div>
            ) : items.length === 0 ? (
              <div className="text-sm text-slate-500">You haven’t applied to any jobs yet.</div>
            ) : (
              <div className="space-y-3">
                {items.map((a) => (
                  <div key={a.applicationId} className="rounded-2xl border border-surface-border p-4 bg-white">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-[240px]">
                        <div className="text-sm font-semibold text-slate-800">{a.title}</div>
                        <div className="text-xs text-slate-500 mt-1">
                          {a.company}
                          {a.location ? ` • ${a.location}` : ''}
                        </div>
                        <div className="text-xs font-semibold mt-2 inline-flex px-2 py-1 rounded-xl bg-surface border border-surface-border text-slate-700">
                          {a.jobStatus ?? 'ACTIVE'}
                        </div>
                      </div>

                      <div className="flex-1">
                        {Array.isArray(a.matchedSkills) && a.matchedSkills.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {a.matchedSkills.slice(0, 10).map((s: string) => (
                              <span
                                key={`${a.applicationId}-${s}`}
                                className="text-xs px-2 py-1 rounded-xl bg-primary-50 text-primary-700 border border-primary-100"
                              >
                                {s}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div className="text-xs text-slate-500">No matched skills extracted yet.</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
