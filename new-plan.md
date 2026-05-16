# New Plan (Phased, Step-by-step, with Phase Gates)

Goal: Fix (1) OTP verification + email delivery, (2) AI chat 400 error (`allowedSkills` schema/typing mismatch), (3) broken dashboard/admin UI actions + missing error dialogs, and (4) ensure there’s a sidebar section that recommends skills/courses based on CV parsing—ideally backed by supported platforms (Coursera/edX/Udemy/Alison/SimpleLearn, etc.).

---

## Phase 0 — Baseline Reproduction (No code changes yet)
**Purpose:** Confirm the failures with exact request/response evidence so we can fix the root cause (not symptoms).

### Tasks
1. Identify the exact frontend endpoints used for:
   - login → “verify OTP” request
   - AI chat request that returns the `allowedSkills` 400
   - admin section gating / error handling
   - dashboard click actions (settings/notifications/messages/profile)
2. For each failure, capture:
   - request URL
   - HTTP status code
   - request body payload (especially `allowedSkills`)
   - response body `{ message, error, statusCode }` if present
3. Record the exact routes/pages involved in:
   - OTP send
   - OTP verify
   - post-login navigation
   - AI chat UI request

### Phase Gate (exit criteria)
- We can point to the exact failing backend endpoint(s) and the exact payload mismatch(s).

---

## Phase 1 — OTP Email + OTP Verify Flow (Backend first, then Frontend)
**Purpose:** Ensure OTP is actually sent to the user and verify endpoint is reachable and correct.

### Tasks
1. Backend trace:
   - Inspect `apps/api/src/auth/auth.controller.ts`
   - Inspect `apps/api/src/auth/auth.service.ts`
   - Inspect `apps/api/src/auth/dto/verify-otp.dto.ts`
   - Inspect OTP utilities: `apps/api/src/auth/otp/otp-utils.ts`
   - Inspect emailer: `apps/api/src/auth/email/brevo-emailer.ts`
   - Find where OTP is persisted (DB or cache) and how verify checks it
2. Fix likely root causes in this order:
   - Verify endpoint route mismatch (frontend calling wrong URL)
   - OTP generation logic not being triggered on login
   - Emailer not invoked / invoked without awaiting / thrown but swallowed
   - DTO validation rejecting or failing silently
   - OTP expiration or storage key mismatch
3. Frontend trace:
   - Find OTP verify UI page/component under `apps/web/web-ui/src/app/auth/*`
   - Confirm OTP verify call matches backend route and DTO shape
   - Ensure errors are surfaced (toast/modal/banner)
   - Ensure “wrong OTP” and “wrong email/password” show explicit messages

### Phase Gate (exit criteria)
- OTP send works (user receives OTP).
- OTP verify works (correct OTP succeeds, wrong OTP shows a clear UI error).
- Wrong email/password during sign-in shows a dialog/message.

---

## Phase 2 — AI Chat `allowedSkills` 400 Error (DTO contract alignment)
**Purpose:** Fix the schema mismatch causing:  
`each value in allowedSkills must be a string` and `allowedSkills must be an array`.

### Tasks
1. Backend contract:
   - Inspect `apps/api/src/ai/dto/chat-request.dto.ts`
   - Inspect `apps/api/src/ai/ai.controller.ts`
   - Inspect `apps/api/src/ai/ai.service.ts`
   - Find where `allowedSkills` is validated/used
2. Frontend request builder:
   - Locate AI chat UI under `apps/web/web-ui/src/app/ai/*`
   - Locate API client under `apps/web/web-ui/src/lib/api/*` for chat calls
   - Confirm the exact JSON being sent (pay attention to `allowedSkills` type)
3. Implement one of these fixes (whichever matches intended design):
   - Convert frontend to send `allowedSkills: string[]`
   - OR update backend DTO/validation to accept the frontend’s intended shape
4. Ensure 400 responses are displayed as user-friendly messages (not raw JSON).

### Phase Gate (exit criteria)
- AI chat returns a normal 200 response for valid input.
- No DTO validation errors from the `allowedSkills` field.

---

## Phase 3 — Broken Dashboard/Admin Actions + Missing Error Dialogs (Frontend wiring)
**Purpose:** Ensure UI interactions route correctly, don’t silently fail, and show user-visible errors.

### Tasks
1. Identify dashboard/nav/interaction components:
   - `apps/web/web-ui/src/components/DashboardLayout.tsx`
   - `apps/web/web-ui/src/components/Sidebar.tsx`
   - `apps/web/web-ui/src/components/TopBar.tsx`
2. Locate each broken action:
   - Settings button
   - Notification icon
   - Message icon
   - Profile section dropdown/menu
3. Fix systematically:
   - Verify routes exist and are linked correctly
   - Ensure click handlers are attached (no overlay/div intercept)
   - Ensure auth guard / RBAC redirects correctly
4. Error handling UX:
   - Add a single shared error-display pattern (toast/modal/banner)
   - Ensure API failures (401/403/400/500) produce visible user messages

### Phase Gate (exit criteria)
- All tested dashboard icons/buttons open the expected pages/menus.
- When access is denied (end-user tries admin), user sees a clear dialog message.

---

## Phase 4 — Course/Skill Recommendations Sidebar + Platform Integrations
**Purpose:** Confirm what external learning platforms are supported and implement a working recommendations sidebar fed by CV scanning / skill gap analysis.

### Tasks
1. Backend recommendation pipeline:
   - Inspect CV scan:
     - `apps/api/src/cv-scan/cv-scan.module.ts`
     - `apps/api/src/cv-scan/cv-scan.service.ts`
     - `apps/api/src/cv-scan/worker/cv-scan-worker.service.ts`
   - Inspect course recommendation request DTO:
     - `apps/api/src/ai/dto/course-recommendations-request.dto.ts`
   - Inspect AI/service integration:
     - `apps/api/src/ai/ai.service.ts`
2. Platform check:
   - Search codebase for integrations:
     - Coursera/edX/Udemy/Alison/SimpleLearn
     - Any “apiKey/url/oauth”, “client_id”, “webhook”, “recommendation endpoint”
3. Sidebar wiring:
   - Frontend: add/confirm a sidebar section like “Recommended Skills & Courses”
   - Ensure it calls the backend recommendation endpoint
   - Ensure recommendations render in an accessible, non-clipped layout
4. If integrations do not exist yet:
   - Implement a “pluggable provider” abstraction (so adding providers later is easy)
   - Start with whichever provider is currently available in repo or implement a generic fallback (manual curated dataset) to avoid blocking UI

### Phase Gate (exit criteria)
- Sidebar shows course/skill recommendations after CV upload/scan (or after entering target career).
- Platform integration status is explicit (either real API integration or controlled fallback).

---

## Phase 5 — Verification & Hardening (Build + Typecheck + E2E sanity)
**Purpose:** Prevent regressions and ensure everything compiles/runs.

### Tasks
1. Run TypeScript checks:
   - `tsc --noEmit` (backend + frontend)
2. Run build:
   - API build
   - Web build
3. Smoke test:
   - [ ] sign-in wrong email/password shows dialog (UI-level)
   - [x] OTP verify works (API-level)
   - [x] AI chat works without `allowedSkills` validation errors (API-level)
   - [ ] dashboard icons work at least at one viewport size (UI-level)
  - [x] Verify feature tiles are wired to real working routes (not hardcoded/dead links):
    - AI Career Chat, Job Board, Mentor Matching, Video Sessions, Resume Builder, Admin Analytics
    - Create Profile, Get Matched, Level Up
  - [x] Verify KPI counters on the dashboard/home are derived from live API response data and update over time (not static hardcoded values):
    - 500+ Active Jobs
    - 120+ Mentors
    - 10K+ AI Chats
    - 2K+ Users

### Phase Gate (exit criteria)
- No TS errors.
- Build succeeds.
- The key flows (OTP, AI chat, dashboard actions) work end-to-end.

---

## “Brief Hiccup” Avoidance Rules (How we’ll work)
- **One subsystem at a time**: OTP first, then AI DTO mismatch, then UI actions, then recommendations.
- **No UX-only changes until backend contract is confirmed** (e.g., OTP and allowedSkills must match).
- **Use exact payload snapshots** (from Phase 0) as the truth source.
- **After each fix**: verify immediately before moving to next area.

---

## Deliverables
1. Root-cause fixes committed for:
   - OTP email + verify flow
   - AI chat allowedSkills payload mismatch
   - dashboard/admin click wiring + error dialogs
2. Recommendations sidebar implemented and wired to CV/skill analysis.
3. A short “What’s supported” note listing integrated platforms vs fallback.

---

## Progress Tracker (legend)
- [x] = done
- [/] = in progress
- [ ] = not started

### Phase 0 — Baseline Reproduction
- [x] Capture OTP send/verify request+response evidence
- [x] Identify failing endpoints + payload mismatches

### Phase 1 — OTP Email + OTP Verify
- [x] Trace backend OTP send + persistence + verify logic
- [x] Trace frontend OTP verify UI call + error display
- [ ] OTP works end-to-end (wrong OTP shows UI error)

### Phase 2 — AI Chat `allowedSkills` 400
- [/] Confirm backend DTO expectations for `allowedSkills`
- [/] Confirm frontend payload shape for `allowedSkills`
- [x] Fix contract mismatch + verify chat returns 200

### Phase 3 — Dashboard/Admin UI Actions
- [x] Locate broken click handlers + missing/hidden UI routes
- [/] Implement consistent user-visible error dialogs/toasts
- [x] Messages route added (/messages) and wired from TopBar
- [x] Notifications route added (/notifications) and wired from TopBar
- [x] Verify settings/profile navigation (wired to /profile; web build ok)
- [x] Verify notifications navigation (wired to /notifications page)

### Phase 4 — Recommendations Sidebar + Platforms
- [x] Check codebase for Coursera/edX/Udemy/Alison/SimpleLearn integrations
- [x] Wire recommendations sidebar to recommendation endpoint
- [/] Validate sidebar displays recommendations post-CV scan

### Phase 5 — Verification & Hardening
- [x] Run `tsc --noEmit` (API + Web)
- [x] Run builds (API + Web)
- [x] Smoke-test OTP, login errors, AI chat, and dashboard actions
- [ ] sign-in wrong email/password shows dialog (UI-level)
- [ ] dashboard icons work at least at one viewport size (UI-level)
- [ ] Verify feature tiles are wired to real working routes (not hardcoded/dead links):
  - [ ] AI chat
  - [ ] CV scan
  - [ ] Recommendations
  - [ ] Messages
  - [ ] Notifications
- [ ]  Verify KPI counters on the dashboard/home are derived from live API response data and update over time (not static hardcoded values):
  - [ ] Jobs applied
  - [ ] Jobs saved
  - [ ] Courses completed
  - [ ] 2K+ Users
  - [ ] 10K+ AI Chats
  - [ ] 120+ Mentors
  - [ ] 500+ Active Jobs
