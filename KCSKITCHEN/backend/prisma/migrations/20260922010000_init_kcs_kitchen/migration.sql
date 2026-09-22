-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "KitchenRole" AS ENUM ('KITCHEN_ADMIN', 'CASHIER', 'FINANCE', 'AUDITOR', 'TEACHER', 'STAFF', 'STUDENT');

-- CreateEnum
CREATE TYPE "PersonType" AS ENUM ('TEACHER', 'STAFF', 'STUDENT', 'ADMINISTRATIVE_STAFF', 'OTHER');

-- CreateEnum
CREATE TYPE "ProductCategory" AS ENUM ('FOOD', 'DRINK', 'SNACK', 'DESSERT', 'OTHER');

-- CreateEnum
CREATE TYPE "InventoryUnit" AS ENUM ('UNIT', 'BOTTLE', 'CAN', 'KG', 'LITER', 'PORTION', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('CASH', 'MOBILE_MONEY', 'BANK', 'EDUPAY', 'CREDIT');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PAID', 'CREDIT', 'PARTIALLY_PAID', 'VOIDED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('CONFIRMED', 'VOIDED', 'REVERSED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('PURCHASE', 'CREDIT', 'PAYMENT', 'DISCOUNT', 'ADJUSTMENT', 'REFUND', 'REVERSAL');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('THRESHOLD_FIXED_TOTAL', 'FIXED_AMOUNT', 'PERCENTAGE', 'CATEGORY_DISCOUNT', 'ROLE_DISCOUNT', 'MANUAL_AUTHORIZED_DISCOUNT');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('STOCK_IN', 'SALE', 'WASTE', 'EXPIRED', 'DAMAGED', 'LOSS', 'ADJUSTMENT', 'RETURN');

-- CreateEnum
CREATE TYPE "DisputeReason" AS ENUM ('I_DID_NOT_TAKE_THIS', 'WRONG_ITEM', 'WRONG_QUANTITY', 'WRONG_PRICE', 'WRONG_DATE', 'OTHER');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PeriodStatus" AS ENUM ('OPEN', 'REVIEW', 'CLOSED');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "ConfirmationType" AS ENUM ('NONE', 'PIN', 'DASHBOARD', 'QR', 'SIGNATURE');

-- CreateTable
CREATE TABLE "KitchenAccess" (
    "id" TEXT NOT NULL,
    "orbitPersonId" TEXT NOT NULL,
    "personType" "PersonType" NOT NULL,
    "role" "KitchenRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "creditEnabled" BOOLEAN NOT NULL DEFAULT false,
    "creditLimit" DECIMAL(14,2),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KitchenAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "ProductCategory" NOT NULL,
    "currentPrice" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CDF',
    "photoUrl" TEXT,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "trackInventory" BOOLEAN NOT NULL DEFAULT false,
    "stockQuantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "unit" "InventoryUnit" NOT NULL DEFAULT 'UNIT',
    "minimumStock" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "reorderLevel" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductPriceHistory" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "price" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CDF',
    "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedBy" TEXT NOT NULL,
    "reason" TEXT,

    CONSTRAINT "ProductPriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscountRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "DiscountType" NOT NULL,
    "eligibleRole" "KitchenRole",
    "category" "ProductCategory",
    "thresholdAmount" DECIMAL(14,2),
    "fixedAmount" DECIMAL(14,2),
    "targetAmount" DECIMAL(14,2),
    "percentage" DECIMAL(7,4),
    "priority" INTEGER NOT NULL DEFAULT 100,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscountRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KitchenCounter" (
    "name" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "KitchenCounter_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "KitchenTransaction" (
    "id" TEXT NOT NULL,
    "transactionNumber" TEXT NOT NULL,
    "orbitPersonId" TEXT NOT NULL,
    "personType" "PersonType" NOT NULL,
    "personNameSnapshot" TEXT NOT NULL,
    "cashierOrbitPersonId" TEXT NOT NULL,
    "cashierNameSnapshot" TEXT NOT NULL,
    "subtotal" DECIMAL(14,2) NOT NULL,
    "discount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CDF',
    "paymentMode" "PaymentMode" NOT NULL,
    "paymentStatus" "PaymentStatus" NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'CONFIRMED',
    "creditAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "confirmationType" "ConfirmationType" NOT NULL DEFAULT 'NONE',
    "confirmedByPersonAt" TIMESTAMP(3),
    "originalTransactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KitchenTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KitchenTransactionItem" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productNameSnapshot" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unitPriceAtPurchase" DECIMAL(14,2) NOT NULL,
    "subtotal" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "KitchenTransactionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscountApplication" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "discountRuleId" TEXT,
    "originalAmount" DECIMAL(14,2) NOT NULL,
    "discountAmount" DECIMAL(14,2) NOT NULL,
    "finalAmount" DECIMAL(14,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "appliedAutomatically" BOOLEAN NOT NULL DEFAULT true,
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscountApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KitchenLedgerEntry" (
    "id" TEXT NOT NULL,
    "orbitPersonId" TEXT NOT NULL,
    "transactionId" TEXT,
    "paymentId" TEXT,
    "type" "LedgerEntryType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CDF',
    "description" TEXT NOT NULL,
    "reason" TEXT,
    "performedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KitchenLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KitchenPayment" (
    "id" TEXT NOT NULL,
    "orbitPersonId" TEXT NOT NULL,
    "transactionId" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CDF',
    "method" "PaymentMode" NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "receivedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KitchenPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KitchenDispute" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "orbitPersonId" TEXT NOT NULL,
    "reason" "DisputeReason" NOT NULL,
    "comment" TEXT,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KitchenDispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "reason" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountingPeriod" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "status" "PeriodStatus" NOT NULL DEFAULT 'OPEN',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "closedBy" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountingPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "reason" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationOutbox" (
    "id" TEXT NOT NULL,
    "orbitPersonId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "channels" TEXT[],
    "payload" JSONB NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "NotificationOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KitchenAccess_orbitPersonId_key" ON "KitchenAccess"("orbitPersonId");

-- CreateIndex
CREATE INDEX "KitchenAccess_role_isActive_idx" ON "KitchenAccess"("role", "isActive");

-- CreateIndex
CREATE INDEX "Product_category_isAvailable_idx" ON "Product"("category", "isAvailable");

-- CreateIndex
CREATE INDEX "ProductPriceHistory_productId_effectiveAt_idx" ON "ProductPriceHistory"("productId", "effectiveAt");

-- CreateIndex
CREATE INDEX "DiscountRule_isActive_priority_idx" ON "DiscountRule"("isActive", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "KitchenTransaction_transactionNumber_key" ON "KitchenTransaction"("transactionNumber");

-- CreateIndex
CREATE INDEX "KitchenTransaction_orbitPersonId_createdAt_idx" ON "KitchenTransaction"("orbitPersonId", "createdAt");

-- CreateIndex
CREATE INDEX "KitchenTransaction_cashierOrbitPersonId_createdAt_idx" ON "KitchenTransaction"("cashierOrbitPersonId", "createdAt");

-- CreateIndex
CREATE INDEX "KitchenTransaction_status_createdAt_idx" ON "KitchenTransaction"("status", "createdAt");

-- CreateIndex
CREATE INDEX "KitchenTransactionItem_transactionId_idx" ON "KitchenTransactionItem"("transactionId");

-- CreateIndex
CREATE INDEX "KitchenLedgerEntry_orbitPersonId_createdAt_idx" ON "KitchenLedgerEntry"("orbitPersonId", "createdAt");

-- CreateIndex
CREATE INDEX "KitchenLedgerEntry_transactionId_idx" ON "KitchenLedgerEntry"("transactionId");

-- CreateIndex
CREATE INDEX "KitchenPayment_orbitPersonId_createdAt_idx" ON "KitchenPayment"("orbitPersonId", "createdAt");

-- CreateIndex
CREATE INDEX "KitchenDispute_status_createdAt_idx" ON "KitchenDispute"("status", "createdAt");

-- CreateIndex
CREATE INDEX "KitchenDispute_orbitPersonId_createdAt_idx" ON "KitchenDispute"("orbitPersonId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_productId_createdAt_idx" ON "StockMovement"("productId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingPeriod_year_month_key" ON "AccountingPeriod"("year", "month");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "NotificationOutbox_status_createdAt_idx" ON "NotificationOutbox"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "ProductPriceHistory" ADD CONSTRAINT "ProductPriceHistory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitchenTransaction" ADD CONSTRAINT "KitchenTransaction_originalTransactionId_fkey" FOREIGN KEY ("originalTransactionId") REFERENCES "KitchenTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitchenTransactionItem" ADD CONSTRAINT "KitchenTransactionItem_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "KitchenTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitchenTransactionItem" ADD CONSTRAINT "KitchenTransactionItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountApplication" ADD CONSTRAINT "DiscountApplication_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "KitchenTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountApplication" ADD CONSTRAINT "DiscountApplication_discountRuleId_fkey" FOREIGN KEY ("discountRuleId") REFERENCES "DiscountRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitchenLedgerEntry" ADD CONSTRAINT "KitchenLedgerEntry_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "KitchenTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitchenLedgerEntry" ADD CONSTRAINT "KitchenLedgerEntry_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "KitchenPayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitchenPayment" ADD CONSTRAINT "KitchenPayment_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "KitchenTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitchenDispute" ADD CONSTRAINT "KitchenDispute_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "KitchenTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Seed the requested teacher threshold as an inactive draft.
-- KCS administration must confirm and explicitly activate it.
INSERT INTO "DiscountRule" (
  "id", "name", "type", "eligibleRole", "thresholdAmount", "targetAmount",
  "priority", "isActive", "requiresApproval", "createdAt", "updatedAt"
) VALUES (
  'teacher-threshold-10000-6000-draft',
  'Teacher threshold 10,000 CDF to 6,000 CDF - pending approval',
  'THRESHOLD_FIXED_TOTAL',
  'TEACHER',
  10000,
  6000,
  10,
  false,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);
