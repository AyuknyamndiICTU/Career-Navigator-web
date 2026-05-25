# syntax=docker/dockerfile:1

FROM node:20-alpine AS deps
WORKDIR /app
COPY . .
RUN npm install --no-audit --ignore-scripts

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app ./
# Prisma client generation (and query engine download) is expected to have
# already happened during `npm ci` in the deps stage. Avoid re-running `prisma generate`
# here to keep Docker builds resilient to transient DNS failures to binaries.prisma.sh.
RUN npm run build --workspace=apps/api

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json

# Install only production deps
RUN npm ci --ignore-scripts --omit=dev

# Copy generated Prisma client from builder (Prisma v6+ generates to @prisma/client)
COPY --from=builder /app/apps/api/node_modules/@prisma/client ./node_modules/@prisma/client
# Prisma v6+ also requires the engine at .prisma/client/default
COPY --from=builder /app/apps/api/node_modules/.prisma ./node_modules/.prisma

# App build output
COPY --from=builder /app/apps/api/dist ./dist

EXPOSE 3000
CMD ["node", "dist/src/main.js"]
