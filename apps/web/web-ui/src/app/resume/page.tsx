// @ts-nocheck
'use client';

import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { apiFetch } from '@/lib/auth';

type ResumeResponse = unknown;

export default function ResumeBuilderPage() {
  const [template, setTemplate] = useState<'STANDARD' | 'DETAILED'>('STANDARD');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<ResumeResponse | null>(null);

  const templates = useMemo(
    () => [
      { id: 'STANDARD' as const, label: 'Standard' },
      { id: 'DETAILED' as const, label: 'Detailed' },
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
    // Optionally auto-build once user lands; safe to remove if you want manual only.
    void build();
  }, []);

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-slate-800">Resume Builder</h1>
          <p className="text-sm text-slate-500">Generate a structured resume from your profile.</p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-card overflow-hidden border border-surface-border mb-6">
          <div className="px-6 py-4 border-b border-surface-border flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-[220px]">
              <div className="text-xs font-semibold text-slate-600 mb-1">Template</div>
              <select
                value={template}
                onChange={(e) => setTemplate(e.target.value as 'STANDARD' | 'DETAILED')}
                className="w-full px-3 py-2 rounded-xl bg-surface border border-surface-border text-sm"
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => void build()}
              disabled={busy}
              className="px-4 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? 'Building…' : 'Build Resume'}
            </button>
          </div>

          <div className="p-6">
            {busy && !data ? (
              <div className="flex items-center gap-3 justify-center py-12">
                <svg className="w-5 h-5 text-primary-600 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-sm text-slate-500 font-medium">Generating resume…</span>
              </div>
            ) : !data ? (
              <div className="text-sm text-slate-500">No resume generated yet.</div>
            ) : (
              <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed font-mono text-slate-600">
                {JSON.stringify(data, null, 2)}
              </pre>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
