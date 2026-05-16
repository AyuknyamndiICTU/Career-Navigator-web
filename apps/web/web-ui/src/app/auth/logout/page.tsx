'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { clearTokens } from '@/lib/auth';

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    clearTokens();
    router.push('/auth/login');
  }, [router]);

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-card p-8 text-center max-w-sm w-full">
        <div className="w-12 h-12 mx-auto rounded-full bg-primary-50 flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-primary-600 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-slate-600">Signing you out…</p>
      </div>
    </div>
  );
}
