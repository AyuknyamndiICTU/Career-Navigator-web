import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** @type {import('next').NextConfig} */
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig = {
  turbopack: {
    // Force Turbopack to resolve from the monorepo root
    root: path.join(__dirname, '../../..'),
  },
};

export default nextConfig;
