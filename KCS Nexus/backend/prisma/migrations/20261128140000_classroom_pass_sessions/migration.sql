CREATE TABLE "ClassroomPassSession" (
 "id" TEXT NOT NULL PRIMARY KEY,"teacherReference" TEXT NOT NULL,"studentReference" TEXT NOT NULL,
 "teacherId" TEXT,"studentId" TEXT,"badgeType" TEXT NOT NULL,"academicYear" TEXT NOT NULL,"period" TEXT NOT NULL,
 "teacherName" TEXT NOT NULL,"studentName" TEXT NOT NULL,"className" TEXT NOT NULL,"courseReference" TEXT,"courseName" TEXT,
 "issueNote" TEXT NOT NULL DEFAULT '',"issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"expectedReturnAt" TIMESTAMP(3) NOT NULL,
 "returnedAt" TIMESTAMP(3),"returnedByReference" TEXT,"returnNote" TEXT,"revision" INTEGER NOT NULL DEFAULT 1,
 CONSTRAINT "ClassroomPassSession_badgeType_check" CHECK ("badgeType" IN ('BATHROOM','HALLPASS','KITCHEN')),
 CONSTRAINT "ClassroomPassSession_timing_check" CHECK ("expectedReturnAt">"issuedAt" AND ("returnedAt" IS NULL OR "returnedAt">="issuedAt")),
 CONSTRAINT "ClassroomPassSession_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
 CONSTRAINT "ClassroomPassSession_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ClassroomPassSession_active_teacher_badge" ON "ClassroomPassSession"("teacherReference","badgeType") WHERE "returnedAt" IS NULL;
CREATE UNIQUE INDEX "ClassroomPassSession_active_student" ON "ClassroomPassSession"("studentReference") WHERE "returnedAt" IS NULL;
CREATE INDEX "ClassroomPassSession_teacherReference_issuedAt_idx" ON "ClassroomPassSession"("teacherReference","issuedAt");
CREATE INDEX "ClassroomPassSession_studentReference_issuedAt_idx" ON "ClassroomPassSession"("studentReference","issuedAt");
CREATE INDEX "ClassroomPassSession_academicYear_period_idx" ON "ClassroomPassSession"("academicYear","period");
