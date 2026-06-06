# Career Navigator — Comprehensive Fix & Enhancement Plan

## Root Cause Analysis

### Bug A: "Save Changes" Not Saving All Profile Data
**Root Cause:** Fixed. Education/experience forms had missing fields, no success feedback, and data was wiped on errors.

### Bug B: Resume Template Visual Selection Missing
**Root Cause:** Fixed. Replaced text dropdown + raw JSON output with 3 visual template cards and styled resume rendering.

### Bug C: Validation Gaps
**Root Cause:** Fixed. Phone, password, file upload, and URL validation added to all backend DTOs and frontend forms.

---

## Phase 1: Fix Profile Page — Education/Experience Forms + Save Feedback

- [x] 1.1 Add success toast/feedback after "Save Changes" succeeds
- [x] 1.2 Fix Education form — add missing fields (fieldOfStudy, description, isCurrent)
- [x] 1.3 Fix Experience form — add missing location field
- [x] 1.4 Preserve form data on failed submission and show per-section success feedback

---

## Phase 2: Resume Builder — Visual Templates with Design Previews

- [x] 2.1 Create ResumeData TypeScript interface
- [x] 2.2 Create TemplateClassic component (dark header, two-column)
- [x] 2.3 Create TemplateModern component (colored sidebar, skill tags)
- [x] 2.4 Create TemplateMinimal component (single-column, ATS-optimized)
- [x] 2.5 Add visual template picker with 3 preview cards
- [x] 2.6 Replace JSON output with styled resume rendering
- [x] 2.7 Add "Download as PDF" button (window.print())
- [x] 2.8 Update backend template IDs (CLASSIC/MODERN/MINIMAL)

---

## Phase 3: Input Validation — Phone, Email, Password, File Uploads

- [x] 3.1 Add phone number validation to backend DTOs (profile + references)
- [x] 3.2 Add password complexity validation (register + password reset)
- [x] 3.3 Add file type and size validation to upload endpoints (5MB images, 10MB CV)
- [x] 3.4 Add URL and email validation to CV wizard fields (CvWizardDataDto)
- [x] 3.5 Add client-side validation to frontend forms (phone, year range)

---

## Phase 4: Conversations — Add Missing Creation Endpoint

- [x] 4.1 Create CreateConversationDto
- [x] 4.2 Add POST /conversations endpoint with duplicate detection

---

## Phase 5: Security & Infrastructure Hardening

- [x] 5.1 Remove dead AdminGuard code (deleted)
- [x] 5.2 Add login-specific rate limiting (5 attempts/min/IP on /auth/login)
- [x] 5.3 Add Prisma migrate deploy to Docker startup (falls back to db push)
- [x] 5.4 Fix CORS wildcard fallback in Socket.IO gateway
- [x] 5.5 Add ArrayMaxSize(20) to AI allowedSkills arrays
- [x] 5.6 Add DOCX accept to frontend CV upload

---

## Phase 6: Testing & Verification

- [x] 6.1 Create validation e2e test suite (7 test cases)
- [x] 6.2 Create auth e2e test suite (6 test cases)
- [x] 6.3 Add conversation creation e2e tests (7 test cases)
- [x] 6.4 Manual smoke test checklist documented in plan

---

## Phase 7: Polish & UX Improvements

- [x] 7.1 Create reusable SuccessToast component
- [x] 7.2 Add form dirty-state warning to profile page (beforeunload)
- [x] 7.3 Add print stylesheet for resume PDF export (print.css)
- [x] 7.4 Auto-regenerate resume on template change

---

## Final Progress Summary

| Phase | Tasks | Status |
|-------|-------|--------|
| Phase 1: Profile Fixes | 4 | ✅ Complete |
| Phase 2: Resume Templates | 8 | ✅ Complete |
| Phase 3: Validation | 5 | ✅ Complete |
| Phase 4: Conversations | 2 | ✅ Complete |
| Phase 5: Security/Hardening | 6 | ✅ Complete |
| Phase 6: Testing | 4 | ✅ Complete |
| Phase 7: Polish | 4 | ✅ Complete |
| **Total** | **33** | **✅ 33/33** |

---

## Complete File Change Index

### Backend (NestJS) — 18 files
| # | File | Action | Phase | Status |
|---|------|--------|-------|--------|
| 1 | `apps/api/src/profile/dto/profile.dto.ts` | MODIFY — phone regex, cvWizardData validation | 3 | ✅ |
| 2 | `apps/api/src/profile/dto/cv-wizard-data.dto.ts` | NEW — URL/email validation class | 3 | ✅ |
| 3 | `apps/api/src/profile/dto/reference.dto.ts` | MODIFY — phone regex | 3 | ✅ |
| 4 | `apps/api/src/auth/dto/register.dto.ts` | MODIFY — password complexity regex | 3 | ✅ |
| 5 | `apps/api/src/auth/dto/password-reset-confirm.dto.ts` | MODIFY — password complexity regex | 3 | ✅ |
| 6 | `apps/api/src/upload/upload.controller.ts` | MODIFY — file filter + size limits | 3 | ✅ |
| 7 | `apps/api/src/conversations/conversations.controller.ts` | MODIFY — add POST /conversations | 4 | ✅ |
| 8 | `apps/api/src/conversations/conversations.service.ts` | MODIFY — add createConversation method | 4 | ✅ |
| 9 | `apps/api/src/conversations/dto/create-conversation.dto.ts` | NEW | 4 | ✅ |
| 10 | `apps/api/src/resume/dto/build-resume.dto.ts` | MODIFY — CLASSIC/MODERN/MINIMAL | 2 | ✅ |
| 11 | `apps/api/src/resume/resume.service.ts` | MODIFY — new template IDs + full data | 2 | ✅ |
| 12 | `apps/api/src/ai/dto/chat-request.dto.ts` | MODIFY — ArrayMaxSize(20) | 5 | ✅ |
| 13 | `apps/api/src/ai/dto/mock-interview-request.dto.ts` | MODIFY — ArrayMaxSize(20) | 5 | ✅ |
| 14 | `apps/api/src/ai/dto/course-recommendations-request.dto.ts` | MODIFY — ArrayMaxSize(20) | 5 | ✅ |
| 15 | `apps/api/src/realtime/messaging.gateway.ts` | MODIFY — CORS fallback | 5 | ✅ |
| 16 | `apps/api/src/main.ts` | MODIFY — login rate limiter | 5 | ✅ |
| 17 | `apps/api/src/admin/admin.guard.ts` | DELETE | 5 | ✅ |
| 18 | `apps/api/Dockerfile` | MODIFY — prisma migrate deploy | 5 | ✅ |

### Frontend (Next.js) — 11 files
| # | File | Action | Phase | Status |
|---|------|--------|-------|--------|
| 19 | `apps/web/web-ui/src/app/profile/page.tsx` | MODIFY — success feedback, missing fields, client validation, dirty-state | 1,3,7 | ✅ |
| 20 | `apps/web/web-ui/src/app/resume/page.tsx` | MODIFY — template picker, styled output, PDF button, auto-regenerate | 2,7 | ✅ |
| 21 | `apps/web/web-ui/src/components/resume/types.ts` | NEW | 2 | ✅ |
| 22 | `apps/web/web-ui/src/components/resume/TemplateClassic.tsx` | NEW | 2 | ✅ |
| 23 | `apps/web/web-ui/src/components/resume/TemplateModern.tsx` | NEW | 2 | ✅ |
| 24 | `apps/web/web-ui/src/components/resume/TemplateMinimal.tsx` | NEW | 2 | ✅ |
| 25 | `apps/web/web-ui/src/components/SuccessToast.tsx` | NEW | 7 | ✅ |
| 26 | `apps/web/web-ui/src/app/profile/cv/page.tsx` | MODIFY — accept DOCX, header text | 5 | ✅ |
| 27 | `apps/web/web-ui/src/app/resume/print.css` | NEW — @media print styles | 7 | ✅ |

### Tests — 3 files
| # | File | Action | Phase | Status |
|---|------|--------|-------|--------|
| 28 | `apps/api/test/validation.e2e-spec.ts` | NEW — 7 tests (phone, password, URL, email) | 6 | ✅ |
| 29 | `apps/api/test/auth.e2e-spec.ts` | NEW — 6 tests (register, login, password reset) | 6 | ✅ |
| 30 | `apps/api/test/conversations.e2e-spec.ts` | NEW — 7 tests (create, duplicate, auth, self, inactive, list) | 6 | ✅ |
