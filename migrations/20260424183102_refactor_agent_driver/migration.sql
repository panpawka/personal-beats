-- AlterTable
ALTER TABLE "Beat" ADD COLUMN     "currentPhase" TEXT,
ADD COLUMN     "currentSessionId" TEXT,
ADD COLUMN     "lastEventId" TEXT;

-- CreateTable
CREATE TABLE "AgentEvent" (
    "id" TEXT NOT NULL,
    "beatId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "eventId" TEXT,
    "type" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentMessage" (
    "id" TEXT NOT NULL,
    "beatId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumedAt" TIMESTAMP(3),

    CONSTRAINT "AgentMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentEvent_beatId_occurredAt_idx" ON "AgentEvent"("beatId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "AgentEvent_sessionId_eventId_key" ON "AgentEvent"("sessionId", "eventId");

-- CreateIndex
CREATE INDEX "AgentMessage_sessionId_consumedAt_idx" ON "AgentMessage"("sessionId", "consumedAt");

-- AddForeignKey
ALTER TABLE "AgentEvent" ADD CONSTRAINT "AgentEvent_beatId_fkey" FOREIGN KEY ("beatId") REFERENCES "Beat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentMessage" ADD CONSTRAINT "AgentMessage_beatId_fkey" FOREIGN KEY ("beatId") REFERENCES "Beat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
