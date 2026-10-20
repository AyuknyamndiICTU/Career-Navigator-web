import { existsSync } from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

// Prisma 7 no longer reads .env itself; existing environment variables win.
const envFile = path.join(__dirname, '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

const DATABASE_URL_FALLBACK =
  'postgresql://postgres:postgres@localhost:5435/career_navigator?schema=public';

const prismaRoot = path.join(__dirname, 'prisma');

export default defineConfig({
  schema: path.join(prismaRoot, 'schema.prisma'),
  migrations: {
    path: path.join(prismaRoot, 'migrations'),
  },
  datasource: {
    url: process.env.DATABASE_URL ?? DATABASE_URL_FALLBACK,
  },
});
