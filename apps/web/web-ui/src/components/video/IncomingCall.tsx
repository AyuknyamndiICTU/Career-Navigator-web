'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getUserSocket } from '@/lib/realtime';

type Incoming = { conversationId: string; sessionId: string; from: { id: string; name: string } };

const RING_MS = 60_000;

/** Shows "X is calling you" anywhere in the app when someone starts a call in a shared conversation. */
export default function IncomingCall() {
  const [call, setCall] = useState<Incoming | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const socket = getUserSocket();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onIncoming = (payload: Incoming) => {
      setCall(payload);
      clearTimeout(timer);
      timer = setTimeout(() => setCall(null), RING_MS);
    };
    socket.on('call:incoming', onIncoming);
    return () => {
      socket.off('call:incoming', onIncoming);
      clearTimeout(timer);
    };
  }, []);

  if (!call || pathname === '/video') return null;
  return (
    <div role="alertdialog" aria-live="assertive" aria-label="Incoming video call" className="fixed bottom-6 right-6 z-50 w-80 rounded-2xl bg-white shadow-card border border-surface-border p-4">
      <p className="text-sm font-semibold text-slate-800">{call.from.name} is calling you</p>
      <p className="text-xs text-slate-500 mt-0.5">Video call</p>
      <div className="mt-3 flex gap-2">
        <Link
          href={`/video?conversation=${call.conversationId}`}
          onClick={() => setCall(null)}
          className="flex-1 text-center px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700"
        >
          Join
        </Link>
        <button type="button" onClick={() => setCall(null)} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200">
          Dismiss
        </button>
      </div>
    </div>
  );
}
