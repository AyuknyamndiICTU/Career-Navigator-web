# syntax=docker/dockerfile:1

FROM node:20-alpine AS deps
WORKDIR /app

# Native build tools needed for bcrypt and other compiled deps on Alpine
RUN apk add --no-cache python3 make g++

COPY . .
RUN npm install --no-audit --ignore-scripts

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app ./

# Remove any Windows-generated Prisma engine so generate creates the correct one
RUN rm -rf apps/api/node_modules/.prisma/client/query_engine-windows.dll.node 2>/dev/null || true

# Ensure Prisma Client is generated inside the Linux-musl container,
# matching the `binaryTargets` from `apps/api/prisma/schema.prisma`.
# Prisma reads `DATABASE_URL` from the schema via env(), so provide a dummy value.
ENV DATABASE_URL="postgresql://postgres:postgres@localhost:5432/career_navigator?schema=public"
RUN cd apps/api && npx prisma generate --schema prisma/schema.prisma

RUN npm run build --workspace=apps/api

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json

# Copy Prisma schema (needed for db push at startup) + pre-generated client + node_modules
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/node_modules/.prisma ./node_modules/.prisma
# Copy the actual Prisma client package into /app/node_modules so require('@prisma/client') works.
COPY --from=builder /app/apps/api/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules ./node_modules

# Prisma Client + engines are generated in the builder stage and copied into the runner.
# Avoid re-running `npx prisma generate` here because `npx` can resolve a different Prisma CLI version.
# App build output
COPY --from=builder /app/apps/api/dist ./dist

EXPOSE 3000
CMD ["sh", "-c", "npx prisma db push --schema apps/api/prisma/schema.prisma --skip-generate --accept-data-loss 2>/dev/null; node dist/src/main.js"]
