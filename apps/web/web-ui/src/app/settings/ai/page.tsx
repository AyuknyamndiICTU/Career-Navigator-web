'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import ErrorAlert from '@/components/ErrorAlert';
import SuccessToast from '@/components/SuccessToast';
import { apiFetch } from '@/lib/auth';
import { formatUsd } from '@/lib/ai-usage';

type Provider = {
  id: string;
  name: string;
  keyUrl: string;
  platformConfigured: boolean;
  customBaseUrl: boolean;
};
type ProvidersResponse = {
  byokEnabled: boolean;
  providers: Provider[];
  tasks: Array<{ task: string; label: string }>;
};
type Credential = {
  id: string;
  provider: string;
  providerName: string;
  label: string;
  keyPreview: string;
  tier: 'FREE' | 'PAID';
  monthlyBudgetUsd: number | null;
  monthSpendUsd: number;
  status: 'ACTIVE' | 'INVALID' | 'DISABLED';
  statusReason: string | null;
  lastValidatedAt: string | null;
};
type Preferences = {
  fallbackToPlatform: boolean;
  tasks: Array<{ task: string; label: string; credentialId: string | null; model: string | null }>;
};
type ModelOption = { id: string; free: boolean };

const STATUS_STYLE: Record<Credential['status'], string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  INVALID: 'bg-red-50 text-red-700 border-red-100',
  DISABLED: 'bg-slate-100 text-slate-600 border-slate-200',
};

const inputClass =
  'w-full px-4 py-2.5 bg-slate-50 rounded-xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 font-medium text-slate-800';

const errorText = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

export default function AiSettingsPage() {
  const [providers, setProviders] = useState<ProvidersResponse | null>(null);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [models, setModels] = useState<Record<string, ModelOption[]>>({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');

  const [form, setForm] = useState({
    provider: 'GEMINI',
    apiKey: '',
    label: '',
    tier: 'FREE' as 'FREE' | 'PAID',
    monthlyBudgetUsd: '',
    baseUrl: '',
  });

  const loadModels = useCallback(async (credentialId: string) => {
    try {
      const list: ModelOption[] = await apiFetch(`/ai/credentials/${credentialId}/models`);
      setModels((prev) => ({ ...prev, [credentialId]: list }));
    } catch (e) {
      setError(errorText(e, 'Could not load models for this key'));
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const [p, c, pr]: [ProvidersResponse, Credential[], Preferences] = await Promise.all([
        apiFetch('/ai/providers'),
        apiFetch('/ai/credentials'),
        apiFetch('/ai/preferences'),
      ]);
      setProviders(p);
      setCredentials(c);
      setPrefs(pr);
      for (const id of new Set(pr.tasks.map((t) => t.credentialId).filter(Boolean))) {
        void loadModels(id as string);
      }
    } catch (e) {
      setError(errorText(e, 'Could not load AI settings'));
    }
  }, [loadModels]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addKey(e: React.FormEvent) {
    e.preventDefault();
    setBusy('add');
    setError('');
    setNotice('');
    try {
      await apiFetch('/ai/credentials', {
        method: 'POST',
        body: {
          provider: form.provider,
          apiKey: form.apiKey.trim(),
          label: form.label.trim() || undefined,
          tier: form.tier,
          monthlyBudgetUsd: form.monthlyBudgetUsd ? Number(form.monthlyBudgetUsd) : undefined,
          baseUrl: form.baseUrl.trim() || undefined,
        },
      });
      setForm((f) => ({ ...f, apiKey: '', label: '', monthlyBudgetUsd: '', baseUrl: '' }));
      setNotice('Key checked and saved. Pick it for a feature below.');
      await load();
    } catch (err) {
      setError(errorText(err, 'Could not save the key'));
    } finally {
      setBusy('');
    }
  }

  async function act(id: string, action: 'test' | 'toggle' | 'remove' | 'budget', value?: string) {
    setBusy(`${action}:${id}`);
    setError('');
    setNotice('');
    try {
      if (action === 'test') {
        const res = await apiFetch(`/ai/credentials/${id}/test`, { method: 'POST' });
        setNotice(res.message);
      } else if (action === 'toggle') {
        const current = credentials.find((c) => c.id === id);
        await apiFetch(`/ai/credentials/${id}`, {
          method: 'PATCH',
          body: { status: current?.status === 'DISABLED' ? 'ACTIVE' : 'DISABLED' },
        });
      } else if (action === 'budget') {
        await apiFetch(`/ai/credentials/${id}`, {
          method: 'PATCH',
          body: { monthlyBudgetUsd: value ? Number(value) : null },
        });
        setNotice('Budget updated.');
      } else {
        if (!window.confirm('Remove this key? Features using it go back to the free platform AI.')) return;
        await apiFetch(`/ai/credentials/${id}`, { method: 'DELETE' });
        setNotice('Key removed.');
      }
      await load();
    } catch (err) {
      setError(errorText(err, 'That did not work'));
    } finally {
      setBusy('');
    }
  }

  async function savePreferences(next: Preferences) {
    setBusy('prefs');
    setError('');
    setNotice('');
    try {
      const saved: Preferences = await apiFetch('/ai/preferences', {
        method: 'PUT',
        body: {
          fallbackToPlatform: next.fallbackToPlatform,
          tasks: next.tasks.map(({ task, credentialId, model }) => ({
            task,
            credentialId,
            model: model ?? undefined,
          })),
        },
      });
      setPrefs(saved);
      setNotice('AI preferences saved.');
    } catch (err) {
      setError(errorText(err, 'Could not save preferences'));
    } finally {
      setBusy('');
    }
  }

  function setTask(task: string, patch: { credentialId?: string | null; model?: string | null }) {
    setPrefs((prev) =>
      prev
        ? {
            ...prev,
            tasks: prev.tasks.map((t) => (t.task === task ? { ...t, ...patch } : t)),
          }
        : prev,
    );
    if (patch.credentialId && !models[patch.credentialId]) void loadModels(patch.credentialId);
  }

  const selected = providers?.providers.find((p) => p.id === form.provider);
  const activeKeys = credentials.filter((c) => c.status === 'ACTIVE');

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto pb-12 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-800">AI providers</h1>
            <p className="mt-1 text-sm text-slate-500 max-w-2xl">
              Everything works on the free platform AI with no setup. Optionally add your own API key
              (free or paid) to run chosen features on your own quota — only for your account.
            </p>
          </div>
          <Link
            href="/settings/ai/usage"
            className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700"
          >
            View usage
          </Link>
        </div>

        <ErrorAlert error={error} />
        {notice && <SuccessToast key={notice} message={notice} />}

        {providers && !providers.byokEnabled && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Using your own AI keys is turned off on this server. You can keep using the free platform AI.
          </div>
        )}

        {/* Add key */}
        {providers?.byokEnabled && (
          <form onSubmit={addKey} className="bg-white rounded-2xl border border-surface-border shadow-card p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-800">Add an API key</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <label className="block text-sm font-semibold text-slate-700">
                Provider
                <select
                  className={`${inputClass} mt-1.5`}
                  value={form.provider}
                  onChange={(e) => setForm({ ...form, provider: e.target.value, baseUrl: '' })}
                >
                  {providers.providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                {selected && (
                  <a href={selected.keyUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs font-semibold text-indigo-600 hover:underline">
                    Get a {selected.name} key ↗
                  </a>
                )}
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                API key
                <input
                  className={`${inputClass} mt-1.5`}
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  required
                  minLength={8}
                  value={form.apiKey}
                  onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                  placeholder="Paste your key"
                />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Label (optional)
                <input
                  className={`${inputClass} mt-1.5`}
                  maxLength={60}
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  placeholder="e.g. My Gemini key"
                />
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="block text-sm font-semibold text-slate-700">
                  Plan
                  <select
                    className={`${inputClass} mt-1.5`}
                    value={form.tier}
                    onChange={(e) => setForm({ ...form, tier: e.target.value as 'FREE' | 'PAID' })}
                  >
                    <option value="FREE">Free tier</option>
                    <option value="PAID">Paid</option>
                  </select>
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  Monthly budget (USD)
                  <input
                    className={`${inputClass} mt-1.5`}
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.monthlyBudgetUsd}
                    onChange={(e) => setForm({ ...form, monthlyBudgetUsd: e.target.value })}
                    placeholder="optional"
                  />
                </label>
              </div>
              {selected?.customBaseUrl && (
                <label className="block text-sm font-semibold text-slate-700 md:col-span-2">
                  Custom OpenAI-compatible URL (optional, approved hosts only)
                  <input
                    className={`${inputClass} mt-1.5`}
                    type="url"
                    value={form.baseUrl}
                    onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
                    placeholder="https://…/v1"
                  />
                </label>
              )}
            </div>
            <p className="text-xs text-slate-500">
              The key is checked with the provider (no tokens spent), stored encrypted and never shown again —
              only its last 4 characters. Prompts sent with your own key are processed under that
              provider&apos;s terms.
            </p>
            <button
              type="submit"
              disabled={busy === 'add' || !form.apiKey.trim()}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold disabled:opacity-50"
            >
              {busy === 'add' ? 'Checking key…' : 'Check & save key'}
            </button>
          </form>
        )}

        {/* Keys */}
        <section className="bg-white rounded-2xl border border-surface-border shadow-card p-6">
          <h2 className="text-lg font-bold text-slate-800">Your keys</h2>
          {credentials.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No keys yet — you are using the free platform AI.</p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {credentials.map((c) => (
                <li key={c.id} className="py-4 flex flex-wrap items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-800">{c.label}</span>
                      <span className="text-xs text-slate-500">{c.providerName}</span>
                      <span className="font-mono text-xs text-slate-500">{c.keyPreview}</span>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${STATUS_STYLE[c.status]}`}>
                        {c.status.toLowerCase()}
                      </span>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border border-slate-200 text-slate-500">
                        {c.tier === 'FREE' ? 'free tier' : 'paid'}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      This month: {formatUsd(c.monthSpendUsd)} (estimate)
                      {c.monthlyBudgetUsd !== null && ` of ${formatUsd(c.monthlyBudgetUsd)} budget`}
                      {c.lastValidatedAt && ` · checked ${new Date(c.lastValidatedAt).toLocaleString()}`}
                    </div>
                    {c.statusReason && <div className="mt-1 text-xs text-red-600">{c.statusReason}</div>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        const value = window.prompt(
                          'Monthly budget in USD (leave empty for no budget):',
                          c.monthlyBudgetUsd?.toString() ?? '',
                        );
                        if (value !== null) void act(c.id, 'budget', value.trim());
                      }}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Budget
                    </button>
                    <button
                      onClick={() => act(c.id, 'test')}
                      disabled={busy === `test:${c.id}`}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      {busy === `test:${c.id}` ? 'Testing…' : 'Test'}
                    </button>
                    <button
                      onClick={() => act(c.id, 'toggle')}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      {c.status === 'DISABLED' ? 'Turn on' : 'Turn off'}
                    </button>
                    <button
                      onClick={() => act(c.id, 'remove')}
                      className="px-3 py-1.5 rounded-lg border border-red-200 text-xs font-semibold text-red-600 hover:bg-red-50"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Per-feature models */}
        {prefs && (
          <section className="bg-white rounded-2xl border border-surface-border shadow-card p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-800">Which AI runs each feature</h2>
            <div className="space-y-3">
              {prefs.tasks.map((t) => (
                <div key={t.task} className="grid md:grid-cols-[180px_1fr_1fr] gap-3 items-center">
                  <span className="text-sm font-semibold text-slate-700">{t.label}</span>
                  <select
                    className={inputClass}
                    value={t.credentialId ?? ''}
                    onChange={(e) => setTask(t.task, { credentialId: e.target.value || null, model: null })}
                  >
                    <option value="">Free platform AI</option>
                    {activeKeys.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label} ({c.providerName})
                      </option>
                    ))}
                  </select>
                  {t.credentialId ? (
                    <select
                      className={inputClass}
                      value={t.model ?? ''}
                      onChange={(e) => setTask(t.task, { model: e.target.value || null })}
                    >
                      <option value="">Pick a model…</option>
                      {(models[t.credentialId] ?? []).map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.id}
                          {m.free ? ' — free' : ' — paid'}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs text-slate-500">Uses the platform&apos;s free models with a daily allowance.</span>
                  )}
                </div>
              ))}
            </div>
            <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                className="w-4 h-4"
                checked={prefs.fallbackToPlatform}
                onChange={(e) => setPrefs({ ...prefs, fallbackToPlatform: e.target.checked })}
              />
              If my key fails or runs out of budget, fall back to the free platform AI
            </label>
            <button
              onClick={() => prefs && savePreferences(prefs)}
              disabled={busy === 'prefs' || prefs.tasks.some((t) => t.credentialId && !t.model)}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold disabled:opacity-50"
            >
              {busy === 'prefs' ? 'Saving…' : 'Save'}
            </button>
          </section>
        )}

        <p className="text-xs text-slate-500">
          Privacy: the free platform AI runs on providers&apos; free tiers, whose prompts may be used to improve
          their products. CV text is stripped of emails, phone numbers and street addresses before any AI
          processing. Usage numbers come from each provider&apos;s reported token counts.
        </p>
      </div>
    </DashboardLayout>
  );
}
