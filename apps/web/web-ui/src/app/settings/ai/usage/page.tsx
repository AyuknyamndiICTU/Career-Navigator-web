'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import ErrorAlert from '@/components/ErrorAlert';
import { apiFetch } from '@/lib/auth';
import { getUserSocket } from '@/lib/realtime';
import { Allowance, formatTokens, formatUsd, UsageTotals } from '@/lib/ai-usage';

type Range = 'today' | 'month' | '30d' | 'custom';
type GroupBy = 'task' | 'provider' | 'model' | 'credential';

type Group = {
  key: string | null;
  label: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  costUsd: number;
};
type KeyUsage = {
  id: string;
  label: string;
  providerName: string;
  monthSpendUsd: number;
  monthlyBudgetUsd: number | null;
  budgetRemainingUsd: number | null;
  spendIsEstimate: boolean;
  balance: { remainingUsd: number | null; limitUsd: number | null; usageUsd: number } | null;
};
type Report = {
  groups: Group[];
  totals: Omit<Group, 'key' | 'label'>;
  daily: Array<{ day: string; calls: number; inputTokens: number; outputTokens: number; costUsd: number }>;
  today: UsageTotals;
  allowance: Allowance;
  keys: KeyUsage[];
  costNote: string;
};

const TASK_LABELS: Record<string, string> = {
  chat: 'free chats',
  'mock-interview': 'mock interviews',
  'cv-assist': 'CV AI assists',
  'job-rerank': 'job matchings',
  'course-recs': 'course recommendations',
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-2xl border border-surface-border shadow-card p-5">
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</div>
      <div className="mt-1 text-2xl font-extrabold text-slate-800 tabular-nums">{value}</div>
    </div>
  );
}

export default function AiUsagePage() {
  const [range, setRange] = useState<Range>('month');
  const [groupBy, setGroupBy] = useState<GroupBy>('task');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (range === 'custom' && !from) return;
    const params = new URLSearchParams({ range, groupBy });
    if (range === 'custom') {
      params.set('from', new Date(from).toISOString());
      if (to) params.set('to', new Date(`${to}T23:59:59`).toISOString());
    }
    try {
      setReport(await apiFetch(`/ai/usage?${params}`));
      setError('');
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Could not load usage');
    }
  }, [range, groupBy, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  // Live: refresh when any AI call of this user finishes (in any tab or device).
  useEffect(() => {
    const socket = getUserSocket();
    const onUsage = () => void load();
    socket.on('ai:usage', onUsage);
    return () => {
      socket.off('ai:usage', onUsage);
    };
  }, [load]);

  const maxDaily = Math.max(1, ...(report?.daily ?? []).map((d) => d.inputTokens + d.outputTokens));

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto pb-12 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-800">AI usage</h1>
            <p className="mt-1 text-sm text-slate-500">Tokens and cost of every AI request, updated live.</p>
          </div>
          <Link href="/settings/ai" className="text-sm font-bold text-indigo-600 hover:underline">
            Manage AI providers →
          </Link>
        </div>

        <ErrorAlert error={error} />

        <div className="flex flex-wrap items-center gap-2">
          {(['today', 'month', '30d', 'custom'] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border ${
                range === r ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'
              }`}
            >
              {r === 'today' ? 'Today' : r === 'month' ? 'This month' : r === '30d' ? 'Last 30 days' : 'Custom'}
            </button>
          ))}
          {range === 'custom' && (
            <>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 text-sm" aria-label="From" />
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 text-sm" aria-label="To" />
            </>
          )}
        </div>

        {report && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Stat label="Requests" value={formatTokens(report.totals.calls)} />
              <Stat label="Input tokens" value={formatTokens(report.totals.inputTokens)} />
              <Stat label="Output tokens" value={formatTokens(report.totals.outputTokens)} />
              <Stat label="Cost" value={formatUsd(report.totals.costUsd)} />
            </div>

            <section className="bg-white rounded-2xl border border-surface-border shadow-card p-6">
              <h2 className="text-lg font-bold text-slate-800">Free platform AI left today</h2>
              <ul className="mt-3 grid sm:grid-cols-2 gap-2 text-sm text-slate-700">
                {Object.entries(report.allowance).map(([task, a]) => (
                  <li key={task} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-2.5">
                    <span>{a.exempt ? `Unlimited ${TASK_LABELS[task] ?? task}` : `${a.remaining} of ${a.limit} ${TASK_LABELS[task] ?? task} left`}</span>
                    {!a.exempt && (
                      <span className="h-2 w-24 rounded-full bg-slate-200 overflow-hidden">
                        <span className="block h-full bg-indigo-500" style={{ width: `${(a.remaining / Math.max(1, a.limit)) * 100}%` }} />
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-slate-500">Resets daily at 00:00 UTC. Requests on your own keys don&apos;t count.</p>
            </section>

            {report.keys.length > 0 && (
              <section className="bg-white rounded-2xl border border-surface-border shadow-card p-6">
                <h2 className="text-lg font-bold text-slate-800">Your keys this month</h2>
                <ul className="mt-3 space-y-2 text-sm">
                  {report.keys.map((k) => (
                    <li key={k.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-2.5">
                      <span className="font-semibold text-slate-700">
                        {k.label} <span className="font-normal text-slate-500">({k.providerName})</span>
                      </span>
                      <span className="text-slate-600 tabular-nums">
                        {formatUsd(k.monthSpendUsd)} spent{k.spendIsEstimate ? ' (estimate)' : ''}
                        {k.budgetRemainingUsd !== null && ` · ${formatUsd(k.budgetRemainingUsd)} of budget left`}
                        {k.balance?.remainingUsd !== null && k.balance?.remainingUsd !== undefined &&
                          ` · ${formatUsd(k.balance.remainingUsd)} credit left at OpenRouter`}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="bg-white rounded-2xl border border-surface-border shadow-card p-6">
              <h2 className="text-lg font-bold text-slate-800">Daily tokens</h2>
              {report.daily.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">No AI usage in this period.</p>
              ) : (
                <div className="mt-4 flex items-end gap-1 h-40" role="img" aria-label="Tokens per day">
                  {report.daily.map((d) => (
                    <div key={d.day} className="flex-1 flex flex-col items-center justify-end h-full min-w-[6px]">
                      <div
                        className="w-full rounded-t bg-indigo-400 hover:bg-indigo-600"
                        style={{ height: `${((d.inputTokens + d.outputTokens) / maxDaily) * 100}%` }}
                        title={`${d.day}: ${formatTokens(d.inputTokens + d.outputTokens)} tokens, ${formatUsd(d.costUsd)}`}
                      />
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="bg-white rounded-2xl border border-surface-border shadow-card p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-slate-800">Breakdown</h2>
                <select
                  value={groupBy}
                  onChange={(e) => setGroupBy(e.target.value as GroupBy)}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold"
                  aria-label="Group by"
                >
                  <option value="task">By feature</option>
                  <option value="provider">By provider</option>
                  <option value="model">By model</option>
                  <option value="credential">By key</option>
                </select>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="py-2 pr-4">Name</th>
                      <th className="py-2 pr-4 text-right">Requests</th>
                      <th className="py-2 pr-4 text-right">Input</th>
                      <th className="py-2 pr-4 text-right">Output</th>
                      <th className="py-2 text-right">Cost</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {report.groups.map((g) => (
                      <tr key={g.key ?? 'none'} className="border-t border-slate-100">
                        <td className="py-2 pr-4 font-semibold text-slate-700">{g.label}</td>
                        <td className="py-2 pr-4 text-right">{formatTokens(g.calls)}</td>
                        <td className="py-2 pr-4 text-right">{formatTokens(g.inputTokens)}</td>
                        <td className="py-2 pr-4 text-right">{formatTokens(g.outputTokens)}</td>
                        <td className="py-2 text-right">{formatUsd(g.costUsd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-slate-500">{report.costNote}</p>
            </section>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
