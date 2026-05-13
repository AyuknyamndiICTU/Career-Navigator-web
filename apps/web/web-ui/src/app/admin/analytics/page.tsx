'use client';

// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/auth';

export default function AdminAnalyticsPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setBusy(true);
      setError('');
      setData(null);

      try {
        const res = await apiFetch('/admin/analytics/engagement', {
          method: 'GET',
        });

        if (mounted) setData(res);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to load analytics';
        if (mounted) setError(msg);
      } finally {
        if (mounted) setBusy(false);
      }
    }

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  return React.createElement(
    'main',
    { className: 'mx-auto max-w-5xl p-6' },
    React.createElement(
      'div',
      {
        className:
          'rounded-xl border-4 border-black bg-white p-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]',
      },
      React.createElement('div', { className: 'text-3xl font-black' }, 'ADMIN ANALYTICS'),
      React.createElement(
        'div',
        { className: 'mt-1 text-sm font-bold opacity-80' },
        'Engagement metrics'
      ),

      busy
        ? React.createElement(
            'div',
            { className: 'mt-4 rounded-lg border-2 border-black bg-black/5 p-3 font-bold' },
            'LOADING…'
          )
        : null,

      error
        ? React.createElement(
            'div',
            { className: 'mt-4 rounded-lg border-2 border-black bg-red-100 p-3 text-sm font-bold' },
            error
          )
        : null,

      data
        ? React.createElement(
            'div',
            { className: 'mt-4 rounded-lg border-2 border-black p-3' },
            React.createElement(
              'pre',
              { className: 'whitespace-pre-wrap break-words text-xs leading-relaxed font-mono' },
              JSON.stringify(data, null, 2)
            )
          )
        : null
    )
  );
}
