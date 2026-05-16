// @ts-nocheck
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { apiFetch } from '@/lib/auth';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await apiFetch('/auth/register', {
        method: 'POST',
        body: { email, password },
      });
      router.push('/auth/verify-otp?email=' + encodeURIComponent(email));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Register failed');
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
              <div className="text-xs text-slate-400">Create your account</div>
            </div>
          </Link>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-card p-8">
          <h1 className="text-2xl font-bold text-slate-800">Sign Up</h1>
          <p className="mt-1 text-sm text-slate-500">We&apos;ll email you a verification code</p>

          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <label className="block">
              <span className="text-sm font-medium text-slate-700 mb-1.5 block">Email</span>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 bg-surface rounded-xl text-sm border border-surface-border focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-all"
                placeholder="you@example.com"
                type="email"
                required
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700 mb-1.5 block">Password</span>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-surface rounded-xl text-sm border border-surface-border focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-all"
                placeholder="Minimum 8 characters"
                type="password"
                minLength={8}
                required
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
              {isLoading ? 'Sending…' : 'Send Verification Code'}
            </button>

            <div className="pt-1 text-center text-xs text-slate-500">
              <button
                type="button"
                onClick={() => router.push('/auth/login')}
                className="font-medium text-primary-600 hover:text-primary-700 transition-colors"
              >
                Already have an account? Sign in
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
