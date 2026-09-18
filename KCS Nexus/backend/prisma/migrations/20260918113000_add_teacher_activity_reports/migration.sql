CREATE TYPE "TeacherReportStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'REVIEWED', 'RETURNED');

CREATE TABLE "TeacherActivityReport" (
  "id" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "evidence" JSONB NOT NULL,
  "aiSource" TEXT NOT NULL,
  "recipientRole" TEXT NOT NULL,
  "status" "TeacherReportStatus" NOT NULL DEFAULT 'DRAFT',
  "submittedAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "reviewerNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TeacherActivityReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TeacherActivityReport_teacherId_periodStart_periodEnd_idx" ON "TeacherActivityReport"("teacherId", "periodStart", "periodEnd");
CREATE INDEX "TeacherActivityReport_status_submittedAt_idx" ON "TeacherActivityReport"("status", "submittedAt");
ALTER TABLE "TeacherActivityReport" ADD CONSTRAINT "TeacherActivityReport_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TeacherProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;