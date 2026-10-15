'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Page crashed:', error);
  }, [error]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md w-full rounded-3xl bg-white p-8 text-center shadow-xl border border-slate-100">
        <h1 className="text-2xl font-bold text-slate-800">Something went wrong</h1>
        <p className="mt-3 text-sm text-slate-500">
          This page hit an unexpected error. You can try again, or go back to the dashboard.
        </p>
        {error.digest && (
          <p className="mt-2 text-xs text-slate-400">Reference: {error.digest}</p>
        )}
        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-2xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 transition-colors"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-2xl border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
