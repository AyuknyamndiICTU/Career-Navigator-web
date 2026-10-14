import { env } from './env';

type OriginCallback = (err: Error | null, allow?: boolean) => void;

/**
 * Shared by HTTP CORS and the Socket.IO gateway so both enforce the same allow-list.
 * Without CORS_ALLOWED_ORIGINS (dev only; validateEnv rejects it in production) the origin is reflected.
 */
export function corsOriginCallback(
  origin: string | undefined,
  callback: OriginCallback,
): void {
  const allowed = env.corsAllowedOrigins;
  // Requests without an Origin header (curl, server-to-server, same-origin) are not CORS requests.
  if (!origin || !allowed) {
    callback(null, true);
    return;
  }
  callback(null, allowed.includes(origin));
}
