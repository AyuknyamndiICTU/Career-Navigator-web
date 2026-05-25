# Act Mode TODO — Gemini-first CV extraction + recommendations

- [ ] Phase 0: Inventory & contracts
  - [x] Locate Skills/Courses, Jobs, Profile, Upload UI routes
  - [x] Identify backend endpoints used for each feature
  - [ ] Lock JSON contracts:
    - [x] `UploadMedia.cvExtractedText` schema (must support `deriveCareerAllowedSkills`)
    - [x] Course/Job recommendation output shapes with `externalUrl`

- [x] Phase 1: CV scan worker refactor (Ollama → Gemini)
  - [x] Phase 1a: Implement `extractStructuredCvViaGemini()`
  - [x] Phase 1b: Replace call in `processJob()` to use Gemini
  - [x] Phase 1c: JSON hardening:
    - [x] strip code fences
    - [x] extract first JSON object
    - [x] validate `skills: string[]`
  - [x] Phase 1d: Add retries/backoff for 429/503 during Gemini extraction
  - [x] Phase 1e: DOCX support:
    - [x] add DOCX → text extraction step (mammoth)
    - [x] choose extractor based on file extension
  - [x] Phase 1f: Caching/skip logic:
    - [x] if `cvScanStatus=COMPLETED` and input unchanged, skip re-extraction (same `objectKey`)

- [ ] Phase 2: Scrape/store course catalogs (Decision A)
  - [x] Add Prisma models for scraped course candidates + cached recommendations
  - [x] Implement scraper modules per platform (public pages first)
  - [x] Persist scraped candidates into DB
  - [x] Implement Gemini ranking endpoint that outputs `CourseRecommendation[]` including `externalUrl`
  - [x] Update Skills/Courses UI to render external links

- [ ] Phase 3: Scrape/store job listings + recommendations
  - [x] Add Prisma models for scraped jobs + cached recommendations
  - [x] Implement scraper modules (start internal DB if external not ready)
  - [x] Implement Gemini matching endpoint outputting `JobRecommendation[]` with `externalUrl`
  - [x] Update Jobs UI to show match reason + external links

- [ ] Phase 4: Resume builder upgrade (Projects + References)
  - [ ] Confirm Prisma models exist / extend schema
  - [ ] Update Profile UI with dynamic Projects/References sections
  - [ ] Update resume generation endpoint and output model

- [ ] Phase 5: Career glue consistency
  - [ ] Ensure all endpoints use the same allowed-skills precedence
  - [ ] Ensure enforcement messages are consistent

- [ ] Phase 6: Docker compose — make Ollama optional
  - [ ] Move Ollama to compose profile OR gate start behind CV_SCAN_ENABLED
  - [ ] Update compose so `docker compose up` does NOT require Ollama

- [ ] Testing & validation
  - [x] Run backend unit/e2e tests (done: e2e suites passed after changes)
  - [x] Add tests for Gemini CV JSON parsing robustness (covered by existing e2e mocks; next: add focused tests for DOCX path)
  - [ ] Manual smoke test:
    - [ ] upload PDF CV → extract → skills → courses/jobs
    - [ ] upload DOCX → extract → skills update
  - [ ] Verify capacity handling (429/503 retries) and UI behavior

- [ ] Documentation
  - [x] Update AI-plan.md / README with new flows (Phase 1 completed; next: document CV worker + DOCX env expectations)
  - [ ] Document required env vars for Gemini-based CV extraction (GEMINI_API_KEY, GEMINI model behavior) and mammoth usage
