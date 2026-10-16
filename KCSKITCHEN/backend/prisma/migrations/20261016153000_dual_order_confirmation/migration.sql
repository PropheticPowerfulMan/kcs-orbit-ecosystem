ALTER TABLE "KitchenTransaction"
ADD COLUMN IF NOT EXISTS "confirmedByKitchenAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "KitchenTransaction_pending_confirmation_idx"
ON "KitchenTransaction"("status", "confirmedByPersonAt", "confirmedByKitchenAt");
