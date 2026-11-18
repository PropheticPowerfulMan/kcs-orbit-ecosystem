-- CreateTable
CREATE TABLE "TeachingSession" (
    "id" TEXT NOT NULL,
    "courseId" TEXT,
    "courseReference" TEXT NOT NULL,
    "teacherId" TEXT,
    "teacherUserId" TEXT NOT NULL,
    "scheduleKey" TEXT NOT NULL,
    "schoolDate" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "semester" INTEGER NOT NULL,
    "term" TEXT NOT NULL,
    "courseName" TEXT NOT NULL,
    "courseCode" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "teacherName" TEXT NOT NULL,
    "room" TEXT NOT NULL,
    "expectedStartAt" TIMESTAMP(3) NOT NULL,
    "expectedEndAt" TIMESTAMP(3) NOT NULL,
    "checkInAt" TIMESTAMP(3),
    "checkOutAt" TIMESTAMP(3),
    "teacherNote" TEXT,
    "reviewStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rosterRevision" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeachingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentCoursePresence" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "studentId" TEXT,
    "studentReference" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "studentNumber" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "note" TEXT,
    "markedById" TEXT NOT NULL,
    "markedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentCoursePresence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeachingSession_teacherUserId_schoolDate_idx" ON "TeachingSession"("teacherUserId", "schoolDate");

-- CreateIndex
CREATE INDEX "TeachingSession_academicYear_schoolDate_idx" ON "TeachingSession"("academicYear", "schoolDate");

-- CreateIndex
CREATE UNIQUE INDEX "TeachingSession_courseReference_scheduleKey_schoolDate_key" ON "TeachingSession"("courseReference", "scheduleKey", "schoolDate");

-- CreateIndex
CREATE INDEX "StudentCoursePresence_studentReference_markedAt_idx" ON "StudentCoursePresence"("studentReference", "markedAt");

-- CreateIndex
CREATE UNIQUE INDEX "StudentCoursePresence_sessionId_studentReference_key" ON "StudentCoursePresence"("sessionId", "studentReference");

-- AddForeignKey
ALTER TABLE "TeachingSession" ADD CONSTRAINT "TeachingSession_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingSession" ADD CONSTRAINT "TeachingSession_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TeacherProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentCoursePresence" ADD CONSTRAINT "StudentCoursePresence_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TeachingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentCoursePresence" ADD CONSTRAINT "StudentCoursePresence_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Data integrity independent of the caller.
ALTER TABLE "TeachingSession"
 ADD CONSTRAINT "TeachingSession_time_order" CHECK ("expectedEndAt">"expectedStartAt"),
 ADD CONSTRAINT "TeachingSession_checkout_order" CHECK ("checkOutAt" IS NULL OR ("checkInAt" IS NOT NULL AND "checkOutAt">="checkInAt")),
 ADD CONSTRAINT "TeachingSession_semester" CHECK ("semester" IN (1,2)),
 ADD CONSTRAINT "TeachingSession_revision" CHECK ("rosterRevision">=0),
 ADD CONSTRAINT "TeachingSession_review_status" CHECK ("reviewStatus" IN ('PENDING','ACKNOWLEDGED','FOLLOW_UP','JUSTIFIED'));

-- Do not invent absence records for dates before this feature was activated.
INSERT INTO "AuditLog" ("id","action","targetType","targetId","metadata")
VALUES ('course-attendance-tracking-start','COURSE_ATTENDANCE_TRACKING_ENABLED','TeachingAttendance','school',
 jsonb_build_object('startsOn',to_char(CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Kinshasa','YYYY-MM-DD'),'timezone','Africa/Kinshasa'))
ON CONFLICT ("id") DO NOTHING;
