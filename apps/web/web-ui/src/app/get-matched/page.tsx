// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { apiFetch } from '@/lib/auth';

export default function GetMatchedPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState<Array<any>>([]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setBusy(true);
      setError('');
      try {
        const res = (await apiFetch('/jobs/matched', { method: 'POST', body: {} })) as any;
        if (!mounted) return;
        setItems(Array.isArray(res?.items) ? res.items : []);
      } catch (e) {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : 'Failed to load matched jobs');
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
          <h1 className="text-xl font-bold text-slate-800">Get Matched</h1>
          <p className="text-sm text-slate-500">AI-ranked jobs based on your career-path skills.</p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-card overflow-hidden border border-surface-border">
          <div className="px-6 py-4 border-b border-surface-border">
            <h2 className="text-base font-semibold text-slate-800">Recommended jobs</h2>
          </div>

          <div className="p-6">
            {busy ? (
              <div className="flex items-center gap-3 justify-center py-12">
                <svg className="w-5 h-5 text-primary-600 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-sm text-slate-500 font-medium">Ranking jobs…</span>
              </div>
            ) : items.length === 0 ? (
              <div className="text-sm text-slate-500">No matches found yet.</div>
            ) : (
              <div className="space-y-3">
                {items.map((job) => (
                  <div key={job.jobId} className="rounded-2xl border border-surface-border p-4 bg-white">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-[240px]">
                        <div className="text-sm font-semibold text-slate-800">{job.title}</div>
                        <div className="text-xs text-slate-500 mt-1">
                          {job.company}
                          {job.location ? ` • ${job.location}` : ''}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="text-xs font-semibold px-2 py-1 rounded-xl bg-primary-50 text-primary-700 border border-primary-100">
                          Score: {job.score}
                        </div>
                      </div>
                    </div>

                    {Array.isArray(job.matchedSkills) && job.matchedSkills.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {job.matchedSkills.map((s) => (
                          <span
                            key={s}
                            className="text-xs px-2 py-1 rounded-xl bg-primary-50 text-primary-700 border border-primary-100"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    )}

                    {job.description && (
                      <div className="mt-3 text-sm text-slate-600 whitespace-pre-wrap">{job.description}</div>
                    )}
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
