// @ts-nocheck
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { apiFetch } from '@/lib/auth';
import ErrorAlert from '@/components/ErrorAlert';

export default function PasswordResetRequestPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsLoading(true);

    try {
      const res = await apiFetch('/auth/password-reset/request', {
        method: 'POST',
        body: { email },
      });
      setMessage(res?.message || 'Request sent.');
      router.push('/auth/password-reset/confirm?email=' + encodeURIComponent(email));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated Background Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-purple-500/20 blur-[120px] animate-pulse" style={{ animationDuration: '8s' }} />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-pink-500/20 blur-[120px] animate-pulse" style={{ animationDuration: '10s' }} />

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
        <div className="bg-white/80 backdrop-blur-2xl rounded-3xl shadow-2xl p-8 md:p-10 border border-white">
          <h1 className="text-2xl font-bold text-slate-800 text-center">Reset Password</h1>
          <p className="mt-2 text-sm text-slate-500 text-center font-medium">
            Enter your email to receive a reset code
          </p>

          <form className="mt-8 space-y-5" onSubmit={onSubmit}>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">Email</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-5 py-3.5 bg-slate-50/50 rounded-2xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-100 focus:border-purple-400 transition-all font-medium text-slate-800 placeholder-slate-400 shadow-sm"
                placeholder="you@example.com"
                type="email"
                required
              />
            </div>

            <ErrorAlert error={error} />

            {message && (
              <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-sm font-bold text-emerald-700 text-center shadow-sm">
                {message}
              </div>
            )}

            <button
              disabled={isLoading}
              type="submit"
              className="w-full py-3.5 mt-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-2xl text-sm font-bold hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-md"
            >
              {isLoading ? 'Sending...' : 'Send Reset Code'}
            </button>

            <div className="pt-4 text-center">
              <button
                type="button"
                onClick={() => router.push('/auth/login')}
                className="text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors"
              >
                Back to sign in
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
