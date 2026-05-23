# Phase 3 — CV Upload + Scan Pipeline — Implementation Plan

> [!IMPORTANT]
> This plan is written so that **any AI or developer** can pick up at any step and continue.

---

## Research Summary

After auditing the entire codebase, here is the current state of Phase 3:

### What already works (backend)
| Component | Status | File |
|-----------|--------|------|
| `POST /upload/cv` endpoint | ✅ Exists | [upload.controller.ts](file:///c:/Career%20Navigator%20web/apps/api/src/upload/upload.controller.ts#L58-L86) |
| MinIO upload logic | ✅ Exists | [upload.service.ts:80-136](file:///c:/Career%20Navigator%20web/apps/api/src/upload/upload.service.ts#L80-L136) |
| DB save (objectKey in `uploadMedia`) | ✅ Exists | [upload.service.ts:193-212](file:///c:/Career%20Navigator%20web/apps/api/src/upload/upload.service.ts#L193-L212) |
| BullMQ enqueue after CV upload | ✅ Exists | [upload.service.ts:214-218](file:///c:/Career%20Navigator%20web/apps/api/src/upload/upload.service.ts#L214-L218) |
| CvScanService (queue producer) | ✅ Exists | [cv-scan.service.ts](file:///c:/Career%20Navigator%20web/apps/api/src/cv-scan/cv-scan.service.ts) |
| CvScanWorkerService (consumer) | ✅ Exists | [cv-scan-worker.service.ts](file:///c:/Career%20Navigator%20web/apps/api/src/cv-scan/worker/cv-scan-worker.service.ts) |
| Worker status transitions (PROCESSING→COMPLETED/FAILED) | ✅ Exists | [cv-scan-worker.service.ts:120-157](file:///c:/Career%20Navigator%20web/apps/api/src/cv-scan/worker/cv-scan-worker.service.ts#L120-L157) |
| Ollama structured extraction prompt | ✅ Exists | [cv-scan-worker.service.ts:203-276](file:///c:/Career%20Navigator%20web/apps/api/src/cv-scan/worker/cv-scan-worker.service.ts#L203-L276) |
| JSON parsing with `tryExtractJson` | ✅ Exists | [cv-scan-worker.service.ts:53-58](file:///c:/Career%20Navigator%20web/apps/api/src/cv-scan/worker/cv-scan-worker.service.ts#L53-L58) |
| AI skills derivation from CV | ✅ Exists | [ai.service.ts:103-146](file:///c:/Career%20Navigator%20web/apps/api/src/ai/ai.service.ts#L103-L146) |
| Sidebar RecommendedSkillsCard | ✅ Exists | [RecommendedSkillsCard.tsx](file:///c:/Career%20Navigator%20web/apps/web/web-ui/src/components/RecommendedSkillsCard.tsx) |

### What's missing or needs fixing
| Issue | Severity | Detail |
|-------|----------|--------|
| No `cvScanStatus=PENDING` on upload | 🟡 Medium | Upload service saves to DB but doesn't set initial `cvScanStatus: 'PENDING'`. Worker sets PROCESSING, but there's no PENDING transition. |
| Worker concurrency defaults to 2 | 🟡 Medium | [cv-scan-worker.service.ts:85](file:///c:/Career%20Navigator%20web/apps/api/src/cv-scan/worker/cv-scan-worker.service.ts#L85) defaults to `2`, but improve-plan requires `1`. |
| No frontend CV upload page | 🔴 Critical | There is **no UI page** to upload a CV. Users can't trigger the CV scan pipeline. |
| `apiFetch` only supports JSON | 🟠 High | The shared [apiFetch](file:///c:/Career%20Navigator%20web/apps/web/web-ui/src/lib/auth.ts#L49-L62) always sets `Content-Type: application/json` and `JSON.stringify`s the body. It can't send `multipart/form-data` needed for file uploads. |
| `tryExtractJson` fallback returns raw text | 🟡 Medium | When JSON parsing fails, it returns raw Ollama response text instead of a valid empty structure. |

---

## Proposed Changes

### Step 1 — Set `cvScanStatus: 'PENDING'` on CV upload

**File**: [upload.service.ts](file:///c:/Career%20Navigator%20web/apps/api/src/upload/upload.service.ts)

In the `uploadCv()` method, add `cvScanStatus: 'PENDING'` and `cvScanRequestedAt: new Date()` to both the `create` and `update` branches of the upsert. This ensures the DB reflects the correct initial state before the BullMQ worker picks up the job.

---

### Step 2 — Fix worker concurrency default to 1

**File**: [cv-scan-worker.service.ts](file:///c:/Career%20Navigator%20web/apps/api/src/cv-scan/worker/cv-scan-worker.service.ts)

Change line 85 default from `'2'` to `'1'` to match the improve-plan requirement (`CV_SCAN_WORKER_CONCURRENCY=1`).

---

### Step 3 — Improve `tryExtractJson` fallback

**File**: [cv-scan-worker.service.ts](file:///c:/Career%20Navigator%20web/apps/api/src/cv-scan/worker/cv-scan-worker.service.ts)

When JSON.parse fails at [line 270-275](file:///c:/Career%20Navigator%20web/apps/api/src/cv-scan/worker/cv-scan-worker.service.ts#L270-L275), return a valid empty-structured JSON string instead of raw text so downstream consumers (`deriveCareerAllowedSkills`) never choke on non-JSON `cvExtractedText`.

---

### Step 4 — Add `apiFetchFile` helper for multipart uploads

**File**: [auth.ts](file:///c:/Career%20Navigator%20web/apps/web/web-ui/src/lib/auth.ts)

Add a new `apiFetchFile()` function that sends `FormData` with auth headers (no Content-Type override — the browser sets the multipart boundary automatically).

---

### Step 5 — Create frontend CV upload page with scan status

**New file**: `apps/web/web-ui/src/app/profile/cv/page.tsx`

A page at `/profile/cv` that:
- Has a file input accepting `.pdf` files
- Uploads via `POST /upload/cv` using `apiFetchFile`
- Shows upload status (success/error)
- Polls or fetches CV scan status from a new lightweight endpoint
- Displays extracted skills when scan completes

Also add a link to it from the Profile page.

---

### Step 6 — Add a `GET /upload/cv/status` endpoint

**File**: [upload.controller.ts](file:///c:/Career%20Navigator%20web/apps/api/src/upload/upload.controller.ts) + [upload.service.ts](file:///c:/Career%20Navigator%20web/apps/api/src/upload/upload.service.ts)

A lightweight `GET /upload/cv/status` endpoint that returns the user's current CV scan status and extracted skills. The frontend will call this to show scan progress and results.

---

### Step 7 — Update `improve-plan.md` checkboxes

Check off all Phase 3 milestone items and mark Phase 3 as complete in the progress tracker.

---

## Verification Plan

### Automated
```bash
cd c:\Career Navigator web\apps\api && npx tsc --noEmit
cd c:\Career Navigator web\apps\web\web-ui && npx tsc --noEmit
```

### Manual
- Upload a PDF CV via the new `/profile/cv` page
- Verify the file appears in MinIO
- Verify `cvScanStatus` transitions: `PENDING` → `PROCESSING` → `COMPLETED`
- Verify `cvExtractedText` contains valid JSON with a `skills` array
- Verify the sidebar RecommendedSkillsCard picks up the new skills
- Verify AI chat uses the extracted skills as allowed skills

---

## Execution Order

| Step | Priority | Status |
|------|----------|--------|
| Step 1 — Set PENDING on upload | 🟡 Medium | `[ ]` |
| Step 2 — Fix worker concurrency default | 🟡 Medium | `[ ]` |
| Step 3 — Improve tryExtractJson fallback | 🟡 Medium | `[ ]` |
| Step 4 — Add apiFetchFile helper | 🟠 High | `[ ]` |
| Step 5 — Create CV upload page | 🔴 Critical | `[ ]` |
| Step 6 — Add CV status endpoint | 🟠 High | `[ ]` |
| Step 7 — Update plan checkboxes | 🟢 Low | `[ ]` |
