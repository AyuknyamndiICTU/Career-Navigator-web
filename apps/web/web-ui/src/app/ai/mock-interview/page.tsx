// @ts-nocheck
'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { apiStream } from '@/lib/auth';
import DashboardLayout from '@/components/DashboardLayout';
import ErrorAlert from '@/components/ErrorAlert';
import AiUsageLine from '@/components/ai/AiUsageLine';
import type { AiMeta } from '@/lib/ai-usage';

type Difficulty = 'beginner' | 'intermediate' | 'advanced';

type Turn = {
  role: 'user' | 'assistant';
  content: string;
  meta?: AiMeta | null;
  streamingTokens?: number;
};

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

export default function MockInterviewPage() {
  const [role, setRole] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('intermediate');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [answer, setAnswer] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  function updateLast(patch: (t: Turn) => Turn) {
    setTurns((prev) => {
      const last = prev[prev.length - 1];
      if (!last || last.role !== 'assistant') return prev;
      return [...prev.slice(0, -1), patch(last)];
    });
  }

  async function run(body: Record<string, unknown>) {
    setBusy(true);
    setError('');
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await apiStream(
        '/ai/mock-interview/stream',
        body,
        (event, data) => {
          if (event === 'start') {
            setTurns((prev) => [
              ...prev,
              { role: 'assistant', content: '', meta: { ...data, usage: null }, streamingTokens: 0 },
            ]);
          } else if (event === 'delta') {
            updateLast((t) => ({ ...t, content: t.content + data.text }));
          } else if (event === 'usage') {
            updateLast((t) => ({ ...t, streamingTokens: data.outputTokensEstimate }));
          } else if (event === 'done') {
            updateLast((t) => ({ ...t, content: data.response, meta: data.ai, streamingTokens: undefined }));
          } else if (event === 'error') {
            setError(data.message || 'The interview was interrupted.');
            updateLast((t) => ({ ...t, streamingTokens: undefined }));
          }
        },
        controller.signal,
      );
    } catch (e) {
      if (controller.signal.aborted) return;
      const msg = e instanceof Error ? e.message : 'Mock interview failed';
      if (!msg) return;
      if (
        msg.toLowerCase().includes('401') ||
        msg.toLowerCase().includes('unauthorized')
      )
        return;
      setError(msg);
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!role.trim() || busy) return;
    setTurns([]);
    await run({ role: role.trim(), difficulty });
  }

  async function sendAnswer() {
    const text = answer.trim();
    if (!text || busy) return;
    const history = turns.filter((t) => t.content).map(({ role: r, content }) => ({ role: r, content }));
    setAnswer('');
    setTurns((prev) => [...prev, { role: 'user', content: text }]);
    await run({ role: role.trim(), difficulty, message: text, history: history.slice(-20) });
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
            background: 'linear-gradient(135deg, #f59e0b 0%, #f97316 50%, #ea580c 100%)',
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
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              Interview Prep
            </motion.div>

            <h1 className="text-3xl md:text-4xl font-extrabold text-white leading-tight">
              Mock Interview
            </h1>
            <p className="mt-3 text-white/80 text-sm md:text-base leading-relaxed max-w-lg">
              Practice interview questions tailored to your exact career path and experience level.
            </p>
          </div>

          {/* Decorative Elements */}
          <div className="absolute -right-16 -top-16 w-64 h-64 bg-white/5 rounded-full" />
          <div className="absolute right-32 top-8 w-24 h-24 bg-white/10 rounded-full blur-xl" />
          <div className="absolute -left-8 -bottom-16 w-48 h-48 bg-white/5 rounded-full" />
        </motion.div>

        {/* Form card */}
        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="bg-white rounded-2xl shadow-card overflow-hidden border border-surface-border mb-6">
          <div className="px-6 py-4 border-b border-surface-border bg-slate-50/50">
            <div className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <svg className="w-5 h-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Set up your interview
            </div>
          </div>

          <form className="p-6 md:p-8 space-y-6" onSubmit={onSubmit}>
            {/* Role input */}
            <motion.label variants={itemVariants} className="block">
              <span className="text-sm font-bold text-slate-700 mb-2 block">
                Target Role
              </span>
              <input
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-5 py-3 bg-slate-50 rounded-xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400 transition-all font-medium text-slate-800 placeholder-slate-400"
                placeholder="e.g. Frontend Developer, Data Analyst"
                type="text"
                maxLength={200}
                required
              />
            </motion.label>

            {/* Difficulty select */}
            <motion.label variants={itemVariants} className="block">
              <span className="text-sm font-bold text-slate-700 mb-2 block">
                Difficulty Level
              </span>
              <div className="relative">
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                  className="w-full px-5 py-3 bg-slate-50 rounded-xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400 transition-all font-medium text-slate-800 appearance-none"
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-slate-500">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </motion.label>

            {/* Error */}
            <ErrorAlert error={error} />

            {/* Submit */}
            <motion.button
              variants={itemVariants}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              disabled={busy || !role.trim()}
              type="submit"
              className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl text-sm font-bold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-md"
            >
              {busy ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Generating questions…
                </span>
              ) : (
                'Start Mock Interview'
              )}
            </motion.button>
          </form>
        </motion.div>

        {/* Interview transcript */}
        {turns.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl shadow-card overflow-hidden border border-surface-border">
            <div className="px-6 py-4 border-b border-surface-border bg-slate-50/50 flex flex-wrap items-center justify-between gap-4">
              <div className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Interview in progress
              </div>
              <div className="flex gap-2">
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                  Role: {role}
                </span>
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-orange-50 text-orange-600 border border-orange-100 uppercase">
                  {difficulty}
                </span>
              </div>
            </div>

            <div className="p-6 md:p-8 space-y-5">
              {turns.map((turn, i) => (
                <div
                  key={i}
                  className={
                    turn.role === 'assistant'
                      ? 'text-sm text-slate-700 leading-relaxed font-medium'
                      : 'ml-auto max-w-[85%] rounded-2xl bg-orange-50 border border-orange-100 px-4 py-3 text-sm text-slate-800 font-medium'
                  }
                >
                  <div className="whitespace-pre-wrap">{turn.content || '…'}</div>
                  {turn.role === 'assistant' && (
                    <AiUsageLine meta={turn.meta} streamingTokens={turn.streamingTokens} />
                  )}
                </div>
              ))}

              <div className="pt-2 flex items-end gap-3">
                <textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  rows={3}
                  maxLength={5000}
                  placeholder="Type your answer to get feedback and the next question…"
                  className="flex-1 px-4 py-3 bg-slate-50 rounded-xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400 font-medium text-slate-800 placeholder-slate-400 resize-none"
                />
                <button
                  type="button"
                  onClick={busy ? () => abortRef.current?.abort() : sendAnswer}
                  disabled={!busy && !answer.trim()}
                  className="px-5 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl text-sm font-bold disabled:opacity-50 shadow-md"
                >
                  {busy ? 'Stop' : 'Answer'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </DashboardLayout>
  );
}
