CREATE TABLE "ValueWordAssignment" (
 "id" TEXT NOT NULL PRIMARY KEY,"academicYear" TEXT NOT NULL,"schoolDate" TEXT NOT NULL,
 "startsAt" TIMESTAMP(3) NOT NULL,"endsAt" TIMESTAMP(3) NOT NULL,"location" TEXT NOT NULL,
 "speakerReference" TEXT NOT NULL,"speakerId" TEXT,"speakerName" TEXT NOT NULL,"speakerGroup" TEXT NOT NULL,
 "topic" TEXT NOT NULL DEFAULT '',"scripture" TEXT NOT NULL DEFAULT '',"status" TEXT NOT NULL DEFAULT 'PUBLISHED',
 "cancellationReason" TEXT,"version" INTEGER NOT NULL DEFAULT 1,"notificationRevision" INTEGER NOT NULL DEFAULT 1,
 "createdByReference" TEXT,"publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "ValueWordAssignment_speakerId_fkey" FOREIGN KEY ("speakerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
 CONSTRAINT "ValueWordAssignment_timing" CHECK ("endsAt">"startsAt"),
 CONSTRAINT "ValueWordAssignment_status" CHECK ("status" IN ('PUBLISHED','COMPLETED','CANCELLED'))
);
CREATE UNIQUE INDEX "ValueWordAssignment_academicYear_schoolDate_key" ON "ValueWordAssignment"("academicYear","schoolDate");
CREATE INDEX "ValueWordAssignment_startsAt_status_idx" ON "ValueWordAssignment"("startsAt","status");
CREATE INDEX "ValueWordAssignment_speakerReference_schoolDate_idx" ON "ValueWordAssignment"("speakerReference","schoolDate");
CREATE TABLE "ValueWordDelivery" (
 "id" TEXT NOT NULL PRIMARY KEY,"assignmentId" TEXT NOT NULL,"revision" INTEGER NOT NULL,"kind" TEXT NOT NULL,
 "recipientReference" TEXT NOT NULL,"inAppSentAt" TIMESTAMP(3),"emailLogReference" TEXT,"emailFailure" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "ValueWordDelivery_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "ValueWordAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "ValueWordDelivery_kind" CHECK ("kind" IN ('REMINDER_7','REMINDER_3','REMINDER_1','COMMUNITY','CHANGED','REVIEW'))
);
CREATE UNIQUE INDEX "ValueWordDelivery_unique_notice" ON "ValueWordDelivery"("assignmentId","revision","kind","recipientReference");
CREATE INDEX "ValueWordDelivery_assignmentId_revision_idx" ON "ValueWordDelivery"("assignmentId","revision");

CREATE TABLE "ValueWordSettings" (
 "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'main',"enabled" BOOLEAN NOT NULL DEFAULT true,
 "startTime" TEXT NOT NULL DEFAULT '08:00',"endTime" TEXT NOT NULL DEFAULT '08:30',
 "location" TEXT NOT NULL DEFAULT 'KCS · General assembly',"staffWeekday" INTEGER NOT NULL DEFAULT 5,
 "excludedIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],"revision" INTEGER NOT NULL DEFAULT 1,"updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "ValueWordSettings_times" CHECK ("startTime" ~ '^[0-2][0-9]:[0-5][0-9]$' AND "endTime">"startTime"),
 CONSTRAINT "ValueWordSettings_staff_day" CHECK ("staffWeekday" BETWEEN 0 AND 5)
);
