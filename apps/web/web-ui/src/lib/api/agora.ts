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

function getApiBaseUrl(): string {
  const v =
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    'http://localhost:3000';

  // Normalize (no trailing slash)
  return v.replace(/\/+$/, '');
}

export async function startAgoraSession(
  req: StartAgoraSessionRequest,
): Promise<StartAgoraSessionResponse> {
  const res = await fetch(`${getApiBaseUrl()}/agora/sessions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to start Agora session: ${res.status} ${text}`);
  }

  return res.json() as Promise<StartAgoraSessionResponse>;
}

export async function endAgoraSession(
  sessionId: string,
): Promise<EndAgoraSessionResponse> {
  const res = await fetch(`${getApiBaseUrl()}/agora/sessions/${sessionId}/end`, {
    method: 'POST',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to end Agora session: ${res.status} ${text}`);
  }

  return res.json() as Promise<EndAgoraSessionResponse>;
}
