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
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
};

export default function MessagesPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [conversations, setConversations] = useState<Array<any>>([]);

  async function load() {
    setBusy(true);
    setError('');
    try {
      const res = await apiFetch('/conversations');
      setConversations(res?.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load messages');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

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
            background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 50%, #4338ca 100%)',
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
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Inbox
            </motion.div>

            <h1 className="text-3xl md:text-4xl font-extrabold text-white leading-tight">
              Messages
            </h1>
            <p className="mt-3 text-white/80 text-sm md:text-base leading-relaxed max-w-lg">
              View your conversation threads with mentors and peers.
            </p>
          </div>

          {/* Decorative Elements */}
          <div className="absolute -right-16 -top-16 w-64 h-64 bg-white/5 rounded-full" />
          <div className="absolute right-32 top-8 w-24 h-24 bg-white/10 rounded-full blur-xl" />
        </motion.div>

        <ErrorAlert error={error} />

        <div className="bg-white rounded-3xl shadow-card border border-surface-border overflow-hidden">
          <div className="px-6 py-5 border-b border-surface-border bg-slate-50/50 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-800">Active Conversations</h2>
            <div className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold border border-indigo-100">
               {conversations.length} Threads
            </div>
          </div>

          <div className="p-4 md:p-6">
            {busy ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center shadow-lg animate-pulse mb-4">
                  <svg className="w-8 h-8 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
                <div className="text-sm font-bold text-slate-700">Loading messages...</div>
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                 <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4 border border-slate-200">
                  <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                     <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-slate-800">No Conversations Yet</h3>
                <p className="mt-1 text-sm text-slate-500 max-w-sm">When you message a mentor or match, it will appear here.</p>
              </div>
            ) : (
              <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-3">
                {conversations.map((c) => (
                  <motion.a
                    variants={itemVariants}
                    whileHover={{ x: 4 }}
                    href={`/messages/${c.id}`}
                    key={c.id}
                    className="flex items-center gap-4 rounded-2xl border border-slate-100 p-4 bg-white hover:bg-slate-50 hover:border-indigo-100 hover:shadow-sm transition-all cursor-pointer group"
                  >
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 border border-white shadow-sm flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                      <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                      </svg>
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                         <div className="text-base font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">
                           Conversation {c.id.slice(0, 8)}
                         </div>
                         <div className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-1 rounded-md">
                           {new Date(c.updatedAt).toLocaleDateString()}
                         </div>
                      </div>
                      <div className="text-sm text-slate-500 mt-1 line-clamp-1">
                        Click to view messages and reply in this thread...
                      </div>
                    </div>
                  </motion.a>
                ))}
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
