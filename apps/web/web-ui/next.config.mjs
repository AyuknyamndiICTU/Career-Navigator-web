import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.join(__dirname, '../../..');

/** @type {(phase: string) => import('next').NextConfig} */
export default function nextConfig(phase) {
  /** @type {import('next').NextConfig} */
  const config = {
    // Self-contained server (server.js + only the traced node_modules) for a small runtime image.
    output: 'standalone',
    outputFileTracingRoot: monorepoRoot,
    turbopack: {
      // Force Turbopack to resolve from the monorepo root
      root: monorepoRoot,
    },
  };

  // Production images contain no API address: the reverse proxy/ingress routes /api and /socket.io.
  if (phase === PHASE_DEVELOPMENT_SERVER) {
    const apiUrl = (process.env.API_INTERNAL_URL || 'http://localhost:3001').replace(/\/+$/, '');
    // Socket.IO requests end in "/socket.io/"; the default trailing-slash redirect would break them.
    config.skipTrailingSlashRedirect = true;
    config.rewrites = async () => [
      { source: '/api/:path*', destination: `${apiUrl}/api/:path*` },
      { source: '/socket.io/', destination: `${apiUrl}/socket.io/` },
      { source: '/socket.io/:path*', destination: `${apiUrl}/socket.io/:path*` },
    ];
  }

  return config;
}
