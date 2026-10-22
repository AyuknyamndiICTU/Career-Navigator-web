'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ensureAccessToken, getAccessToken } from '@/lib/auth';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import IncomingCall from './video/IncomingCall';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

type AuthState = 'checking' | 'authenticated';

// Every dashboard page is protected. The refresh cookie lives on the API host, so the check
// runs in the browser (a Next middleware can't see it until web and API share an origin, 14.1).
export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // On a full page load the in-memory token is always empty (matching the server render);
  // on client-side navigation it is usually set, so the spinner is skipped.
  const [authState, setAuthState] = useState<AuthState>(() =>
    getAccessToken() ? 'authenticated' : 'checking',
  );
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let active = true;
    ensureAccessToken()
      .then((token) => {
        if (!active) return;
        if (token) {
          setAuthState('authenticated');
        } else {
          router.replace(`/auth/login?next=${encodeURIComponent(pathname || '/')}`);
        }
      })
      .catch((err: unknown) => {
        console.warn('Session check failed:', err);
        if (active) router.replace('/auth/login');
      });
    return () => {
      active = false;
    };
  }, [pathname, router]);

  if (authState !== 'authenticated') {
    return (
      <div className="flex h-screen items-center justify-center bg-surface" role="status" aria-live="polite">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
        <span className="sr-only">Checking your session…</span>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-surface overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
      <IncomingCall />
    </div>
  );
}
