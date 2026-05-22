import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** @type {import('next').NextConfig} */
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig = {
  turbopack: {
    // Force Turbopack to treat this Next app folder as the root.
    // Must be absolute, otherwise Turbopack may resolve relative to src/.
    root: __dirname,
  },
};

export default nextConfig;
