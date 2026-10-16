ALTER TYPE "TransactionStatus" ADD VALUE IF NOT EXISTS 'PENDING' BEFORE 'CONFIRMED';

CREATE TABLE IF NOT EXISTS "SchoolSubsidyPayment" (
  "id" TEXT NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "method" "PaymentMode" NOT NULL,
  "reference" TEXT,
  "notes" TEXT,
  "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "recordedBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SchoolSubsidyPayment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SchoolSubsidyPayment_paidAt_idx" ON "SchoolSubsidyPayment"("paidAt");

ALTER TABLE "KitchenAccess" ADD COLUMN IF NOT EXISTS "emailNotifications" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "KitchenAccess" ADD COLUMN IF NOT EXISTS "smsNotifications" BOOLEAN NOT NULL DEFAULT true;
