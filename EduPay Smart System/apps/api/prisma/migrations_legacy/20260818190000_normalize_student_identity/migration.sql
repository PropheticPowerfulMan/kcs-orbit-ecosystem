ALTER TABLE "Student"
  ADD COLUMN IF NOT EXISTS "firstName" TEXT,
  ADD COLUMN IF NOT EXISTS "middleName" TEXT,
  ADD COLUMN IF NOT EXISTS "lastName" TEXT,
  ADD COLUMN IF NOT EXISTS "email" TEXT,
  ADD COLUMN IF NOT EXISTS "phone" TEXT,
  ADD COLUMN IF NOT EXISTS "dateOfBirth" TIMESTAMP(3);

UPDATE "Student"
SET "lastName" = COALESCE("lastName", split_part(trim("fullName"), ' ', 1)),
    "firstName" = COALESCE("firstName", regexp_replace(trim("fullName"), '^.*\s+', ''))
WHERE "fullName" IS NOT NULL;