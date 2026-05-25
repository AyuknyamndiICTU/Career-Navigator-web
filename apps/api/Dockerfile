# syntax=docker/dockerfile:1

FROM node:20-alpine AS deps
WORKDIR /app
COPY . .
RUN npm install --no-audit --ignore-scripts

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app ./

# Ensure Prisma Client is generated inside the Linux-musl container,
# including the updated `binaryTargets` from `apps/api/prisma/schema.prisma`.
# Prisma reads `DATABASE_URL` from the schema via env(), so provide a dummy value.
ENV DATABASE_URL="postgresql://postgres:postgres@localhost:5432/career_navigator?schema=public"
RUN npx -C apps/api prisma generate --schema prisma/schema.prisma

RUN npm run build --workspace=apps/api

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
# Provide a dummy DATABASE_URL so Prisma can evaluate `env("DATABASE_URL")` during `prisma generate`.
ENV DATABASE_URL="postgresql://postgres:postgres@localhost:5432/career_navigator?schema=public"

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json

# Copy Prisma schema for generation inside this (linux-musl) image.
COPY --from=builder /app/apps/api/prisma ./prisma

# Install only production deps (ignore scripts so prisma doesn't auto-generate during install)
RUN npm ci --ignore-scripts --omit=dev

# Generate Prisma Client for the current runtime (linux-musl).
RUN npx prisma generate --schema prisma/schema.prisma

# App build output
COPY --from=builder /app/apps/api/dist ./dist

EXPOSE 3000
CMD ["node", "dist/src/main.js"]
