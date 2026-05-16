// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { apiFetch } from '@/lib/auth';

export default function NotificationsPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState<Array<any>>([]);

  async function load() {
    setBusy(true);
    setError('');
    try {
      const res = await apiFetch('/notifications');
      setItems(Array.isArray(res) ? res : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load notifications');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function markRead(id: string) {
    try {
      await apiFetch(`/notifications/${id}/read`, { method: 'POST' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to mark as read');
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-slate-800">Notifications</h1>
          <p className="text-sm text-slate-500">Your recent updates</p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-card overflow-hidden">
          <div className="px-6 py-4 border-b border-surface-border">
            <h2 className="text-base font-semibold text-slate-800">Inbox</h2>
          </div>

          <div className="p-6">
            {busy ? (
              <div className="flex items-center gap-3 justify-center py-12">
                <svg className="w-5 h-5 text-primary-600 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-sm text-slate-500 font-medium">Loading…</span>
              </div>
            ) : items.length === 0 ? (
              <div className="text-sm text-slate-500">No notifications yet.</div>
            ) : (
              <div className="space-y-3">
                {items.map((n) => (
                  <div
                    key={n.id}
                    className={`rounded-xl border p-4 ${
                      n.isRead ? 'bg-surface text-slate-700 border-surface-border' : 'bg-primary-50/40 border-primary-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-xs font-semibold text-slate-600">
                          {n.type ?? 'Notification'}
                        </div>
                        <div className="mt-2 text-sm text-slate-800 whitespace-pre-wrap">
                          {n.message}
                        </div>
                        {!n.isRead && (
                          <div className="mt-2 text-xs font-semibold text-primary-700">Unread</div>
                        )}
                      </div>

                      {!n.isRead && (
                        <button
                          onClick={() => markRead(n.id)}
                          className="shrink-0 px-3 py-2 bg-white border border-primary-200 text-primary-700 rounded-xl text-xs font-semibold hover:bg-primary-100 transition-colors"
                        >
                          Mark read
                        </button>
                      )}
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
