// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/auth';

type RecommendationResponse = {
  response?: string;
  allowedSkills?: string[];
  studentGoal?: string | null;
};

export default function RecommendedSkillsCard() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [text, setText] = useState<string>('');

  async function load() {
    setBusy(true);
    setError('');
    try {
      // allowedSkills + studentGoal are optional. Backend will derive allowed skills from user’s job-app skills.
      const res = (await apiFetch('/ai/course-recommendations', {
        method: 'POST',
        body: {},
      })) as RecommendationResponse;

      if (typeof res?.response === 'string') setText(res.response);
      else setText(typeof res === 'string' ? res : JSON.stringify(res, null, 2));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load recommendations');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="px-2 mb-3">
      <div className="rounded-2xl bg-white shadow-card overflow-hidden border border-surface-border">
        <div className="px-4 py-3 border-b border-surface-border">
          <div className="text-sm font-bold text-slate-800">Recommended Skills & Courses</div>
          <div className="text-xs text-slate-500 mt-0.5">Based on your career path</div>
        </div>

        <div className="p-4">
          {busy ? (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <svg className="w-4 h-4 text-primary-600 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading…
            </div>
          ) : error ? (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
              {error}
            </div>
          ) : text ? (
            <pre className="text-xs text-slate-700 whitespace-pre-wrap break-words leading-relaxed font-mono">
              {text}
            </pre>
          ) : (
            <div className="text-xs text-slate-500">No recommendations available.</div>
          )}
        </div>
      </div>
    </div>
  );
}
