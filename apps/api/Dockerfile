# syntax=docker/dockerfile:1

FROM node:20-alpine AS deps
WORKDIR /app
COPY . .
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app ./
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" npx prisma generate --schema=apps/api/prisma/schema.prisma
RUN npm run build --workspace=apps/api

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json

# Install only production deps
RUN npm ci --ignore-scripts --omit=dev

# Copy generated Prisma client from builder
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/apps/api/node_modules/.prisma ./apps/api/node_modules/.prisma

# App build output
COPY --from=builder /app/apps/api/dist ./dist

EXPOSE 3000
CMD ["node", "dist/main.js"]
