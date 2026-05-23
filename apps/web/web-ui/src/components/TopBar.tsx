'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/auth';

interface TopBarProps {
  onMenuClick: () => void;
}

export default function TopBar({ onMenuClick }: TopBarProps) {
  const router = useRouter();
  const [username, setUsername] = useState('User');

  useEffect(() => {
    const token = getAccessToken();
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.email) {
          const namePart = payload.email.split('@')[0];
          setUsername(namePart);
        }
      } catch (e) {
        // ignore
      }
    }
  }, []);

  return (
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-surface-border">
      <div className="flex items-center justify-between gap-4 px-4 md:px-8 h-16 md:h-20">
        {/* Left: hamburger + search */}
        <div className="flex items-center gap-4 flex-1">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-xl hover:bg-slate-100 text-slate-700 transition-colors bg-white border border-slate-200 shadow-sm"
            aria-label="Toggle menu"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="relative max-w-md flex-1 hidden sm:block">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search careers, mentors, or jobs..."
              className="w-full pl-11 pr-4 py-2.5 bg-slate-50 rounded-2xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all font-medium text-slate-700 shadow-sm"
            />
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-3">
          {/* Action Icons Wrapper */}
          <div className="hidden sm:flex items-center gap-2 pr-2">
            {/* Notification bell */}
            <button
              onClick={() => router.push('/notifications')}
              className="relative p-2.5 rounded-xl hover:bg-indigo-50 hover:text-indigo-600 text-slate-500 transition-colors"
              aria-label="Notifications"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white" />
            </button>

            {/* Mail */}
            <button
              onClick={() => router.push('/messages')}
              className="p-2.5 rounded-xl hover:bg-indigo-50 hover:text-indigo-600 text-slate-500 transition-colors"
              aria-label="Messages"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </button>
          </div>

          {/* Divider */}
          <div className="w-px h-8 bg-slate-200 hidden sm:block mx-1" />

          {/* User avatar */}
          <button
            onClick={() => router.push('/profile')}
            className="flex items-center gap-3 pl-2 pr-4 py-1.5 rounded-2xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-200"
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-sm font-bold uppercase shadow-sm">
              {username[0]}
            </div>
            <div className="hidden md:block text-left">
              <div className="text-sm font-bold text-slate-700 leading-tight">
                {username}
              </div>
              <div className="text-xs font-medium text-slate-400">
                Premium User
              </div>
            </div>
            <svg className="w-4 h-4 text-slate-400 hidden md:block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
