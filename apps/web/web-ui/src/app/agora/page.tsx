'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import dynamic from 'next/dynamic';
import DashboardLayout from '@/components/DashboardLayout';

const VideoCallClient = dynamic(
  () => import('@/components/agora/VideoCallClient').then((m) => m.VideoCallClient),
  { ssr: false, loading: () => <div className="p-8 text-center text-sm text-slate-500">Loading video module…</div> }
);

export default function AgoraPage() {
  const [channelName, setChannelName] = useState('career-demo');
  const [uid, setUid] = useState(0);
  const [role, setRole] = useState<any>('publisher');
  const [started, setStarted] = useState(false);

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-slate-800">Video Call</h1>
          <p className="text-sm text-slate-500">Connect with mentors and career advisors in real-time</p>
        </div>

        {!started ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-card p-6"
          >
            <h2 className="text-lg font-semibold text-slate-800 mb-5">Join a Session</h2>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-slate-700 mb-1.5 block">Channel Name</span>
                <input
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-surface rounded-xl text-sm border border-surface-border focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-all"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700 mb-1.5 block">UID (0 = auto)</span>
                <input
                  type="number"
                  value={uid}
                  onChange={(e) => setUid(Number(e.target.value))}
                  className="w-full px-4 py-2.5 bg-surface rounded-xl text-sm border border-surface-border focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-all"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700 mb-1.5 block">Role</span>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-4 py-2.5 bg-surface rounded-xl text-sm border border-surface-border focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-all"
                >
                  <option value="publisher">Publisher (Host)</option>
                  <option value="subscriber">Subscriber (Audience)</option>
                </select>
              </label>

              <div className="flex items-end">
                <button
                  onClick={() => setStarted(true)}
                  className="w-full py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 transition-colors shadow-soft"
                >
                  Join Session
                </button>
              </div>
            </div>

            {/* Tip */}
            <div className="mt-5 rounded-xl bg-primary-50 border border-primary-100 p-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-primary-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <div className="text-sm font-medium text-primary-800">Quick Tip</div>
                  <div className="mt-0.5 text-sm text-primary-600">
                    Open another tab, set a different role, and join the same channel name to test multi-user calls.
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key="call"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <VideoCallClient channelName={channelName} uid={uid} role={role} />
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </DashboardLayout>
  );
}
