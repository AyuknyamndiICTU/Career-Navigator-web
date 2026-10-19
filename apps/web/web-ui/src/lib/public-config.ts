import { getApiBaseUrl } from './auth';

export type PublicConfig = {
  agoraAppId: string | null;
  aiByokEnabled: boolean;
};

let cached: Promise<PublicConfig> | null = null;

/** Runtime settings from `GET /api/config/public` (fetched once per page load). */
export function getPublicConfig(): Promise<PublicConfig> {
  cached ??= fetch(`${getApiBaseUrl()}/config/public`)
    .then((res) => {
      if (!res.ok) throw new Error(`Could not load app settings (HTTP ${res.status})`);
      return res.json() as Promise<PublicConfig>;
    })
    .catch((e: unknown) => {
      cached = null;
      throw e;
    });
  return cached;
}
