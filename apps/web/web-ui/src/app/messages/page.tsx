// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { apiFetch } from '@/lib/auth';

export default function MessagesPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [conversations, setConversations] = useState<Array<any>>([]);

  async function load() {
    setBusy(true);
    setError('');
    try {
      const res = await apiFetch('/conversations');
      setConversations(res?.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load messages');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-slate-800">Messages</h1>
          <p className="text-sm text-slate-500">Your conversation threads</p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-card overflow-hidden">
          <div className="px-6 py-4 border-b border-surface-border">
            <h2 className="text-base font-semibold text-slate-800">Conversations</h2>
          </div>

          <div className="p-6">
            {busy ? (
              <div className="flex items-center justify-center py-12">
                <svg className="w-5 h-5 text-primary-600 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="ml-3 text-sm text-slate-500 font-medium">Loading…</span>
              </div>
            ) : conversations.length === 0 ? (
              <div className="text-sm text-slate-500">No conversations yet.</div>
            ) : (
              <div className="space-y-3">
                {conversations.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-xl border border-surface-border p-4 bg-surface"
                  >
                    <div className="text-sm font-semibold text-slate-800">Conversation {c.id}</div>
                    <div className="text-xs text-slate-500 mt-1">
                      Updated: {new Date(c.updatedAt).toLocaleString()}
                    </div>
                    <div className="text-xs text-slate-500 mt-3">
                      (Conversation thread view coming next)
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
