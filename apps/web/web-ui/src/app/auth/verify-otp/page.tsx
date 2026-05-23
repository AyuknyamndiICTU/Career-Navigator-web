// @ts-nocheck
'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { apiFetch } from '@/lib/auth';
import ErrorAlert from '@/components/ErrorAlert';

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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated Background Blobs */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-500/20 blur-[120px] animate-pulse" style={{ animationDuration: '8s' }} />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-cyan-500/20 blur-[120px] animate-pulse" style={{ animationDuration: '10s' }} />
      
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
              <Image src="/logo.png" alt="Career Navigator" fill className="object-cover" />
            </div>
          </Link>
        </div>

        {/* Card */}
        <div className="bg-white/80 backdrop-blur-2xl rounded-3xl shadow-2xl p-8 md:p-10 border border-white text-center">
          <h1 className="text-2xl font-bold text-slate-800">Verify Your Email</h1>
          <p className="mt-2 text-sm text-slate-500 font-medium">
            {email ? `Enter the 6-digit code sent to ${email}` : 'Enter the 6-digit code sent to your email'}
          </p>

          <form className="mt-8 space-y-6" onSubmit={onSubmit}>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-3 text-left ml-1">OTP Code</label>
              <input
                value={code}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCode(e.target.value)}
                className="w-full px-5 py-4 bg-slate-50/50 rounded-2xl text-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all text-center tracking-[0.5em] font-mono font-bold text-slate-800 shadow-sm"
                type="text"
                inputMode="numeric"
                placeholder="000000"
                required
                maxLength={6}
              />
            </div>

            <ErrorAlert error={error} />

            <button
              disabled={isLoading || code.length !== 6}
              type="submit"
              className="w-full py-3.5 bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-2xl text-sm font-bold hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-md"
            >
              {isLoading ? 'Verifying…' : 'Verify Email'}
            </button>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => router.push('/auth/login')}
                className="text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors"
              >
                Cancel and back to sign in
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

export default function VerifyOtpPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500 font-bold">Loading...</div>}>
      <VerifyOtpForm />
    </Suspense>
  );
}
