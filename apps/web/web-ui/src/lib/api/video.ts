import { apiFetch } from '@/lib/auth';

export type VideoJoin = {
  provider: 'livekit';
  url: string;
  token: string;
  room: string;
  sessionId: string;
  expiresAt: string;
};

export type ActiveCall = { session: { id: string; startedAt: string; createdById: string } | null };

export type VideoUsage = {
  month: string;
  participantMinutes: number;
  freeMinutes: number;
  percent: number;
  alert: boolean;
  sessions: number;
  activeConnections: number;
  configured: boolean;
};

/** Joins (or starts) the call of a conversation; only its participants get a token. */
export function joinVideoCall(conversationId: string): Promise<VideoJoin> {
  return apiFetch('/video/sessions', { method: 'POST', body: { conversationId } });
}

export function getActiveCall(conversationId: string): Promise<ActiveCall> {
  return apiFetch(`/video/sessions/active?conversationId=${encodeURIComponent(conversationId)}`, { method: 'GET' });
}

export function getVideoUsage(): Promise<VideoUsage> {
  return apiFetch('/video/usage', { method: 'GET' });
}
