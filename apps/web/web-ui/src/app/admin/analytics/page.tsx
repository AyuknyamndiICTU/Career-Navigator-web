'use client';

// @ts-nocheck
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { apiFetch } from '@/lib/auth';
import DashboardLayout from '@/components/DashboardLayout';
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
      <div className="max-w-6xl mx-auto pb-12">
        {/* Hero Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative overflow-hidden rounded-3xl p-8 md:p-10 mb-8"
          style={{
            background: 'linear-gradient(135deg, #1e293b 0%, #334155 50%, #475569 100%)',
          }}
        >
          <div className="relative z-10 max-w-2xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 backdrop-blur-sm rounded-full text-white/90 text-xs font-semibold mb-4 border border-white/20"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              Admin Dashboard
            </motion.div>

            <h1 className="text-3xl md:text-4xl font-extrabold text-white leading-tight">
              Platform Analytics
            </h1>
            <p className="mt-3 text-white/80 text-sm md:text-base leading-relaxed max-w-lg">
              Monitor real-time engagement, track user activity, and overview platform growth metrics.
            </p>
          </div>

          {/* Decorative Elements */}
          <div className="absolute -right-16 -top-16 w-64 h-64 bg-white/5 rounded-full" />
          <div className="absolute right-32 top-8 w-24 h-24 bg-white/10 rounded-full blur-xl" />
          <div className="absolute -left-8 -bottom-16 w-48 h-48 bg-white/5 rounded-full" />
        </motion.div>

        {/* Stats preview cards */}
        {data && (
          <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Total Users', key: 'totalUsers', color: 'text-blue-500', bg: 'bg-blue-50', gradient: 'from-blue-500 to-cyan-500', icon: (
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              )},
              { label: 'Active Users', key: 'activeUsers', color: 'text-emerald-500', bg: 'bg-emerald-50', gradient: 'from-emerald-400 to-teal-500', icon: (
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )},
              { label: 'Total Jobs', key: 'totalJobs', color: 'text-violet-500', bg: 'bg-violet-50', gradient: 'from-violet-500 to-purple-600', icon: (
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.193 23.193 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              )},
              { label: 'Mentors', key: 'totalMentors', color: 'text-amber-500', bg: 'bg-amber-50', gradient: 'from-amber-400 to-orange-500', icon: (
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )},
            ].map((stat) => (
              <motion.div
                variants={itemVariants}
                whileHover={{ y: -4 }}
                key={stat.key}
                className="bg-white rounded-2xl p-6 shadow-card hover:shadow-card-hover transition-all duration-300 border border-surface-border relative overflow-hidden group"
              >
                <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${stat.gradient} opacity-0 group-hover:opacity-100 transition-opacity`} />
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 bg-gradient-to-br ${stat.gradient} rounded-2xl flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform duration-300`}>
                    {stat.icon}
                  </div>
                  <div>
                    <div className="text-3xl font-extrabold text-slate-800 tracking-tight">
                      {data[stat.key] ?? '—'}
                    </div>
                    <div className="text-sm text-slate-500 font-bold mt-0.5">{stat.label}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Main data card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-white rounded-2xl shadow-card overflow-hidden border border-surface-border">
          <div className="px-6 py-5 border-b border-surface-border bg-slate-50/50 flex items-center gap-3">
            <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            <div>
              <h2 className="text-base font-bold text-slate-800">Raw API Output</h2>
              <p className="text-xs text-slate-500 font-medium">Detailed engagement metrics</p>
            </div>
          </div>

          <div className="p-6">
            {busy && (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center shadow-lg animate-pulse mb-4">
                  <svg className="w-8 h-8 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
                <div className="text-sm font-bold text-slate-700">Fetching Analytics...</div>
              </div>
            )}

            <ErrorAlert error={error} />

            {data && (
              <div className="rounded-2xl bg-slate-900 p-6 overflow-auto shadow-inner border border-slate-800 relative group">
                <div className="absolute top-4 right-4 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                </div>
                <pre className="whitespace-pre-wrap break-words text-sm leading-relaxed font-mono text-emerald-400">
                  {JSON.stringify(data, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
