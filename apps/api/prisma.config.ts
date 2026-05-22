import { defineConfig } from 'prisma/config';

const DATABASE_URL_FALLBACK =
  'postgresql://postgres:postgres@localhost:5432/career_navigator?schema=public';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? DATABASE_URL_FALLBACK,
  },
});
