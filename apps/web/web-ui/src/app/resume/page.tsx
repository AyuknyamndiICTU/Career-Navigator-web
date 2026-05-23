// @ts-nocheck
'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import DashboardLayout from '@/components/DashboardLayout';
import { apiFetch } from '@/lib/auth';
import ErrorAlert from '@/components/ErrorAlert';

type ResumeResponse = unknown;

export default function ResumeBuilderPage() {
  const [template, setTemplate] = useState<'STANDARD' | 'DETAILED'>('STANDARD');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<ResumeResponse | null>(null);

  const templates = useMemo(
    () => [
      { id: 'STANDARD' as const, label: 'Standard Template' },
      { id: 'DETAILED' as const, label: 'Detailed Template' },
    ],
    [],
  );

  async function build() {
    setBusy(true);
    setError('');
    try {
      const res = await apiFetch('/resume/build', {
        method: 'POST',
        body: { template },
      });

      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to build resume');
      setData(null);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void build();
  }, []);

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
            background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 50%, #115e59 100%)',
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
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Auto-Generator
            </motion.div>

            <h1 className="text-3xl md:text-4xl font-extrabold text-white leading-tight">
              Resume Builder
            </h1>
            <p className="mt-3 text-white/80 text-sm md:text-base leading-relaxed max-w-lg">
              Generate a perfectly formatted, ATS-friendly resume instantly based on your profile data.
            </p>

            <div className="mt-8 bg-white/15 backdrop-blur-md border border-white/20 rounded-2xl p-4 shadow-lg flex flex-wrap items-end gap-3">
               <div className="min-w-[240px] flex-1">
                  <label className="block text-xs font-semibold text-white/80 mb-1.5 ml-1">Select Template</label>
                  <div className="relative">
                    <select
                      value={template}
                      onChange={(e) => setTemplate(e.target.value as 'STANDARD' | 'DETAILED')}
                      className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 transition-all text-sm appearance-none font-bold"
                    >
                      {templates.map((t) => (
                        <option key={t.id} value={t.id} className="text-slate-800">
                          {t.label}
                        </option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-white/70">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => void build()}
                  disabled={busy}
                  className="px-6 py-3 bg-white text-teal-700 rounded-xl text-sm font-bold hover:bg-white/90 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[140px]"
                >
                  {busy ? (
                     <svg className="w-4 h-4 animate-spin text-teal-700" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                  ) : (
                    'Generate Resume'
                  )}
                </button>
            </div>
          </div>

          {/* Decorative Elements */}
          <div className="absolute -right-16 -top-16 w-64 h-64 bg-white/5 rounded-full" />
          <div className="absolute right-32 top-8 w-24 h-24 bg-white/10 rounded-full blur-xl" />
        </motion.div>

        <ErrorAlert error={error} />

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white rounded-3xl shadow-card overflow-hidden border border-surface-border min-h-[400px] flex flex-col">
          <div className="px-6 py-4 border-b border-surface-border bg-slate-50/50 flex items-center gap-3">
            <div className="flex gap-1.5">
               <div className="w-3 h-3 rounded-full bg-slate-300" />
               <div className="w-3 h-3 rounded-full bg-slate-300" />
               <div className="w-3 h-3 rounded-full bg-slate-300" />
            </div>
            <h2 className="text-sm font-bold text-slate-500 ml-2">Preview Document</h2>
          </div>

          <div className="p-8 flex-1 flex flex-col">
            {busy && !data ? (
              <div className="flex flex-col items-center justify-center h-full m-auto py-20">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center shadow-lg animate-pulse mb-4">
                  <svg className="w-8 h-8 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
                <div className="text-sm font-bold text-slate-700">Compiling your resume...</div>
              </div>
            ) : !data ? (
              <div className="flex flex-col items-center justify-center h-full m-auto py-20 text-center">
                 <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4 border border-slate-200">
                  <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-slate-800">No Resume Generated</h3>
                <p className="mt-1 text-sm text-slate-500 max-w-sm">Click the generate button above to build your resume.</p>
              </div>
            ) : (
              <div className="rounded-2xl bg-white border border-slate-200 p-8 shadow-inner overflow-auto">
                <pre className="whitespace-pre-wrap break-words text-sm leading-relaxed font-serif text-slate-800">
                  {JSON.stringify(data, null, 2).replace(/[{}"]/g, '')}
                </pre>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
