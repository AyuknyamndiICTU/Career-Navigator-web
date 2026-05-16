// @ts-nocheck
'use client';

import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { apiFetch } from '@/lib/auth';

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
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-slate-800">Mentor Matching</h1>
          <p className="text-sm text-slate-500">Search mentors by skills and expertise.</p>
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
                  placeholder="Name or bio keywords…"
                />
              </div>

              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Skill</label>
                <input
                  value={skill}
                  onChange={(e) => setSkill(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface border border-surface-border text-sm focus:outline-none"
                  placeholder="e.g. React"
                />
              </div>

              <div className="flex-1 min-w-[220px]">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Expertise</label>
                <input
                  value={expertise}
                  onChange={(e) => setExpertise(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface border border-surface-border text-sm focus:outline-none"
                  placeholder="e.g. Frontend"
                />
              </div>

              <button
                onClick={() => void load(1)}
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
                  <span className="text-sm text-slate-500 font-medium">Loading mentors…</span>
                </div>
              </div>
            ) : items.length === 0 ? (
              <div className="text-sm text-slate-500">No mentors found.</div>
            ) : (
              <div className="space-y-3">
                {items.map((m) => (
                  <div key={m.id} className="rounded-2xl border border-surface-border p-4 bg-white">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold text-slate-800">{m.displayName}</div>
                        <div className="text-xs text-slate-500 mt-1 whitespace-pre-wrap">{m.bio ?? ''}</div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-1 rounded-xl bg-surface text-slate-700 border border-surface-border">
                          {Array.isArray(m.expertise) && m.expertise.length > 0 ? m.expertise[0] : 'Expert'}
                        </span>
                      </div>
                    </div>

                    {Array.isArray(m.skills) && m.skills.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {m.skills.slice(0, 10).map((s: string) => (
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
                    onClick={() => void load(Math.max(1, page - 1))}
                    disabled={busy || page <= 1}
                    className="px-3 py-2 rounded-xl bg-surface border border-surface-border text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => void load(Math.min(totalPages, page + 1))}
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
      </div>
    </DashboardLayout>
  );
}
