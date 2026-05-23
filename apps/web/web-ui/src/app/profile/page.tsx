// @ts-nocheck
'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import DashboardLayout from '@/components/DashboardLayout';
import { apiFetch } from '@/lib/auth';
import ErrorAlert from '@/components/ErrorAlert';

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
      <div className="max-w-4xl mx-auto pb-12">
        {/* Hero Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative overflow-hidden rounded-3xl p-8 md:p-10 mb-8"
          style={{
            background: 'linear-gradient(135deg, #e11d48 0%, #f43f5e 50%, #fb7185 100%)',
          }}
        >
          <div className="relative z-10 max-w-2xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/15 backdrop-blur-sm rounded-full text-white/90 text-xs font-semibold mb-4"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Account Settings
            </motion.div>

            <h1 className="text-3xl md:text-4xl font-extrabold text-white leading-tight">
              Your Profile
            </h1>
            <p className="mt-3 text-white/80 text-sm md:text-base leading-relaxed max-w-lg">
              Manage your personal details, career headline, and contact information.
            </p>

            <div className="mt-6 flex gap-3">
              <a href="/profile" className="px-5 py-2.5 rounded-xl bg-white text-rose-600 text-sm font-bold shadow-lg transition-transform hover:-translate-y-0.5">Personal Details</a>
              <a href="/profile/cv" className="px-5 py-2.5 rounded-xl bg-white/15 text-white text-sm font-bold hover:bg-white/20 transition-all border border-white/20">CV & Skills Analysis</a>
            </div>
          </div>

          {/* Decorative Elements */}
          <div className="absolute -right-16 -top-16 w-64 h-64 bg-white/5 rounded-full" />
          <div className="absolute right-32 top-8 w-24 h-24 bg-white/10 rounded-full blur-xl" />
        </motion.div>

        <ErrorAlert error={error} />

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white rounded-3xl shadow-card overflow-hidden border border-surface-border">
          <div className="px-8 py-5 border-b border-surface-border bg-slate-50/50 flex items-center gap-3">
             <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-500">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            <h2 className="text-lg font-bold text-slate-800">Account Details</h2>
          </div>

          <div className="p-8">
            {busy ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center shadow-lg animate-pulse mb-4">
                  <svg className="w-8 h-8 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
                <div className="text-sm font-bold text-slate-700">Loading profile data...</div>
              </div>
            ) : (
              <form onSubmit={onSave} className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <label className="block">
                  <span className="text-sm font-bold text-slate-700 mb-2 block">First name</span>
                  <input
                    value={draft.firstName}
                    onChange={(e) => setDraft((d) => ({ ...d, firstName: e.target.value }))}
                    className="w-full px-5 py-3.5 bg-slate-50 rounded-2xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 transition-all font-medium text-slate-800 shadow-sm"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-bold text-slate-700 mb-2 block">Last name</span>
                  <input
                    value={draft.lastName}
                    onChange={(e) => setDraft((d) => ({ ...d, lastName: e.target.value }))}
                    className="w-full px-5 py-3.5 bg-slate-50 rounded-2xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 transition-all font-medium text-slate-800 shadow-sm"
                  />
                </label>

                <label className="block sm:col-span-2">
                  <span className="text-sm font-bold text-slate-700 mb-2 block">Headline</span>
                  <input
                    value={draft.headline}
                    onChange={(e) => setDraft((d) => ({ ...d, headline: e.target.value }))}
                    className="w-full px-5 py-3.5 bg-slate-50 rounded-2xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 transition-all font-medium text-slate-800 shadow-sm"
                    placeholder="e.g. Senior Software Engineer at Tech Corp"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-bold text-slate-700 mb-2 block">Phone</span>
                  <input
                    value={draft.phone}
                    onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
                    className="w-full px-5 py-3.5 bg-slate-50 rounded-2xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 transition-all font-medium text-slate-800 shadow-sm"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-bold text-slate-700 mb-2 block">Location</span>
                  <input
                    value={draft.location}
                    onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))}
                    className="w-full px-5 py-3.5 bg-slate-50 rounded-2xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 transition-all font-medium text-slate-800 shadow-sm"
                  />
                </label>

                <label className="block sm:col-span-2">
                  <span className="text-sm font-bold text-slate-700 mb-2 block">Professional Summary</span>
                  <textarea
                    value={draft.summary}
                    onChange={(e) => setDraft((d) => ({ ...d, summary: e.target.value }))}
                    className="w-full px-5 py-4 bg-slate-50 rounded-2xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 transition-all font-medium text-slate-800 shadow-sm min-h-[120px]"
                    placeholder="Briefly describe your career goals and background..."
                  />
                </label>

                <div className="sm:col-span-2 pt-4 border-t border-slate-100 flex justify-end">
                  <button
                    disabled={saving}
                    type="submit"
                    className="px-8 py-3.5 bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-2xl text-sm font-bold hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-md flex items-center gap-2"
                  >
                    {saving ? (
                      <>
                        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Saving...
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
