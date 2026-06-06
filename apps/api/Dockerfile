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

# Install production deps in the runner so the Prisma CLI binary exists at node_modules/.bin/prisma
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json

RUN apk add --no-cache python3 make g++ && \
    npm ci --ignore-scripts --omit=dev && \
    apk del python3 make g++

# Copy Prisma schema + pre-generated query engines so the client works on linux-musl
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/node_modules/.prisma ./node_modules/.prisma

# Copy the Prisma Client runtime into the runner's /app/node_modules (what Nest's require('@prisma/client') needs)
COPY --from=builder /app/apps/api/node_modules/@prisma/client ./node_modules/@prisma/client

# Also copy the Prisma CLI package (so we can run `prisma db push`)
COPY --from=builder /app/apps/api/node_modules/prisma ./apps/api/node_modules/prisma

# Ensure compiled Nest output
COPY --from=builder /app/apps/api/dist ./dist

EXPOSE 3000
CMD ["sh", "-c", "cd apps/api && npx prisma migrate deploy --schema prisma/schema.prisma || npx prisma db push --schema prisma/schema.prisma --accept-data-loss --skip-generate; cd /app && node dist/src/main.js"]
