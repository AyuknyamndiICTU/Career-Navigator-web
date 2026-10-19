# syntax=docker/dockerfile:1

# Manifests only, so dependency layers stay cached until a package.json or the lockfile changes.
FROM node:24-alpine AS manifests
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/web-ui/package.json apps/web/web-ui/package.json

FROM manifests AS build
RUN --mount=type=cache,target=/root/.npm \
    npm ci --workspace=web-ui --ignore-scripts --no-audit --no-fund

# Prevent next/font/google from fetching fonts over the network during docker builds.
ENV NEXT_FONT_GOOGLE_MOCK=1
ENV NEXT_TELEMETRY_DISABLED=1

# No API address is baked in: the browser calls /api on its own origin, so one image fits every environment.
COPY apps/web/web-ui apps/web/web-ui
RUN npm run build --workspace=web-ui

# Standalone output: server.js plus only the node_modules files the app actually uses.
FROM node:24-alpine AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build /app/apps/web/web-ui/.next/standalone ./
COPY --from=build /app/apps/web/web-ui/.next/static ./apps/web/web-ui/.next/static
COPY --from=build /app/apps/web/web-ui/public ./apps/web/web-ui/public
USER node

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/auth/login').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "apps/web/web-ui/server.js"]
