CREATE TABLE "AcademicScheduleEntry" (
  "id" TEXT NOT NULL,
  "sourceKey" TEXT NOT NULL,
  "academicYear" TEXT NOT NULL,
  "semester" INTEGER NOT NULL,
  "grade" TEXT NOT NULL,
  "classGroup" TEXT,
  "day" TEXT NOT NULL,
  "period" INTEGER NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "teacherName" TEXT,
  "room" TEXT,
  "sourceDocument" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AcademicScheduleEntry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AcademicScheduleEntry_sourceKey_key" ON "AcademicScheduleEntry"("sourceKey");
CREATE INDEX "AcademicScheduleEntry_academicYear_semester_grade_day_idx" ON "AcademicScheduleEntry"("academicYear", "semester", "grade", "day");
CREATE INDEX "AcademicScheduleEntry_teacherName_day_idx" ON "AcademicScheduleEntry"("teacherName", "day");
