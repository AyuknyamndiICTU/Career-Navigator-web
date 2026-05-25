// @ts-nocheck
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { apiFetch } from '@/lib/auth';
import ErrorAlert from '@/components/ErrorAlert';

type Reference = {
  id?: string;
  name: string;
  relationship: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
};

export default function ReferencesPage() {
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [references, setReferences] = useState<Reference[]>([]);

  const [draft, setDraft] = useState(() => ({
    name: '',
    relationship: '',
    company: '',
    email: '',
    phone: '',
    notes: '',
  }));

  const formPayload = useMemo(() => {
    return {
      name: draft.name.trim(),
      relationship: draft.relationship.trim() || undefined,
      company: draft.company.trim() || undefined,
      email: draft.email.trim() || undefined,
      phone: draft.phone.trim() || undefined,
      notes: draft.notes.trim() || undefined,
    };
  }, [draft]);

  async function load() {
    setBusy(true);
    setError('');
    try {
      const res = (await apiFetch('/profile/references', { method: 'GET' })) as Reference[];
      setReferences(Array.isArray(res) ? res : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load references');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      if (!formPayload.name) throw new Error('Reference name is required');
      await apiFetch('/profile/references', { method: 'POST', body: formPayload });

      setDraft({
        name: '',
        relationship: '',
        company: '',
        email: '',
        phone: '',
        notes: '',
      });

      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create reference');
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(referenceId: string) {
    setDeletingId(referenceId);
    setError('');
    try {
      await apiFetch(`/profile/references/${referenceId}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete reference');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto pb-12">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-slate-900">References</h1>
          <p className="text-sm text-slate-600 mt-1">
            Add professional references to strengthen your resume.
          </p>
        </div>

        <ErrorAlert error={error} />

        <div className="bg-white rounded-3xl shadow-card overflow-hidden border border-surface-border">
          <div className="px-6 py-4 border-b border-surface-border bg-slate-50/50">
            <h2 className="text-lg font-bold text-slate-800">Add a Reference</h2>
          </div>

          <form className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5" onSubmit={onCreate}>
            <label className="block md:col-span-2">
              <span className="text-sm font-bold text-slate-700 mb-2 block">Name</span>
              <input
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                className="w-full px-4 py-3.5 bg-slate-50 rounded-2xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 transition-all font-medium text-slate-800 shadow-sm"
                placeholder="e.g. Jane Smith"
              />
            </label>

            <label className="block">
              <span className="text-sm font-bold text-slate-700 mb-2 block">Relationship</span>
              <input
                value={draft.relationship}
                onChange={(e) => setDraft((d) => ({ ...d, relationship: e.target.value }))}
                className="w-full px-4 py-3.5 bg-slate-50 rounded-2xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 transition-all font-medium text-slate-800 shadow-sm"
                placeholder="e.g. Manager"
              />
            </label>

            <label className="block">
              <span className="text-sm font-bold text-slate-700 mb-2 block">Company</span>
              <input
                value={draft.company}
                onChange={(e) => setDraft((d) => ({ ...d, company: e.target.value }))}
                className="w-full px-4 py-3.5 bg-slate-50 rounded-2xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 transition-all font-medium text-slate-800 shadow-sm"
                placeholder="e.g. Acme"
              />
            </label>

            <label className="block">
              <span className="text-sm font-bold text-slate-700 mb-2 block">Email</span>
              <input
                value={draft.email}
                onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
                className="w-full px-4 py-3.5 bg-slate-50 rounded-2xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 transition-all font-medium text-slate-800 shadow-sm"
                placeholder="e.g. jane@company.com"
              />
            </label>

            <label className="block">
              <span className="text-sm font-bold text-slate-700 mb-2 block">Phone</span>
              <input
                value={draft.phone}
                onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
                className="w-full px-4 py-3.5 bg-slate-50 rounded-2xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 transition-all font-medium text-slate-800 shadow-sm"
                placeholder="e.g. +234..."
              />
            </label>

            <label className="block md:col-span-2">
              <span className="text-sm font-bold text-slate-700 mb-2 block">Notes</span>
              <textarea
                value={draft.notes}
                onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                className="w-full px-4 py-3.5 bg-slate-50 rounded-2xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 transition-all font-medium text-slate-800 shadow-sm min-h-[110px]"
                placeholder="Anything you want to remember about this reference..."
              />
            </label>

            <div className="md:col-span-2 flex justify-end pt-2 border-t border-slate-100">
              <button
                disabled={saving}
                type="submit"
                className="px-8 py-3.5 bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-2xl text-sm font-bold hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md flex items-center gap-2"
              >
                {saving ? 'Saving...' : 'Add Reference'}
              </button>
            </div>
          </form>
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-slate-800">Your References</h2>
            {busy ? <span className="text-sm text-slate-600">Loading...</span> : null}
          </div>

          {references.length === 0 ? (
            <div className="bg-slate-50 rounded-2xl border border-surface-border p-6 text-sm text-slate-600">
              No references yet. Add one above.
            </div>
          ) : (
            <div className="space-y-3">
              {references.map((r) => (
                <div
                  key={r.id}
                  className="bg-white rounded-2xl border border-surface-border p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <h3 className="font-extrabold text-slate-900">{r.name}</h3>
                        {r.relationship ? (
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                            {r.relationship}
                          </span>
                        ) : null}
                      </div>

                      {r.company ? (
                        <p className="text-sm text-slate-600 mt-2">{r.company}</p>
                      ) : null}

                      {(r.email || r.phone) ? (
                        <p className="text-sm text-slate-600 mt-1">
                          {[r.email, r.phone].filter(Boolean).join(' • ')}
                        </p>
                      ) : null}

                      {r.notes ? (
                        <p className="text-sm text-slate-600 mt-3 whitespace-pre-wrap">{r.notes}</p>
                      ) : null}
                    </div>

                    {r.id ? (
                      <button
                        disabled={deletingId === r.id}
                        onClick={() => void onDelete(r.id as string)}
                        className="px-4 py-2 rounded-xl bg-rose-50 text-rose-700 text-sm font-bold border border-rose-100 hover:bg-rose-100 transition disabled:opacity-50"
                      >
                        {deletingId === r.id ? 'Deleting...' : 'Delete'}
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
