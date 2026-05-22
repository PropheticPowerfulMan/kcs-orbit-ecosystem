ALTER TABLE "Parent"
  ADD COLUMN IF NOT EXISTS "physicalAddress" TEXT;

ALTER TABLE "Teacher"
  ADD COLUMN IF NOT EXISTS "physicalAddress" TEXT;
