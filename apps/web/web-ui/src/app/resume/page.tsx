// @ts-nocheck
'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import DashboardLayout from '@/components/DashboardLayout';
import { apiFetch } from '@/lib/auth';
import ErrorAlert from '@/components/ErrorAlert';
import TemplateClassic from '@/components/resume/TemplateClassic';
import TemplateModern from '@/components/resume/TemplateModern';
import TemplateMinimal from '@/components/resume/TemplateMinimal';
import type { ResumeData } from '@/components/resume/types';

type TemplateId = 'CLASSIC' | 'MODERN' | 'MINIMAL';

const TEMPLATES: { id: TemplateId; label: string; description: string; previewClass: string; previewBg: string }[] = [
  {
    id: 'CLASSIC',
    label: 'Classic',
    description: 'Dark header, two-column layout with skills sidebar. Professional and traditional.',
    previewClass: 'from-slate-700 to-slate-900',
    previewBg: 'bg-slate-800',
  },
  {
    id: 'MODERN',
    label: 'Modern',
    description: 'Colored sidebar with skill tags. Clean, contemporary, and visually striking.',
    previewClass: 'from-indigo-500 to-violet-600',
    previewBg: 'bg-indigo-600',
  },
  {
    id: 'MINIMAL',
    label: 'Minimal',
    description: 'Single-column black on white. ATS-optimized, no distractions.',
    previewClass: 'from-slate-400 to-slate-600',
    previewBg: 'bg-white',
  },
];

function TemplatePreview({ t, selected, onSelect }: { t: typeof TEMPLATES[0]; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative rounded-2xl overflow-hidden border-2 transition-all duration-300 text-left group ${
        selected ? 'border-indigo-500 shadow-lg ring-2 ring-indigo-200' : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
      }`}
    >
      {/* Mini mockup */}
      <div className={`h-24 bg-gradient-to-br ${t.previewClass} flex items-center justify-center`}>
        <div className="w-16 h-1.5 bg-white/20 rounded-full" />
      </div>
      <div className="p-4 bg-white">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-slate-800">{t.label}</span>
          {selected && (
            <svg className="w-5 h-5 text-indigo-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
            </svg>
          )}
        </div>
        <p className="mt-1 text-xs text-slate-500 leading-relaxed line-clamp-2">{t.description}</p>
      </div>
    </button>
  );
}

function renderTemplate(template: TemplateId, data: ResumeData) {
  switch (template) {
    case 'CLASSIC':
      return <TemplateClassic data={data} />;
    case 'MODERN':
      return <TemplateModern data={data} />;
    case 'MINIMAL':
      return <TemplateMinimal data={data} />;
  }
}

export default function ResumeBuilderPage() {
  const [template, setTemplate] = useState<TemplateId>('CLASSIC');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<ResumeData | null>(null);

  const build = useCallback(async (tpl: TemplateId) => {
    setBusy(true);
    setError('');
    try {
      const res = await apiFetch('/resume/build', {
        method: 'POST',
        body: { template: tpl },
      });
      setData(res as ResumeData);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to build resume');
      setData(null);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void build('CLASSIC');
  }, [build]);

  function handleTemplateSelect(tpl: TemplateId) {
    setTemplate(tpl);
    void build(tpl);
  }

  function handleDownloadPdf() {
    window.print();
  }

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
              Choose a template, generate your resume, and download as PDF — all from your profile data.
            </p>

            <div className="mt-8 bg-white/15 backdrop-blur-md border border-white/20 rounded-2xl p-4 shadow-lg flex flex-wrap items-end gap-3">
              <button
                onClick={() => void build(template)}
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

              {data && (
                <button
                  onClick={handleDownloadPdf}
                  className="px-6 py-3 bg-white/20 text-white rounded-xl text-sm font-bold border border-white/30 hover:bg-white/30 transition-all flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download as PDF
                </button>
              )}
            </div>
          </div>

          <div className="absolute -right-16 -top-16 w-64 h-64 bg-white/5 rounded-full" />
          <div className="absolute right-32 top-8 w-24 h-24 bg-white/10 rounded-full blur-xl" />
        </motion.div>

        <ErrorAlert error={error} />

        {/* Template Picker */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          <h2 className="text-lg font-bold text-slate-800 mb-1">Choose a Template</h2>
          <p className="text-sm text-slate-500 mb-4">Select the design that best fits your style. Click a card to preview it below.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {TEMPLATES.map((t) => (
              <TemplatePreview
                key={t.id}
                t={t}
                selected={template === t.id}
                onSelect={() => handleTemplateSelect(t.id)}
              />
            ))}
          </div>
        </motion.div>

        {/* Resume Output */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-3xl shadow-card overflow-hidden border border-surface-border min-h-[400px] flex flex-col"
        >
          <div className="px-6 py-4 border-b border-surface-border bg-slate-50/50 flex items-center gap-3">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-slate-300" />
              <div className="w-3 h-3 rounded-full bg-slate-300" />
              <div className="w-3 h-3 rounded-full bg-slate-300" />
            </div>
            <h2 className="text-sm font-bold text-slate-500 ml-2">
              Preview — {TEMPLATES.find((t) => t.id === template)?.label ?? 'Classic'} Template
            </h2>
          </div>

          <div className="p-4 flex-1 flex flex-col overflow-auto">
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
                <p className="mt-1 text-sm text-slate-500 max-w-sm">Fill in your profile, education, and experience, then generate your resume.</p>
              </div>
            ) : (
              <div className="shadow-lg rounded-lg overflow-hidden border border-slate-200">
                {renderTemplate(template, data)}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
