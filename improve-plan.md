# improve-plan.md — VPS-Friendly Architecture (4 CPU / 8GB RAM / 128GB SSD)

## Goal
Re-arrange your stack/architecture so the app runs **reliably and smoothly on a single Contabo VPS** (4 CPU, 8GB RAM, 128GB SSD), while still supporting all features defined in `plan.md` and `new-plan.md`:
- Auth (JWT + refresh rotation + OTP verify)
- Profile CRUD + CV upload to MinIO + resume builder
- CV scan (BullMQ worker + Ollama structured extraction)
- Jobs + mentor matching + recommendations
- Career-path-only AI chat + mock interviews + course recommendations
- Realtime chat + notifications
- Agora video calling
- Admin + analytics pages
- Dashboard actions + consistent UI error handling
- Recommendations sidebar (skill/course suggestions)

---

## Phase Gates (operational “done” definition)
**Gate A — Boot Gate**
- All required services start successfully on the VPS.
- No frequent OOM kills/restarts.

**Gate B — Feature Gate**
- OTP flow works end-to-end (send + verify).
- AI chat works end-to-end (no `allowedSkills` 400).
- Dashboard icons route and render correctly.
- CV upload triggers CV scan and produces extracted structured JSON.
- Course recommendation sidebar renders without breaking layout.

**Gate C — Performance Gate**
- Under light traffic, Ollama stays responsive.
- Background jobs do not starve the API.
- Realtime chat/notifications remain stable.

---

## VPS-safe Architecture Changes (apply before Feature work)
These changes preserve your product features but reduce RAM/OOM risk.

### 1) Deployment: Kubernetes ➜ Docker Compose (single-node baseline)
- **Do not run Kubernetes on a single 8GB VPS** (overhead + scheduling complexity).
- Use Docker Compose with:
  - **API replicas = 1**
  - **Web replicas = 1**
  - **BullMQ worker = separate container**

### 2) OpenSearch: default OFF on VPS
In your current code:
- `POST /jobs/index` uses OpenSearch ingest.
- Job “reranking” currently uses **skill overlap counting** (no vector similarity).
- Mentors matching uses Postgres arrays.

So for VPS stability:
- **Disable OpenSearch by default**
- Keep OpenSearch only as an optional future enhancement (feature-flagged compose profile).

### 3) Ollama: pick small model tier and make it switchable
- Default to **`phi3:mini`** (Tier 1 stability).
- Keep model configurable via `OLLAMA_MODEL`.
- Avoid large models on 8GB unless you’ve validated memory behavior.

### 4) BullMQ: concurrency caps for CV scan
- Set `CV_SCAN_WORKER_CONCURRENCY` to **1** initially.
- Keep CV scans from running in parallel until stability is proven.

### 5) Brevo charges: OTP must be log-only by default
Your code only calls Brevo when `OTP_EMAIL_LOG_ONLY !== 'true'`.
So for “no unexpected bills”:
- Set `OTP_EMAIL_LOG_ONLY=true` in production unless you explicitly want email delivery charges.

### 6) Agora: token minting is local; streaming is usage-billed
Your backend token minting is local, but actual RTC usage can cost money.
Treat Agora video as “works when configured”, but costs depend on Agora usage/plan.

---

## Step-by-step Phases & Milestones (with “no brief hiccups” gates)

### Phase 0 — Production Baseline (Infrastructure first, no app logic yet)
**Milestone 0.1 — Compose-first production stack**
- [x] Create/confirm a single-node `docker-compose.yml` for:
  - postgres, redis, minio, ollama, api, web, bullmq worker
- [x] Ensure api/web are **replica=1**
- [x] BullMQ CV scan worker runs as a **separate container** (Phase 0 requirement)

**Milestone 0.2 — Optional OpenSearch wiring**
- [x] Make OpenSearch disabled by default in compose
- [x] Add a clear “enable OpenSearch” option (compose profile or env feature flag)

**Milestone 0.3 — Resource safety defaults**
- [x] Set `OTP_EMAIL_LOG_ONLY=true` in prod
- [x] Set `CV_SCAN_WORKER_CONCURRENCY=1`
- [x] Set `OLLAMA_MODEL=phi3:mini` (or smallest stable model you test)

**Milestone 0.4 — Swap safety (VPS ops)**
- [x] Add swap file sized for your SSD endurance (e.g., 4–8GB)

**Exit criteria for Phase 0**
- Gate A is satisfied: services boot cleanly; no immediate OOM/restarts.

---

### Phase 1 — Auth + OTP Flow (stability before AI/UI)
**Milestone 1.1 — OTP send works**
- [x] Confirm frontend hits the correct backend OTP-send route
- [x] Confirm OTP is persisted and expiration is correct
- [x] Confirm Brevo is not used when `OTP_EMAIL_LOG_ONLY=true`

**Milestone 1.2 — OTP verify works**
- [x] Confirm frontend verify UI sends DTO in the correct shape
- [x] Verify correct OTP => account activates
- [x] Wrong OTP => clear error message

**Milestone 1.3 — Refresh rotation works**
- [x] Confirm refresh endpoint works and invalid tokens are handled gracefully

**Exit criteria for Phase 1**
- OTP end-to-end works reliably
- Gate B is partially satisfied for auth (no blocking 400/500s).

---

### Phase 2 — AI Chat Contract + Career-path-only Policy
**Milestone 2.1 — Fix `allowedSkills` schema mismatch**
- [x] Inspect `ChatRequestDto` expectations in backend
- [x] Inspect frontend payload builder for AI chat requests
- [x] Align both so `allowedSkills` is always valid (type + shape)

**Milestone 2.2 — Enforce career-path-only behavior**
- [x] Verify assistant refuses out-of-scope content per your guard logic
- [x] Verify allowed responses actually align to allowed skills

**Milestone 2.3 — Mock interview + course recommendations**
- [x] Confirm `/ai/mock-interview` works without validation errors
- [x] Confirm `/ai/course-recommendations` works and returns consistent structure

**Exit criteria for Phase 2**
- AI chat returns 200 (no `allowedSkills` 400)
- AI endpoints respond consistently
- Gate B continues to be satisfied.

---

### Phase 3 — CV Upload + Scan Pipeline (Media + Jobs + Ollama structured extraction)
**Milestone 3.1 — MinIO upload works**
- [x] Confirm CV upload endpoint writes to MinIO
- [x] Confirm uploaded objectKey is saved in DB

**Milestone 3.2 — BullMQ CV scan orchestration**
- [x] Confirm enqueue happens
- [x] Confirm worker runs (`CV_SCAN_ENABLED=true` if used)
- [x] Confirm worker updates `cvScanStatus` transitions correctly

**Milestone 3.3 — Ollama extraction produces valid structured JSON**
- [x] Confirm structured extraction is stored in `cvExtractedText`
- [x] Confirm JSON parsing strategy doesn’t break if model returns extra text

**Milestone 3.4 — Sidebar data plumbing**
- [x] Ensure extracted skills feed into:
  - AI allowed skills derivation
  - recommendations sidebar content

**Exit criteria for Phase 3**
- CV upload => scan => stored structured output => UI recommendations update
- Gate B is satisfied for CV-related features.

---

### Phase 4 — Jobs + Mentors + Recommendations (functional without OpenSearch)
**Milestone 4.1 — Jobs browse & apply**
- [ ] Confirm filters/search/pagination work
- [ ] Confirm apply endpoint works and prevents double-applications

**Milestone 4.2 — Mentors matching**
- [ ] Confirm mentor search works based on skill/expertise arrays

**Milestone 4.3 — Reranking + notifications**
- [ ] Confirm rerank returns ranked items
- [ ] Confirm notifications are created for matches

**Milestone 4.4 — Recommendations sidebar (offline-safe)**
- [ ] Ensure course recommendations are generated via Ollama offline
- [ ] Confirm provider names are “suggested”, not fetched from remote APIs
  - (unless you implement a future curated course DB / integrations)

**Exit criteria for Phase 4**
- Jobs + mentor matching + notifications work end-to-end
- Recommendations sidebar renders correctly
- Gate B is satisfied.

---

### Phase 5 — Realtime Chat + Notifications UX
**Milestone 5.1 — Socket.IO basic reliability**
- [ ] Confirm typing/online/offline events do not crash under load
- [ ] Confirm message send works with REST fallback and/or history loading

**Milestone 5.2 — Notifications lifecycle**
- [ ] Confirm notifications CRUD
- [ ] Confirm “mark read” works and UI updates immediately

**Milestone 5.3 — Error UX consistency**
- [ ] Add a shared UI error presentation pattern (toast/modal/banner)

**Exit criteria for Phase 5**
- Realtime chat works
- Notifications work with clear user-visible errors
- Gate C is moving toward satisfied.

---

### Phase 6 — Agora Video Calling (feature-complete, costs acknowledged)
**Milestone 6.1 — Token mint + session lifecycle**
- [ ] Start/join/end flows work
- [ ] Store session metadata (if enabled) without errors

**Milestone 6.2 — UI integration**
- [ ] Confirm video UI doesn’t break dashboard layout
- [ ] Confirm responsive behavior (mobile widths at least partially)

**Milestone 6.3 — Production safety checks**
- [ ] Confirm env variables exist and token minting errors are user-visible

**Exit criteria for Phase 6**
- Video sessions are functional when Agora credentials are present
- No crashes from missing envs

---

### Phase 7 — Dashboard/Admin + RBAC + Routing
**Milestone 7.1 — Dashboard navigation correctness**
- [ ] Ensure sidebar/topbar actions route to real pages
- [ ] Ensure click handlers are attached (no overlay intercept)

**Milestone 7.2 — Admin analytics + RBAC**
- [ ] Confirm user denied access returns 403 with friendly UI message
- [ ] Confirm admin analytics route works and is protected

**Milestone 7.3 — Resilience**
- [ ] Confirm 401/403/400 errors don’t result in blank screens

**Exit criteria for Phase 7**
- All dashboard icons/buttons function and render without silent failures.

---

### Phase 8 — Verification & Hardening (prove it won’t regress)
**Milestone 8.1 — TypeScript checks**
- [ ] Run `tsc --noEmit`

**Milestone 8.2 — Build**
- [ ] API build
- [ ] Web build

**Milestone 8.3 — E2E sanity smoke**
- [ ] OTP flow: wrong OTP shows clear UI error
- [ ] AI chat: no validation/DTO errors
- [ ] CV scan: structured output saved
- [ ] Jobs rerank: creates notifications
- [ ] Recommendations sidebar: renders post-CV scan

**Milestone 8.4 — Load/memory sanity**
- [ ] Verify Ollama responsiveness during a CV scan
- [ ] Verify worker concurrency caps prevent API starvation

**Exit criteria for Phase 8**
- Gate A + Gate B + Gate C satisfied.

---

## Progress Tracker (edit as you go)
- [x] Phase 0 complete (Compose baseline + swap + safe env defaults)
- [x] Phase 1 complete (OTP + refresh rotation)
- [x] Phase 2 complete (AI contract alignment + career-path policy + other AI endpoints)
- [x] Phase 3 complete (CV upload + BullMQ + Ollama structured extraction + sidebar wiring)
- [ ] Phase 4 complete (jobs/mentors/rerank/notifications + offline-safe course sidebar)
- [ ] Phase 5 complete (realtime + notifications UX)
- [ ] Phase 6 complete (Agora session lifecycle)
- [ ] Phase 7 complete (dashboard/admin routing + RBAC)
- [ ] Phase 8 complete (typecheck/build/smoke/hardening)

---

## Notes you should keep in mind (to avoid future “brief hiccups”)
- Change deployment (K8s ➜ Compose) **before** expanding features.
- Disable OpenSearch by default until you prove memory headroom.
- Keep Ollama model small until stability is verified.
- Constrain BullMQ worker concurrency early.
- Keep OTP email log-only by default to avoid Brevo billing surprises.
