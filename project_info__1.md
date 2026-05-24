# Career Navigator Web — Codebase Overview (Explore Mode Index)

## Summary
This is a **monorepo** containing:
- **NestJS API** (`apps/api`) with Prisma/Postgres persistence, Redis-backed realtime messaging, background workers (CV scan, notifications), and an **AI assistant** using **Gemini** (`POST /ai/chat`, `POST /ai/mock-interview`, `POST /ai/course-recommendations`).
- **Next.js web UI** (`apps/web/web-ui`) implementing authenticated user flows (AI chat, jobs, mentors, resume/CV, profile) and an admin KPI dashboard.

Two key behaviors in this codebase explain the earlier “AI Chats not updating in real time” and “AI service at capacity” user experience:
1) The **dashboard KPI** “AI Chats” is computed server-side from the database (Prisma `Message` count), and the dashboard page originally fetched it only once.
2) The AI chat endpoint must **persist** successful exchanges into `Conversation`/`Message` for that KPI to increase.

## Architecture

### High-level pattern
Layered backend (NestJS modules) + REST APIs + Prisma persistence + (optional) WebSockets for realtime conversations, with background processing via BullMQ workers.

### Major subsystems
1) **Authentication & RBAC**
- JWT access/refresh handling lives under `apps/api/src/auth/**`.
- Admin endpoints are protected by `RolesGuard` + `@Roles()`.

2) **Core domain persistence (Prisma)**
- Prisma schema defines: `User`, `Conversation`, `ConversationParticipant`, `Message`, job/mentor-related models, CV upload media and CV scan status, etc.
- Backend services read/write those models directly using Prisma client.

3) **Realtime messaging**
- A Socket.IO gateway (`MessagingGateway`) broadcasts conversation message events and typing events.
- Redis pub/sub is used to scale sockets via `RedisIoAdapter`.

4) **AI assistant (Gemini)**
- `AiController` exposes AI endpoints under `/ai/*`.
- `AiService` implements:
  - Gemini generation with retry/backoff
  - career-skill restriction logic (“allowed skills”)
  - (optional) persistence of successful AI interactions into `Conversation`/`Message`

5) **Background workers**
- CV scan is orchestrated by `CvScanService` + `CvScanWorkerService`.
- Worker uses `CV_SCAN_ENABLED` to decide whether it runs; if enabled it currently uses **Ollama** for structured CV extraction.

6) **Admin analytics / KPI**
- `GET /admin/analytics/dashboard` returns counters:
  - `activeJobs`, `totalMentors`, `aiChats`, `totalUsers`
- `aiChats` is currently a **proxy**: it is computed as `prisma.message.count()`.

### Execution start / entry points
- **API** entry: `apps/api/src/main.ts`
  - Configures CORS, helmet, express-rate-limit, swagger docs, websocket adapter (Redis) when `REDIS_URL` exists.
- **AI endpoints** entry: `apps/api/src/ai/ai.controller.ts`
- **Admin analytics** entry: `apps/api/src/admin/admin.controller.ts`

## Directory Structure (annotated)

```
project-root/
├─ apps/
│  ├─ api/
│  │  ├─ src/
│  │  │  ├─ ai/
│  │  │  │  ├─ ai.controller.ts         — HTTP handlers for /ai/*
│  │  │  │  ├─ ai.service.ts           — Gemini calls, allowed-skills enforcement, persistence
│  │  │  │  └─ dto/                      — ChatRequestDto, MockInterviewRequestDto, CourseRecommendationsRequestDto
│  │  │  ├─ admin/
│  │  │  │  ├─ admin.controller.ts     — /admin routes including analytics
│  │  │  │  │  └─ admin.service.ts       — KPI queries via Prisma
│  │  │  ├─ conversations/
│  │  │  │  ├─ conversations.controller.ts
│  │  │  │  └─ conversations.service.ts — persists conversation messages + emits realtime
│  │  │  ├─ realtime/
│  │  │  │  ├─ messaging.gateway.ts  — Socket.IO event broadcasting
│  │  │  │  └─ redis-io.adapter.ts
│  │  │  ├─ cv-scan/
│  │  │  │  ├─ cv-scan.service.ts        — enqueue via BullMQ (guarded by CV_SCAN_ENABLED)
│  │  │  │  │  └─ worker/cv-scan-worker.service.ts — performs extraction (currently uses Ollama)
│  │  │  ├─ prisma/                      — PrismaService wrapper
│  │  │  └─ (other modules: jobs, mentors, resume, profile, upload, notifications, etc.)
│  │  └─ prisma/schema.prisma            — data model
│  └─ web/web-ui/
│     ├─ src/
│     │  ├─ app/
│     │  │  ├─ page.tsx                  — homepage dashboard KPI cards
│     │  │  └─ ai/chat/page.tsx          — AI chat UI
│     │  ├─ lib/auth.ts                 — apiFetch + auth token handling
│     │  └─ components/
│     │     └─ ErrorAlert.tsx
└─ infra/
   └─ docker/
      └─ docker-compose.yml            — local deployment stack (postgres, redis, api, web, minio, ollama)
```

## Key Abstractions

### AiController
- **File**: `apps/api/src/ai/ai.controller.ts`
- **Responsibility**: Exposes `/ai/chat`, `/ai/mock-interview`, `/ai/course-recommendations`.
- **Interface**:
  - `chat(dto, authorization)` → `AiService.chat(...)`
  - `mockInterview(dto, authorization)` → `AiService.mockInterview(...)`
  - `courseRecommendations(dto, authorization)` → `AiService.recommendCourses(...)`
- **Lifecycle**: Singleton provider registered in `AiModule`.

### AiService
- **File**: `apps/api/src/ai/ai.service.ts`
- **Responsibility**:
  - Calls **Gemini** (`generateWithGemini`)
  - Computes user “allowed skills” (`resolveAllowedSkills`)
  - Enforces that model output must reference allowed skills (`enforceAllowedSkillsInResponse`)
  - Persists AI chat exchanges into Prisma `Conversation`/`Message` on success (`persistAiChat`)
- **Interface**:
  - `chat(authorizationHeader, dto)` returns `{ response, allowedSkills }`
  - `mockInterview(...)` returns `{ response, allowedSkills, role, difficulty }`
  - `recommendCourses(...)` returns `{ response, allowedSkills, studentGoal }`
- **Non-obvious behaviors**:
  - “Allowed skills” is derived from DB data (CV scan or job applications) via `deriveCareerAllowedSkills`.
  - “AI service at capacity” originates from HTTP status handling in `generateWithGemini` (Gemini 429/503 → specific `BadRequestException` message).

### AdminService (KPI computation)
- **File**: `apps/api/src/admin/admin.service.ts`
- **Responsibility**: Fetches dashboard counters from Prisma.
- **Interface**:
  - `getDashboardKpis()` returns `{ activeJobs, totalMentors, aiChats, totalUsers }`
- **Important detail**: `aiChats` is computed as `this.prisma.message.count()` (a proxy for “AI chat activity”).
  - This is why AI chat UI must persist messages to DB for the KPI to change.

### ConversationsService
- **File**: `apps/api/src/conversations/conversations.service.ts`
- **Responsibility**: Persists user messages in an existing conversation and emits realtime events.
- **Interface**:
  - `sendMessage(authorizationHeader, conversationId, dto)` writes `prisma.message.create(...)` and calls `messagingGateway.emitNewMessage(...)`.

### MessagingGateway (realtime)
- **File**: `apps/api/src/realtime/messaging.gateway.ts`
- **Responsibility**: Socket.IO gateway for conversation rooms and message events.
- **Interface**:
  - `emitNewMessage(conversationId, message)` queries `ConversationParticipant` and emits `message:new` to each participant’s user room.
  - `onTyping` emits `typing` events after verifying conversation participation.

### Prisma schema models used for AI chat analytics
- **File**: `apps/api/prisma/schema.prisma`
- **Relevant models**:
  - `Conversation`
  - `ConversationParticipant`
  - `Message`

### Next.js homepage KPI cards
- **File**: `apps/web/web-ui/src/app/page.tsx`
- **Responsibility**: Renders KPI cards including “AI Chats”.
- **Key behavior**:
  - Calls `GET /admin/analytics/dashboard` and maps returned `aiChats` to the card value.
  - The page now uses **polling** (via `setInterval`) so KPI can update without a hard refresh.

### Next.js AI chat UI
- **File**: `apps/web/web-ui/src/app/ai/chat/page.tsx`
- **Responsibility**: Sends a prompt to `POST /ai/chat` and renders conversation history in React state.
- **Non-obvious behavior**:
  - The UI history is **local state**. The KPI only changes when backend persistence occurs.

## Data Flow (concrete)

### AI chat + KPI update
1) User types prompt → `apps/web/web-ui/src/app/ai/chat/page.tsx` calls:
   - `apiFetch('/ai/chat', { method: 'POST', body: { message } })`
2) Backend `apps/api/src/ai/ai.controller.ts` routes to:
   - `AiService.chat(authorization, dto)`
3) `AiService.chat`:
   - derives allowed skills from Prisma-backed user data (`deriveCareerAllowedSkills` / `resolveAllowedSkills`)
   - calls Gemini via `generateWithGemini(...)`
   - enforces allowed-skills policy (`enforceAllowedSkillsInResponse`)
   - persists successful exchanges into Prisma `Conversation` + `Message` (`persistAiChat`)
4) KPI on homepage:
   - `apps/web/web-ui/src/app/page.tsx` polls `GET /admin/analytics/dashboard`
   - `AdminService.getDashboardKpis()` computes `aiChats = prisma.message.count()`

### “AI service at capacity” error
- In `AiService.generateWithGemini`, responses with 429/503 are retried (with exponential backoff and optional `retry-after`) and then converted into user-visible `BadRequestException` messages.

### Realtime conversation messaging
1) Client sends message to `POST /conversations/:conversationId/messages`
2) `ConversationsService.sendMessage` writes `Message`
3) `MessagingGateway.emitNewMessage` broadcasts `message:new` to Socket.IO rooms

## Non-Obvious Behaviors & Design Decisions

- **“AI Chats” counter is a DB proxy, not a chat-session counter.**
  - It counts total `Message` rows. So any AI persistence strategy directly changes the KPI.
- **Allowed-skills enforcement happens in backend, not only via prompt text.**
  - The service checks the model output text for any mention of allowed skills.
  - If none match, the response is replaced with a refusal message containing the phrase **“career-path skills”**.
- **AI persistence is required for KPI accuracy.**
  - The UI-only history doesn’t affect KPI because the KPI reads from DB.
- **CV scan worker is still Ollama-based in this codebase.**
  - Even if AI chat uses Gemini, CV extraction and structured parsing are tied to `CvScanWorkerService.extractStructuredCvViaOllama` and `CV_SCAN_ENABLED`.
- **Docker composition originally starts Ollama and enables CV scanning by default.**
  - If you remove Ollama usage for AI chat but keep CV scanning enabled, startup/runs can still depend on Ollama.

## Module Reference (one-liners)

| File | Purpose |
|---|---|
| `apps/api/src/main.ts` | API bootstrap: CORS, helmet, rate limiting, swagger, websocket adapter |
| `apps/api/src/ai/ai.controller.ts` | REST entrypoints for `/ai/*` |
| `apps/api/src/ai/ai.service.ts` | Gemini integration + allowed-skills enforcement + AI persistence |
| `apps/api/src/admin/admin.service.ts` | Computes KPI counters (including `aiChats` proxy) |
| `apps/api/src/conversations/conversations.service.ts` | Persists conversation messages and triggers realtime events |
| `apps/api/src/realtime/messaging.gateway.ts` | Socket.IO room routing + emits `message:new` and typing |
| `apps/api/src/cv-scan/worker/cv-scan-worker.service.ts` | Background CV extraction using Ollama (guarded by `CV_SCAN_ENABLED`) |
| `apps/web/web-ui/src/app/page.tsx` | Dashboard KPI cards with polling (`/admin/analytics/dashboard`) |
| `apps/web/web-ui/src/app/ai/chat/page.tsx` | AI chat UI; calls `/ai/chat` and renders response |

## Suggested Reading Order
1) `apps/api/src/main.ts` — how the server is configured and protected
2) `apps/api/src/ai/ai.controller.ts` → `apps/api/src/ai/ai.service.ts` — how Gemini is called + errors + policy enforcement
3) `apps/api/src/admin/admin.service.ts` — why “AI Chats” is computed and what it actually counts
4) `apps/web/web-ui/src/app/page.tsx` — how the dashboard loads and refreshes the KPI
5) `apps/api/src/conversations/conversations.service.ts` + `apps/api/src/realtime/messaging.gateway.ts` — how messages are persisted and broadcast
6) `apps/api/src/cv-scan/worker/cv-scan-worker.service.ts` — Ollama dependency if you want to remove Ollama entirely

## Docker Compose Note (Ollama gating)
Current `infra/docker/docker-compose.yml` shows:
- `ollama` service is **always defined** and `api` has `depends_on` to it.
- `CV_SCAN_ENABLED` is set to `"true"` in `api` environment.

Because CV extraction worker still uses Ollama, “disabling Ollama” safely requires one of:
- **Option A**: Keep Ollama but start it only when CV scan is enabled (compose profiles).
- **Option B**: Disable CV scanning by default (`CV_SCAN_ENABLED=false`) so the worker doesn’t start without Ollama.
- **Option C (bigger change)**: Refactor CV scan worker to use Gemini or another model instead of Ollama.
