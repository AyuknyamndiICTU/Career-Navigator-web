# Career Navigator — Optimization & Hardening Plan (v2)

> Replaces the original "Project Reset Plan". The feature build-out (Milestones 0–9) is complete and condensed under **Baseline**.
> Phases 10–18 implement the 2026-10-14 codebase audit: P0 critical fixes, P1 robustness, P2 performance, P3 portability, a cloud-only multi-provider AI gateway, a project size diet, AI-free CV scanning, and free replacements for video calls and file storage. Phase 19 is the execution order.

## References
- UI reference: `Dashboard for students.jpeg`, `Skillset Dashboard.jpeg`
- Logo: `logo/logo.png`
- Source context: `project description.pdf`

## Status & priority legend
- Status: `[ ]` not started · `[/]` in progress · `[x]` done
- **P0** bug / production risk · **P1** robustness · **P2** performance · **P3** portability & flexibility
- Every item lists **Problem → Fix → Done when** so it can be verified on its own.

## Target Tech Stack (after this plan)
- **Frontend:** Next.js 16 (App Router, `output: 'standalone'`) + React + strict TypeScript (no `@ts-nocheck`)
  - Tailwind design system, Framer Motion, Socket.IO client, LiveKit client for video calls (lazy-loaded; replaces Agora)
  - CV scanning in the browser for scanned files: pdf.js + Tesseract OCR (`tesseract.js`)
  - Three.js dropped from the target stack (never installed; keeps the bundle small)
  - Calls the API same-origin via `/api` → one image works in every environment
- **Backend:** NestJS 11 + Prisma 7 (Rust-free client + `@prisma/adapter-pg`) + PostgreSQL 16
  - Config validated at boot (`@nestjs/config` + zod), global JWT guard, health endpoints, structured logs
  - API docs: Swagger at `/api/docs` (off in production unless `SWAGGER_ENABLED=true`)
  - Auth: access token in memory + refresh token in httpOnly cookie, rotation + reuse detection, OTP email
  - Search: PostgreSQL full-text search (`tsvector` + GIN, `pg_trgm`) — replaces OpenSearch
  - Cache + async jobs: Redis + BullMQ
  - Object storage: Cloudflare R2 (free tier, S3 API) in production, Garage locally — MinIO removed (archived upstream); uploads never touch local disk
  - CV parsing: rule-based, layout-aware parser + OCR fallback — **no AI tokens by default**; AI only when the user asks
  - Video: LiveKit (open source; LiveKit Cloud free tier or self-hosted)
  - **AI: cloud-only gateway** — Gemini (free tier, primary), OpenAI GPT (`gpt-oss` on Ollama Cloud; official GPT optional), Claude Haiku (budget-capped), OpenRouter free pool. **No local or self-hosted models.**
  - **Free AI by default; bring your own key (BYOK) optional** — users can add their own free or paid API key (encrypted at rest) and see their token and credit usage live
- **Runtime:** Node.js 24 LTS everywhere (Node 20 reached end-of-life in April 2026)
- **Infra:** Docker Compose on the VPS (4 vCPU / 8 GB) + Kubernetes via kustomize overlays; Jenkins CI/CD
  - Migrations run once per deploy (Compose one-shot service / k8s Job)
  - Ingress + TLS (cert-manager), HPA for the API, requests/limits on every container

---

## Baseline — Milestones 0–9 (done)
- [x] M0 Repo structure (web + api + infra), tooling, `.env.example`, NestJS + Swagger
- [x] M1 Auth: registration + OTP, JWT access/refresh rotation, password reset, deactivation, theme preference
- [x] M2 Profile CRUD, picture/CV upload to MinIO, resume builder (6 templates), CV scan via BullMQ
- [x] M3 Job browse/filter/apply, mentor search, job indexing, AI rerank + notification fan-out
- [x] M4 Realtime chat (Socket.IO + Redis adapter), notifications + worker
- [x] M5 Career-path-restricted AI chat, mock interview, course recommendations
- [x] M6 Agora video sessions (token minting, session metadata, UI)
- [x] M7 Admin user/feedback management, analytics endpoints, RBAC
- [x] M8 Dockerfiles, Compose, k8s manifests, rate limiting, helmet
- [x] M9 Web pages for every feature (auth, AI, admin, jobs, mentors, messages, profile, resume)

---

## Phase 10 — P0: Critical bugs & production risks

- [x] **10.1 Random logouts from the refresh-token race**
  - Problem: when several requests get 401 at once, each calls `refreshSession()` in [auth.ts](apps/web/web-ui/src/lib/auth.ts) with the same refresh token. The backend reuse detection in [auth.service.ts](apps/api/src/auth/auth.service.ts) then revokes **all** of the user's sessions. Two open tabs trigger the same race.
  - Fix: single-flight refresh promise shared by `apiFetch` and `apiFetchFile`; cross-tab lock with `navigator.locks.request('cn-auth-refresh', …)` and re-read the token after acquiring it.
  - Done when: 5 parallel requests with an expired access token cause exactly one `POST /auth/refresh`; two tabs stay logged in.

- [x] **10.2 Destructive schema sync on every container start**
  - Problem: [apps/api/Dockerfile](apps/api/Dockerfile) runs `prisma db push --accept-data-loss` in `CMD`; there is no `prisma/migrations` folder; replicas race each other; `apps/api/.dockerignore` excludes migrations.
  - Fix: create a baseline migration (`prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script` → `migrations/0001_baseline`, then `prisma migrate resolve --applied 0001_baseline` on existing databases). Run `prisma migrate deploy` once per deploy via a one-shot `migrate` service in Compose (`depends_on: condition: service_completed_successfully`) and a k8s `Job`. `CMD` becomes `node dist/src/main.js`.
  - Done when: starting a container never changes the schema; migrations are committed; `migrate deploy` is idempotent.
  - Status: baseline is `prisma/migrations/0_init`; Compose `migrate` service + [api-migrate-job.yaml](infra/k8s/api-migrate-job.yaml). Existing databases need `prisma migrate resolve --applied 0_init` once.

- [x] **10.3 Ingress `/api` prefix does not match the API**
  - Problem: [ingress.yaml](infra/k8s/ingress.yaml) forwards `/api/*` unchanged, but the API has no global prefix → every call 404s.
  - Fix: `app.setGlobalPrefix('api')` in [main.ts](apps/api/src/main.ts); update Socket.IO path, frontend base path (14.1) and e2e tests.
  - Done when: `GET https://<host>/api/health/ready` returns 200 through the ingress and the Compose reverse proxy.
  - Status: prefix live; `NEXT_PUBLIC_API_BASE_URL` now ends with `/api`; ingress also routes `/socket.io`. The health endpoint itself arrives with 11.3.

- [x] **10.4 Silent fallback to a localhost database**
  - Problem: [prisma.service.ts](apps/api/src/prisma/prisma.service.ts) sets `DATABASE_URL` to `postgres:postgres@localhost` when missing.
  - Fix: remove `DATABASE_URL_FALLBACK`; rely on the config schema (11.1).
  - Done when: a missing `DATABASE_URL` stops boot with a clear message.

- [x] **10.5 Refresh-token DB expiry hard-coded to 30 days**
  - Problem: `expiresAt` in [auth.service.ts](apps/api/src/auth/auth.service.ts) (login and refresh paths) ignores `JWT_REFRESH_EXPIRES_IN`.
  - Fix: derive `expiresAt` from the signed token's `exp` claim (single source of truth).
  - Done when: `JWT_REFRESH_EXPIRES_IN=7d` produces DB rows that expire in 7 days.

- [x] **10.6 Unbounded page size**
  - Problem: `?limit=1000000` is accepted by [jobs.controller.ts](apps/api/src/jobs/jobs.controller.ts) and [mentors.service.ts](apps/api/src/mentors/mentors.service.ts).
  - Fix: shared `PaginationQueryDto` (`@Type(() => Number) @IsInt() @Min(1) @Max(100)`) used by jobs, mentors, admin users, notifications and conversation messages.
  - Done when: `limit > 100` returns 400.
  - Status: shared `parsePagination` in `apps/api/src/lib/pagination.ts`; jobs and mentors are the only endpoints that accept a client page size today.

- [/] **10.7 Committed and weak secrets**
  - Problem: [docker-compose.prod.yml](infra/docker/docker-compose.prod.yml) hard-codes Postgres `postgres/postgres`, MinIO `minioadmin` and `*-change-me` JWT secrets; [Jenkinsfile](Jenkinsfile) hard-codes the VPS IP and deploys as `root`; [seed-admin.ts](apps/api/seed-admin.ts) hard-codes the admin password and prints it.
  - Fix: prod Compose reads `env_file: .env.prod` with required-variable syntax (`${JWT_ACCESS_SECRET:?missing}`); strong generated secrets; Jenkins host/user/registry from credentials or job parameters; a non-root deploy user in the `docker` group; seed reads `ADMIN_EMAIL`/`ADMIN_PASSWORD` from env and never logs the password; **rotate every secret that was ever committed**.
  - Done when: `git grep -nE "minioadmin|change-me|AdminPassword|postgres:postgres"` only matches dev-only files and examples.
  - Status: code done (prod Compose requires `.env` per [.env.prod.example](infra/docker/.env.prod.example), data ports bound to 127.0.0.1, Redis password, Jenkins `vps-deploy-target` credential, env-based seed). Remaining manual steps: rotate Gemini/Ollama keys, create the server `.env`, change the existing Postgres password, add the Jenkins credential and a non-root deploy user.

- [x] **10.8 Personal data committed to git**
  - Problem: 66 uploaded files (profile photos and CVs) are tracked under `apps/api/tmp/` because uploads are written to disk first.
  - Fix: `git rm -r --cached apps/api/tmp`, ignore `tmp/`, stop writing uploads to disk (13.6). Decide as a team whether to purge history (`git filter-repo --path apps/api/tmp --invert-paths` + coordinated force-push — irreversible).
  - Done when: `git ls-files apps/api/tmp` is empty.
  - Status: untracked and ignored (files kept on disk). History purged on 2026-10-14 from both GitHub repos (Career-Navigator-web and AyuknyamndiICTU/api, which also lost the leaked keys) and force-pushed; verified with fresh clones.

- [x] **10.9 Prisma package version mismatch**
  - Problem: [apps/api/package.json](apps/api/package.json) mixes `@prisma/adapter-pg ^7.8.0` with `@prisma/client`/`prisma ^6.19.3`.
  - Fix: align all three on Prisma 7 (see 15.4).
  - Done when: `npm ls @prisma/client @prisma/adapter-pg prisma` shows a single major version.
  - Status: aligned on 6.19.3 for now (lowest-risk fix); the Prisma 7 upgrade stays in 15.4.

- [x] **10.10 Tokens stored in `localStorage`**
  - Problem: any injected script can read both tokens ([auth.ts](apps/web/web-ui/src/lib/auth.ts)).
  - Fix: API sets the refresh token as `httpOnly; Secure; SameSite=Lax; Path=/api/auth` cookie; the access token lives in memory only; `/auth/refresh` reads the cookie; logout clears it. CSRF: SameSite + POST-only refresh + `Origin` check. Depends on 14.1 (same-origin).
  - Done when: no tokens in `localStorage`; a page reload restores the session through the cookie.
  - Status: works without 14.1 because web and API are same-site (`localhost`, or `yourdomain.com` + `api.yourdomain.com`). New `POST /api/auth/logout`; `COOKIE_SECURE=false` only for plain-http local Compose.

---

## Phase 11 — P1: Robustness

- [x] **11.1 Typed, validated configuration** — `@nestjs/config` + zod schema in `apps/api/src/config/env.schema.ts`; all `process.env` reads go through `ConfigService`; the app refuses to boot on missing/invalid values.
  - Done when: `process.env` appears only inside `apps/api/src/config/`.
  - Status: dependency-free instead of `@nestjs/config` + zod (keeps the image small): typed getters in [env.ts](apps/api/src/config/env.ts) and `validateEnv()` at boot, which lists every problem at once (required secrets, URL/duration/boolean/int formats, Redis for workers, Brevo unless log-only, CORS and no log-only OTPs in production).
- [x] **11.2 One auth guard instead of 8 copies** — global `JwtAuthGuard` + `@Public()` + `@CurrentUser()`; delete the duplicated `extractBearerToken` helpers in the ai, conversations, jobs, notifications, profile, resume and upload services; `RolesGuard` reuses the guard's user.
  - Done when: no service parses the `Authorization` header itself.
  - Status: [jwt-auth.guard.ts](apps/api/src/auth/jwt-auth.guard.ts) registered as `APP_GUARD`; agora endpoints are now protected too.
- [x] **11.3 Health checks & graceful shutdown** — `@nestjs/terminus`: `/api/health/live` (process) and `/api/health/ready` (Postgres, Redis, object storage); `app.enableShutdownHooks()`; close BullMQ workers and Redis on shutdown; Docker `HEALTHCHECK`; k8s probes move off `/api-docs`.
  - Status: small built-in [health module](apps/api/src/health/) instead of terminus (3 s timeout per check, 503 with per-dependency status); queues, workers, Socket.IO Redis clients close on shutdown; Compose `web` waits for a healthy API.
- [x] **11.4 Errors & logs** — global exception filter with a consistent `{ statusCode, message, requestId }` body (no stack traces in production); `nestjs-pino` JSON logs with request IDs; redact `authorization`, `cookie`, passwords, OTPs and AI API keys (`apiKey`, `x-api-key`, `x-goog-api-key`).
  - Status: [AllExceptionsFilter](apps/api/src/logging/all-exceptions.filter.ts) + `X-Request-Id` middleware; Nest's built-in JSON logger (production) wrapped by [RedactingLogger](apps/api/src/logging/redacting-logger.ts) instead of pino. Access logs carry only method, path, status and timing.
- [x] **11.5 CORS hardening** — in production `CORS_ALLOWED_ORIGINS` is required (no reflect-any-origin with credentials); the Socket.IO gateway uses the same list instead of its own `http://localhost:3000` default. After 14.1 CORS is only needed in development.
- [x] **11.6 Frontend resilience** — `src/middleware.ts` redirects unauthenticated users away from protected routes; add `app/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx` and route `loading.tsx`; replace silent `catch {}` blocks in [VideoCallClient.tsx](apps/web/web-ui/src/components/agora/VideoCallClient.tsx) (and avoid them in its LiveKit replacement, Phase 17) with logged warnings; abort in-flight fetches on unmount.
  - Status: the refresh cookie lives on the API host, so a middleware can't see it until 14.1; [DashboardLayout](apps/web/web-ui/src/components/DashboardLayout.tsx) checks the session in the browser and redirects to `/auth/login?next=…` (same-site paths only). `VideoCallClient` cancels joins that finish after unmount. `apiFetch` accepts an `AbortSignal` for pages that need it.
- [x] **11.7 Tests in CI** — re-enable `npm test` in the [Jenkinsfile](Jenkinsfile); run API e2e against throwaway Postgres + Redis containers; add `tsc --noEmit` for the web app; add regression tests for 10.1 and 10.5.
  - Status: Jenkins runs lint, API + web type-checks, `npm test` and the API e2e suite (101 tests; they mock Prisma/Redis/storage, so no containers are needed). Web lint moved to ESLint 9 flat config (Next 16 removed `next lint`). 10.1 is covered by [auth.test.mjs](apps/web/web-ui/test/auth.test.mjs) (Node test runner, needs Node >= 22.18 on the agent), 10.5 by `auth.e2e-spec.ts`.
- [x] **11.8 Upload validation** — check magic bytes (`%PDF`, DOCX zip header, JPEG/PNG/WebP signatures) instead of trusting the client `mimetype`; random UUID object keys (never the original filename); keep the 5 MB / 10 MB limits.
  - Status: [file-signature.ts](apps/api/src/upload/file-signature.ts); uploads are kept in memory and never touch disk (13.6).

---

## Phase 12 — AI provider overhaul (cloud-only, free-first, multi-model)

### Goals
- Reach **GPT, Claude and Gemini** models through one gateway.
- **Zero local inference** — nothing AI-related runs in the deployment's RAM. Ollama is allowed **only** as Ollama **Cloud** (`https://ollama.com/v1`).
- **Make free quota last longer**: cheapest adequate model per task, caching, token trimming, load spread across separate per-model quotas, per-user fairness limits.
- **Faster answers** than the current Ollama path: strict time budget + streaming.
- **Free by default, own key optional**: every account uses the free platform AI with no setup; a user can add their own free or paid API key and use it for their account only, with tokens and credit usage calculated and shown in real time (12.14–12.24).

### Provider matrix (checked 2026-10-14 — free tiers change, re-check before go-live)
| Family | Access | Models | Cost | Limits / notes | Role |
|---|---|---|---|---|---|
| Gemini | Google AI Studio API key | `gemini-3.8-flash`, `gemini-3.6-flash`, `gemini-3.5-flash-lite`, `gemini-3.1-flash-lite`, `gemini-2.5-flash-lite` | **Free tier** — input and output tokens free of charge | RPM / TPM / RPD per project **per model** (see AI Studio → Rate limits); RPD resets at midnight Pacific. Free-tier content may be used to improve Google products. | **Primary** for every task |
| GPT (OpenAI open-weight) | Ollama **Cloud**, OpenAI-compatible `https://ollama.com/v1` | `gpt-oss:120b`, `gpt-oss:20b` | Free plan includes monthly starter credits; afterwards `gpt-oss:20b` $0.07 in / $0.30 out and `gpt-oss:120b` $0.15 / $0.60 per 1M tokens | Free plan = 1 concurrent request; runs on Ollama's servers, **not** on the VPS | Secondary |
| GPT (official) | OpenRouter or OpenAI API | e.g. `openai/gpt-5.4-nano` | Paid — no free tier | Only with a hard spend cap on the key | Optional |
| Claude | Anthropic API | `claude-haiku-5-5` | **No free API tier**; from $0.10 in / $0.50 out per 1M tokens; prompt-cache reads ≈ 10 % of input price | Rough estimate: $5 ≈ 12,000 short chats (1.5k in / 0.5k out tokens) | Quality fallback, budget-capped |
| Free pool | OpenRouter `openrouter/free` | auto-selects a free model | $0 | 20 req/min; 50 req/day (1,000/day after a one-time ≥ $10 credit purchase) | Overflow when everything else is throttled |

Not used: local Ollama (slow, eats VPS RAM), GitHub Models (retired 2026-07-30), time-limited trials (e.g. Cerebras $5 / 30 days).

### Task routing (defaults; every chain is overridable by env)
| Task | Output | Chain (first healthy entry wins) | Max output tokens | Cache |
|---|---|---|---|---|
| `chat` | streamed text | gemini-3.8-flash → gemini-3.6-flash → ollama gpt-oss:120b → claude-haiku-5-5 → openrouter/free | 800 | — |
| `mock-interview` | streamed text | gemini-3.8-flash → claude-haiku-5-5 → ollama gpt-oss:120b → openrouter/free | 600 | — |
| `cv-assist` (opt-in only, Phase 16) | JSON for one CV section | gemini-3.5-flash-lite → gemini-3.1-flash-lite → ollama gpt-oss:20b → claude-haiku-5-5 | 600 | file SHA-256 + section, 30 days |
| `job-rerank` | JSON | gemini-3.5-flash-lite → gemini-2.5-flash-lite → ollama gpt-oss:20b | 1,000 | profile hash + job-ID set, 24 h |
| `course-recs` | JSON | gemini-3.1-flash-lite → gemini-3.5-flash-lite → ollama gpt-oss:20b | 1,000 | skills hash, 7 days (`CourseRecommendationCache`) |

Configuration (`provider/model`, split on the first `/`; providers without a key are skipped):
```env
GEMINI_API_KEY=
OLLAMA_API_KEY=            # Ollama Cloud only
ANTHROPIC_API_KEY=
OPENROUTER_API_KEY=
OPENAI_API_KEY=            # optional
AI_ROUTE_CHAT=gemini/gemini-3.8-flash,gemini/gemini-3.6-flash,ollama/gpt-oss:120b,anthropic/claude-haiku-5-5,openrouter/openrouter/free
AI_ROUTE_CV_ASSIST=gemini/gemini-3.5-flash-lite,gemini/gemini-3.1-flash-lite,ollama/gpt-oss:20b,anthropic/claude-haiku-5-5
AI_CHAT_TIME_BUDGET_MS=20000
AI_USER_DAILY_LIMIT_CHAT=40
AI_BYOK_ENABLED=true
AI_KEY_ENCRYPTION_KEY=            # 32-byte base64 secret; required when BYOK is enabled
AI_KEY_ENCRYPTION_KEY_PREVIOUS=   # optional, only during key rotation
```

### Work items
- [x] **12.1 AI gateway module** `apps/api/src/ai/gateway/` — `AiGatewayService.generate(task, messages, opts)` and `.stream(…)`; adapters `gemini.provider.ts` (native REST), `openai-compatible.provider.ts` (Ollama Cloud, OpenRouter, OpenAI — same `/v1/chat/completions` shape; Gemini's OpenAI-compatible endpoint can also use it) and `anthropic.provider.ts` (Messages API). Plain `fetch` + `AbortSignal`, **no vendor SDKs** (keeps the image small).
- [x] **12.2 Remove duplication** — the Gemini→Ollama logic is copied in [ai.service.ts](apps/api/src/ai/ai.service.ts) (1,047 lines), [cv-scan-worker.service.ts](apps/api/src/cv-scan/worker/cv-scan-worker.service.ts) and [jobs.service.ts](apps/api/src/jobs/jobs.service.ts); move it into the gateway; delete [aiProvider.ts](apps/api/src/lib/aiProvider.ts) and keyword heuristics such as `isCodeRelatedTask` in favour of explicit task profiles.
- [x] **12.3 Quota-aware routing** — on 429 / `RESOURCE_EXHAUSTED` mark `provider/model` as cooling in Redis until `Retry-After` (per-minute limits) or the next daily reset (per-day limits); skip cooling entries; per-model daily counters so load spreads across the separate Gemini model quotas.
- [x] **12.4 Time budget** — per-attempt timeout (chat: 8 s to first token; background jobs: 30 s), at most 1 retry per model, total budget per request (chat 20 s). Replaces the current 6-retry / 16 s back-off loop. Circuit breaker after N consecutive failures.
- [x] **12.5 Streaming** — `POST /api/ai/chat/stream` and `/api/ai/mock-interview/stream` via Server-Sent Events; the chat page renders tokens as they arrive (existing non-stream endpoints stay for compatibility).
- [x] **12.6 Token economy** — send the last 6 turns + a rolling summary; per-task `maxOutputTokens`; JSON/structured-output mode for extraction; compact system prompts; Claude `cache_control` on the system prompt; keep the Gemini system-prompt prefix stable so implicit caching applies.
- [x] **12.7 Response caching** — Redis + existing cache tables for deterministic tasks (see table); re-uploading the same CV never calls a model again.
- [x] **12.8 Batch reranking** — one call ranks all candidate jobs (IDs + short summaries) instead of one call per job.
- [x] **12.9 Per-user fairness** — daily per-user limits on the platform's free AI in Redis; friendly 429 with reset time; admins exempt; calls made with a user's own key are exempt (12.17).
- [x] **12.10 Privacy on free tiers** — redact emails, phone numbers and street addresses from CV text (opt-in AI assist only, Phase 16) before sending it to a free-tier provider; mention AI processing in the privacy notice.
- [x] **12.11 Observability** — log provider, model, latency, input/output tokens and cache hits per call; admin analytics card "AI usage by provider/model (today / 30 days)"; `/api/health/ai` lists configured providers and cooling state; per-user metering is in 12.18–12.19.
- [x] **12.12 Remove local Ollama everywhere** — the `ollama` service, `local-ollama` profile and `cn-ollama` volume in [docker-compose.yml](infra/docker/docker-compose.yml); the `http://ollama:11434/v1` option; `OLLAMA_MODEL` (`qwen2.5-coder:7b`) in [api-deployment.yaml](infra/k8s/api-deployment.yaml); update `.env.example` files.
- [x] **12.13 Tests** — unit tests for routing, fallback and cooldown with mocked `fetch`; e2e with a fake provider (no real keys in CI).
- Done when: chat starts streaming in under ~3 s on Gemini; revoking the Gemini key still serves chat through the next provider; no AI process runs on the VPS; the usage card shows load spread across models.
- Status (2026-10-15): gateway in [apps/api/src/ai/gateway/](apps/api/src/ai/gateway/) (plain `fetch`, no SDKs); task names `chat`, `mock-interview`, `cv-assist`, `job-rerank`, `course-recs` (`AI_ROUTE_<TASK>` overrides). Cooldowns, daily counters, quotas and caches live in Redis and fall back to process memory when Redis is down. Per-model daily caps are opt-in (`AI_MODEL_DAILY_LIMITS`) because free-tier RPD values change. Job match reasons were already one batched call; they now run through the gateway (`AI_JOB_MATCH_ENABLED`, legacy `GEMINI_JOB_MATCH_ENABLED` still read). Redaction applies to the current AI CV parsing too, ahead of Phase 16. Verified live: with the (leaked, now 403) Gemini key the gateway cooled both Gemini models and streamed the answer from Ollama Cloud in ~3.9 s. Tests: `gateway.spec.ts` (22 unit) + `ai.e2e-spec.ts` (18) with recorded-shape provider fixtures.

### Free AI by default + bring your own key (BYOK) with live usage metering

How it works for users:
- **Default:** every account uses the platform's free AI chain above — no setup needed.
- **Own key (optional):** in *Settings → AI providers* a user adds an API key (free or paid) for Gemini, OpenAI (GPT), Anthropic (Claude), OpenRouter or Ollama Cloud, picks the model per feature, and from then on those features run on **their** key, quota and credits — only for their own account.
- **Live usage:** tokens and cost are counted on every AI call (platform or own key) and shown in real time — per message while streaming, in the top bar, and on a usage page.

Resolution order for each AI request:
1. The user's own key + chosen model for that feature (if active, valid, under budget and not rate-limited)
2. The platform free chain (if the user allows fallback — on by default)
3. Otherwise a clear message, e.g. "Your key's monthly budget is used up — raise it or enable free fallback"

- [x] **12.14 Data model** (Prisma, shipped as a migration per 10.2)
  - `UserAiCredential` — `userId`, `provider` (GEMINI · OPENAI · ANTHROPIC · OPENROUTER · OLLAMA_CLOUD), `label`, `ciphertext` / `iv` / `authTag` / `keyVersion`, `last4`, `tier` (FREE · PAID, declared by the user), `monthlyBudgetUsd?`, `status` (ACTIVE · INVALID · DISABLED), `lastValidatedAt`; index on `userId`.
  - `UserAiPreference` — per-feature mapping `task → credentialId + model`, `fallbackToPlatform` (default `true`).
  - `AiModelPrice` — `provider`, `model`, input / output / cached-input price per 1M tokens, `effectiveFrom`; admin-editable, seeded from the provider matrix.
  - `AiUsageEvent` — `userId`, `credentialId?` (null = platform AI), `provider`, `model`, `task`, `inputTokens`, `outputTokens`, `cachedTokens`, `reasoningTokens`, `costUsd` (Decimal), `costSource` (PROVIDER · PRICE_TABLE · FREE), `latencyMs`, `status`, `createdAt`; indexes `[userId, createdAt]` and `[credentialId, createdAt]`.
- [x] **12.15 Key security**
  - AES-256-GCM encryption with `AI_KEY_ENCRYPTION_KEY` (kept in env / k8s Secret, never in the database); `keyVersion` + `AI_KEY_ENCRYPTION_KEY_PREVIOUS` allow rotation without losing stored keys.
  - The plaintext key is never sent back to the browser (only `••••last4`), never logged (11.4 redaction), never cached; it is decrypted in memory only for the outgoing provider call.
  - Outbound calls go only to fixed HTTPS provider hosts — users cannot supply URLs, so no SSRF. Extra OpenAI-compatible hosts only through an admin allowlist (`AI_BYOK_ALLOWED_HOSTS`) with private-IP blocking.
  - "Remove key" and account deactivation/deletion delete the key immediately; add / remove / test actions are rate-limited and written to an audit log.
- [x] **12.16 Key validation & model discovery** — on save and on "Test", call the provider's model-list endpoint (no tokens spent): Gemini `models.list`, OpenAI-compatible `GET /v1/models`, Anthropic `GET /v1/models`; for OpenRouter `GET /api/v1/key` (also returns `is_free_tier`, usage and remaining credit). Cache each key's model list for 24 h, tag models Free/Paid from `AiModelPrice`, mark the key INVALID on 401/403.
- [x] **12.17 Gateway integration** — `AiGatewayService` resolves the credential per request (order above). Own-key calls skip the platform free limits (12.9) and never use platform quota, but keep the general abuse rate limit. On 401/402/429 from a user's key: mark it invalid or cooling, notify the user, fall back if allowed. Cached results produced with a user's key are scoped to that user.
- [x] **12.18 Exact token & cost metering** — counts come from the provider's response, not guesses:
  - Gemini `usageMetadata` (`promptTokenCount`, `candidatesTokenCount`, `cachedContentTokenCount`, `thoughtsTokenCount`)
  - OpenAI-compatible `usage` (`prompt_tokens`, `completion_tokens`, cached/reasoning details), with `stream_options: { include_usage: true }` so streams end with a usage chunk
  - Anthropic `usage` (`input_tokens`, `output_tokens`, cache fields) from the `message_start` + `message_delta` stream events
  - Cost = provider-reported cost when available (e.g. OpenRouter), otherwise `AiModelPrice` × tokens; `$0` (tokens still counted) for FREE-tier keys and platform free models.
  - Hot path: Redis `HINCRBY` counters per user / key / day / month; durable `AiUsageEvent` rows written asynchronously in batches (BullMQ) so metering never slows a response.
- [x] **12.19 Real-time display**
  - While streaming: SSE `usage` events with a running output-token estimate, then exact final numbers and cost; each chat bubble shows e.g. `↑ 1,240 · ↓ 312 tokens · $0.0004 · gemini-3.8-flash (your key)`.
  - After every AI call (including background job matching and CV AI assist) the API emits Socket.IO `ai:usage` to the user's room, so a top-bar widget (today's tokens, cost, remaining allowance/budget) updates live in every open tab and device.
  - Usage page `/settings/ai/usage`: today / this month / custom range; breakdown by feature, provider, model and key (platform free vs own key); daily chart; remaining platform free allowance ("32 of 40 free chats left today"); remaining budget per own key.
  - Credit balance: live remaining credit for OpenRouter keys (`GET /api/v1/key`, cached 60 s). Gemini, OpenAI and Anthropic don't expose balances to ordinary API keys, so for those the page shows **estimated spend vs. the user's own budget**, clearly labelled as an estimate.
- [x] **12.20 Budgets & alerts** — optional monthly budget per own key; in-app notification at 80 %; at 100 % own-key usage stops and requests fall back to the platform free AI (if enabled) or show a clear message; budgets reset on the 1st of each month (UTC).
- [x] **12.21 Settings UI** — *Settings → AI providers*: add key (provider, key, label, free/paid, optional budget), "Test" button, masked key list with status and last check time, per-feature model picker (chat, mock interview, CV AI assist, job matching, course recommendations), "fall back to free platform AI" toggle, remove key; note that prompts sent with an own key are processed under that provider's terms.
- [x] **12.22 API surface** — `GET /api/ai/providers`; `GET|POST /api/ai/credentials`; `PATCH|DELETE /api/ai/credentials/:id`; `POST /api/ai/credentials/:id/test`; `GET /api/ai/credentials/:id/models`; `GET|PUT /api/ai/preferences`; `GET /api/ai/usage?range=&groupBy=`; `GET|PUT /api/admin/ai/prices` — all behind the JWT guard (11.2) with validated DTOs.
- [x] **12.23 Admin view** — platform AI usage and cost by provider/model, number of users on their own keys, aggregate own-key token counts (never key material); edit `AiModelPrice`; global switch `AI_BYOK_ENABLED`.
- [x] **12.24 Tests** — AES-GCM round-trip and tamper detection; the plaintext key never appears in responses or logs; recorded provider fixtures produce exact token counts and costs; budget cut-off and fallback; SSRF guard; `ai:usage` emitted after a stream completes.
- Done when: a new user chats for free with no setup; after adding their own key the selected features run on it; displayed usage matches the provider-reported usage; the top bar updates within ~1 s of each AI response; removing the key immediately returns the account to the free platform AI.
- Status (2026-10-15): migration `20261015000000_ai_gateway` (also seeds prices); `fallbackToPlatform` is a `User` column rather than a preference row. Usage events are written in in-process batches (every 2 s / 100 events, flushed on shutdown) instead of BullMQ. The `AI_BYOK_ENABLED` switch is env-only (shown read-only to admins). Extra endpoints: `GET /api/ai/usage/summary` (top-bar widget), `GET /api/admin/ai/usage`, admin-only `GET /api/health/ai`. Web: streaming chat and multi-turn mock interview with per-answer usage, live top-bar widget, `/settings/ai`, `/settings/ai/usage`, admin AI panel. Tests: `byok.e2e-spec.ts` (12).

---

## Phase 13 — P2: Performance

- [x] **13.1 Standalone Next build** — `output: 'standalone'` in [next.config.mjs](apps/web/web-ui/next.config.mjs); the runner image copies `.next/standalone`, `.next/static` and `public`, then runs `node apps/web/web-ui/server.js`.
- [x] **13.2 Docker layer caching** — copy `package.json` + `package-lock.json` (root and workspace manifests) first, `npm ci` with `--mount=type=cache,target=/root/.npm`, then copy sources; expand the root `.dockerignore` (`**/.next`, `**/node_modules`, `**/dist`, `apps/api/tmp`, `logo`, `*.md`, `**/test`, `.git`).
- [x] **13.3 Lean API runtime image** — `bcryptjs` is pure JS, so drop `python3 make g++` entirely; `npm ci --omit=dev --workspace=apps/api`; `USER node`; `CMD ["node","dist/src/main.js"]` (no `npx`).
- [x] **13.4 Fit the 8 GB VPS** (see [swap-safety-commands.md](swap-safety-commands.md)) — `mem_limit`/`cpus` per service in prod Compose; `NODE_OPTIONS=--max-old-space-size=384` (API) / `256` (web); `CV_SCAN_WORKER_CONCURRENCY=1`; Redis `maxmemory` with `noeviction` (BullMQ requirement) and TTLs on every cache key; Postgres `shared_buffers=256MB`. Swap stays as a safety net only.
- [x] **13.5 Resume query** — replace the 5 sequential queries in [resume.service.ts](apps/api/src/resume/resume.service.ts) with one `findUnique({ include })` (or `Promise.all`).
- [x] **13.6 Uploads without local disk** — `memoryStorage()` (limits already 5/10 MB) and stream the buffer to object storage (Phase 18); remove `diskStorage('./tmp')` from [upload.controller.ts](apps/api/src/upload/upload.controller.ts). Works on read-only and ephemeral filesystems.
- [x] **13.7 Split oversized services** — `ai.service.ts` (1,047 lines) → gateway + `ChatService` / `InterviewService` / `CourseRecsService`; `jobs.service.ts` (936) → browse / apply / match; `cv-scan-worker.service.ts` (518) → extract / parse / populate.
- [x] **13.8 Query tuning** — composite index `Message(conversationId, createdAt)` for paginated history; conversation lists `select` without message bodies; `EXPLAIN ANALYZE` the filtered job browse query.
- [x] **13.9 Frontend data fetching** — shared `useApi` hook (dedupe in-flight requests, abort on unmount, revalidate on focus) or SWR if preferred; lazy-load resume templates with `next/dynamic` (the video client already is).
- Status (2026-10-19):
  - **Images:** API 998 MB → 742 MB, web 1.51 GB → 284 MB. Both run as `node` and have a `HEALTHCHECK`. The migrate service runs `npx prisma migrate deploy --schema prisma/schema.prisma` from the runtime image. Idle memory on the local stack: API ≈55 MiB, web ≈31 MiB. Still on Node 20; the Node 24 pin is 14.4. Builds use only the root `.dockerignore`, so the per-app ones are unused.
  - **13.4 prod Compose limits:**
    - Postgres: 768m / 1 CPU, `shared_buffers=256MB`, `max_connections=50`.
    - Redis: `maxmemory 192mb noeviction`.
    - API: 640m, heap 384.
    - Web: 384m, heap 256.
    - MinIO: 512m.
  - **13.4 Redis key lifetimes:** every app Redis key is written with a TTL (`AiStateStore`). BullMQ jobs use `removeOnComplete`.
  - 13.6 was already done in Phase 11.
  - **13.7 split:**
    - AI: [career-skills.service.ts](apps/api/src/ai/career-skills.service.ts), chat (94 lines), interview (71), course-recs (260).
    - Jobs: [job-catalog.ts](apps/api/src/jobs/job-catalog.ts), browse (209), applications (78), match (386).
    - CV worker: text extractor (42), AI parser (89), profile populator (99, one transaction with `createMany`), orchestrator (203).
  - **13.8:** migration `20261019000000_query_indexes` adds `Message(conversationId, createdAt)`, `Job(status, createdAt)` and a GIN index on `Job.skills`.
    - `GET /conversations/:id/messages` now takes `limit` (default 50) and `before`, and returns `{ items, nextBefore }`.
    - `EXPLAIN ANALYZE` on 50k synthetic jobs: the default browse (`status=ACTIVE ORDER BY createdAt DESC LIMIT 10`) uses an index scan on `Job_status_createdAt_idx` and takes 0.12 ms. The skill filter takes 0.9 ms.
    - Still sequential: the pagination `count(*)` (7.8 ms) and the `ILIKE` search (76 ms). Full-text search is 14.9.
  - **13.9:** the request dedupe and abort logic lives in [inflight.ts](apps/web/web-ui/src/lib/inflight.ts) and is used by [useApi.ts](apps/web/web-ui/src/lib/useApi.ts).
    - Adopted by: messages, notifications, level-up and the conversation's profile lookup.
    - The conversation page gets "Load older messages" via `nextBefore` and drops duplicate messages by id.
    - The six resume templates load through `next/dynamic`.
    - Tests: `test/inflight.test.mjs` (3) and 3 conversation pagination e2e tests.

---

## Phase 14 — P3: Portability & flexibility

- [x] **14.1 Same-origin API — build once, deploy anywhere**
  - Browser calls relative `/api/...`. Production: ingress (k8s) or a small reverse proxy such as Caddy (Compose, automatic TLS) routes `/api` and `/socket.io` to the API. Development: Next `rewrites` send `/api/:path*` to `API_INTERNAL_URL` (default `http://localhost:3001`).
  - Remove the `NEXT_PUBLIC_API_BASE_URL` / `NEXT_PUBLIC_BACKEND_URL` / `NEXT_PUBLIC_SOCKET_URL` build args; serve public runtime settings (e.g. the LiveKit URL) from `GET /api/config/public`; delete the `replace('/api/v1', '')` workaround in [messages/[id]/page.tsx](apps/web/web-ui/src/app/messages/%5Bid%5D/page.tsx).
  - Done when: the same web image runs unchanged in dev, staging and production.
- [x] **14.2 Typed API client & strict TypeScript** — generate `src/lib/api/schema.d.ts` with `openapi-typescript` from the Swagger JSON; typed `apiFetch`; remove `// @ts-nocheck` from all 30 files (start with [auth.ts](apps/web/web-ui/src/lib/auth.ts), then pages and resume templates); CI fails on new `@ts-nocheck`.
- [x] **14.3 Web tooling** — replace `next lint` (removed in Next 16) with ESLint 9 flat config + `eslint .`; same ESLint major in both workspaces; delete one-off codemods [replace-errors.js](apps/web/web-ui/replace-errors.js) (hard-coded Windows path) and [inject-erroralert-import.js](apps/web/web-ui/inject-erroralert-import.js); drop the stale `./src/pages/**` glob from [tailwind.config.ts](apps/web/web-ui/tailwind.config.ts).
- [x] **14.4 Pin Node** — `.nvmrc` = `24`, `"engines": { "node": ">=24 <25" }` in the root [package.json](package.json), `node:24-alpine` in both Dockerfiles and the Jenkins agent.
- [x] **14.5 Environment templates** — update [apps/api/.env.example](apps/api/.env.example) and [apps/web/.env.example](apps/web/.env.example), add `infra/docker/.env.prod.example`; document every variable (required / optional / default); remove obsolete ones (local `OLLAMA_BASE_URL`, `OPENSEARCH_*`, `NEXT_PUBLIC_*_URL`, `AGORA_*`, `MINIO_*`).
- [x] **14.6 Kubernetes** — kustomize `base/` + `overlays/{dev,prod}`; Secrets/ConfigMaps instead of inline `REPLACE_ME`; requests/limits on every container; image tags = git SHA (no `:latest`); probes on `/api/health/*`; Redis with a PVC (or managed); Postgres as a StatefulSet or managed service; object storage on R2 (Phase 18); migration `Job` (10.2); cert-manager annotations; HPA for the API (CPU 70 %); no `OLLAMA_*` variables.
- [x] **14.7 Jenkins pipeline** — lint → typecheck → unit + e2e tests → build images (BuildKit cache) → push `:<git-sha>` → deploy → post-deploy health check → automatic rollback to the previous tag on failure. Host, user and registry from credentials; no `root` SSH.
- [x] **14.8 Swagger** — serve at `/api/docs`; `SWAGGER_ENABLED` (off in production by default, or behind basic auth); relative server URL instead of the hard-coded `http://localhost:3001`.
- [x] **14.9 Replace OpenSearch with PostgreSQL search** — generated `tsvector` column on `Job` (title, company, description, skills) + GIN index, `pg_trgm` for fuzzy titles; remove the `OPENSEARCH_*` path in [jobs.service.ts](apps/api/src/jobs/jobs.service.ts) and the `opensearch` Compose profile (OpenSearch alone needs 1–2 GB RAM).
- [x] **14.10 Cross-platform scripts** — root scripts `clean`, `db:migrate`, `db:seed`, `typecheck`, `api:openapi` written in Node (no bash/PowerShell-only commands); fix the `start:prod` path mismatch (`dist/main` vs `dist/src/main.js`).
- [ ] **14.11 One repository** — `apps/api` contains its own `.git` with a separate remote; fold it into the monorepo after confirming nothing is unpushed (team decision).
- Status (2026-10-20):
  - **14.1 Same origin:**
    - The browser uses `/api` and `window.location.origin` for Socket.IO.
    - Local Compose and the production VPS get a Caddy `proxy` service ([Caddyfile](infra/docker/Caddyfile)).
      - Production: automatic HTTPS for `SITE_ADDRESS`; only ports 80/443 are public, and the API listens on 127.0.0.1 only.
      - Locally the proxy publishes `WEB_HOST_PORT`.
    - `next dev` rewrites `/api` and `/socket.io` to `API_INTERNAL_URL`; WebSocket and polling were both verified through it.
    - `GET /api/config/public` returns `agoraAppId` and `aiByokEnabled`; the LiveKit URL joins it in Phase 17.
    - New `TRUST_PROXY` setting (hops) keeps per-IP rate limits correct behind the proxy.
    - Resume photo URLs are now relative (`/api/upload/file/...`).
    - The `/api/v1` workaround was already gone.
  - **14.2 Typed client:**
    - `npm run api:openapi` builds the API and exports OpenAPI in Nest preview mode (no database needed), then generates [schema.d.ts](apps/web/web-ui/src/lib/api/schema.d.ts).
    - The `@nestjs/swagger` CLI plugin fills in DTO properties.
    - [client.ts](apps/web/web-ui/src/lib/api/client.ts) provides `apiRequest(method, route, { params, query, body })`, with typed bodies and path params. It is used by the auth pages and job apply.
    - Responses stay `unknown` until controllers declare response DTOs.
    - All 29 `@ts-nocheck` files are clean; removing them surfaced 4 real errors, now fixed.
    - ESLint `ban-ts-comment` is now an error. Jenkins fails if the committed schema drifts from the API.
  - **14.3:** both workspaces were already on ESLint 9 flat config.
  - **14.4:** Jenkins checks the agent's Node major against `.nvmrc`. A local Node 25 install only gets npm engine warnings.
    - Both containers run Node v24.22.0.
    - Images grew with the Node 24 base: API 742 → 792 MB, web 284 → 334 MB.
  - **Verification:**
    - API: lint, typecheck, unit tests, and 126/126 e2e tests (16 suites) pass.
    - Web: typecheck passes; lint has 0 errors (58 warnings, down from 87); 6 tests pass.
    - Local stack is healthy, including the proxy.
      - Through `localhost:3010`: `/api/health/ready`, `/api/config/public`, Socket.IO polling and WebSocket, and web pages all work.
      - Auth smoke test 24/24 and the live AI stream pass.
  - **14.5:** `MINIO_*` and `AGORA_*` stay until Phases 18 and 17 replace those services. Every API variable is documented as required or optional, with its default.
  - **14.6:** the old flat manifests moved to [infra/k8s/base](infra/k8s/base) (git history kept). Base and overlays:
    - Base adds: Postgres StatefulSet with a PVC, Redis StatefulSet with a PVC, HPA (2–5 replicas at 70 % CPU), a NetworkPolicy, a config map generator, and non-root security contexts.
    - Overlays add: per-environment namespace, domain and image tags, plus Secrets generated from git-ignored `*.env` files. Templates live in `overlays/prod`.
    - Both overlays render with `kubectl kustomize`; release steps are in [infra/k8s/README.md](infra/k8s/README.md).
  - **14.7:** the server-side [deploy.sh](infra/docker/deploy.sh) waits for `/api/health/ready` and rolls back to the previous tag (kept in `.deployed-tag`) if the release never becomes ready.
    - The production Compose file requires an explicit `TAG`.
    - SSH uses `accept-new` instead of disabling host-key checks.
    - CI lint runs without `--fix`.
    - BuildKit layer and npm caches persist on the agent.
  - **14.8:** Swagger moved from `/api-docs` to `/api/docs` (JSON at `/api/docs-json`). Optional basic auth via `SWAGGER_USER` and `SWAGGER_PASSWORD` also covers the JSON. The server URL is now `/`.
  - **14.9 Postgres search:**
    - Migration `20261020000000_job_search` adds `pg_trgm`, a generated `searchVector` column, a GIN index on it, and a trigram index on `title`.
    - Weighting: title A, skills and company B, description C.
    - Search uses `websearch_to_tsquery` (quoted phrases and `-exclusions`) plus `query <% title` for typos. Results are ranked by `ts_rank` plus word similarity.
    - Verified on sample rows: stemming, typos, skills, phrases and company names all match.
    - `POST /jobs/index`, which any signed-in user could call, was removed, along with the OpenSearch config and Compose service.
  - **14.10:** [scripts/clean.mjs](scripts/clean.mjs) and [scripts/openapi.mjs](scripts/openapi.mjs) run CLIs through `node` without a shell, so paths with spaces work. The web `typecheck` script runs `next typegen` first, which fixes the stale `.next/dev/types` problem.
  - **14.11 (open):** `apps/api/.git` points at `github.com/AyuknyamndiICTU/api` (`master`). It has no unpushed commits; its working-tree changes are older copies of files the monorepo already tracks. Folding it in means deleting `apps/api/.git` and archiving the old remote — waiting for the team's go-ahead.

---

## Phase 15 — Project size diet

Measured on the dev machine on 2026-10-14: **≈ 2.5 GB** in total.

| Item | Size now | Cause | Action | Target |
|---|---|---|---|---|
| `apps/web/web-ui/.next` | 1,247 MB (`.next/dev` alone 1,226 MB) | Turbopack dev cache + old builds | delete; `npm run clean` | 0 at rest |
| `apps/api/node_modules` | 351 MB | separate `apps/api/package-lock.json` → second install | delete nested lockfile + folder; install from root only | 0 |
| `apps/web/web-ui/node_modules` | 166 MB | separate `apps/web/web-ui/package-lock.json`; `prisma` wrongly in web deps (~130 MB) | delete nested lockfile + folder; remove `prisma` from web | 0 |
| Prisma copies (engines + CLI) | ~415 MB across copies | Prisma 6 Rust engines (Windows + musl), CLI in prod deps, installed twice | Prisma 7 Rust-free client (no query-engine binaries); `prisma` CLI → devDependencies; drop `binaryTargets` | ≤ 60 MB |
| root `node_modules` | 654 MB | normal + duplicates | `npm dedupe` after the steps above | ≤ 550 MB |
| `node_modules/.cache` (root + api) | ~75 MB | tool caches | part of `clean` | 0 |
| `apps/api/tmp` | 40 MB (66 files) | uploads written to disk and committed | 10.8 + 13.6 | 0 |
| `pdf-parse` | 27 MB | unmaintained v1 with bundled test files | switch to `unpdf` | a few MB |
| `agora-rtc-sdk-ng` | 4.9 MB | proprietary video SDK | replace with `livekit-client` (Phase 17) | — |
| `minio` client | 2.3 MB | MinIO-specific SDK | replace with `aws4fetch` (tiny SigV4 signer, Phase 18) | < 0.1 MB |
| `logo/` | 5.5 MB | 2.8 MB PNG + `TEST.paint` / `TEST.png` | optimized WebP/PNG (≤ 150 KB), delete TEST files | ≤ 0.2 MB |
| `apps/api/.git` | 4.6 MB | nested repository | 14.11 | 0 |

Overall targets:
- Source checkout without `node_modules`: **≤ 25 MB**
- Working tree after a fresh `npm ci`: **≤ 700 MB** (from ≈ 2.5 GB)
- Docker images: web **≤ 200 MB**, API **≤ 300 MB**
- VPS RAM at idle (api + web + postgres + redis; storage, video and AI in the cloud): **≤ 1.5 GB**

Steps:
- [x] **15.1** Add a cross-platform `clean` script; delete `.next`, `dist` and caches; extend the root [.gitignore](.gitignore) (today only `node_modules` and `.env*`) with `.next/`, `dist/`, `tmp/`, `coverage/`, `*.log`.
- [x] **15.2** One lockfile: delete `apps/api/package-lock.json`, `apps/web/web-ui/package-lock.json` and their `node_modules`; `npm install` at the root; `npm dedupe`; commit only the root lockfile.
- [x] **15.3** Remove `prisma` from [apps/web/web-ui/package.json](apps/web/web-ui/package.json).
- [x] **15.4** Upgrade to Prisma 7 (Rust-free): `@prisma/client`, `prisma`, `@prisma/adapter-pg` on the same 7.x; follow the Prisma 7 upgrade guide for the generator; remove `binaryTargets` and the Windows-engine cleanup line from the Dockerfile; regenerate and run e2e.
- [x] **15.5** Replace `pdf-parse` with `unpdf`; keep `mammoth` for DOCX, lazy-imported inside the worker.
- [x] **15.6** Optimize logo assets and serve them with `next/image`; delete `logo/TEST.*`.
- [x] **15.7** Run `npx depcheck` in both workspaces and remove unused packages; move `@types/*` from `dependencies` to `devDependencies` in the API.
- [ ] **15.8** Optional: switch to pnpm (content-addressable store, hard-linked `node_modules`) for further disk savings — only if the team agrees to change package manager.
- [x] **15.9** Record before/after: folder sizes, `docker image ls`, idle `docker stats`.
- Status (2026-10-20):

  | Measure | Before | After | Target |
  |---|---|---|---|
  | Working tree total | 3,459 MB | 936 MB (896 MB after `npm run clean` removes `apps/api/tmp`) | ≤ 700 MB |
  | `apps/web/web-ui/.next` | 2,218 MB | 0 at rest | 0 |
  | root / api / web `node_modules` | 668 / 352 / 160 MB | 869 / 0 / 5 MB | ≤ 550 MB total |
  | Prisma packages (all copies) | 136 MB | 40 MB (runtime image: 10 MB) | ≤ 60 MB |
  | Tracked source files | 11.3 MB | 2.5 MB | ≤ 25 MB |
  | `logo/` | 5.5 MB | 0.1 MB | ≤ 0.2 MB |
  | API image | 792 MB | 413 MB (+ migrate image 615 MB, one-shot) | ≤ 300 MB |
  | Web image | 334 MB | 328 MB | ≤ 200 MB |
  | Idle RAM (api + web + postgres + redis) | ≈ 170 MiB | ≈ 220 MiB | ≤ 1.5 GB |

  - **15.1:**
    - `npm run clean` now also removes the tool caches and the old upload folder `apps/api/tmp`.
    - The root `.gitignore` gains `.next/`, `dist/`, `coverage/`, `*.log` and `*.tsbuildinfo`.
    - A tracked `apps/api-build.log` was deleted.
  - **15.2:**
    - The nested lockfiles and their `node_modules` are gone; everything installs from the root.
    - `npm dedupe` hung for over an hour on the dev machine and was stopped. The single install already removed the duplicate tree.
  - **15.4 Prisma 7.10.1:**
    - Generator `prisma-client` writes TypeScript into `apps/api/src/generated/prisma` (git-ignored; the API `postinstall` and the build regenerate it). All imports go through [src/prisma/client.ts](apps/api/src/prisma/client.ts).
    - `importFileExtension = ""` is needed so Jest can resolve the generated files.
    - The `url` moved to [prisma.config.ts](apps/api/prisma.config.ts). `binaryTargets` and dotenv are gone.
    - `.env` is loaded explicitly with `process.loadEnvFile`, because Prisma 7 no longer loads it.
    - `pg` connect timeout is 5 s, matching Prisma 6.
  - **15.4 Prisma CLI out of the runtime:**
    - The CLI (with Studio, a PGlite dev server and TypeScript, ~200 MB) is a devDependency.
    - Migrations run from a separate image, `apps/api/Dockerfile --target migrate`, used by Compose, the k8s Job (`cn-migrate`) and Jenkins.
    - The runtime installs with `--omit=dev --omit=optional`. Those packages are "devOptional" (also optional peers of `@prisma/client`), so `--omit=dev` alone keeps them.
    - The runtime image keeps only the PostgreSQL query compiler.
  - **15.5:**
    - `unpdf` replaces `pdf-parse` and is lazy-loaded as ESM from the CommonJS build. It was verified on a generated PDF and inside the container.
    - `mammoth` stays for DOCX.
  - **15.6:**
    - Logos were resized to 512 px for the web (79 KB, was 2.8 MB) and 600 px for the report (102 KB). Pages already use `next/image`.
    - `logo/TEST.*` and the unused `next.svg` / `vercel.svg` were deleted.
  - **15.7 depcheck:**
    - Removed: `swagger-ui-express` (`@nestjs/swagger` bundles `swagger-ui-dist`), `@eslint/eslintrc`, `ts-loader`, `pdf-parse`, `dotenv`, and `prisma` from the web app.
    - `@types/*` moved to devDependencies.
    - `@nestjs/websockets`, `socket.io` and `@jest/globals` are now declared explicitly.
  - **Targets not met:**
    - Web image: `node:24-alpine` is ~165 MB on its own (the Node binary is 126 MB) and the app layer is only 61 MB, so 200 MB isn't reachable with this base.
    - API image: the same base plus 134 MB of production dependencies.
    - Working tree: about 280 MB of the root `node_modules` is Next itself (`next` plus its native SWC compiler).
    - Remaining options: pnpm (15.8), or a distroless/`alpine`-plus-node-binary base (saves only ~24 MB).
  - **Verification:**
    - API: typecheck, lint, 23 unit tests and 126/126 e2e tests pass. Web: typecheck, lint and tests pass.
    - The OpenAPI-generated types are unchanged.
    - Compose stack: migrate container (Prisma 7 CLI) succeeds; auth smoke test 24/24; live AI stream works; job search and `/api/docs` respond.
    - One migrate run hit a transient P1001 (database unreachable) and passed on rerun.

---

## Phase 16 — CV scanning without AI (text extraction + OCR + rule-based parser)

**Goal:** uploading a CV fills the profile with **zero AI tokens** in the normal case; AI is used only when the user explicitly asks.

Why not "just Tesseract":
- Most CVs are digital PDF/DOCX files that already contain exact text. Reading that text layer is instant and more accurate than any OCR, so OCR is only needed for scanned PDFs and photos.
- OCR only produces raw text. Turning text into education, experience and skills needs a parser — that is the part that replaces the AI.

OCR engines compared:
| Engine | License | Accuracy | Footprint | Decision |
|---|---|---|---|---|
| **Tesseract 5 via `tesseract.js`** (WebAssembly) | Apache-2.0 | good on clean scans and printed text; weaker on phone photos and complex layouts | a few MB per language model (`eng`, `fra`), downloaded once and cached by the browser | **Chosen** — runs in the user's browser: 0 server RAM, 0 tokens |
| Tesseract native (`tesseract-ocr` Alpine package) | Apache-2.0 | same | adds tens of MB to the worker image | server fallback behind a flag |
| PaddleOCR (PP-OCRv5) | Apache-2.0 | clearly better on photos, skewed and multi-column pages | Python + PaddlePaddle runtime, large image, high RAM while running | optional separate service later, only if Tesseract quality proves insufficient |
| docTR / Surya / Docling | various | strong layout analysis | PyTorch-based, heavy | not suitable for the 8 GB VPS |

Parsing pipeline:
| Step | Tool / method | Runs in | AI tokens |
|---|---|---|---|
| 1. File check | magic bytes (11.8) | API | 0 |
| 2a. Digital PDF | `unpdf` (pdf.js) text items with position, font size and weight | API worker | 0 |
| 2b. DOCX | `mammoth.convertToHtml` (keeps headings, bold, lists) | API worker | 0 |
| 2c. Scanned PDF / photo | pdf.js page render + `tesseract.js` in a Web Worker (`eng+fra`) | user's browser | 0 |
| 3. Lines, blocks, columns | layout heuristics: font size, bold, ALL CAPS, vertical gaps, column detection | shared parser | 0 |
| 4. Sections | English + French heading dictionaries, accent-insensitive fuzzy match | shared parser | 0 |
| 5. Fields | regex + `libphonenumber-js`, date-range and degree patterns | shared parser | 0 |
| 6. Skills | dictionary match (platform skills + curated ESCO subset) with aliases | shared parser | 0 |
| 7. Review & confirm | pre-filled form with confidence per field | web | 0 |
| 8. Optional AI assist | only the low-confidence section the user picks | AI gateway | a few hundred |

- [x] **16.1 Shared parser package** — `packages/cv-parser` (pure TypeScript, no DOM or Node APIs, fully unit-tested), added to the npm workspaces; used by the API worker (authoritative) and the web app (instant preview and the OCR path).
- [x] **16.2 Text extraction** — PDF via `unpdf`, DOCX via `mammoth` (HTML output), plain text; a page with too few characters is treated as "no text layer" and routed to OCR.
- [x] **16.3 OCR in the browser** — for scanned PDFs and image CVs (allow JPG/PNG in the CV upload), render pages with pdf.js and run `tesseract.js` in a Web Worker with a progress bar; send the recognised lines and bounding boxes with the upload (treated as untrusted input and validated). Server fallback: native `tesseract` CLI in the worker image behind `CV_OCR_SERVER=true`, concurrency 1.
- [x] **16.4 Layout & sections** — group text into lines and blocks; detect two-column layouts; match headings in English and French (Education / Formation / Études, Experience / Expérience professionnelle / Parcours, Skills / Compétences, Projects / Projets, Languages / Langues, Certifications, References / Références, Summary / Profil / À propos).
- [x] **16.5 Field extractors** — name (largest, boldest top line without contact data), email, phone via `libphonenumber-js` (already in the dependency tree — declare it explicitly), LinkedIn/GitHub/portfolio links, location, date ranges (`Jan 2020 – Present`, `2019–2021`, `09/2018`, French month names, `Aujourd'hui` / `Présent`), degrees (BSc, BEng, Licence, HND, BTS, Master, MBA, PhD, Baccalauréat, GCE O/A Level), title vs. company lines, bullet points as descriptions.
- [x] **16.6 Skills** — match against the platform's job skills plus a curated subset of the free, multilingual ESCO skills taxonomy shipped as a small JSON file with aliases (`JS` → JavaScript, `Node` → Node.js); fuzzy match and de-duplicate.
- [x] **16.7 Review & confirm** — every parsed field carries a confidence score and its source line; the CV page shows a pre-filled form with low-confidence fields highlighted; nothing is saved until the user confirms; entries matching existing education/experience are merged, not duplicated.
- [x] **16.8 AI only on request** — remove automatic AI extraction from [cv-scan-worker.service.ts](apps/api/src/cv-scan/worker/cv-scan-worker.service.ts); an "Improve with AI" button on a low-confidence section sends only that section's text through the gateway (`cv-assist` task, the user's own key if set, PII redacted per 12.10, cached by file hash). Global switch `CV_AI_ASSIST_ENABLED`.
- [x] **16.9 Accuracy test set** — 30–50 anonymised CVs (English + French; one and two columns; DOCX; scanned; phone photo) with expected JSON; CI reports field-level precision/recall. Targets: contact fields ≥ 95 %, education/experience entries ≥ 85 %, skills ≥ 80 %.
- Note: OpenResume's published parser algorithm (line-feature scoring) is a good reference, but its code is AGPL-3.0 — write our own implementation instead of copying it.
- Done when: a typical digital CV fills the profile in under 1 s with 0 AI tokens; a scanned CV is OCR'd in the browser with no server load; AI runs only when the user clicks "Improve with AI".
- **Status (done):**
    - `packages/cv-parser` (`@career-navigator/cv-parser`, CommonJS build in `dist`, built on `npm install`): layout (rows, two-column gutter detection), DOCX HTML, EN/FR headings (exact + fuzzy, inline `Label:` headings), dates, contact (`libphonenumber-js`, default country `CV_DEFAULT_PHONE_COUNTRY`, CM), entries (date-first layouts, wrapped bullets), skills (curated dictionary with aliases + the platform's job skills; not ESCO — ESCO can be imported into `skills-data.ts` later), OCR helpers. Every field carries a confidence and its source line. Written from scratch (no OpenResume code).
    - API: `CvTextExtractor` returns pdf.js items with position, size and bold (fonts read from `commonObjs`), mammoth HTML for DOCX, or the image. `CvScanProcessor` (worker and inline OCR path) parses and stores `{legacy fields, parsed, fileSha256, parserVersion, ocr}` in `cvExtractedText` (job matching still reads `skills`); **no AI and no profile writes** in the worker. Scans without a text layer fail with a "use the CV page" message, or go to `CvServerOcr` (`tesseract`/`pdftoppm` CLIs, one file at a time, 60 s timeout) when `CV_OCR_SERVER=true` (API image build arg `WITH_OCR=true`; compose passes it from `CV_OCR_SERVER`).
    - Upload accepts JPG/PNG CVs and an optional `ocr` field (browser words; validated by `validateOcrWords`, max 15 000 words / 10 pages / 3 MB, invalid → 400 before storing). `GET upload/cv/status` adds `review`, `confirmedAt`, `fileName`, `aiAssistAvailable`. `POST upload/cv/confirm` (validated DTO) merges into Profile/Education/WorkExperience: matching entries (same organisation + same title or start year, accent/case-insensitive) only get empty fields filled, new ones are added, nothing is deleted, other `cvWizardData` keys are kept; sets `UploadMedia.cvConfirmedAt` (migration `20261021000000_cv_review`). `POST upload/cv/assist {section}` sends only that section's stored text, PII-redacted, through the `cv-assist` gateway task, cached by file hash + section; the model output is sanitised to the expected fields. `CV_AI_ASSIST_ENABLED` (default true) also appears as `cvAiAssistEnabled` in `GET /api/config/public`.
    - Web `/profile/cv`: checks the file in the browser (`lib/cv-ocr.ts`: unpdf text-layer check, pdf.js page render, `tesseract.js` eng+fra with progress and cancel), then a review form with confidence badges, highlighted low-confidence fields with their source line, include/exclude per entry, and "Improve with AI" on sections below 0.8 confidence. Old (pre-16) scans ask for a re-upload.
    - Accuracy (`npm run accuracy -w @career-navigator/cv-parser`, also part of `npm test`): 150 cases = 10 synthetic EN/FR personas × text/HTML/PDF/two-column PDF/OCR renderings × 3 layouts. Contact 100 %, education 100 %, experience 99 %, skills 100 % — all targets met. **Follow-up for the team:** add real anonymised CVs (scans, phone photos) to `test/fixtures`; synthetic data cannot show how noisy real OCR is.
    - Tests: parser 20 (node:test), API unit 25 (incl. a real generated PDF through `pdfToItems` + parser; API `npm test` now runs Jest with `--experimental-vm-modules` for the ESM-only unpdf), API e2e 134 (OCR upload, invalid OCR, review status, merge-confirm, validation, assist cache key/redaction, assist switch). Dockerfiles copy and build `packages/cv-parser` before the apps.

---

## Phase 17 — Video calls: free and open source (replace Agora)

Options (checked 2026-10-14):
| Option | Free allowance | Quality | Load on our server | Notes |
|---|---|---|---|---|
| Agora (current) | 10,000 combined RTC minutes / month, then from $0.59 per 1,000 minutes | excellent global network | none | proprietary SDK, vendor lock-in |
| **LiveKit Cloud — Build plan** | 5,000 WebRTC participant-minutes / month, 100 concurrent connections, 50 GB downstream, no credit card | global edge network, 99.99 % uptime | none | same SDK and API as self-hosted |
| **LiveKit self-hosted** (open source, Apache-2.0) | unlimited — only VPS bandwidth | same media server as the cloud: simulcast, adaptive bitrate, built-in TURN | light (forwards streams, no transcoding); roughly 1.5–2.5 Mbps per 720p video stream | needs a UDP port range plus TCP/TLS fallback |
| Jitsi Meet self-hosted | unlimited (Apache-2.0) | good | heavy (Java videobridge + XMPP + focus) | too heavy next to everything else on 8 GB |
| Plain P2P WebRTC (Socket.IO signaling + coturn) | unlimited | good for 1:1 only | TURN relay only | most custom code, no SFU features |

**Recommendation: LiveKit.** Start on LiveKit Cloud's free Build plan (no ops, no VPS RAM). When monthly usage approaches the free minutes, point the same code at a self-hosted LiveKit server by changing three env vars (`LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`). A 30-minute 1:1 mock interview uses 60 participant-minutes → about 80 sessions/month free on the cloud plan, unlimited when self-hosted. Honest trade-off: Agora's free monthly allowance (10,000 min) is larger than LiveKit Cloud's (5,000); LiveKit wins on open source, unlimited self-hosting and no lock-in.

- [ ] **17.1 Provider-neutral video module** — replaces [agora.service.ts](apps/api/src/agora/agora.service.ts): `POST /api/video/sessions` returns `{ provider, url, token, room, expiresAt }`. LiveKit access tokens are HS256 JWTs with a `video` grant — mint them with the existing `jsonwebtoken` dependency or `livekit-server-sdk`. Random room names; only the conversation participants or the booked mentor/mentee get a token; TTL about 2 h.
- [ ] **17.2 Frontend** — replace `agora-rtc-sdk-ng` with `livekit-client` loaded via `next/dynamic` (optionally `@livekit/components-react` for prebuilt UI): camera/mic toggles, screen share, device picker, pre-join preview, connection-quality indicator, auto-reconnect.
- [ ] **17.3 Self-host profile (when needed)** — `livekit/livekit-server` service in prod Compose (`livekit.yaml` with keys from env, `mem_limit` 512 MB); signaling WebSocket through the reverse proxy at `/rtc`; open UDP 50000–60000 and TCP 7881; built-in TURN on 443/TLS for restrictive networks. On Kubernetes prefer LiveKit Cloud (UDP + host networking is complex).
- [ ] **17.4 Webhooks & usage** — verify LiveKit webhook signatures; record participant join/leave in `VideoSession` (add `provider`, `participantMinutes`); admin card "video minutes this month vs. free allowance" with an alert at 80 %.
- [ ] **17.5 Remove Agora** — [VideoCallClient.tsx](apps/web/web-ui/src/components/agora/VideoCallClient.tsx), the `agora` API module, `AGORA_*` and `NEXT_PUBLIC_AGORA_APP_ID` in the env examples, both Compose files and [api-deployment.yaml](infra/k8s/api-deployment.yaml).
- [ ] **17.6 Tests** — tokens are room-scoped (cannot join another room); expired tokens are rejected; webhook signature check; two-participant join smoke test.
- Done when: two users hold a 30-minute 720p call; no Agora code or package remains; video costs $0 at current usage.

---

## Phase 18 — File storage: free S3-compatible storage (replace MinIO)

**Problem:** MinIO's community repository was archived on 2026-04-25 and is no longer maintained; community builds are source-only, so the `minio/minio:latest` image in both Compose files receives no security fixes. On the VPS it also costs RAM and disk.

Options (checked 2026-10-14):
| Option | Free allowance | Notes |
|---|---|---|
| **Cloudflare R2** (recommended for production) | 10 GB-month storage, 1 M Class A operations (writes/lists) and 10 M Class B operations (reads) per month; **egress is free** | S3-compatible API and presigned URLs; managed durability; nothing runs on the VPS |
| Garage (self-hosted, Rust, AGPL-3.0, run unmodified as a separate service) | unlimited (your disk) | lightweight S3-compatible store built for small self-hosting; ideal for local dev and offline setups |
| SeaweedFS (self-hosted, Apache-2.0) | unlimited | S3 gateway; heavier but scales out |
| MinIO community | — | archived — do not use |

Capacity: a CV (~1 MB) plus a profile photo resized to ~100 KB means the 10 GB free tier holds files for roughly 9,000 users.

- [ ] **18.1 Storage module** — `ObjectStorage` interface (`put`, `getStream`, `head`, `delete`, `presignGet`) with one S3 implementation using `aws4fetch` (tiny SigV4 signer over `fetch`; works with R2, Garage and any S3 API) — or `@aws-sdk/client-s3` if richer features are ever needed (much larger). Remove the `minio` package from [upload.service.ts](apps/api/src/upload/upload.service.ts) and [cv-scan-worker.service.ts](apps/api/src/cv-scan/worker/cv-scan-worker.service.ts). Env: `S3_ENDPOINT`, `S3_REGION` (`auto` for R2), `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE`.
- [ ] **18.2 Private bucket, presigned downloads** — after an ownership check, return a short-lived presigned GET URL (~5 min) instead of streaming file bytes through the API; object keys `users/{userId}/{uuid}.{ext}`.
- [ ] **18.3 Smaller files** — resize profile pictures in the browser (canvas → WebP, 512 px, ~50–100 KB) before upload; the server still validates type and size (11.8).
- [ ] **18.4 Lifecycle job** (BullMQ, nightly) — keep the latest 3 CV versions per user, delete orphaned objects; delete all of a user's objects when the account is deleted.
- [ ] **18.5 Migration** — copy existing MinIO objects to R2 with `rclone sync` (or Cloudflare Super Slurper — free, only Class A operations billed), verify object counts and checksums, then switch env vars.
- [ ] **18.6 Environments** — production on R2; local Compose on a single-node Garage container plus an init script that creates the bucket and keys; remove the `minio` service and `cn-minio` volume from both Compose files.
- [ ] **18.7 Tests** — storage contract tests run in CI against the local S3 container.
- Done when: no MinIO image or package remains; uploads and downloads work on R2 in production and Garage locally by changing env vars only; storage stays within the R2 free tier at current usage.

---

## Phase 19 — Execution order & definition of done

Order (respects dependencies):
1. 10.1, 10.4, 10.5, 10.6, 10.8 — small, isolated fixes
2. 15.1–15.3 quick disk wins → 15.4 Prisma 7 together with 10.9 and the 10.2 migration baseline
3. 11.1 config → 11.2 auth guard → 11.3 health → 11.4 logging
4. Phase 18 storage on R2/Garage together with 13.6 uploads (MinIO is unmaintained)
5. Phase 12 AI gateway (12.1–12.4 first, with 12.18 metering built in), then streaming, caching, quotas, then BYOK + live usage (12.14–12.24)
6. Phase 16 CV scanning without AI (removes the biggest automatic AI consumer)
7. 13.1–13.4 Docker/VPS fit
8. 10.3 + 14.1 same-origin → 10.10 httpOnly cookies → 14.2 typed client
9. Phase 17 LiveKit video
10. 10.7 secret rotation + 14.7 Jenkins + 14.6 Kubernetes
11. Remaining P2/P3 items

Definition of done:
- [ ] `npm run lint`, `npm run typecheck` and `npm test` pass at the root; e2e passes in CI
- [ ] No `@ts-nocheck`, no `process.env` outside the config module, no hard-coded secrets or hosts
- [ ] Fresh clone → `npm ci` → `docker compose up` works on Windows, macOS and Linux with only `.env` files filled in
- [ ] Phase 15 size targets met and recorded
- [ ] AI works with only `GEMINI_API_KEY` set; every additional key only adds fallbacks
- [ ] Users can add and remove their own AI key; their token and cost usage is shown live and matches provider-reported usage
- [ ] Uploading a CV fills the profile with zero AI tokens by default; AI runs only on explicit request
- [ ] Video calls run on LiveKit; no Agora code or package remains
- [ ] Files live on R2 (production) / Garage (local); no MinIO image or package remains

---

## UI/Theming Notes (from screenshots)
Use these references as style guide:

- **Layout:** left sidebar + top bar + card-based dashboards (consistent spacing/alignment across pages)
- **Modern Dashboard Styling:** clean white surfaces, soft indigo primary colors (`#5B5FC7`), rounded corners (2xl), and subtle soft drop shadows. **Avoid brutalist hard borders.**
- **Typography:** clean sans-serif (Inter), strong hierarchy for headings; clean form inputs.
- **Motion:** Framer Motion for page transitions + soft hover interactions (e.g., cards floating up slightly on hover).
- **Responsiveness:** fluid layouts that collapse cleanly to mobile view (sidebar turns into hamburger menu overlay).

Logo usage:
- Brand header/sidebar: `logo/logo.png`
- Authentication screens header/footer: `logo/logo.png`
