-- CreateTable
CREATE TABLE "VideoSession" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'livekit',
    "room" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "participantMinutes" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "VideoSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoParticipant" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "VideoParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VideoSession_room_key" ON "VideoSession"("room");

-- CreateIndex
CREATE INDEX "VideoSession_conversationId_endedAt_idx" ON "VideoSession"("conversationId", "endedAt");

-- CreateIndex
CREATE INDEX "VideoSession_startedAt_idx" ON "VideoSession"("startedAt");

-- CreateIndex
CREATE INDEX "VideoParticipant_sessionId_userId_leftAt_idx" ON "VideoParticipant"("sessionId", "userId", "leftAt");

-- AddForeignKey
ALTER TABLE "VideoSession" ADD CONSTRAINT "VideoSession_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoParticipant" ADD CONSTRAINT "VideoParticipant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "VideoSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

