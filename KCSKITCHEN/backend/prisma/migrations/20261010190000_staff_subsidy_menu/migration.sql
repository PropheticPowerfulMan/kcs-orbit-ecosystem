ALTER TABLE "Product" ADD COLUMN "discountEligible" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "KitchenTransaction" ADD COLUMN "eligibleSubtotal" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "KitchenTransaction" ADD COLUMN "schoolSubsidy" DECIMAL(14,2) NOT NULL DEFAULT 0;

UPDATE "Product"
SET "discountEligible" = false
WHERE "category" = 'DRINK'
   OR lower("name") IN ('bora', 'coca', 'fanta', 'vitalo', 'lait caille', 'lait caillé', 'yaourt', 'water', 'eau', 'bavaria', 'bisap', 'bissap');

CREATE INDEX "KitchenTransaction_schoolSubsidy_createdAt_idx" ON "KitchenTransaction"("schoolSubsidy", "createdAt");
