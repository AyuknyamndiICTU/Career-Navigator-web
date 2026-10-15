import { io, type Socket } from 'socket.io-client';
import { ensureAccessToken, getSocketUrl } from '@/lib/auth';

let shared: Socket | null = null;

/**
 * One app-wide connection to the user's realtime room, reused across page navigations
 * (live AI usage, notifications). Pages with their own conversation logic keep their socket.
 */
export function getUserSocket(): Socket {
  if (!shared) {
    shared = io(`${getSocketUrl()}/chat`, {
      // A callback so reconnects pick up a refreshed access token.
      auth: (cb) => {
        void ensureAccessToken().then((token) => cb({ token }));
      },
      transports: ['websocket'],
    });
  }
  return shared;
}
