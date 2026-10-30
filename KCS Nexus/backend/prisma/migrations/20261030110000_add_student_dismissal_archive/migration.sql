CREATE TABLE IF NOT EXISTS "StudentArchive" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "studentNumber" TEXT NOT NULL,
  "orbitUserId" TEXT,
  "fullName" TEXT NOT NULL,
  "grade" TEXT NOT NULL,
  "section" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "effectiveDate" TIMESTAMP(3) NOT NULL,
  "archivedSnapshot" JSONB NOT NULL,
  "archivedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudentArchive_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StudentArchive_studentId_key" ON "StudentArchive"("studentId");
CREATE INDEX IF NOT EXISTS "StudentArchive_effectiveDate_idx" ON "StudentArchive"("effectiveDate");
CREATE INDEX IF NOT EXISTS "StudentArchive_studentNumber_idx" ON "StudentArchive"("studentNumber");
CREATE INDEX IF NOT EXISTS "StudentArchive_archivedById_idx" ON "StudentArchive"("archivedById");

DO $$ BEGIN
  ALTER TABLE "StudentArchive" ADD CONSTRAINT "StudentArchive_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
