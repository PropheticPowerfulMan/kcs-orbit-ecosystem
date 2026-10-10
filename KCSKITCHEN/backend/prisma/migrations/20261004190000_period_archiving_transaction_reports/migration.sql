-- Soft deletion keeps accounting history auditable while allowing operators
-- to remove obsolete periods from the active workspace.
ALTER TABLE "AccountingPeriod"
  ADD COLUMN "archivedBy" TEXT,
  ADD COLUMN "archivedAt" TIMESTAMP(3),
  ADD COLUMN "archiveReason" TEXT;

CREATE INDEX "AccountingPeriod_archivedAt_year_month_idx"
  ON "AccountingPeriod"("archivedAt", "year", "month");

-- Official transaction registers are immutable, signed snapshots. The QR only
-- exposes verification metadata; operational rows stay inside authenticated Kitchen.
CREATE TABLE "KitchenTransactionReportVerification" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "deduplicationKey" TEXT NOT NULL,
  "issuedBy" TEXT NOT NULL,
  "issuedAt" TIMESTAMP(3) NOT NULL,
  "periodFrom" TIMESTAMP(3) NOT NULL,
  "periodTo" TIMESTAMP(3) NOT NULL,
  "statusFilter" TEXT,
  "paymentModeFilter" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'CDF',
  "transactionCount" INTEGER NOT NULL,
  "confirmedSubtotal" DECIMAL(14,2) NOT NULL,
  "confirmedDiscount" DECIMAL(14,2) NOT NULL,
  "confirmedTotal" DECIMAL(14,2) NOT NULL,
  "voidedCount" INTEGER NOT NULL DEFAULT 0,
  "rowsHash" TEXT NOT NULL,
  "canonicalPayload" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "signature" TEXT NOT NULL,
  "keyId" TEXT NOT NULL DEFAULT 'qr-v1',
  "version" INTEGER NOT NULL DEFAULT 1,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KitchenTransactionReportVerification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "KitchenTransactionReportVerification_documentId_key"
  ON "KitchenTransactionReportVerification"("documentId");

CREATE UNIQUE INDEX "KitchenTransactionReportVerification_deduplicationKey_key"
  ON "KitchenTransactionReportVerification"("deduplicationKey");

CREATE INDEX "KitchenTransactionReportVerification_issuedAt_idx"
  ON "KitchenTransactionReportVerification"("issuedAt");

CREATE INDEX "KitchenTransactionReportVerification_periodFrom_periodTo_idx"
  ON "KitchenTransactionReportVerification"("periodFrom", "periodTo");
