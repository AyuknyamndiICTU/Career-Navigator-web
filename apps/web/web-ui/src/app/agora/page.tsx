'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import dynamic from 'next/dynamic';
import DashboardLayout from '@/components/DashboardLayout';

const VideoCallClient = dynamic(
  () => import('@/components/agora/VideoCallClient').then((m) => m.VideoCallClient),
  { ssr: false, loading: () => (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center shadow-lg animate-pulse mb-4">
          <svg className="w-8 h-8 text-white animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
        <div className="text-sm font-bold text-slate-700">Loading Video Module...</div>
      </div>
    ) 
  }
);

export default function AgoraPage() {
  const [channelName, setChannelName] = useState('career-demo');
  const [uid, setUid] = useState(0);
  const [role, setRole] = useState<any>('publisher');
  const [started, setStarted] = useState(false);

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto pb-12">
        {/* Hero Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative overflow-hidden rounded-3xl p-8 md:p-10 mb-8"
          style={{
            background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 50%, #4f46e5 100%)',
          }}
        >
          <div className="relative z-10 max-w-2xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/15 backdrop-blur-sm rounded-full text-white/90 text-xs font-bold mb-4"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Live Collaboration
            </motion.div>

            <h1 className="text-3xl md:text-4xl font-extrabold text-white leading-tight">
              Video Sessions
            </h1>
            <p className="mt-3 text-white/80 text-sm md:text-base leading-relaxed max-w-lg font-medium">
              Connect with mentors, recruiters, and career advisors in high-quality real-time video calls.
            </p>
          </div>

          {/* Decorative Elements */}
          <div className="absolute -right-16 -top-16 w-64 h-64 bg-white/5 rounded-full" />
          <div className="absolute right-32 top-8 w-24 h-24 bg-white/10 rounded-full blur-xl" />
          <div className="absolute -left-8 -bottom-16 w-48 h-48 bg-white/5 rounded-full" />
        </motion.div>

        {!started ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl shadow-card p-8 border border-surface-border"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-cyan-50 flex items-center justify-center text-cyan-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-slate-800">Join a Session</h2>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <label className="block">
                <span className="text-sm font-bold text-slate-700 mb-2 block">Channel Name</span>
                <input
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  className="w-full px-5 py-3.5 bg-slate-50 rounded-2xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:border-cyan-400 transition-all font-medium text-slate-800 placeholder-slate-400 shadow-sm"
                />
              </label>

              <label className="block">
                <span className="text-sm font-bold text-slate-700 mb-2 block">UID (0 = auto)</span>
                <input
                  type="number"
                  value={uid}
                  onChange={(e) => setUid(Number(e.target.value))}
                  className="w-full px-5 py-3.5 bg-slate-50 rounded-2xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:border-cyan-400 transition-all font-medium text-slate-800 shadow-sm"
                />
              </label>

              <label className="block">
                <span className="text-sm font-bold text-slate-700 mb-2 block">Role</span>
                <div className="relative">
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-5 py-3.5 bg-slate-50 rounded-2xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:border-cyan-400 transition-all font-medium text-slate-800 appearance-none shadow-sm"
                  >
                    <option value="publisher">Publisher (Host)</option>
                    <option value="subscriber">Subscriber (Audience)</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-slate-500">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </label>

              <div className="flex items-end">
                <button
                  onClick={() => setStarted(true)}
                  className="w-full py-3.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-2xl text-sm font-bold hover:shadow-lg hover:-translate-y-0.5 transition-all shadow-md flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Join Session
                </button>
              </div>
            </div>

            {/* Tip */}
            <div className="mt-8 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 p-5">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 text-blue-600">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-800">Quick Testing Tip</div>
                  <div className="mt-1 text-sm text-slate-600 font-medium">
                    Open another browser tab, select the <span className="font-bold text-slate-800">Subscriber</span> role, and join the exact same <span className="font-bold text-slate-800">{channelName}</span> channel to test a multi-user video call right now.
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key="call"
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              className="bg-black rounded-3xl overflow-hidden shadow-2xl border border-slate-800"
            >
              <VideoCallClient channelName={channelName} uid={uid} role={role} />
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </DashboardLayout>
  );
}
