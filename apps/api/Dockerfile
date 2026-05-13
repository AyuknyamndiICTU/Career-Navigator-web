# syntax=docker/dockerfile:1

FROM node:20-alpine AS deps
WORKDIR /app

# Install deps first (better layer caching)
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build Nest app
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json

# Install only production deps
RUN npm ci --ignore-scripts --omit=dev

COPY --from=builder /app/dist ./dist

# If you use prisma at runtime, you'll need the generated client.
# This repo uses Prisma Service; ensure migrations/client generation happen appropriately in your pipeline.
# COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

EXPOSE 3000
CMD ["node", "dist/main.js"]
