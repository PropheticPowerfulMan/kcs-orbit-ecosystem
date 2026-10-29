ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "signatureImage" TEXT,
  ADD COLUMN IF NOT EXISTS "signatureUpdatedAt" TIMESTAMP(3);

ALTER TABLE "DisciplineCase"
  ADD COLUMN IF NOT EXISTS "suspensionStart" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "suspensionEnd" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "DisciplineCase_studentId_suspensionStart_suspensionEnd_idx"
  ON "DisciplineCase"("studentId", "suspensionStart", "suspensionEnd");
