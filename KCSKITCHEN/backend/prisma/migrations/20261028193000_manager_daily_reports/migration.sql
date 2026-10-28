CREATE TYPE "KitchenManagerInboxKind" AS ENUM ('DAILY_REPORT', 'COMPLAINT', 'SYSTEM');

CREATE TABLE "KitchenManagerSettings" (
  "id" TEXT NOT NULL DEFAULT 'primary',
  "managerOrbitPersonId" TEXT,
  "reportEmail" TEXT,
  "dailyReportEnabled" BOOLEAN NOT NULL DEFAULT false,
  "dailyReportHour" INTEGER NOT NULL DEFAULT 17,
  "lastReportDate" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "KitchenManagerSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KitchenManagerInbox" (
  "id" TEXT NOT NULL,
  "kind" "KitchenManagerInboxKind" NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "referenceType" TEXT,
  "referenceId" TEXT,
  "reportDate" TEXT,
  "attachmentName" TEXT,
  "attachmentBase64" TEXT,
  "emailedAt" TIMESTAMP(3),
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KitchenManagerInbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "KitchenManagerInbox_kind_reportDate_key" ON "KitchenManagerInbox"("kind", "reportDate");
CREATE INDEX "KitchenManagerInbox_createdAt_idx" ON "KitchenManagerInbox"("createdAt");
CREATE INDEX "KitchenManagerInbox_readAt_createdAt_idx" ON "KitchenManagerInbox"("readAt", "createdAt");
