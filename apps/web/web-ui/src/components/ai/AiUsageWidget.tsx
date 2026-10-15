'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/auth';
import { getUserSocket } from '@/lib/realtime';
import { Allowance, formatTokens, formatUsd, UsageTotals } from '@/lib/ai-usage';

type Summary = { today: UsageTotals; allowance: Allowance; ownKeys: number };

/** Today's AI tokens, cost and free chats left; updates live after every AI response. */
export default function AiUsageWidget() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    let active = true;
    const load = () =>
      apiFetch('/ai/usage/summary', {}, { redirectOn401: false })
        .then((s: Summary) => active && setSummary(s))
        .catch((e: unknown) => console.warn('Could not load AI usage:', e));
    void load();

    const socket = getUserSocket();
    const onUsage = (payload: { today: UsageTotals }) => {
      setSummary((prev) => (prev ? { ...prev, today: payload.today } : prev));
      setPulse(true);
      setTimeout(() => setPulse(false), 800);
      // Allowance counters live server-side; refresh them after each call.
      void load();
    };
    socket.on('ai:usage', onUsage);
    return () => {
      active = false;
      socket.off('ai:usage', onUsage);
    };
  }, []);

  if (!summary) return null;

  const chat = summary.allowance.chat;
  const tokens = summary.today.inputTokens + summary.today.outputTokens;

  return (
    <Link
      href="/settings/ai/usage"
      title="AI usage today — open usage details"
      className={`hidden lg:flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold tabular-nums transition-colors ${
        pulse
          ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
      }`}
    >
      <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
      <span>{formatTokens(tokens)} tok</span>
      <span className="text-slate-300">·</span>
      <span>{formatUsd(summary.today.costUsd)}</span>
      {chat && !chat.exempt && (
        <>
          <span className="text-slate-300">·</span>
          <span>
            {chat.remaining}/{chat.limit} free chats
          </span>
        </>
      )}
    </Link>
  );
}
