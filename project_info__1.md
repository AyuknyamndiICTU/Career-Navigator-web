# Career Navigator Web — Codebase Overview (Index / Architecture Notes)

## Summary
This monorepo contains a NestJS REST API (apps/api) for authentication, profile management, and media uploads, and a separate Next.js frontend scaffold (apps/web). The backend uses Prisma with a PostgreSQL data model (with planned usage of MinIO for uploads), JWT access + refresh tokens, and OTP-based email verification and password reset via Brevo (SendGrid-like SMTP API). Execution entry for the backend is `apps/api/src/main.ts`, which also serves Swagger docs at `/api-docs`.

> Note: In this exploration pass I fully read the backend NestJS code and Prisma schema; the frontend (apps/web) and infra (infra/docker, infra/k8s) were only partially visible via README titles and directory listing, not deeply inspected.

## Architecture
**Primary pattern:** Modular NestJS (controller/service layering) with Prisma as the persistence layer and hand-rolled auth verification inside services (no Nest guards shown in the files read).

**Major subsystems**
- **API runtime:** `apps/api/src/main.ts` bootstraps the Nest app and Swagger.
- **Persistence & DB access:** `apps/api/src/prisma/*` provides a global `PrismaService` used by feature modules.
- **Auth subsystem:** `apps/api/src/auth/*`
  - OTP email verification + activation (`register` → `verify-otp`)
  - Password reset OTP flow
  - JWT access token creation and refresh-token rotation
  - Account deactivation + theme preference read/write
- **Profile subsystem:** `apps/api/src/profile/*`
  - Bearer-token authenticated CRUD for personal profile, education, and work experiences
- **Media upload subsystem:** `apps/api/src/upload/*`
  - Upload picture and CV to MinIO and store object metadata in Prisma
- **Data model:** `apps/api/prisma/schema.prisma` defines the core entities and enumerations

**Technology stack**
- Backend: TypeScript, NestJS, Swagger (`@nestjs/swagger`), Prisma Client + Prisma schema
- Security: `bcryptjs` for password hashing; `jsonwebtoken` for access/refresh; OTP codes stored as SHA-256 hashes
- Email OTP provider: Brevo via direct HTTP fetch to the Brevo SMTP endpoint
- Storage: MinIO via `minio` SDK + local disk staging via Multer
- Testing: Jest configured in `apps/api/package.json`

**Execution start**
1. HTTP request hits Nest controllers (Auth/Profile/Upload).
2. Controllers delegate to services.
3. Services parse/verify JWTs using shared JWT utilities and read/update via Prisma.

The backend runtime loop is the Nest HTTP server listening on `process.env.PORT ?? 3000` (in `main.ts`).

## Directory Structure
```
project-root/
├── apps/
│   ├── api/                      — NestJS backend (read extensively)
│   │   ├── src/
│   │   │   ├── main.ts          — Nest bootstrap + Swagger at /api-docs
│   │   │   ├── app.module.ts   — feature module wiring
│   │   │   ├── prisma/          — PrismaService + PrismaModule
│   │   │   ├── auth/            — register/login/refresh/password reset/theme/deactivate
│   │   │   ├── profile/         — profile + education + work experience CRUD
│   │   │   └── upload/          — profile picture + CV uploads to MinIO
│   │   └── prisma/schema.prisma— data model + enums
│   └── web/                      — Next.js frontend (only top-level README seen)
│
├── infra/
│   ├── docker/                   — Docker build contexts (only README title seen)
│   └── k8s/                      — Kubernetes manifests (only README title seen)
│
├── logo/                         — branding assets (logo/logo.png)
├── plan.md                       — high-level roadmap for features
└── root tooling files:
    package.json, tsconfig.base.json, eslint config, prettier config, etc.
```

## Key Abstractions

### PrismaService
- **File**: `apps/api/src/prisma/prisma.service.ts` (class `PrismaService`)
- **Responsibility**: Provide a Prisma Client configured with Prisma’s PostgreSQL adapter and automatic DATABASE_URL fallback.
- **Interface (key behaviors)**:
  - Extends `PrismaClient`
  - On construction:
    - If `process.env.DATABASE_URL` is missing, sets a fallback connection string.
    - Creates a `PrismaPg` adapter using the configured connection string.
    - Calls `super({ adapter })` to route Prisma queries through the adapter.
  - Implements `onModuleDestroy()` to call `this.$disconnect()`.
- **Lifecycle**: Singleton in the Nest DI container (exported via `@Global()` PrismaModule).
- **Used by**: `AuthService`, `ProfileService`, `UploadService`.

### AuthController
- **File**: `apps/api/src/auth/auth.controller.ts`
- **Responsibility**: Define REST endpoints for the auth domain and delegate to `AuthService`.
- **Interface (routes)**:
  - `POST /auth/register` → `AuthService.register()`
  - `POST /auth/verify-otp` → `AuthService.verifyRegisterOtp()`
  - `POST /auth/login` → `AuthService.login()`
  - `POST /auth/refresh` → `AuthService.refresh()`
  - `POST /auth/password-reset/request` → `AuthService.requestPasswordReset()`
  - `POST /auth/password-reset/confirm` → `AuthService.confirmPasswordReset()`
  - `POST /auth/deactivate` (Authorization header) → `AuthService.deactivate()`
  - `GET /auth/theme` (Authorization header) → `AuthService.getTheme()`
  - `POST /auth/theme` (Authorization header + body) → `AuthService.setTheme()`
- **Lifecycle**: Request-scoped instantiation via DI wiring.
- **Used by**: All HTTP clients (frontend or API consumers).

### AuthService
- **File**: `apps/api/src/auth/auth.service.ts` (class `AuthService`)
- **Responsibility**: Orchestrate auth flows using Prisma models + email OTP + JWT signing/verification.
- **Interface (key methods)**:
  - `register(dto: RegisterDto)`
    - Creates or updates a `User` as `isActive=false`
    - Generates 6-digit OTP and stores **only its hash** in `EmailVerificationOtp` with:
      - purpose = `REGISTER`
      - attempts counter initialized to 0
      - expiresAt = now + 10 minutes
    - Sends OTP email via `BrevoEmailer`
  - `verifyRegisterOtp(dto: VerifyOtpDto)`
    - Fetches user by email (selects id + isActive)
    - Loads most recent unused, non-expired OTP for purpose REGISTER
    - Compares `hashOtpCode(code) === otp.codeHash`
    - On success:
      - transaction updates user `isActive=true`
      - marks OTP as used (`usedAt=new Date()`)
    - On mismatch:
      - increments attempts and throws on limit
  - `login(dto: LoginDto)`
    - Requires user exists, `isActive=true`, password matches bcrypt hash
    - Generates:
      - access token (JWT payload includes `isActive`)
      - refresh token (JWT includes `sub` + random `jti`)
    - Persists refresh token security data:
      - stores SHA-256 hash of refresh token (`tokenHash`)
      - stores `jti`
      - stores `expiresAt` (currently fixed to 30d fallback rather than parsed from env)
  - `refresh(dto: RefreshDto)`
    - Verifies refresh JWT signature via `verifyRefreshToken`
    - Looks up refreshToken row by `tokenHash`
    - Implements **refresh token reuse detection**:
      - if `revokedAt` already set → throws and revokes all other non-revoked refresh tokens for that user
    - If valid and unrevoked:
      - creates new access token
      - rotates refresh token:
        - revokes existing refresh token row
        - inserts a new refresh token row (new tokenHash + jti + expiresAt)
  - `requestPasswordReset(dto)`
    - Avoids user enumeration: returns generic message even if email not found
    - Stores OTP purpose = `PASSWORD_RESET` (with TTL and attempts=0)
    - Sends email OTP if user exists
  - `confirmPasswordReset(dto)`
    - Requires user exists and isActive=true
    - Loads most recent unused, non-expired reset OTP
    - Validates OTP hash match
    - Updates:
      - user passwordHash
      - marks OTP usedAt
      - revokes all refresh tokens for the user
  - `deactivate(authorizationHeader)`
    - Requires valid bearer access token
    - transaction:
      - sets `user.isActive=false`, sets `deactivatedAt`
      - revokes all refresh tokens (`revokedAt=now`)
  - `getTheme(authorizationHeader)` / `setTheme(...)`
    - Requires bearer access token
    - Reads or writes `user.themePreference`

- **Lifecycle**: Singleton service.
- **Used by**: `AuthController` routes.

### JWT Utilities
- **File**: `apps/api/src/auth/jwt/jwt-utils.ts`
- **Responsibility**: Provide token signing and verification primitives plus token hashing for refresh-token storage.
- **Interface (key functions)**:
  - `hashToken(token: string)`: SHA-256 hash used as stable lookup key for refresh tokens.
  - `signAccessToken({ secret, expiresIn, userId, email, isActive })`
    - payload: `{ sub, email, isActive }`
  - `signRefreshToken({ secret, expiresIn, userId })`
    - generates `jti` (UUID) and includes `jwtid: jti` in JWT claims
  - `verifyAccessToken({ secret, token })`
  - `verifyRefreshToken({ secret, token })`
    - asserts refresh token contains `jti`, throws if missing

**Non-obvious implementation detail:** refresh-token rotation stores a database row keyed by `tokenHash` only, and reuse detection is driven by whether that row already has `revokedAt`.

### OTP Utilities
- **File**: `apps/api/src/auth/otp/otp-utils.ts`
- **Responsibility**: Generate short OTP codes and hash them for storage.
- **Interface (key functions)**:
  - `generate6DigitCode()`: produces a 6-digit string (left-padded).
  - `hashOtpCode(code)`: SHA-256 of `career-navigator:${code}`.

### ProfileController
- **File**: `apps/api/src/profile/profile.controller.ts`
- **Responsibility**: Define REST endpoints for profile + education + work experience CRUD.
- **Routes** (all are bearer-authenticated via the service):
  - `GET /profile` → `getProfile`
  - `PUT /profile` → `upsertProfile`
  - `GET /profile/education`, `POST /profile/education`, `PUT /profile/education/:educationId`, `DELETE /profile/education/:educationId`
  - `GET /profile/work-experience`, `POST /profile/work-experience`, `PUT /profile/work-experience/:workExperienceId`, `DELETE /profile/work-experience/:workExperienceId`

### ProfileService
- **File**: `apps/api/src/profile/profile.service.ts`
- **Responsibility**: Enforce ownership via the authenticated `sub` userId and manage profile data via Prisma.
- **Key behaviors**:
  - `getAuthUser(authorizationHeader)`:
    - uses `process.env.JWT_ACCESS_SECRET`
    - extracts bearer token string
    - verifies with `verifyAccessToken`
    - returns `{ sub: payload.sub }`
  - Ownership enforcement pattern:
    - for update/delete of education/work experience, it first queries `findFirst` by `{ id: ..., userId }`
    - if not found, throws `BadRequestException('Invalid request')`
    - update/delete is then done by `id` only (after the pre-check ensures user ownership)
- **Used by**: `ProfileController`.

### UploadController
- **File**: `apps/api/src/upload/upload.controller.ts`
- **Responsibility**: Accept multipart uploads and delegate to UploadService.
- **Routes**:
  - `POST /upload/picture` (multipart field `file`)
  - `POST /upload/cv` (multipart field `file`)
- **Key detail**: Uses `FileInterceptor('file', { storage: diskStorage(...) })` to save uploads to a local `./tmp` directory as a fallback before re-uploading to MinIO.

### UploadService
- **File**: `apps/api/src/upload/upload.service.ts`
- **Responsibility**: Store uploaded file bytes in MinIO and persist the MinIO object metadata in Prisma.
- **Key behaviors**:
  - Lazy MinIO initialization: constructor does not configure MinIO; `minio` client is created only on first upload call.
  - Auth enforcement:
    - `getAuthUser()` validates bearer access token using `JWT_ACCESS_SECRET`
  - MinIO object key convention:
    - `${userId}/${mediaType}/${randomUUID()}${ext}`
    - media types are string enums: `PROFILE_PICTURE` and `CV`
  - Upload procedure:
    1. Creates `createReadStream(params.file.path)` from the staged Multer file.
    2. Calls `this.minio.putObject(bucket, objectKey, stream, size, { Content-Type })`
    3. Upserts `UploadMedia` row by composite unique constraint `(userId, type)`
  - Returns API response with uploaded `objectKey`.

### Prisma Data Model (Schema)
- **File**: `apps/api/prisma/schema.prisma`
- **Responsibility**: Define entities and constraints for OTPs, refresh tokens, user profile, uploaded media, and related CV sections.
- **Key entities & constraints**:
  - `User`: `email` unique; `isActive` with default false; `themePreference` default LIGHT
  - `EmailVerificationOtp`:
    - purpose enum { REGISTER, PASSWORD_RESET }
    - stores only `codeHash`, `expiresAt`, `attempts`, and `usedAt`
    - indexes by `[userId, purpose]` and `[expiresAt]`
  - `RefreshToken`:
    - unique `jti` and unique `tokenHash`
    - stores `expiresAt` and `revokedAt` for rotation/reuse detection
  - `Profile` one-to-one via `userId @unique`
  - `Education` and `WorkExperience` are one-to-many
  - `UploadMedia`:
    - composite unique `(userId, type)`
    - stores `objectKey` and optional `contentType`/`originalFilename`

## Data Flow
1. **Register / Activate**
   1) Client calls `POST /auth/register` → `AuthController.register()` → `AuthService.register()`.
   2) Service upserts user as inactive and creates an `EmailVerificationOtp` row (purpose `REGISTER`).
   3) Service sends OTP email using `BrevoEmailer` (Brevo SMTP endpoint).
2. **OTP verification**
   1) Client calls `POST /auth/verify-otp` → `AuthService.verifyRegisterOtp()`.
   2) Service queries latest unused OTP for the user/purpose and ensures `expiresAt > now`.
   3) On mismatch, increments attempts and throws errors until `MAX_OTP_ATTEMPTS`.
   4) On match, transaction sets `user.isActive=true` and marks the OTP `usedAt`.
3. **Login**
   1) Client calls `POST /auth/login` with credentials.
   2) Service bcrypt-compares passwordHash; checks `user.isActive`.
   3) Service signs access token and refresh token via `jwt-utils`.
   4) Service hashes refresh token and stores it in `RefreshToken` row with `expiresAt`.
4. **Refresh rotation**
   1) Client calls `POST /auth/refresh`.
   2) Service verifies JWT signature, then looks up `RefreshToken` by `tokenHash`.
   3) If `revokedAt` is set, it treats it as reuse:
      - revokes other refresh tokens for that user
      - throws `Refresh token reuse detected`
   4) Else it revokes old token row and inserts a new refresh token row in a transaction.
5. **Profile CRUD**
   1) Client calls `/profile` endpoints with `Authorization: Bearer <accessToken>`.
   2) `ProfileService.getAuthUser()` verifies the access token and returns `{ sub }`.
   3) Upserts profile or performs education/work experience CRUD using Prisma.
   4) Update/delete first confirm ownership with `{ id, userId }` pre-check.
6. **Uploads**
   1) Client calls `/upload/picture` or `/upload/cv` with multipart `file` + bearer access token.
   2) Controller stores file in `./tmp` via Multer.
   3) `UploadService` uploads stream to MinIO using key convention by userId + media type.
   4) `UploadService` upserts `UploadMedia` row with new `objectKey`.

## Non-Obvious Behaviors & Design Decisions

### 1) Auth verification is service-level (no guards/middleware shown)
Controllers pass `authorization` headers into services, and services do manual bearer extraction + token verification. This means:
- authorization checks are **not centralized** in a Nest guard; each service method depends on consistent token parsing logic.
- adding new endpoints requires explicit header plumbing in controller + explicit verification in the corresponding service.

### 2) Refresh token reuse detection revokes all active refresh tokens
In `AuthService.refresh()`:
- if the `RefreshToken` row already has `revokedAt`, the service assumes **reuse**.
- it then calls `updateMany` to revoke all other unrevoked refresh tokens for the same `userId`.
This is a standard “compromised refresh token” pattern, and it increases security by preventing further usage of potentially replayed tokens.

### 3) Refresh token expiry persistence currently ignores env duration parsing
Both `login()` and `refresh()` persist refresh token `expiresAt` as `new Date(Date.now() + 30 * 24 * 60 * 60_000)` (fixed 30 days).
- JWT signing uses `refreshExpiresIn` from environment (default '30d'), but the database expiry calculation does not parse `refreshExpiresIn`.
- There is a `parseDurationToMs()` helper in `jwt-utils.ts`, but it is not used by `AuthService`.
Implication: if env `JWT_REFRESH_EXPIRES_IN` changes away from the assumed 30d, DB expiry and JWT expiry may diverge.

### 4) OTP attempt counting and failure behavior
For register OTP:
- wrong OTP increments `attempts`
- if `attempts >= MAX_OTP_ATTEMPTS`, it throws but does not mark the OTP as used or permanently disable it via DB state beyond the attempts counter.
This is safe-ish but may cause confusing UX: further attempts might continue to throw “attempt limit exceeded” for the same OTP row.

### 5) Upload uses disk staging + streaming (MinIO stream is derived from staged file)
`UploadService` calls `createReadStream(params.file.path)`.
- Multer writes to local disk (`./tmp`).
- In production you likely need to ensure temp cleanup and configure Multer memory storage or an automated cleanup pipeline; the current code comment explicitly calls this out as a “fallback” and suggests a production improvement.

### 6) Ownership checks use “pre-check then update/delete by id”
For education and work experience update/delete:
- code first does `findFirst({ where: { id, userId } })`
- then updates/deletes using `where: { id: educationId }` (or `workExperienceId`) without `userId`
This is correct because the pre-check ensures ownership, but it relies on the pre-check never being bypassed and adds an extra DB round-trip per write.

## Suggested Reading Order
1. `apps/api/src/main.ts` — shows bootstrapping + Swagger path.
2. `apps/api/src/app.module.ts` — shows which feature modules are wired.
3. `apps/api/src/prisma/prisma.service.ts` + `apps/api/prisma/schema.prisma` — understand persistence and constraints.
4. `apps/api/src/auth/auth.service.ts` + `apps/api/src/auth/jwt/jwt-utils.ts` — understand security model end-to-end (OTP → JWT → refresh rotation).
5. `apps/api/src/profile/profile.service.ts` — learn the “verify bearer → fetch sub → ownership pre-check” pattern.
6. `apps/api/src/upload/upload.service.ts` — understand MinIO keying + `UploadMedia` upsert.

## Module Reference

| File | Purpose |
|------|---------|
| `apps/api/src/main.ts` | Nest bootstrap + Swagger at `/api-docs` |
| `apps/api/src/app.module.ts` | Registers Auth/Profile/Upload modules |
| `apps/api/src/prisma/prisma.service.ts` | Prisma Client configured with PrismaPg adapter + fallback DB URL |
| `apps/api/prisma/schema.prisma` | Core DB schema: Users, OTPs, Refresh tokens, Profile, Education, WorkExperience, UploadMedia |
| `apps/api/src/auth/auth.controller.ts` | Auth REST endpoints |
| `apps/api/src/auth/auth.service.ts` | Auth business logic (OTP, JWT, refresh rotation, password reset, deactivate, theme) |
| `apps/api/src/auth/jwt/jwt-utils.ts` | JWT signing/verifying and refresh token hashing helpers |
| `apps/api/src/auth/email/brevo-emailer.ts` | Brevo API call to send OTP codes |
| `apps/api/src/profile/profile.controller.ts` | Profile REST endpoints |
| `apps/api/src/profile/profile.service.ts` | Profile/education/work experience CRUD with ownership checks |
| `apps/api/src/upload/upload.controller.ts` | Multipart upload endpoints |
| `apps/api/src/upload/upload.service.ts` | MinIO upload + `UploadMedia` metadata persistence |

## Known Gaps / What’s Not Yet Indexed
- **Frontend source code (apps/web):** Only `apps/web/README.md` was visible in exploration; React/Next.js pages/components were not inspected.
- **Infra source (infra/docker, infra/k8s):** Only README titles were visible; Dockerfile/Kubernetes manifests were not read.
- **Tests:** Jest configuration exists, but test files were not read in this exploration pass beyond discovering they exist in directory listings.

If you want, I can do another targeted exploration pass focused on:
- `apps/web/*` (Next.js pages/routes/components),
- `infra/docker/*` and `infra/k8s/*`,
- and any missing `apps/api/test/*` specs.
