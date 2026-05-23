// @ts-nocheck
'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/auth';
import DashboardLayout from '@/components/DashboardLayout';
import ErrorAlert from '@/components/ErrorAlert';

type Difficulty = 'beginner' | 'intermediate' | 'advanced';

export default function MockInterviewPage() {
  const [role, setRole] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('intermediate');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [response, setResponse] = useState('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!role.trim() || busy) return;

    setBusy(true);
    setError('');
    setResponse('');

    try {
      const res = await apiFetch('/ai/mock-interview', {
        method: 'POST',
        body: { role: role.trim(), difficulty },
      });

      const text =
        typeof res === 'string'
          ? res
          : res?.response || JSON.stringify(res, null, 2);
      setResponse(text);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Mock interview failed';
      if (!msg) return;
      if (
        msg.toLowerCase().includes('401') ||
        msg.toLowerCase().includes('unauthorized')
      )
        return;
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-slate-800">Mock Interview</h1>
          <p className="text-sm text-slate-500">
            Practice interview questions tailored to your career path
          </p>
        </div>

        {/* Form card */}
        <div className="bg-white rounded-2xl shadow-card overflow-hidden border border-surface-border mb-6">
          <div className="px-6 py-4 border-b border-surface-border">
            <div className="text-base font-semibold text-slate-800">
              Set up your interview
            </div>
          </div>

          <form className="p-6 space-y-4" onSubmit={onSubmit}>
            {/* Role input */}
            <label className="block">
              <span className="text-sm font-medium text-slate-700 mb-1.5 block">
                Target role
              </span>
              <input
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-4 py-2.5 bg-surface rounded-xl text-sm border border-surface-border focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-all"
                placeholder="e.g. Frontend Developer, Data Analyst"
                type="text"
                maxLength={200}
                required
              />
            </label>

            {/* Difficulty select */}
            <label className="block">
              <span className="text-sm font-medium text-slate-700 mb-1.5 block">
                Difficulty
              </span>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                className="w-full px-4 py-2.5 bg-surface rounded-xl text-sm border border-surface-border focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-all"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </label>

            {/* Error */}
            <ErrorAlert error={error} />

            {/* Submit */}
            <button
              disabled={busy || !role.trim()}
              type="submit"
              className="w-full py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 focus:ring-2 focus:ring-primary-200 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-soft"
            >
              {busy ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="w-4 h-4 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Generating questions…
                </span>
              ) : (
                'Start Mock Interview'
              )}
            </button>
          </form>
        </div>

        {/* Response card */}
        {response && (
          <div className="bg-white rounded-2xl shadow-card overflow-hidden border border-surface-border">
            <div className="px-6 py-4 border-b border-surface-border">
              <div className="text-base font-semibold text-slate-800">
                Interview Questions
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Role: {role} · Difficulty: {difficulty}
              </div>
            </div>

            <div className="p-6">
              <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                {response}
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
