// @ts-nocheck
'use client';

import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { apiFetch } from '@/lib/auth';

type Profile = {
  firstName?: string | null;
  lastName?: string | null;
  headline?: string | null;
  phone?: string | null;
  location?: string | null;
  summary?: string | null;
};

export default function ProfilePage() {
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState<Profile | null>(null);

  const form = useMemo(() => {
    return {
      firstName: profile?.firstName ?? '',
      lastName: profile?.lastName ?? '',
      headline: profile?.headline ?? '',
      phone: profile?.phone ?? '',
      location: profile?.location ?? '',
      summary: profile?.summary ?? '',
    };
  }, [profile]);

  const [draft, setDraft] = useState(form);

  useEffect(() => {
    setDraft(form);
  }, [form]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setBusy(true);
      setError('');
      try {
        const res = await apiFetch('/profile', { method: 'GET' });
        if (mounted) setProfile(res as Profile);
      } catch (e) {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : 'Failed to load profile');
      } finally {
        if (mounted) setBusy(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  async function onSave(e) {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const payload = {
        firstName: draft.firstName.trim() || undefined,
        lastName: draft.lastName.trim() || undefined,
        headline: draft.headline.trim() || undefined,
        phone: draft.phone.trim() || undefined,
        location: draft.location.trim() || undefined,
        summary: draft.summary.trim() || undefined,
      };

      const res = await apiFetch('/profile', { method: 'PUT', body: payload });
      setProfile(res as Profile);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-slate-800">Profile</h1>
          <p className="text-sm text-slate-500">Manage your personal details</p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-card overflow-hidden">
          <div className="px-6 py-4 border-b border-surface-border">
            <h2 className="text-base font-semibold text-slate-800">Account details</h2>
          </div>

          <div className="p-6">
            {busy ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-primary-600 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span className="text-sm text-slate-500 font-medium">Loading…</span>
                </div>
              </div>
            ) : (
              <form onSubmit={onSave} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-sm font-medium text-slate-700 mb-1.5 block">First name</span>
                  <input
                    value={draft.firstName}
                    onChange={(e) => setDraft((d) => ({ ...d, firstName: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-surface rounded-xl text-sm border border-surface-border focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-all"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700 mb-1.5 block">Last name</span>
                  <input
                    value={draft.lastName}
                    onChange={(e) => setDraft((d) => ({ ...d, lastName: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-surface rounded-xl text-sm border border-surface-border focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-all"
                  />
                </label>

                <label className="block sm:col-span-2">
                  <span className="text-sm font-medium text-slate-700 mb-1.5 block">Headline</span>
                  <input
                    value={draft.headline}
                    onChange={(e) => setDraft((d) => ({ ...d, headline: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-surface rounded-xl text-sm border border-surface-border focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-all"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700 mb-1.5 block">Phone</span>
                  <input
                    value={draft.phone}
                    onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-surface rounded-xl text-sm border border-surface-border focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-all"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700 mb-1.5 block">Location</span>
                  <input
                    value={draft.location}
                    onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-surface rounded-xl text-sm border border-surface-border focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-all"
                  />
                </label>

                <label className="block sm:col-span-2">
                  <span className="text-sm font-medium text-slate-700 mb-1.5 block">Summary</span>
                  <textarea
                    value={draft.summary}
                    onChange={(e) => setDraft((d) => ({ ...d, summary: e.target.value }))}
                    rows={5}
                    className="w-full px-4 py-2.5 bg-surface rounded-xl text-sm border border-surface-border focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-all resize-none"
                    placeholder="Tell us about yourself…"
                  />
                </label>

                <div className="sm:col-span-2 flex items-center justify-end pt-2">
                  <button
                    disabled={saving}
                    type="submit"
                    className="px-5 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-soft"
                  >
                    {saving ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
