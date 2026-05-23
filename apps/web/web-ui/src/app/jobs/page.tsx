// @ts-nocheck
'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import DashboardLayout from '@/components/DashboardLayout';
import { apiFetch } from '@/lib/auth';
import ErrorAlert from '@/components/ErrorAlert';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
};

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
      <div className="max-w-6xl mx-auto pb-12">
        {/* Hero Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative overflow-hidden rounded-3xl p-8 md:p-10 mb-8"
          style={{
            background: 'linear-gradient(135deg, #0ea5e9 0%, #3b82f6 50%, #6366f1 100%)',
          }}
        >
          <div className="relative z-10 max-w-3xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/15 backdrop-blur-sm rounded-full text-white/90 text-xs font-semibold mb-4"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Discover Your Next Opportunity
            </motion.div>

            <h1 className="text-3xl md:text-4xl font-extrabold text-white leading-tight">
              Job Board
            </h1>
            <p className="mt-3 text-white/80 text-sm md:text-base leading-relaxed max-w-lg">
              Browse active roles, filter by skills, and apply directly with an AI-optimized cover letter.
            </p>

            {/* Glassmorphic Filters */}
            <div className="mt-8 bg-white/15 backdrop-blur-md border border-white/20 rounded-2xl p-4 shadow-lg">
              <div className="flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-semibold text-white/80 mb-1.5 ml-1">Search</label>
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 transition-all text-sm"
                    placeholder="Title, company, description…"
                  />
                </div>

                <div className="w-[140px]">
                  <label className="block text-xs font-semibold text-white/80 mb-1.5 ml-1">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-white/30 transition-all text-sm appearance-none"
                    style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
                  >
                    <option value="ACTIVE" className="text-slate-800">ACTIVE</option>
                    <option value="INACTIVE" className="text-slate-800">INACTIVE</option>
                  </select>
                </div>

                <div className="flex-1 min-w-[160px]">
                  <label className="block text-xs font-semibold text-white/80 mb-1.5 ml-1">Location</label>
                  <input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 transition-all text-sm"
                    placeholder="e.g. Remote"
                  />
                </div>

                <div className="flex-1 min-w-[160px]">
                  <label className="block text-xs font-semibold text-white/80 mb-1.5 ml-1">Skill</label>
                  <input
                    value={skill}
                    onChange={(e) => setSkill(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 transition-all text-sm"
                    placeholder="e.g. React"
                  />
                </div>

                <button
                  onClick={() => void loadJobs(1)}
                  className="px-6 py-2.5 bg-white text-blue-600 rounded-xl text-sm font-bold hover:bg-white/90 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[100px]"
                  disabled={busy}
                >
                  {busy ? (
                    <svg className="w-4 h-4 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    'Search'
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Decorative Elements */}
          <div className="absolute -right-16 -top-16 w-64 h-64 bg-white/5 rounded-full" />
          <div className="absolute -left-16 -bottom-16 w-48 h-48 bg-white/5 rounded-full blur-xl" />
        </motion.div>

        <ErrorAlert error={error} />

        {/* List */}
        <div>
          {busy && items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center shadow-lg animate-pulse mb-4">
                <svg className="w-8 h-8 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
              <div className="text-sm text-slate-500 font-medium">Fetching active roles...</div>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="text-sm font-semibold text-slate-700">No jobs found</div>
              <div className="text-xs text-slate-500 mt-1">Try adjusting your filters</div>
            </div>
          ) : (
            <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-4">
              {items.map((job) => (
                <motion.div key={job.id} variants={itemVariants} whileHover={{ y: -3 }} className="group rounded-2xl border border-surface-border p-5 bg-white shadow-card hover:shadow-card-hover transition-all duration-300 relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-400 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-[240px]">
                      <div className="text-lg font-bold text-slate-800">{job.title}</div>
                      <div className="text-sm font-medium text-blue-600 mt-1 flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        {job.company}
                        {job.location && (
                          <>
                            <span className="text-slate-300 mx-1">•</span>
                            <span className="text-slate-500 flex items-center gap-1">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              {job.location}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 border border-slate-200">
                        {job.status ?? 'ACTIVE'}
                      </div>
                      <button
                        onClick={() => openApply(job.id)}
                        className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
                      >
                        Apply Now
                      </button>
                    </div>
                  </div>

                  {job.description ? (
                    <div className="mt-4 text-sm text-slate-600 line-clamp-3 whitespace-pre-wrap leading-relaxed">
                      {job.description}
                    </div>
                  ) : null}

                  {Array.isArray(job.skills) && job.skills.length > 0 ? (
                    <div className="mt-4 flex flex-wrap gap-2 pt-4 border-t border-surface-border">
                      {job.skills.slice(0, 10).map((s) => (
                        <span
                          key={s}
                          className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-100 flex items-center gap-1.5"
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                          {s}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-surface-border shadow-card">
              <div className="text-sm font-medium text-slate-500">
                Page <span className="text-slate-800 font-bold">{page}</span> of <span className="text-slate-800 font-bold">{totalPages}</span>
                {total ? ` • ${total} total` : ''}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => void loadJobs(Math.max(1, page - 1))}
                  disabled={busy || page <= 1}
                  className="px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50 transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => void loadJobs(Math.min(totalPages, page + 1))}
                  disabled={busy || page >= totalPages}
                  className="px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Apply Modal */}
        {applyJobId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-surface-border">
              <div className="px-6 py-5 border-b border-surface-border flex items-center justify-between bg-slate-50/50">
                <div>
                  <div className="text-lg font-bold text-slate-800">Apply for Role</div>
                  <div className="text-sm text-slate-500 mt-1">Submit your cover letter to apply.</div>
                </div>
                <button
                  onClick={() => setApplyJobId(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-6 md:p-8">
                <label className="block text-sm font-bold text-slate-700 mb-2">Cover Letter</label>
                <textarea
                  value={coverLetter}
                  onChange={(e) => setCoverLetter(e.target.value)}
                  className="w-full min-h-[160px] px-5 py-4 rounded-2xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all text-slate-800 placeholder-slate-400"
                  placeholder="Write a short, tailored cover letter highlighting why you are a great fit..."
                />
                <div className="mt-3 flex items-start gap-2 text-xs font-medium text-slate-500 bg-blue-50/50 text-blue-700 p-3 rounded-xl border border-blue-100">
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Tip: Make sure to highlight 2–3 specific skills from the job description that match your profile.
                </div>

                <ErrorAlert error={error} />
              </div>

              <div className="px-6 py-5 border-t border-surface-border flex items-center justify-end gap-3 bg-slate-50/50">
                <button
                  onClick={() => setApplyJobId(null)}
                  className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                  disabled={busy}
                >
                  Cancel
                </button>
                <button
                  onClick={() => void submitApply()}
                  className="px-6 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[120px]"
                  disabled={busy || !coverLetter.trim()}
                >
                  {busy ? (
                    <svg className="w-5 h-5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    'Submit Application'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
