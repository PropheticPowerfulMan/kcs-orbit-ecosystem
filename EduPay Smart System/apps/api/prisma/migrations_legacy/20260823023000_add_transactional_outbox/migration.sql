CREATE TYPE "IntegrationOutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'DEAD_LETTER');

CREATE TABLE "IntegrationOutboxEvent" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "httpMethod" TEXT NOT NULL DEFAULT 'POST',
    "payload" JSONB NOT NULL,
    "status" "IntegrationOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 12,
    "lastAttemptAt" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "errorMessage" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "IntegrationOutboxEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IntegrationOutboxEvent_idempotencyKey_key" ON "IntegrationOutboxEvent"("idempotencyKey");
CREATE INDEX "IntegrationOutboxEvent_status_nextAttemptAt_idx" ON "IntegrationOutboxEvent"("status", "nextAttemptAt");
CREATE INDEX "IntegrationOutboxEvent_aggregateType_aggregateId_idx" ON "IntegrationOutboxEvent"("aggregateType", "aggregateId");
