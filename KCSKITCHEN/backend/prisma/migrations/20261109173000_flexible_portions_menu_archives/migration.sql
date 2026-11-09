ALTER TABLE "DailyMenu" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "KitchenTransactionItem" ADD COLUMN "amountBased" BOOLEAN NOT NULL DEFAULT false;
