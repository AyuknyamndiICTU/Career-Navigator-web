# syntax=docker/dockerfile:1

# Manifests only, so dependency layers stay cached until a package.json or the lockfile changes.
FROM node:24-alpine AS manifests
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/cv-parser/package.json packages/cv-parser/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/web/web-ui/package.json apps/web/web-ui/package.json

FROM manifests AS build
RUN --mount=type=cache,target=/root/.npm \
    npm ci --workspace=apps/api --ignore-scripts --no-audit --no-fund
COPY packages/cv-parser packages/cv-parser
RUN npm run build --workspace=packages/cv-parser
COPY apps/api apps/api
WORKDIR /app/apps/api
# generate writes the Rust-free client into src/generated, which the build compiles with the app.
RUN npx prisma generate && npm run build

# Production dependencies only: the Rust-free client needs no engine binaries and no Prisma CLI.
# --omit=optional too: the CLI, TypeScript and Studio are "devOptional" (also optional peers of @prisma/client),
# so --omit=dev alone keeps them; the only other loss is msgpackr's native add-on, which has a JS fallback.
FROM manifests AS prod-deps
RUN --mount=type=cache,target=/root/.npm \
    npm ci --workspace=apps/api --omit=dev --omit=optional --ignore-scripts --no-audit --no-fund
# The generated client loads only the "fast" PostgreSQL query compiler; drop the other dialects and source maps (~45 MB).
RUN cd node_modules/@prisma/client/runtime \
    && find . -type f \( -name '*.map' -o -name 'query_compiler_small_*' -o -name 'wasm-compiler-edge*' \
       -o \( -name 'query_compiler_fast_*' ! -name '*postgresql*' \) \) -delete

# One-shot migration image (`docker build --target migrate`): the Prisma CLI, schema engine and migrations.
FROM node:24-alpine AS migrate
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
WORKDIR /migrate
COPY package-lock.json /tmp/package-lock.json
RUN --mount=type=cache,target=/root/.npm \
    npm install --no-audit --no-fund --no-save \
      "prisma@$(node -p "require('/tmp/package-lock.json').packages['node_modules/prisma'].version")" \
    && rm /tmp/package-lock.json
COPY apps/api/prisma ./prisma
COPY apps/api/prisma.config.ts ./prisma.config.ts
USER node
CMD ["npx", "prisma", "migrate", "deploy"]

FROM node:24-alpine AS runner
ENV NODE_ENV=production \
    NPM_CONFIG_UPDATE_NOTIFIER=false
# Optional server-side OCR for scanned CVs (CV_OCR_SERVER=true); adds ~40 MB.
ARG WITH_OCR=false
RUN if [ "$WITH_OCR" = "true" ]; then \
      apk add --no-cache tesseract-ocr tesseract-ocr-data-eng tesseract-ocr-data-fra poppler-utils; \
    fi
COPY --from=prod-deps /app /app
COPY --from=build /app/packages/cv-parser/dist /app/packages/cv-parser/dist
COPY --from=build /app/apps/api/dist /app/apps/api/dist
WORKDIR /app/apps/api
USER node

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health/live').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "dist/src/main.js"]
