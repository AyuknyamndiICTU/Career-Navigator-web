-- CreateEnum
CREATE TYPE "AiProvider" AS ENUM ('GEMINI', 'OPENAI', 'ANTHROPIC', 'OPENROUTER', 'OLLAMA_CLOUD');

-- CreateEnum
CREATE TYPE "AiKeyTier" AS ENUM ('FREE', 'PAID');

-- CreateEnum
CREATE TYPE "AiCredentialStatus" AS ENUM ('ACTIVE', 'INVALID', 'DISABLED');

-- CreateEnum
CREATE TYPE "AiCostSource" AS ENUM ('PROVIDER', 'PRICE_TABLE', 'FREE');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "aiFallbackToPlatform" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "UserAiCredential" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "AiProvider" NOT NULL,
    "label" TEXT NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "authTag" TEXT NOT NULL,
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "last4" TEXT NOT NULL,
    "baseUrl" TEXT,
    "tier" "AiKeyTier" NOT NULL DEFAULT 'FREE',
    "monthlyBudgetUsd" DECIMAL(10,2),
    "status" "AiCredentialStatus" NOT NULL DEFAULT 'ACTIVE',
    "statusReason" TEXT,
    "lastValidatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAiCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAiPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "task" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAiPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiModelPrice" (
    "id" TEXT NOT NULL,
    "provider" "AiProvider" NOT NULL,
    "model" TEXT NOT NULL,
    "inputPerMTok" DECIMAL(12,6) NOT NULL,
    "outputPerMTok" DECIMAL(12,6) NOT NULL,
    "cachedInputPerMTok" DECIMAL(12,6),
    "isFree" BOOLEAN NOT NULL DEFAULT false,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiModelPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiUsageEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "credentialId" TEXT,
    "provider" "AiProvider" NOT NULL,
    "model" TEXT NOT NULL,
    "task" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "cachedTokens" INTEGER NOT NULL DEFAULT 0,
    "reasoningTokens" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DECIMAL(12,6) NOT NULL DEFAULT 0,
    "costSource" "AiCostSource" NOT NULL,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserAiCredential_userId_idx" ON "UserAiCredential"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserAiPreference_userId_task_key" ON "UserAiPreference"("userId", "task");

-- CreateIndex
CREATE INDEX "AiModelPrice_provider_model_idx" ON "AiModelPrice"("provider", "model");

-- CreateIndex
CREATE UNIQUE INDEX "AiModelPrice_provider_model_effectiveFrom_key" ON "AiModelPrice"("provider", "model", "effectiveFrom");

-- CreateIndex
CREATE INDEX "AiUsageEvent_userId_createdAt_idx" ON "AiUsageEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AiUsageEvent_credentialId_createdAt_idx" ON "AiUsageEvent"("credentialId", "createdAt");

-- CreateIndex
CREATE INDEX "AiUsageEvent_createdAt_idx" ON "AiUsageEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "UserAiCredential" ADD CONSTRAINT "UserAiCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAiPreference" ADD CONSTRAINT "UserAiPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAiPreference" ADD CONSTRAINT "UserAiPreference_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "UserAiCredential"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsageEvent" ADD CONSTRAINT "AiUsageEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed prices from the plan's provider matrix (checked 2026-10-14); admins can edit them later.
INSERT INTO "AiModelPrice" ("id", "provider", "model", "inputPerMTok", "outputPerMTok", "cachedInputPerMTok", "isFree", "effectiveFrom", "updatedAt") VALUES
  (gen_random_uuid()::text, 'GEMINI', 'gemini-3.8-flash', 0, 0, NULL, true, '2026-10-14', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'GEMINI', 'gemini-3.6-flash', 0, 0, NULL, true, '2026-10-14', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'GEMINI', 'gemini-3.5-flash-lite', 0, 0, NULL, true, '2026-10-14', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'GEMINI', 'gemini-3.1-flash-lite', 0, 0, NULL, true, '2026-10-14', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'GEMINI', 'gemini-2.5-flash-lite', 0, 0, NULL, true, '2026-10-14', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'OLLAMA_CLOUD', 'gpt-oss:20b', 0.07, 0.30, NULL, false, '2026-10-14', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'OLLAMA_CLOUD', 'gpt-oss:120b', 0.15, 0.60, NULL, false, '2026-10-14', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'ANTHROPIC', 'claude-haiku-5-5', 0.10, 0.50, 0.01, false, '2026-10-14', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'OPENROUTER', 'openrouter/free', 0, 0, NULL, true, '2026-10-14', CURRENT_TIMESTAMP);
