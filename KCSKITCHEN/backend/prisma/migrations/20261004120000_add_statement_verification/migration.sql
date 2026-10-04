CREATE TABLE "KitchenStatementVerification" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "deduplicationKey" TEXT NOT NULL,
    "orbitPersonId" TEXT NOT NULL,
    "issuedBy" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "periodFrom" TIMESTAMP(3),
    "periodTo" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "keyId" TEXT NOT NULL DEFAULT 'qr-v1',
    "currency" TEXT NOT NULL DEFAULT 'CDF',
    "openingBalance" DECIMAL(14,2) NOT NULL,
    "closingBalance" DECIMAL(14,2) NOT NULL,
    "entryCount" INTEGER NOT NULL,
    "entriesHash" TEXT NOT NULL,
    "canonicalPayload" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KitchenStatementVerification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "KitchenStatementVerification_documentId_key"
    ON "KitchenStatementVerification"("documentId");

CREATE UNIQUE INDEX "KitchenStatementVerification_deduplicationKey_key"
    ON "KitchenStatementVerification"("deduplicationKey");

CREATE INDEX "KitchenStatementVerification_orbitPersonId_issuedAt_idx"
    ON "KitchenStatementVerification"("orbitPersonId", "issuedAt");

CREATE INDEX "KitchenStatementVerification_orbitPersonId_periodFrom_periodTo_idx"
    ON "KitchenStatementVerification"("orbitPersonId", "periodFrom", "periodTo");

CREATE INDEX "KitchenStatementVerification_issuedAt_idx"
    ON "KitchenStatementVerification"("issuedAt");
