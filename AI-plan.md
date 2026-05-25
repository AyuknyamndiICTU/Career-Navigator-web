# AI-plan.md — Gemini-first career intelligence (courses, jobs, resume, CV extraction)

> **Decision lock:** You selected **A** → *scrape and store results in DB* (not scrape-on-every-request). This reduces latency, rate-limit pain, and lets the system reuse cached recommendations.

This plan is phased to avoid “brief hiccups” and to minimize Gemini capacity issues by:
- queueing long-running AI/scraping jobs,
- caching results in DB,
- using stable JSON contracts between services and UI.

---

## Phase 0 — Contracts, screenshots, and routing inventory (1–2 days)

### 0.1 Identify UI pages + expected payload shapes
You already indicated:
- **Skills/Courses** page exists
- **Jobs** page exists
- **Profile** page exists for resume building
- there is a CV/Resume upload flow

**Deliverables**
- List of exact UI routes/queries (links in sidebar)
- Backend endpoints currently used by:
  - Skills/Courses
  - Jobs
  - Profile/resume generation
  - CV/Cover letter upload + CV scan trigger
  - Course recommendations / mock interview endpoints

### 0.2 Define stable JSON schemas (these will become “API contracts”)
Create TypeScript types (or inline zod/class-validator equivalents) that are shared across features:

1) **`CvExtractedStructuredData`** (written to `UploadMedia.cvExtractedText`)
- required fields:
  - `skills: string[]`
- recommended fields:
  - `fullName: string|null`
  - `education: Array<...>`
  - `experience: Array<...>`
  - `summary: string|null`
  - (keep schema compatible with existing `deriveCareerAllowedSkills()` parsing)

2) **`CourseRecommendation`**
- `platform: string`
- `courseName: string`
- `difficulty: string | null`
- `description: string`
- `externalUrl: string` (required by your requirement)
- `whyRecommended: string` (tied to allowed skills)

3) **`JobRecommendation`**
- `title: string`
- `company?: string | null`
- `location?: string | null`
- `externalUrl: string` (required)
- `matchReason: string` (tied to allowed skills)

4) **`ResumeModel`** (for resume generation)
- `personalDetails`
- `education[]`
- `experience[]`
- `skills[]`
- `objective`
- `references[]`
- `projects[]`

**Deliverables**
- Confirm these schemas match what UI can render today or what we will add.

---

## Phase 1 — Replace Ollama CV extraction with Gemini JSON extraction (1–3 days)

### 1.1 Refactor CV scan worker: Ollama → Gemini
**Target file**
- `apps/api/src/cv-scan/worker/cv-scan-worker.service.ts`

**Replace**
- `extractStructuredCvViaOllama()` with `extractStructuredCvViaGemini()`

**Rules**
- Gemini must return **strict JSON only** in `CvExtractedStructuredData`.
- Validate JSON parsing server-side.
  - If JSON parsing fails: retry once with a “fix JSON” prompt
  - If still failing: set `UploadMedia.cvScanStatus=FAILED` and `cvScanError`

### 1.2 Add DOCX parsing support
Currently CV text extraction uses `pdf-parse`. Add DOCX support so users can upload `.docx`.

**Add**
- A DOCX text extractor step before sending text to Gemini.

**Implementation notes**
- DOCX → text extraction uses the `mammoth` library.
- No additional env vars are required for DOCX parsing beyond the existing AI/CV scan configuration.

**Deliverables**
- Users can upload PDF or DOCX and `cvExtractedText` becomes structured JSON.

**Gemini model note**
- CV extraction uses the Gemini endpoint with the model set in code (currently `gemini-2.5-flash`), so the only required Gemini env var is `GEMINI_API_KEY`.

### 1.3 Ensure allowed skills remain stable
`deriveCareerAllowedSkills()` already parses `cvExtractedText` and extracts `skills`.
Make sure the Gemini extraction JSON schema keeps `skills` as `string[]`.

### 1.4 Add caching to avoid reprocessing
When a user re-uploads a CV:
- compute a hash of file content (or reuse existing objectKey uniqueness)
- if `UploadMedia.cvScanStatus=COMPLETED` and hash matches, skip extraction.

**Deliverables**
- CV extraction is stable, retry-safe, and doesn’t burn Gemini capacity unnecessarily.

---

## Phase 2 — Scraping + DB storage for course/certification recommendations (2–5 days)

> **Decision A**: scrape/store in DB, then Gemini ranks + formats.

### 2.1 Add data models for scraped catalogs
Create tables like:
- `CourseSourceCatalog`
- `ScrapedCourse`
- `CourseRecommendationRequest` (optional audit)
- `UserCourseRecommendation` (cached output per user+goal)

Key fields:
- `platform`
- `externalUrl`
- `courseName`
- `difficulty`
- `description`
- `skillsTags[]` or derived tags
- `sourceFetchedAt`

### 2.2 Implement scraper services (one per platform)
Create backend “scraper” modules, for example:
- `scrapers/coursera`
- `scrapers/edx`
- `scrapers/udemy`
- `scrapers/alison`
- `scrapers/simplilearn`

Each scraper:
1) crawls search/list pages (no crawling every time; scheduled/batched)
2) parses HTML into normalized `ScrapedCourse`
3) stores new/updated courses (dedupe by `externalUrl` or normalized id)

**Important**
- If scraping requires login:
  - implement “Connect Account” flow or session-token-based fetching
  - *Your requested model behavior “send notifcation + credentials” is not recommended via plaintext.* Use token-based connection.

### 2.3 Gemini ranking endpoint
Create/extend endpoint:
- `POST /ai/course-recommendations` (or new `/recommendations/courses`)
Inputs:
- allowed skills (from CV extracted + profile skills)
- optional `studentGoal`
Output:
- `CourseRecommendation[]` with `externalUrl` and `whyRecommended`

Ranking flow:
1) Query DB scraped courses where `platform in [...]` and rough keyword match to skills (fast filter)
2) Send candidate list (or summarized records) to Gemini for ranking and explanation
3) Save final recommendation in DB keyed by `(userId, skillsHash, studentGoalHash)`

### 2.4 UI integration: Skills/Courses page
Update UI route so it renders:
- platform badge
- course name
- difficulty
- description
- “Open course” link (`externalUrl`)

### 2.5 Scheduling/refresh
Add cron to:
- refresh scraped catalogs daily/weekly depending on platform limits
- invalidate old cached recommendations

**Milestone 2 Deliverables**
- Courses page shows real external links
- Scraping results are stored in DB
- Gemini only ranks/frames, not scrapes

---

## Phase 3 — Scraping + DB storage for job recommendations with external links (2–5 days)

### 3.1 Data models for scraped job listings
Create:
- `ScrapedJob`
- `UserJobRecommendation` cache

Fields:
- `title`, `company`, `location`
- `externalUrl`
- `skillsTags[]`
- `sourceFetchedAt`

### 3.2 Job scraper services
Optionally:
- Start with internal DB jobs (already exists)
- Then add external job scraping providers (freelancing platforms) gradually.

### 3.3 Gemini match + explain
Create endpoint:
- `POST /recommendations/jobs` (or extend jobs AI flow if already exists)

Flow:
1) Candidate set from internal DB + scraped jobs filtered by allowed skills
2) Gemini produces ranked matches:
   - `JobRecommendation[]` with `externalUrl`
   - `matchReason` tied to skills + goal

3) Cache `UserJobRecommendation`

### 3.4 UI integration: Jobs page
Update UI to:
- show top recommended jobs
- show match reason
- include clickable external links

**Milestone 3 Deliverables**
- Jobs page returns external links
- Recommendations are cached and stable

---

## Phase 4 — Resume builder: Profile form expansion + full resume generation (3–7 days)

### 4.1 Validate current resume pipeline
Check current implementation in:
- `apps/api/src/resume/resume.service.ts`
- DTOs and `BuildResume` endpoint

### 4.2 Extend Prisma models
If missing, add:
- `Project` model (with userId/profileId)
- `Reference` model

Ensure relations:
- Profile has many Projects
- Profile has many References

### 4.3 Extend Profile UI
Add sections with dynamic add/remove:
- Projects
- References

Fields:
- Projects: title, description, tech stack, links, impact/achievements
- References: name, relationship, contact

### 4.4 Update resume generation prompt & output
Feed `ResumeModel` built from:
- profile inputs
- CV extracted structured info (optional: prefill)
Then Gemini generates:
- professional resume text (and optional formatting)

If your app supports “download resume”, implement a PDF/Docx renderer later.

**Milestone 4 Deliverables**
- Profile → Projects/References persist
- Resume generation produces complete resume
- CV re-upload updates extracted info

---

## Phase 5 — Career-path glue (continuous improvement; 1–3 days per iteration)

### 5.1 Unify skill source of truth
Choose precedence order:
1) CV extracted skills (highest confidence)
2) profile-edited skills (user intent override)
3) fallback from job applications (already exists)

### 5.2 Consistency across endpoints
Ensure:
- course recommendations
- job recommendations
- allowed skills enforcement (mock interview / chat)
all use the same allowed skill set.

---

## Phase 6 — Docker compose changes so Ollama is optional (0.5–1 day)

### 6.1 Goal
Manual:
- `docker compose up` should NOT start Ollama services
- Ollama should start only if explicitly required (or CV scanning uses Gemini only)

### 6.2 Implementation after Phase 1
After Gemini CV extraction is done:
- remove Ollama dependency from CV scan worker
- move `ollama` service under a `profiles: ["ollama"]` block
- set `CV_SCAN_ENABLED` according to whether you want CV scanning workers running by default

**Milestone 6 Deliverables**
- simple compose up works without Ollama
- enabling profile brings Ollama back if needed for legacy behavior

---

## Testing strategy (must be continuous)
At each phase:
- Run backend e2e tests
- Add new tests for:
  - Gemini JSON extraction parsing
  - course/join scraping normalization storage
  - UI contract rendering for links/explanations
- Validate failure paths:
  - Gemini 429/503
  - scraper HTML shape changes
  - login-required workflows

---

## Capacity hardening plan (to avoid brief hiccups)
- All heavy tasks are queued and retryable
- Gemini calls have:
  - retry/backoff
  - strict timeouts
  - fallback: use last cached recommendations if scraping or extraction fails
- UI must show:
  - loading / queued state
  - “using cached results” if new results fail
