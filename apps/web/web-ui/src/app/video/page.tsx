'use client';

import { Suspense, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { apiFetch } from '@/lib/auth';
import { getPublicConfig } from '@/lib/public-config';

// livekit-client is large and browser-only: load it with the call screen.
const VideoCall = dynamic(() => import('@/components/video/VideoCall').then((m) => m.VideoCall), {
  ssr: false,
  loading: () => <div className="bg-white rounded-2xl shadow-card p-8 text-center text-sm text-slate-500">Loading video…</div>,
});

type Conversation = { id: string; createdAt: string; updatedAt: string };

function VideoPageInner() {
  const params = useSearchParams();
  const router = useRouter();
  const conversationId = params.get('conversation');
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [conversations, setConversations] = useState<Conversation[] | null>(null);

  useEffect(() => {
    getPublicConfig()
      .then((c) => setEnabled(c.videoEnabled))
      .catch(() => setEnabled(false));
  }, []);

  useEffect(() => {
    if (conversationId) return;
    apiFetch('/conversations', { method: 'GET' })
      .then((res: { items: Conversation[] }) => setConversations(res.items))
      .catch(() => setConversations([]));
  }, [conversationId]);

  return (
    <div className="max-w-5xl mx-auto pb-12 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Video calls</h1>
          <p className="text-sm text-slate-500">Calls happen inside a conversation; only its participants can join.</p>
        </div>
        {conversationId && (
          <Link href={`/messages/${conversationId}`} className="text-sm font-semibold text-primary-700 hover:underline">
            Back to conversation
          </Link>
        )}
      </div>

      {enabled === false && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">
          Video calls are not configured on this server.
        </div>
      )}

      {enabled && conversationId && (
        <VideoCall conversationId={conversationId} onLeave={() => router.push(`/messages/${conversationId}`)} />
      )}

      {enabled && !conversationId && (
        <div className="bg-white rounded-2xl shadow-card border border-surface-border divide-y divide-surface-border">
          {conversations === null && <p className="p-6 text-sm text-slate-500">Loading conversations…</p>}
          {conversations?.length === 0 && (
            <p className="p-6 text-sm text-slate-500">
              No conversations yet. Start one from <Link href="/mentors" className="text-primary-700 font-semibold">Mentors</Link> or{' '}
              <Link href="/messages" className="text-primary-700 font-semibold">Messages</Link>, then call from there.
            </p>
          )}
          {conversations?.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 px-6 py-4">
              <span className="text-sm font-medium text-slate-700">Conversation {c.id.slice(0, 6)}</span>
              <Link href={`/video?conversation=${c.id}`} className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700">
                Start or join call
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function VideoPage() {
  return (
    <DashboardLayout>
      <Suspense fallback={null}>
        <VideoPageInner />
      </Suspense>
    </DashboardLayout>
  );
}
