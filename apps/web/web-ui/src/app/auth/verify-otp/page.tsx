// @ts-nocheck
'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { apiFetch } from '@/lib/auth';

function VerifyOtpForm() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get('email') || '';

  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await apiFetch('/auth/verify-otp', {
        method: 'POST',
        body: { email, code },
      });
      router.push('/auth/login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OTP verification failed');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="relative w-12 h-12 rounded-2xl overflow-hidden shadow-soft">
              <Image src="/logo.png" alt="Career Navigator" fill className="object-cover" />
            </div>
            <div>
              <div className="text-lg font-bold text-slate-800 leading-tight">Career Navigator</div>
              <div className="text-xs text-slate-400">Verify your email</div>
            </div>
          </Link>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-card p-8">
          <h1 className="text-2xl font-bold text-slate-800">Verify OTP</h1>
          <p className="mt-1 text-sm text-slate-500">
            {email ? `Enter the 6-digit code sent to ${email}` : 'Enter the 6-digit code'}
          </p>

          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <label className="block">
              <span className="text-sm font-medium text-slate-700 mb-1.5 block">OTP Code</span>
              <input
                value={code}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCode(e.target.value)}
                className="w-full px-4 py-2.5 bg-surface rounded-xl text-sm border border-surface-border focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-all text-center tracking-[0.3em] font-mono text-lg"
                type="text"
                inputMode="numeric"
                placeholder="000000"
                required
                maxLength={6}
              />
            </label>

            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              disabled={isLoading}
              type="submit"
              className="w-full py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 focus:ring-2 focus:ring-primary-200 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-soft"
            >
              {isLoading ? 'Verifying…' : 'Verify'}
            </button>

            <div className="pt-1 text-center text-xs text-slate-500">
              <button
                type="button"
                onClick={() => router.push('/auth/login')}
                className="font-medium text-primary-600 hover:text-primary-700 transition-colors"
              >
                Back to sign in
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function VerifyOtpPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface flex items-center justify-center text-slate-500">Loading…</div>}>
      <VerifyOtpForm />
    </Suspense>
  );
}
