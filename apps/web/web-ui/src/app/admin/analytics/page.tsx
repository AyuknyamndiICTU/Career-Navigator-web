'use client';

// @ts-nocheck
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/auth';
import DashboardLayout from '@/components/DashboardLayout';

export default function AdminAnalyticsPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setBusy(true);
      setError('');
      setData(null);

      try {
        const res = await apiFetch('/admin/analytics/engagement', {
          method: 'GET',
        });

        if (mounted) setData(res);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to load analytics';
        if (mounted) setError(msg);
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
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-slate-800">Admin Analytics</h1>
          <p className="text-sm text-slate-500">Monitor platform engagement and user activity</p>
        </div>

        {/* Stats preview cards */}
        {data && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Total Users', key: 'totalUsers', color: 'text-blue-600', bg: 'bg-blue-50', icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              )},
              { label: 'Active Users', key: 'activeUsers', color: 'text-emerald-600', bg: 'bg-emerald-50', icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )},
              { label: 'Total Jobs', key: 'totalJobs', color: 'text-violet-600', bg: 'bg-violet-50', icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.193 23.193 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              )},
              { label: 'Mentors', key: 'totalMentors', color: 'text-amber-600', bg: 'bg-amber-50', icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )},
            ].map((stat) => (
              <div
                key={stat.key}
                className="bg-white rounded-2xl p-5 shadow-card hover:shadow-card-hover transition-shadow duration-300"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 ${stat.bg} ${stat.color} rounded-xl flex items-center justify-center`}>
                    {stat.icon}
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-slate-800">
                      {data[stat.key] ?? '—'}
                    </div>
                    <div className="text-xs text-slate-500 font-medium">{stat.label}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Main data card */}
        <div className="bg-white rounded-2xl shadow-card overflow-hidden">
          <div className="px-6 py-4 border-b border-surface-border">
            <h2 className="text-base font-semibold text-slate-800">Engagement Metrics</h2>
            <p className="text-xs text-slate-500 mt-0.5">Detailed analytics data from the API</p>
          </div>

          <div className="p-6">
            {busy && (
              <div className="flex items-center justify-center py-12">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-primary-600 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span className="text-sm text-slate-500 font-medium">Loading analytics…</span>
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
                {error}
              </div>
            )}

            {data && (
              <div className="rounded-xl bg-surface border border-surface-border p-4 overflow-auto">
                <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed font-mono text-slate-600">
                  {JSON.stringify(data, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
