# syntax=docker/dockerfile:1

# Manifests only, so dependency layers stay cached until a package.json or the lockfile changes.
FROM node:24-alpine AS manifests
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/web-ui/package.json apps/web/web-ui/package.json

FROM manifests AS build
RUN --mount=type=cache,target=/root/.npm \
    npm ci --workspace=apps/api --ignore-scripts --no-audit --no-fund
COPY apps/api apps/api
WORKDIR /app/apps/api
# generate only reads the schema; the URL is never contacted.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" npx prisma generate \
    && npm run build

# Production dependencies plus the Prisma client and engines for linux-musl (bcryptjs is pure JS, no compiler needed).
FROM manifests AS prod-deps
RUN --mount=type=cache,target=/root/.npm \
    npm ci --workspace=apps/api --omit=dev --ignore-scripts --no-audit --no-fund
COPY apps/api/prisma apps/api/prisma
WORKDIR /app/apps/api
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" npx prisma generate \
    && npx prisma version >/dev/null

FROM node:24-alpine AS runner
ENV NODE_ENV=production \
    NPM_CONFIG_UPDATE_NOTIFIER=false
COPY --from=prod-deps /app /app
COPY --from=build /app/apps/api/dist /app/apps/api/dist
WORKDIR /app/apps/api
USER node

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health/live').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "dist/src/main.js"]
