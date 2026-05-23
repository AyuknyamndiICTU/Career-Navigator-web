import path from 'node:path';
import { defineConfig } from 'prisma/config';

const DATABASE_URL_FALLBACK =
  'postgresql://postgres:postgres@localhost:5432/career_navigator?schema=public';

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
