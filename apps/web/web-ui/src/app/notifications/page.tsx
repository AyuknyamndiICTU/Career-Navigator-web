// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
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
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' as const } },
};

export default function NotificationsPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState<Array<any>>([]);

  async function load() {
    setBusy(true);
    setError('');
    try {
      const res = await apiFetch('/notifications');
      setItems(Array.isArray(res) ? res : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load notifications');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function markRead(id: string) {
    // Optimistic UI update
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );

    try {
      await apiFetch(`/notifications/${id}/read`, { method: 'POST' });
    } catch (e) {
      // Revert on error
      setError(e instanceof Error ? e.message : 'Failed to mark as read');
      void load();
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto pb-12">
        {/* Hero Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative overflow-hidden rounded-3xl p-8 md:p-10 mb-8"
          style={{
            background: 'linear-gradient(135deg, #d946ef 0%, #c026d3 50%, #9333ea 100%)',
          }}
        >
          <div className="relative z-10 max-w-2xl">
             <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/15 backdrop-blur-sm rounded-full text-white/90 text-xs font-semibold mb-4"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              Activity Feed
            </motion.div>

            <h1 className="text-3xl md:text-4xl font-extrabold text-white leading-tight">
              Notifications
            </h1>
            <p className="mt-3 text-white/80 text-sm md:text-base leading-relaxed max-w-lg">
              Stay up to date with your recent job matches, profile updates, and mentor connections.
            </p>
          </div>

          {/* Decorative Elements */}
          <div className="absolute -right-16 -top-16 w-64 h-64 bg-white/5 rounded-full" />
          <div className="absolute right-32 top-8 w-24 h-24 bg-white/10 rounded-full blur-xl" />
        </motion.div>

        <ErrorAlert error={error} />

        <div className="bg-white rounded-3xl shadow-card overflow-hidden border border-surface-border">
          <div className="px-6 py-5 border-b border-surface-border bg-slate-50/50 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-800">Your Inbox</h2>
            {items.filter(n => !n.isRead).length > 0 && (
              <div className="px-3 py-1 bg-fuchsia-100 text-fuchsia-700 rounded-full text-xs font-bold">
                 {items.filter(n => !n.isRead).length} Unread
              </div>
            )}
          </div>

          <div className="p-4 md:p-6">
            {busy ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-fuchsia-400 to-purple-500 flex items-center justify-center shadow-lg animate-pulse mb-4">
                  <svg className="w-8 h-8 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
                <div className="text-sm font-bold text-slate-700">Loading notifications...</div>
              </div>
            ) : items.length === 0 ? (
               <div className="flex flex-col items-center justify-center py-16 text-center">
                 <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4 border border-slate-200">
                  <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-slate-800">You're all caught up!</h3>
                <p className="mt-1 text-sm text-slate-500 max-w-sm">No new notifications at this time.</p>
              </div>
            ) : (
              <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-3">
                {items.map((n) => (
                  <motion.div
                    variants={itemVariants}
                    key={n.id}
                    className={`rounded-2xl border p-5 transition-all ${
                      n.isRead 
                        ? 'bg-slate-50 border-slate-200' 
                        : 'bg-white border-fuchsia-200 shadow-md ring-1 ring-fuchsia-100'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          n.isRead ? 'bg-slate-200 text-slate-500' : 'bg-fuchsia-100 text-fuchsia-600'
                        }`}>
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div>
                          <div className={`text-sm font-bold ${n.isRead ? 'text-slate-600' : 'text-slate-800'}`}>
                            {n.type ?? 'System Notification'}
                          </div>
                          <div className={`mt-1.5 text-sm leading-relaxed ${n.isRead ? 'text-slate-500' : 'text-slate-700 font-medium'}`}>
                            {n.message}
                          </div>
                        </div>
                      </div>

                      {!n.isRead && (
                        <button
                          onClick={() => markRead(n.id)}
                          className="shrink-0 px-4 py-2 bg-fuchsia-50 border border-fuchsia-200 text-fuchsia-700 rounded-xl text-xs font-bold hover:bg-fuchsia-100 transition-colors shadow-sm"
                        >
                          Mark as read
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
