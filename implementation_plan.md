# Fix Docker API Restart Loop — Diagnostic & Implementation Plan

## Root Cause Summary

After the series of LLM provider configuration modifications, the API container enters a **crash loop** because it fails during Node.js module initialization before NestJS even boots. There are **5 compounding bugs**, any one of which would cause a crash or runtime failure inside Docker.

---

## Bug 1 — `dotenv` is imported but NOT in `package.json` (CRASH in Docker)

> [!CAUTION]
> This is the **primary crash cause**. The API process dies immediately on `import 'dotenv/config'`.

### What happened
Three files now import `dotenv/config` at the top level:
- [ai.service.ts](file:///c:/Career%20Navigator%20web/apps/api/src/ai/ai.service.ts#L3) — `import 'dotenv/config';`
- [cv-scan-worker.service.ts](file:///c:/Career%20Navigator%20web/apps/api/src/cv-scan/worker/cv-scan-worker.service.ts#L2) — `import 'dotenv/config';`
- [jobs.service.ts](file:///c:/Career%20Navigator%20web/apps/api/src/jobs/jobs.service.ts#L2) — `import 'dotenv/config';`

But `dotenv` is **not listed** in either `dependencies` or `devDependencies` in [package.json](file:///c:/Career%20Navigator%20web/apps/api/package.json). It works locally only because it's a transitive dependency hoisted into `node_modules` by another package. 

In the Docker production image, the Dockerfile runs `npm ci --omit=dev`, which installs **only declared production dependencies**. Since `dotenv` isn't declared, it won't be present → `import 'dotenv/config'` throws `MODULE_NOT_FOUND` → process crashes → Docker restarts the container → infinite loop.

### Fix
**Remove all `import 'dotenv/config'` statements.** They are unnecessary because:
- In Docker, environment variables are injected via `docker-compose.yml` `environment:` block — there is no `.env` file to load.
- Locally, NestJS/Node reads from `process.env` which is populated by the shell or IDE.
- If `.env` loading is needed for local dev, it should be done once in `main.ts` only, not scattered across service files.

---

## Bug 2 — `getAIProvider()` crashes the bootstrap (CRASH in Docker)

> [!CAUTION]
> Even after fixing Bug 1, the API will still crash on startup inside Docker.

### What happened
[main.ts L16](file:///c:/Career%20Navigator%20web/apps/api/src/main.ts#L16) calls:
```typescript
void getAIProvider();
```

[aiProvider.ts L27-30](file:///c:/Career%20Navigator%20web/apps/api/src/lib/aiProvider.ts#L27-L30) throws a **plain `Error`** (not a NestJS exception) when neither key is set:
```typescript
if (!hasGemini && !hasOllama) {
  throw new Error('No AI provider configured...');
}
```

In Docker, the `docker-compose.yml` does **not** pass `GEMINI_API_KEY` or `OLLAMA_API_KEY` to the `api` service (see Bug 3). So this `throw` executes during `bootstrap()`, which is an unhandled exception at the top level → Node.js exits → Docker restarts → infinite loop.

### Fix
Make `getAIProvider()` **never crash** the process. Instead of throwing, it should return a result indicating no provider is available, or log a warning and return gracefully. The individual service methods that call it at request-time can then throw HTTP exceptions.

---

## Bug 3 — `docker-compose.yml` is missing GEMINI_API_KEY and OLLAMA_API_KEY

> [!WARNING]
> The compose file was never updated to pass the new AI provider keys to the container.

### What happened
The [docker-compose.yml](file:///c:/Career%20Navigator%20web/infra/docker/docker-compose.yml#L48-L116) `api` service `environment:` block still has the **old** Ollama config:
```yaml
OLLAMA_BASE_URL: "http://ollama:11434"
OLLAMA_MODEL: "qwen2.5-coder:7b"
OLLAMA_NUM_PREDICT: "10"
```

It has **no** `GEMINI_API_KEY` or `OLLAMA_API_KEY`. The new `aiProvider.ts` reads `GEMINI_API_KEY` and `OLLAMA_API_KEY` from `process.env`, so inside Docker both are `undefined`.

### Fix
Add `GEMINI_API_KEY` and `OLLAMA_API_KEY` to the `api` service environment in `docker-compose.yml`. Remove the stale `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, and `OLLAMA_NUM_PREDICT` vars since the new provider system doesn't use them.

---

## Bug 4 — `next` is incorrectly listed as an API dependency

> [!WARNING]
> This adds ~200MB of unnecessary dependencies to the API Docker image and can cause build failures.

### What happened
[package.json L44](file:///c:/Career%20Navigator%20web/apps/api/package.json#L44) lists:
```json
"next": "^16.2.6"
```

The API is a **NestJS backend** — it should never depend on Next.js. This was likely added accidentally during one of the modification prompts. It causes:
- Massively inflated Docker image size
- Potential dependency conflicts
- Slower builds and installs

### Fix
Remove `"next"` from `apps/api/package.json` dependencies.

---

## Bug 5 — Inconsistent Gemini model names across files

> [!NOTE]
> This won't cause a crash, but will cause runtime failures when the API tries to call a non-existent model.

### What happened
Different files use different Gemini model names:
| File | Model Used |
|------|-----------|
| [ai.service.ts L505](file:///c:/Career%20Navigator%20web/apps/api/src/ai/ai.service.ts#L505) | `gemini-2.0-flash` |
| [cv-scan-worker.service.ts L255](file:///c:/Career%20Navigator%20web/apps/api/src/cv-scan/worker/cv-scan-worker.service.ts#L255) | `gemini-2.5-flash` |
| [jobs.service.ts L595](file:///c:/Career%20Navigator%20web/apps/api/src/jobs/jobs.service.ts#L595) | `gemini-2.5-flash` |

`gemini-2.5-flash` is the latest model and should be used consistently everywhere. Or better yet, the model name should be defined once in `aiProvider.ts` so it can be changed in one place.

### Fix
Standardize all Gemini model references to use a single model name exported from `aiProvider.ts`.

---

## Proposed Changes

### 1. Fix `dotenv` crash — Remove unnecessary imports

#### [MODIFY] [ai.service.ts](file:///c:/Career%20Navigator%20web/apps/api/src/ai/ai.service.ts)
- Remove `import 'dotenv/config';` on line 3

#### [MODIFY] [cv-scan-worker.service.ts](file:///c:/Career%20Navigator%20web/apps/api/src/cv-scan/worker/cv-scan-worker.service.ts)
- Remove `import 'dotenv/config';` on line 2

#### [MODIFY] [jobs.service.ts](file:///c:/Career%20Navigator%20web/apps/api/src/jobs/jobs.service.ts)
- Remove `import 'dotenv/config';` on line 2

---

### 2. Fix `getAIProvider()` to not crash at startup

#### [MODIFY] [aiProvider.ts](file:///c:/Career%20Navigator%20web/apps/api/src/lib/aiProvider.ts)
- Change `getAIProvider()` to **never throw**. Return `activeProvider: 'none'` when both keys are missing, and log a warning instead.
- Add a `geminiModel` constant (`'gemini-2.5-flash'`) to centralize the model name.
- Update `AIProviderResult` type to include `'none'` as a possible `activeProvider`.

#### [MODIFY] [main.ts](file:///c:/Career%20Navigator%20web/apps/api/src/main.ts)
- Remove the `void getAIProvider()` call from bootstrap, or wrap it so a warning is logged but the process doesn't crash.

---

### 3. Fix `docker-compose.yml` env vars

#### [MODIFY] [docker-compose.yml](file:///c:/Career%20Navigator%20web/infra/docker/docker-compose.yml)
- Add `GEMINI_API_KEY` (reading from host env or with a placeholder)
- Add `OLLAMA_API_KEY` (reading from host env or with a placeholder)
- Remove stale `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `OLLAMA_NUM_PREDICT`

---

### 4. Remove `next` from API dependencies

#### [MODIFY] [package.json](file:///c:/Career%20Navigator%20web/apps/api/package.json)
- Remove `"next": "^16.2.6"` from dependencies

---

### 5. Standardize Gemini model name

#### [MODIFY] [aiProvider.ts](file:///c:/Career%20Navigator%20web/apps/api/src/lib/aiProvider.ts)
- Export `GEMINI_MODEL = 'gemini-2.5-flash'`

#### [MODIFY] [ai.service.ts](file:///c:/Career%20Navigator%20web/apps/api/src/ai/ai.service.ts)
- Replace hardcoded `'gemini-2.0-flash'` with imported `GEMINI_MODEL`

#### [MODIFY] [cv-scan-worker.service.ts](file:///c:/Career%20Navigator%20web/apps/api/src/cv-scan/worker/cv-scan-worker.service.ts)
- Replace hardcoded `'gemini-2.5-flash'` with imported `GEMINI_MODEL`

#### [MODIFY] [jobs.service.ts](file:///c:/Career%20Navigator%20web/apps/api/src/jobs/jobs.service.ts)
- Replace hardcoded `'gemini-2.5-flash'` with imported `GEMINI_MODEL`

---

## Verification Plan

### Automated Tests
1. **Build check**: Run `npm run build --workspace=apps/api` to ensure TypeScript compiles cleanly
2. **Docker build**: Run `docker compose build api` from `infra/docker/` to verify the Docker image builds without errors
3. **Docker startup**: Run `docker compose up api` and verify the container stays running (no restart loop)
4. **Log check**: Verify `[AI Provider] Active: Gemini` appears in the container logs

### Manual Verification
- Open the web app in the browser and confirm AI Chat no longer shows the "cannot reach Ollama" error
- Test that AI-powered features (Chat, Mock Interview, Course Recommendations, Job Match) respond without errors
