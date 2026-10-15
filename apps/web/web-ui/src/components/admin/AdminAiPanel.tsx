'use client';

import { useCallback, useEffect, useState } from 'react';
import ErrorAlert from '@/components/ErrorAlert';
import { apiFetch } from '@/lib/auth';
import { formatTokens, formatUsd } from '@/lib/ai-usage';

type ModelUsage = {
  provider: string;
  model: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  errors: number;
};
type Totals = { calls: number; inputTokens: number; outputTokens: number; costUsd: number };
type AdminUsage = {
  byokEnabled: boolean;
  usersWithOwnKeys: number;
  platform: { today: ModelUsage[]; last30Days: ModelUsage[] };
  ownKeys: { today: Totals; last30Days: Totals };
};
type Price = {
  provider: string;
  providerName: string;
  model: string;
  inputPerMTok: number;
  outputPerMTok: number;
  cachedInputPerMTok: number | null;
  isFree: boolean;
  effectiveFrom: string;
};

const PROVIDERS = ['GEMINI', 'OPENAI', 'ANTHROPIC', 'OPENROUTER', 'OLLAMA_CLOUD'];
const cell = 'py-2 pr-4 text-right tabular-nums';

function UsageTable({ rows }: { rows: ModelUsage[] }) {
  if (rows.length === 0) return <p className="text-sm text-slate-500">No platform AI calls.</p>;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
          <th className="py-2 pr-4">Provider / model</th>
          <th className={cell}>Calls</th>
          <th className={cell}>Errors</th>
          <th className={cell}>Input</th>
          <th className={cell}>Output</th>
          <th className="py-2 text-right">Cost</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={`${r.provider}/${r.model}`} className="border-t border-slate-100">
            <td className="py-2 pr-4 font-semibold text-slate-700">
              {r.provider} <span className="font-mono text-xs text-slate-500">{r.model}</span>
            </td>
            <td className={cell}>{formatTokens(r.calls)}</td>
            <td className={cell}>{formatTokens(r.errors)}</td>
            <td className={cell}>{formatTokens(r.inputTokens)}</td>
            <td className={cell}>{formatTokens(r.outputTokens)}</td>
            <td className="py-2 text-right tabular-nums">{formatUsd(r.costUsd)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Admin: platform AI load per provider/model, own-key adoption and the editable price table. */
export default function AdminAiPanel() {
  const [usage, setUsage] = useState<AdminUsage | null>(null);
  const [prices, setPrices] = useState<Price[]>([]);
  const [period, setPeriod] = useState<'today' | 'last30Days'>('today');
  const [error, setError] = useState('');
  const [draft, setDraft] = useState({
    provider: 'GEMINI',
    model: '',
    inputPerMTok: '',
    outputPerMTok: '',
    cachedInputPerMTok: '',
    isFree: false,
  });

  const load = useCallback(async () => {
    try {
      const [u, p] = await Promise.all([apiFetch('/admin/ai/usage'), apiFetch('/admin/ai/prices')]);
      setUsage(u);
      setPrices(p);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Could not load AI usage');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function savePrice(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiFetch('/admin/ai/prices', {
        method: 'PUT',
        body: {
          provider: draft.provider,
          model: draft.model.trim(),
          inputPerMTok: Number(draft.inputPerMTok || 0),
          outputPerMTok: Number(draft.outputPerMTok || 0),
          cachedInputPerMTok: draft.cachedInputPerMTok ? Number(draft.cachedInputPerMTok) : null,
          isFree: draft.isFree,
        },
      });
      setDraft({ ...draft, model: '', inputPerMTok: '', outputPerMTok: '', cachedInputPerMTok: '' });
      await load();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Could not save the price');
    }
  }

  const edit = (p: Price) =>
    setDraft({
      provider: p.provider,
      model: p.model,
      inputPerMTok: String(p.inputPerMTok),
      outputPerMTok: String(p.outputPerMTok),
      cachedInputPerMTok: p.cachedInputPerMTok === null ? '' : String(p.cachedInputPerMTok),
      isFree: p.isFree,
    });

  const own = usage?.ownKeys[period];
  const input = 'px-3 py-2 rounded-xl border border-slate-200 text-sm';

  return (
    <section className="mt-8 space-y-6">
      <ErrorAlert error={error} />

      <div className="bg-white rounded-2xl border border-surface-border shadow-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-800">AI usage by provider and model</h2>
          <div className="flex gap-2">
            {(['today', 'last30Days'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                  period === p ? 'bg-slate-800 text-white border-slate-800' : 'border-slate-200 text-slate-600'
                }`}
              >
                {p === 'today' ? 'Today' : '30 days'}
              </button>
            ))}
          </div>
        </div>
        {usage && (
          <>
            <div className="mt-4 overflow-x-auto">
              <UsageTable rows={usage.platform[period]} />
            </div>
            <div className="mt-4 grid sm:grid-cols-3 gap-3 text-sm">
              <div className="rounded-xl bg-slate-50 px-4 py-3">
                Own keys: <strong>{usage.byokEnabled ? 'enabled' : 'disabled'}</strong> (AI_BYOK_ENABLED)
              </div>
              <div className="rounded-xl bg-slate-50 px-4 py-3">
                Users with own keys: <strong>{usage.usersWithOwnKeys}</strong>
              </div>
              {own && (
                <div className="rounded-xl bg-slate-50 px-4 py-3 tabular-nums">
                  Own-key traffic: <strong>{formatTokens(own.calls)}</strong> calls,{' '}
                  {formatTokens(own.inputTokens + own.outputTokens)} tokens
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-surface-border shadow-card p-6">
        <h2 className="text-lg font-bold text-slate-800">Model prices (USD per 1M tokens)</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4">Model</th>
                <th className={cell}>Input</th>
                <th className={cell}>Cached input</th>
                <th className={cell}>Output</th>
                <th className="py-2 pr-4">Free</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {prices.map((p) => (
                <tr key={`${p.provider}/${p.model}`} className="border-t border-slate-100">
                  <td className="py-2 pr-4 font-semibold text-slate-700">
                    {p.providerName} <span className="font-mono text-xs text-slate-500">{p.model}</span>
                  </td>
                  <td className={cell}>{p.inputPerMTok}</td>
                  <td className={cell}>{p.cachedInputPerMTok ?? '—'}</td>
                  <td className={cell}>{p.outputPerMTok}</td>
                  <td className="py-2 pr-4">{p.isFree ? 'yes' : 'no'}</td>
                  <td className="py-2 text-right">
                    <button onClick={() => edit(p)} className="text-xs font-semibold text-indigo-600 hover:underline">
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <form onSubmit={savePrice} className="mt-4 flex flex-wrap items-end gap-2">
          <select className={input} value={draft.provider} onChange={(e) => setDraft({ ...draft, provider: e.target.value })} aria-label="Provider">
            {PROVIDERS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <input className={input} required placeholder="model" value={draft.model} onChange={(e) => setDraft({ ...draft, model: e.target.value })} aria-label="Model" />
          <input className={`${input} w-24`} type="number" min="0" step="0.000001" placeholder="input" value={draft.inputPerMTok} onChange={(e) => setDraft({ ...draft, inputPerMTok: e.target.value })} aria-label="Input price" />
          <input className={`${input} w-28`} type="number" min="0" step="0.000001" placeholder="cached" value={draft.cachedInputPerMTok} onChange={(e) => setDraft({ ...draft, cachedInputPerMTok: e.target.value })} aria-label="Cached input price" />
          <input className={`${input} w-24`} type="number" min="0" step="0.000001" placeholder="output" value={draft.outputPerMTok} onChange={(e) => setDraft({ ...draft, outputPerMTok: e.target.value })} aria-label="Output price" />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={draft.isFree} onChange={(e) => setDraft({ ...draft, isFree: e.target.checked })} />
            free
          </label>
          <button type="submit" className="px-4 py-2 rounded-xl bg-slate-800 text-white text-sm font-bold">
            Save price
          </button>
        </form>
        <p className="mt-2 text-xs text-slate-500">Saving adds a new price effective now; past usage keeps the price it was billed at.</p>
      </div>
    </section>
  );
}
