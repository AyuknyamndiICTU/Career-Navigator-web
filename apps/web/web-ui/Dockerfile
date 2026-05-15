# syntax=docker/dockerfile:1

FROM node:20-alpine AS deps
WORKDIR /app
COPY . .
RUN npm ci --ignore-scripts || npm ci --ignore-scripts || npm ci --ignore-scripts

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build --workspace=web-ui

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/apps/web/web-ui/.next ./.next
COPY --from=builder /app/apps/web/web-ui/public ./public

# Next.js needs package.json for runtime; we’ll install production deps only.
COPY --from=builder /app/package-lock.json ./package-lock.json
RUN npm ci --ignore-scripts --omit=dev

EXPOSE 3000
CMD ["npm", "run", "start", "--workspace=apps/web/web-ui"]
