CREATE TYPE "ShiningStudentDivision" AS ENUM ('LOWER', 'MIDDLE_UPPER');
CREATE TYPE "ShiningStudentStatus" AS ENUM ('SCHEDULED', 'TOPIC_SUBMITTED', 'PRESENTED', 'EXCUSED');

CREATE TABLE "ShiningStudentSchedule" (
  "id" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "division" "ShiningStudentDivision" NOT NULL,
  "studentId" TEXT NOT NULL,
  "topic" TEXT,
  "topicNotes" TEXT,
  "status" "ShiningStudentStatus" NOT NULL DEFAULT 'SCHEDULED',
  "notifiedAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShiningStudentSchedule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ShiningStudentSchedule_date_division_key" ON "ShiningStudentSchedule"("date", "division");
CREATE INDEX "ShiningStudentSchedule_studentId_date_idx" ON "ShiningStudentSchedule"("studentId", "date");
CREATE INDEX "ShiningStudentSchedule_date_status_idx" ON "ShiningStudentSchedule"("date", "status");

ALTER TABLE "ShiningStudentSchedule" ADD CONSTRAINT "ShiningStudentSchedule_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShiningStudentSchedule" ADD CONSTRAINT "ShiningStudentSchedule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
