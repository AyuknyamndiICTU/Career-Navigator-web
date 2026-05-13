# Career Navigator — Project Reset Plan (from beginning)

## References
- UI reference: `Dashboard for students.jpeg`, `Skillset Dashboard.jpeg`
- Logo: `logo/logo.png`
- Source context: `project description.pdf`

## Target Tech Stack (Web + Scalable Backend)
- **Frontend (Web):** Next.js (React) + TypeScript
  - UI/branding: Tailwind-style design system (dashboard layout from screenshots)
  - Animations: **Framer Motion**
  - 3D accents: **Three.js** (via React Three Fiber), lazy-loaded
  - Realtime: Socket.IO client
  - Video: Agora Web SDK
- **Backend:** NestJS (TypeScript) + Prisma + PostgreSQL
  - API docs: **Swagger** (`/api-docs`)
  - Auth: JWT + refresh token rotation + OTP email verification
  - Search: OpenSearch + pgvector (recommendation embeddings)
  - Cache + async jobs: Redis + BullMQ
  - Object storage: MinIO (CV/resume/profile media)
  - AI runtime: self-hosted **Ollama**
- **Infra:** Docker + Kubernetes
  - Ingress + TLS (cert-manager)
  - HPA for API + realtime gateway
  - StatefulSets for Postgres/OpenSearch/MinIO, Redis deployments

---

## Milestone Status System (for tracking)
- Not started: `[ ]`
- In progress: `[/]`
- Completed: `[x]`

---

## Milestones (fresh start)
### Milestone 0 — Foundations & repo setup
- [x] 0.1 Create repo structure (web + backend + infra)
- [x] 0.2 Add tooling (lint/format/typecheck) and base TS config (added tsconfig + prettier/editorconfig + eslint config + infra skeleton)
- [x] 0.3 Add `.env.example` templates
- [x] 0.4 Initialize backend + Swagger at `/api-docs`

### Milestone 1 — Core Auth + Security
- [x] 1.1 Registration + OTP email verification
- [x] 1.2 JWT access + refresh rotation
- [x] 1.3 Password reset flow (expiring tokens)
- [x] 1.4 Soft delete / deactivation
- [x] 1.5 Theme preference persistence (dark/light)

### Milestone 2 — Profile CRUD + Resume/CV
- [x] 2.1 Personal info + Education CRUD
- [x] 2.2 Work experience CRUD
- [x] 2.3 Profile picture + CV upload to MinIO
- [x] 2.4 Resume builder (structured templates)
- [x] 2.5 CV scan orchestration (BullMQ + Ollama extraction)

### Milestone 3 — Jobs system + Mentor matching + Recommendations
- [x] 3.1 Job browse with filters + search + pagination
- [x] 3.2 Apply with cover letters
- [x] 3.3 Mentor search by skills/expertise
- [x] 3.4 Ingest job demand into OpenSearch index
- [x] 3.5 AI reranking + explanations + notifications fanout

### Milestone 4 — Realtime Chat + Notifications
- [x] 4.1 REST fallback for conversations + message history
- [x] 4.2 Socket.IO events (typing, online/offline, new messages)
- [x] 4.3 Notifications CRUD + mark read
- [x] 4.4 Worker-driven notification updates

### Milestone 5 — Career-path restricted AI Chat + Interview prep
- [x] 5.1 Enforce “career-path-only” policy
- [x] 5.2 AI chat endpoint (`/ai/chat`)
- [x] 5.3 Mock interview endpoint (`/ai/mock-interview`)
- [x] 5.4 Course recommendations mapping (Coursera/Simplilearn/edX/Udemy/Alison)

### Milestone 6 — Video calling (Agora)
- [x] 6.1 Start/join/end video sessions (token minting)
- [x] 6.2 Store session metadata (optional)
- [x] 6.3 UI integration in dashboard style

### Auth + AI + Admin UI coverage (web)
- [x] Core auth pages: login, register, verify-otp, password reset request/confirm, logout
- [x] AI chat page
- [x] Admin analytics page (engagement)

### Milestone 7 — Admin + Analytics
- [x] 7.1 Admin user management + feedback moderation
- [x] 7.2 Analytics endpoints for engagement metrics
- [x] 7.3 RBAC guard enforcement

### Milestone 8 — Docker + Kubernetes + Performance hardening
- [x] 8.1 Containerize services
- [x] 8.2 Kubernetes deployments + services + ingress/TLS
- [x] 8.3 WebSocket scaling strategy (Socket.IO + adapter)
- [x] 8.4 Rate limiting + production hardening validation

---

## Milestone 9 - Implementation Checklist (major steps)
- [x] Create directories: `/apps/web`, `/apps/api`, `/infra/docker`, `/infra/k8s`
- [x] Initialize backend with NestJS + Swagger
- [x] Add Prisma schema + migrations strategy
- [x] Implement auth flows (OTP → activate → JWT login → refresh rotation)
- [x] Implement profile CRUD + resume upload + CV scan pipeline
- [x] Implement job/mentor search + OpenSearch indexing
- [x] Implement AI recommendations and AI chat policy constraints
- [x] Implement Socket.IO chat + notifications
- [x] Implement Agora video calling token service
- [x] Add admin + analytics endpoints
- [x] Add Dockerfiles + Kubernetes manifests
- [x] Run lint/test/build and smoke test end-to-end

---

## UI/Theming Notes (from screenshots)
Use these references as style guide:

- **Layout:** left sidebar + top bar + card-based dashboards (consistent spacing/alignment across pages)
- **Brutalist cartoon styling:** bold black outlines, flat solid colors, chunky typography, and chunky drop shadows; **avoid gradients**
- **Typography:** strong hierarchy for headings; button/label text must stay readable and never clip
- **Motion:** Framer Motion for page transitions + small micro-interactions (keep animations subtle to avoid layout shift)
- **Dark/light mode:** toggle persisted in user preference (server-rendered defaults should match client state)
- **Three.js accents:** minimal decorative accents only; lazy-load so pages don’t block
- **Responsiveness:** no horizontal overflow; test at least one mobile width

Logo usage:
- Brand header/sidebar: `logo/logo.png`
- Authentication screens header/footer: `logo/logo.png`
