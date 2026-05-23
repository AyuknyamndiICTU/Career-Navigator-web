// @ts-nocheck
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { apiFetch, setTokens } from '@/lib/auth';
import ErrorAlert from '@/components/ErrorAlert';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await apiFetch('/auth/login', {
        method: 'POST',
        body: { email, password },
      });

      setTokens(res);
      router.push('/');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed';

      if (
        typeof msg === 'string' &&
        msg.toLowerCase().includes('account is not active')
      ) {
        router.push(
          '/auth/verify-otp?email=' + encodeURIComponent(email),
        );
        return;
      }

      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated Background Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-500/20 blur-[120px] animate-pulse" style={{ animationDuration: '8s' }} />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-fuchsia-500/20 blur-[120px] animate-pulse" style={{ animationDuration: '10s' }} />
      <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] rounded-full bg-emerald-500/10 blur-[100px] animate-pulse" style={{ animationDuration: '12s' }} />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="w-full max-w-md relative z-10"
      >
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Link href="/" className="flex flex-col items-center gap-3 group">
            <div className="relative w-16 h-16 rounded-2xl overflow-hidden shadow-lg group-hover:shadow-xl group-hover:-translate-y-1 transition-all duration-300 ring-4 ring-white/50">
              <Image
                src="/logo.png"
                alt="Career Navigator"
                fill
                className="object-cover"
              />
            </div>
            <div className="text-center mt-2">
              <div className="text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-fuchsia-600 tracking-tight">
                Career Navigator
              </div>
            </div>
          </Link>
        </div>

        {/* Card */}
        <div className="bg-white/80 backdrop-blur-2xl rounded-3xl shadow-2xl p-8 md:p-10 border border-white">
          <h1 className="text-2xl font-bold text-slate-800 text-center">Welcome back</h1>
          <p className="mt-2 text-sm text-slate-500 text-center font-medium">
            Enter your credentials to continue
          </p>

          <form className="mt-8 space-y-5" onSubmit={onSubmit}>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">
                Email
              </label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-5 py-3.5 bg-slate-50/50 rounded-2xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all font-medium text-slate-800 placeholder-slate-400 shadow-sm"
                placeholder="you@example.com"
                type="email"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2 ml-1 mr-1">
                <label className="block text-sm font-bold text-slate-700">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => router.push('/auth/password-reset/request')}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
                >
                  Forgot password?
                </button>
              </div>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-5 py-3.5 bg-slate-50/50 rounded-2xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all font-medium text-slate-800 placeholder-slate-400 shadow-sm"
                placeholder="••••••••"
                type="password"
                minLength={8}
                required
              />
            </div>

            <ErrorAlert error={error} />

            <button
              disabled={isLoading}
              type="submit"
              className="w-full py-3.5 mt-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl text-sm font-bold hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-md"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>

            <div className="pt-4 text-center">
              <span className="text-sm text-slate-500 font-medium">Don't have an account? </span>
              <button
                type="button"
                onClick={() => router.push('/auth/register')}
                className="text-sm font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
              >
                Sign up
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
