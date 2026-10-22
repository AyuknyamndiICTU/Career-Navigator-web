'use client';

import { useEffect, useState } from 'react';
import { getVideoUsage, type VideoUsage } from '@/lib/api/video';

/** Video participant-minutes this month vs. the free allowance; turns amber at 80 % (17.4). */
export default function AdminVideoUsageCard() {
  const [usage, setUsage] = useState<VideoUsage | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getVideoUsage()
      .then(setUsage)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not load video usage'));
  }, []);

  const width = usage ? Math.min(100, usage.percent) : 0;
  return (
    <section className="bg-white rounded-2xl shadow-card border border-surface-border p-6 mt-8" aria-labelledby="video-usage-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="video-usage-title" className="text-base font-bold text-slate-800">Video minutes this month</h2>
        {usage && <span className="text-xs text-slate-500">{usage.month}</span>}
      </div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {usage && !usage.configured && <p className="mt-3 text-sm text-slate-500">Video calls are not configured (LIVEKIT_* settings).</p>}
      {usage && (
        <>
          <p className="mt-3 text-2xl font-extrabold text-slate-800">
            {usage.participantMinutes.toLocaleString()}{' '}
            <span className="text-sm font-semibold text-slate-500">/ {usage.freeMinutes.toLocaleString()} free participant-minutes</span>
          </p>
          <div className="mt-3 h-2.5 rounded-full bg-slate-100" role="progressbar" aria-valuenow={usage.percent} aria-valuemin={0} aria-valuemax={100} aria-label="Share of the free allowance used">
            <div className={`h-2.5 rounded-full ${usage.alert ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${width}%` }} />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {usage.percent}% used · {usage.sessions} calls · {usage.activeConnections} people in calls now
          </p>
          {usage.alert && (
            <p role="alert" className="mt-3 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
              Over 80 % of the free allowance. Consider the self-hosted LiveKit profile (unlimited minutes) before the month ends.
            </p>
          )}
        </>
      )}
    </section>
  );
}
