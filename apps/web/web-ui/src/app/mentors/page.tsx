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
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } },
};

export default function MentorsPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState<Array<any>>([]);

  const [q, setQ] = useState('');
  const [skill, setSkill] = useState('');
  const [expertise, setExpertise] = useState('');

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);

  const totalPages = useMemo(() => {
    const t = Number(total) || 0;
    const l = Number(limit) || 10;
    return Math.max(1, Math.ceil(t / l));
  }, [total, limit]);

  async function load(nextPage = page) {
    setBusy(true);
    setError('');

    try {
      const query = [
        q.trim() ? `q=${encodeURIComponent(q.trim())}` : null,
        skill.trim() ? `skill=${encodeURIComponent(skill.trim())}` : null,
        expertise.trim() ? `expertise=${encodeURIComponent(expertise.trim())}` : null,
        `page=${encodeURIComponent(String(nextPage))}`,
        `limit=${encodeURIComponent(String(limit))}`,
      ]
        .filter(Boolean)
        .join('&');

      const res = (await apiFetch(`/mentors?${query}`, { method: 'GET' })) as any;

      setItems(Array.isArray(res?.items) ? res.items : []);
      setTotal(typeof res?.total === 'number' ? res.total : 0);
      setPage(typeof res?.page === 'number' ? res.page : nextPage);
      setLimit(typeof res?.limit === 'number' ? res.limit : limit);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load mentors');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load(1);
  }, []);

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
            background: 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)',
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
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Expert Guidance
            </motion.div>

            <h1 className="text-3xl md:text-4xl font-extrabold text-white leading-tight">
              Mentor Matching
            </h1>
            <p className="mt-3 text-white/80 text-sm md:text-base leading-relaxed max-w-lg">
              Connect with industry leaders and experienced professionals who can guide you on your career journey.
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
                    placeholder="Name or bio keywords…"
                  />
                </div>

                <div className="flex-1 min-w-[180px]">
                  <label className="block text-xs font-semibold text-white/80 mb-1.5 ml-1">Skill</label>
                  <input
                    value={skill}
                    onChange={(e) => setSkill(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 transition-all text-sm"
                    placeholder="e.g. React"
                  />
                </div>

                <div className="flex-1 min-w-[180px]">
                  <label className="block text-xs font-semibold text-white/80 mb-1.5 ml-1">Expertise</label>
                  <input
                    value={expertise}
                    onChange={(e) => setExpertise(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 transition-all text-sm"
                    placeholder="e.g. Frontend"
                  />
                </div>

                <button
                  onClick={() => void load(1)}
                  className="px-6 py-2.5 bg-white text-emerald-600 rounded-xl text-sm font-bold hover:bg-white/90 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[100px]"
                  disabled={busy}
                >
                  {busy ? (
                    <svg className="w-4 h-4 animate-spin text-emerald-600" fill="none" viewBox="0 0 24 24">
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
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg animate-pulse mb-4">
                <svg className="w-8 h-8 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
              <div className="text-sm text-slate-500 font-medium">Finding mentors...</div>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div className="text-sm font-semibold text-slate-700">No mentors found</div>
              <div className="text-xs text-slate-500 mt-1">Try adjusting your filters</div>
            </div>
          ) : (
            <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid gap-4 md:grid-cols-2">
              {items.map((m) => (
                <motion.div key={m.id} variants={itemVariants} whileHover={{ y: -4 }} className="group rounded-2xl border border-surface-border p-6 bg-white shadow-card hover:shadow-card-hover transition-all duration-300 relative overflow-hidden flex flex-col h-full">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 to-teal-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 border-2 border-white shadow-sm flex items-center justify-center flex-shrink-0">
                      <span className="text-emerald-700 font-bold text-xl uppercase">
                        {m.displayName?.[0] || 'M'}
                      </span>
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-lg font-bold text-slate-800">{m.displayName}</div>
                          <div className="text-sm font-medium text-emerald-600 mt-0.5">
                            {Array.isArray(m.expertise) && m.expertise.length > 0 ? m.expertise[0] : 'Expert Mentor'}
                          </div>
                        </div>
                        <button className="px-4 py-2 rounded-xl bg-emerald-50 text-emerald-700 font-bold text-xs hover:bg-emerald-600 hover:text-white transition-colors border border-emerald-100 shadow-sm">
                          Connect
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 text-sm text-slate-600 leading-relaxed flex-grow">
                    {m.bio || 'No bio provided.'}
                  </div>

                  {Array.isArray(m.skills) && m.skills.length > 0 && (
                    <div className="mt-5 pt-4 border-t border-surface-border flex flex-wrap gap-2">
                      {m.skills.slice(0, 6).map((s: string) => (
                        <span
                          key={s}
                          className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-slate-50 text-slate-600 border border-slate-200"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
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
                  onClick={() => void load(Math.max(1, page - 1))}
                  disabled={busy || page <= 1}
                  className="px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50 transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => void load(Math.min(totalPages, page + 1))}
                  disabled={busy || page >= totalPages}
                  className="px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
