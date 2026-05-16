// @ts-nocheck
'use client';

import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { apiFetch } from '@/lib/auth';

export default function JobsPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState<Array<any>>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);

  const [q, setQ] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [location, setLocation] = useState('');
  const [skill, setSkill] = useState('');

  const [applyJobId, setApplyJobId] = useState<string | null>(null);
  const [coverLetter, setCoverLetter] = useState('');

  const totalPages = useMemo(() => {
    const t = Number(total) || 0;
    const l = Number(limit) || 10;
    return Math.max(1, Math.ceil(t / l));
  }, [total, limit]);

  async function loadJobs(nextPage = page) {
    setBusy(true);
    setError('');

    try {
      const query = [
        q.trim() ? `q=${encodeURIComponent(q.trim())}` : null,
        status ? `status=${encodeURIComponent(status)}` : null,
        location.trim() ? `location=${encodeURIComponent(location.trim())}` : null,
        skill.trim() ? `skill=${encodeURIComponent(skill.trim())}` : null,
        `page=${encodeURIComponent(String(nextPage))}`,
        `limit=${encodeURIComponent(String(limit))}`,
      ]
        .filter(Boolean)
        .join('&');

      const res = (await apiFetch(`/jobs?${query}`, { method: 'GET' })) as any;

      setItems(Array.isArray(res?.items) ? res.items : []);
      setTotal(typeof res?.total === 'number' ? res.total : 0);
      setPage(typeof res?.page === 'number' ? res.page : nextPage);
      setLimit(typeof res?.limit === 'number' ? res.limit : limit);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load jobs');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void loadJobs(1);
  }, []);

  function openApply(jobId: string) {
    setApplyJobId(jobId);
    setCoverLetter('');
  }

  async function submitApply() {
    if (!applyJobId) return;

    setBusy(true);
    setError('');

    try {
      await apiFetch(`/jobs/${applyJobId}/apply`, {
        method: 'POST',
        body: { coverLetter },
      });

      setApplyJobId(null);
      setCoverLetter('');
      await loadJobs(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to apply');
    } finally {
      setBusy(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-slate-800">Job Board</h1>
          <p className="text-sm text-slate-500">Browse active roles and apply with a cover letter.</p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-card overflow-hidden border border-surface-border mb-6">
          <div className="px-6 py-4 border-b border-surface-border">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[220px]">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Search</label>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface border border-surface-border text-sm focus:outline-none"
                  placeholder="Title, company, description…"
                />
              </div>

              <div className="w-[160px]">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface border border-surface-border text-sm"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>

              <div className="flex-1 min-w-[180px]">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Location</label>
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface border border-surface-border text-sm focus:outline-none"
                  placeholder="e.g. Lagos"
                />
              </div>

              <div className="flex-1 min-w-[180px]">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Skill</label>
                <input
                  value={skill}
                  onChange={(e) => setSkill(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface border border-surface-border text-sm focus:outline-none"
                  placeholder="e.g. React"
                />
              </div>

              <button
                onClick={() => void loadJobs(1)}
                className="px-4 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={busy}
              >
                {busy ? 'Loading…' : 'Search'}
              </button>
            </div>
          </div>

          {/* List */}
          <div className="p-6">
            {busy && items.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-primary-600 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span className="text-sm text-slate-500 font-medium">Loading jobs…</span>
                </div>
              </div>
            ) : items.length === 0 ? (
              <div className="text-sm text-slate-500">No jobs found.</div>
            ) : (
              <div className="space-y-3">
                {items.map((job) => (
                  <div key={job.id} className="rounded-2xl border border-surface-border p-4 bg-white">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-[240px]">
                        <div className="text-sm font-semibold text-slate-800">{job.title}</div>
                        <div className="text-xs text-slate-500 mt-1">
                          {job.company}
                          {job.location ? ` • ${job.location}` : ''}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="text-xs font-semibold px-2 py-1 rounded-xl bg-surface text-slate-700 border border-surface-border">
                          {job.status ?? 'ACTIVE'}
                        </div>
                        <button
                          onClick={() => openApply(job.id)}
                          className="px-3 py-2 rounded-xl bg-primary-600 text-white text-xs font-semibold hover:bg-primary-700 transition-colors"
                        >
                          Apply
                        </button>
                      </div>
                    </div>

                    {job.description ? (
                      <div className="mt-3 text-sm text-slate-600 line-clamp-3 whitespace-pre-wrap">
                        {job.description}
                      </div>
                    ) : null}

                    {Array.isArray(job.skills) && job.skills.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {job.skills.slice(0, 10).map((s) => (
                          <span
                            key={s}
                            className="text-xs px-2 py-1 rounded-xl bg-primary-50 text-primary-700 border border-primary-100"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between gap-3">
                <div className="text-xs text-slate-500">
                  Page <span className="font-semibold">{page}</span> of <span className="font-semibold">{totalPages}</span>
                  {total ? ` • ${total} total` : ''}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => void loadJobs(Math.max(1, page - 1))}
                    disabled={busy || page <= 1}
                    className="px-3 py-2 rounded-xl bg-surface border border-surface-border text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => void loadJobs(Math.min(totalPages, page + 1))}
                    disabled={busy || page >= totalPages}
                    className="px-3 py-2 rounded-xl bg-surface border border-surface-border text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Apply Modal */}
        {applyJobId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
            <div className="w-full max-w-2xl bg-white rounded-2xl shadow-card overflow-hidden border border-surface-border">
              <div className="px-6 py-4 border-b border-surface-border flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-slate-800">Apply to this job</div>
                  <div className="text-xs text-slate-500 mt-1">Submit a cover letter (required).</div>
                </div>
                <button
                  onClick={() => setApplyJobId(null)}
                  className="px-3 py-2 rounded-xl bg-surface border border-surface-border text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Close
                </button>
              </div>

              <div className="px-6 py-5">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Cover letter</label>
                <textarea
                  value={coverLetter}
                  onChange={(e) => setCoverLetter(e.target.value)}
                  className="w-full min-h-[140px] px-3 py-2.5 rounded-xl bg-surface border border-surface-border text-sm focus:outline-none"
                  placeholder="Write a short, tailored cover letter…"
                />
                <div className="mt-3 text-xs text-slate-500">
                  Tip: match 2–3 skills mentioned in the job description.
                </div>

                {error && (
                  <div className="mt-4 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                    {error}
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-t border-surface-border flex items-center justify-end gap-2">
                <button
                  onClick={() => setApplyJobId(null)}
                  className="px-4 py-2.5 rounded-xl bg-surface border border-surface-border text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  disabled={busy}
                >
                  Cancel
                </button>
                <button
                  onClick={() => void submitApply()}
                  className="px-4 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={busy || !coverLetter.trim()}
                >
                  {busy ? 'Submitting…' : 'Submit Application'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
