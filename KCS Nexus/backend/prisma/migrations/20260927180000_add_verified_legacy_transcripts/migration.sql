CREATE TABLE "LegacyTranscriptRecord" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "academicYear" TEXT NOT NULL,
  "gradeLevel" TEXT NOT NULL,
  "term" TEXT NOT NULL,
  "courseCode" TEXT NOT NULL,
  "courseName" TEXT NOT NULL,
  "credits" DOUBLE PRECISION NOT NULL,
  "percentage" DOUBLE PRECISION NOT NULL,
  "letterGrade" TEXT NOT NULL,
  "sourceSchool" TEXT NOT NULL,
  "sourceSystem" TEXT NOT NULL DEFAULT 'QUICKSCHOOLS',
  "sourceDocument" TEXT NOT NULL,
  "fileHash" TEXT NOT NULL,
  "verificationStatus" TEXT NOT NULL DEFAULT 'VERIFIED',
  "importedBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LegacyTranscriptRecord_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LegacyTranscriptRecord_studentId_academicYear_term_courseCode_key" ON "LegacyTranscriptRecord"("studentId", "academicYear", "term", "courseCode");
CREATE INDEX "LegacyTranscriptRecord_studentId_academicYear_idx" ON "LegacyTranscriptRecord"("studentId", "academicYear");
CREATE INDEX "LegacyTranscriptRecord_verificationStatus_idx" ON "LegacyTranscriptRecord"("verificationStatus");
ALTER TABLE "LegacyTranscriptRecord" ADD CONSTRAINT "LegacyTranscriptRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
