'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { VideoCallClient } from '@/components/agora/VideoCallClient';

export default function AgoraPage() {
  const [channelName, setChannelName] = useState('career-demo');
  const [uid, setUid] = useState(0);
  const [role, setRole] = useState<any>('publisher');
  const [started, setStarted] = useState(false);

  return (
    <main className="min-h-screen p-6">
      <div className="mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 rounded-xl border-4 border-black bg-white p-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"
        >
          <div className="text-3xl font-black">VIDEO CALL</div>
          <div className="mt-1 text-sm font-bold opacity-80">
            Brutal UI. Real-time vibes. No blinking.
          </div>
        </motion.div>

        {!started ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-xl border-4 border-black bg-white p-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="block">
                <div className="mb-1 text-sm font-black">Channel name</div>
                <input
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  className="w-full rounded-lg border-2 border-black bg-[#f7f7f7] px-3 py-2 font-mono shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] outline-none focus:bg-white"
                />
              </label>

              <label className="block">
                <div className="mb-1 text-sm font-black">UID (0 = any)</div>
                <input
                  type="number"
                  value={uid}
                  onChange={(e) => setUid(Number(e.target.value))}
                  className="w-full rounded-lg border-2 border-black bg-[#f7f7f7] px-3 py-2 font-mono shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] outline-none focus:bg-white"
                />
              </label>

              <label className="block">
                <div className="mb-1 text-sm font-black">Role</div>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full rounded-lg border-2 border-black bg-[#f7f7f7] px-3 py-2 font-mono shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] outline-none focus:bg-white"
                >
                  <option value="publisher">publisher (host)</option>
                  <option value="subscriber">subscriber (audience)</option>
                </select>
              </label>

              <div className="flex items-end">
                <button
                  onClick={() => setStarted(true)}
                  className="w-full rounded-lg border-4 border-black bg-yellow-300 px-4 py-3 text-center text-sm font-black shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-[1px] active:translate-y-[0px]"
                >
                  SUMMON THE ROOM
                </button>
              </div>
            </div>

            <div className="mt-4 rounded-lg border-2 border-black bg-black/5 p-3">
              <div className="text-sm font-black">Tip</div>
              <div className="mt-1 text-sm font-bold opacity-80">
                Open another tab, set the other user role, and join the same channel name.
              </div>
            </div>
          </motion.div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key="call"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-2"
            >
              <VideoCallClient channelName={channelName} uid={uid} role={role} />
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </main>
  );
}
