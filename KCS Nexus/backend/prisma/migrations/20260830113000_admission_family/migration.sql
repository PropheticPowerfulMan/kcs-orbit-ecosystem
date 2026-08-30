ALTER TABLE "AdmissionApplication"
  ADD COLUMN "children" JSONB,
  ADD COLUMN "parentDetails" JSONB,
  ADD COLUMN "parentPhotoData" TEXT,
  ADD COLUMN "provisionedAt" TIMESTAMP(3),
  ADD COLUMN "provisionedParentId" TEXT;
