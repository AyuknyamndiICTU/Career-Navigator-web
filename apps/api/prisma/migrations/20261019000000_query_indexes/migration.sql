-- DropIndex
DROP INDEX "Job_status_idx";

-- DropIndex
DROP INDEX "Message_conversationId_idx";

-- CreateIndex
CREATE INDEX "Job_status_createdAt_idx" ON "Job"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Job_skills_idx" ON "Job" USING GIN ("skills");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");
