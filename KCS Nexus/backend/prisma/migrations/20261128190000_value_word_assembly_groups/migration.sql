ALTER TABLE "ValueWordAssignment" ADD COLUMN "audienceKey" TEXT NOT NULL DEFAULT 'GENERAL';
ALTER TABLE "ValueWordAssignment" ADD CONSTRAINT "ValueWordAssignment_audience" CHECK ("audienceKey" IN ('GENERAL','LOWER','UPPER'));
ALTER TABLE "ValueWordSettings" ADD COLUMN "lowerLocation" TEXT NOT NULL DEFAULT 'KCS · K3–Grade 8 building';
ALTER TABLE "ValueWordSettings" ADD COLUMN "upperLocation" TEXT NOT NULL DEFAULT 'KCS · Grade 9–12 building';
DROP INDEX "ValueWordAssignment_academicYear_schoolDate_key";
CREATE UNIQUE INDEX "ValueWordAssignment_year_day_audience_key" ON "ValueWordAssignment"("academicYear","schoolDate","audienceKey");
CREATE INDEX "ValueWordAssignment_audienceKey_startsAt_idx" ON "ValueWordAssignment"("audienceKey","startsAt");
-- Preserve every existing turn. Future Tuesday–Thursday turns become the matching building's assembly.
-- Snapshot identifiers and completed/past history remain untouched. The revision invalidates obsolete queued reminders.
UPDATE "ValueWordAssignment" a SET "audienceKey"=CASE WHEN EXISTS (
 SELECT 1 FROM "TeacherProfile" p LEFT JOIN "Course" c ON c."teacherId"=p.id
 WHERE p."userId"=a."speakerReference" AND (p."homeroomGrade" ~* '^Grade *(9|10|11|12)$' OR c.grade ~* '^Grade *(9|10|11|12)$')
) THEN 'UPPER' ELSE 'LOWER' END,
 "version"="version"+1,"notificationRevision"="notificationRevision"+1,"updatedAt"=CURRENT_TIMESTAMP
WHERE a."startsAt">CURRENT_TIMESTAMP AND EXTRACT(DOW FROM a."schoolDate"::date) IN (2,3,4);
UPDATE "ValueWordAssignment" a SET "location"=CASE WHEN a."audienceKey"='UPPER' THEN s."upperLocation" ELSE s."lowerLocation" END
FROM "ValueWordSettings" s WHERE s.id='main' AND a."startsAt">CURRENT_TIMESTAMP AND a."audienceKey" IN ('LOWER','UPPER') AND a."location"='KCS · General assembly';
