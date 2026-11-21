-- Existing conversations stay in the school-wide forum.
ALTER TABLE "StudentForumPost"
  ADD COLUMN "audience" TEXT NOT NULL DEFAULT 'SCHOOL',
  ADD COLUMN "classroomGrade" TEXT,
  ADD COLUMN "classroomSection" TEXT;
CREATE INDEX "StudentForumPost_classroom_updatedAt_idx"
  ON "StudentForumPost"("audience", "classroomGrade", "classroomSection", "updatedAt");
