import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.join(__dirname, '../../..');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Self-contained server (server.js + only the traced node_modules) for a small runtime image.
  output: 'standalone',
  outputFileTracingRoot: monorepoRoot,
  turbopack: {
    // Force Turbopack to resolve from the monorepo root
    root: monorepoRoot,
  },
};

export default nextConfig;
