import { apiFetch } from '@/lib/auth';

export type AgoraRole = 'publisher' | 'subscriber';

export type StartAgoraSessionRequest = {
  channelName: string;
  uid?: number;
  role?: AgoraRole;
  tokenExpireSeconds?: number;
  privilegeExpireSeconds?: number;
};

export type StartAgoraSessionResponse = {
  sessionId: string;
  token: string;
  uid: number;
  role: AgoraRole;
  channelName: string;
};

export type EndAgoraSessionResponse = { ended: true };

export async function startAgoraSession(
  req: StartAgoraSessionRequest,
): Promise<StartAgoraSessionResponse> {
  return apiFetch('/agora/sessions', { method: 'POST', body: req });
}

export async function endAgoraSession(
  sessionId: string,
): Promise<EndAgoraSessionResponse> {
  return apiFetch(`/agora/sessions/${encodeURIComponent(sessionId)}/end`, {
    method: 'POST',
  });
}
