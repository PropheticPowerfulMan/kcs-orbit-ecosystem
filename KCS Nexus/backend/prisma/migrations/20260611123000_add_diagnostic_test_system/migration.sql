CREATE TYPE "DiagnosticSubject" AS ENUM ('FRENCH', 'MATHEMATICS');
CREATE TYPE "DiagnosticTestStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 'AUTO_GRADED', 'PENDING_SUPER_ADMIN_APPROVAL', 'APPROVED', 'REJECTED', 'RETAKE_REQUESTED', 'ARCHIVED');
CREATE TYPE "DiagnosticQuestionType" AS ENUM ('MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_ANSWER', 'NUMERIC', 'ESSAY_OPTIONAL');
CREATE TYPE "DiagnosticDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');
CREATE TYPE "DiagnosticDecision" AS ENUM ('ACCEPT_REQUESTED_GRADE', 'ACCEPT_WITH_REMEDIATION', 'RECOMMEND_LOWER_LEVEL', 'RETAKE_TEST', 'ACADEMIC_INTERVIEW_REQUIRED', 'REJECT');

CREATE TABLE "DiagnosticTest" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "subject" "DiagnosticSubject" NOT NULL,
  "gradeLevel" TEXT NOT NULL,
  "academicYear" TEXT NOT NULL,
  "createdByTeacherId" TEXT,
  "createdByUserId" TEXT,
  "status" "DiagnosticTestStatus" NOT NULL DEFAULT 'DRAFT',
  "durationMinutes" INTEGER,
  "passingScore" DOUBLE PRECISION NOT NULL DEFAULT 70,
  "competencies" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "answerKey" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DiagnosticTest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DiagnosticQuestion" (
  "id" TEXT NOT NULL,
  "testId" TEXT NOT NULL,
  "questionText" TEXT NOT NULL,
  "questionType" "DiagnosticQuestionType" NOT NULL,
  "options" JSONB,
  "correctAnswer" JSONB,
  "points" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "difficulty" "DiagnosticDifficulty" NOT NULL DEFAULT 'MEDIUM',
  "competencyTag" TEXT NOT NULL,
  "explanation" TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DiagnosticQuestion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DiagnosticAssignment" (
  "id" TEXT NOT NULL,
  "testId" TEXT NOT NULL,
  "studentId" TEXT,
  "enrollmentApplicationId" TEXT,
  "applicantName" TEXT,
  "applicantEmail" TEXT,
  "status" "DiagnosticTestStatus" NOT NULL DEFAULT 'ASSIGNED',
  "assignedById" TEXT,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dueAt" TIMESTAMP(3),
  CONSTRAINT "DiagnosticAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DiagnosticSubmission" (
  "id" TEXT NOT NULL,
  "testId" TEXT NOT NULL,
  "assignmentId" TEXT,
  "studentId" TEXT,
  "enrollmentApplicationId" TEXT,
  "applicantName" TEXT,
  "answersJson" JSONB,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "submittedAt" TIMESTAMP(3),
  "autoScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "percentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status" "DiagnosticTestStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  "statistics" JSONB,
  "aiRecommendation" JSONB,
  "teacherReview" TEXT,
  "superAdminDecision" "DiagnosticDecision",
  "finalComment" TEXT,
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DiagnosticSubmission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DiagnosticAnswer" (
  "id" TEXT NOT NULL,
  "submissionId" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "answer" JSONB,
  "isCorrect" BOOLEAN,
  "pointsAwarded" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "feedback" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DiagnosticAnswer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DiagnosticAnalyticsSnapshot" (
  "id" TEXT NOT NULL,
  "submissionId" TEXT NOT NULL,
  "enrollmentApplicationId" TEXT,
  "summaryJson" JSONB NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DiagnosticAnalyticsSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DiagnosticApproval" (
  "id" TEXT NOT NULL,
  "submissionId" TEXT NOT NULL,
  "actorId" TEXT,
  "action" "DiagnosticTestStatus" NOT NULL,
  "decision" "DiagnosticDecision",
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DiagnosticApproval_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DiagnosticSubmission_assignmentId_key" ON "DiagnosticSubmission"("assignmentId");
CREATE UNIQUE INDEX "DiagnosticAnswer_submissionId_questionId_key" ON "DiagnosticAnswer"("submissionId", "questionId");
CREATE INDEX "DiagnosticTest_subject_gradeLevel_status_idx" ON "DiagnosticTest"("subject", "gradeLevel", "status");
CREATE INDEX "DiagnosticTest_academicYear_idx" ON "DiagnosticTest"("academicYear");
CREATE INDEX "DiagnosticQuestion_testId_order_idx" ON "DiagnosticQuestion"("testId", "order");
CREATE INDEX "DiagnosticAssignment_status_assignedAt_idx" ON "DiagnosticAssignment"("status", "assignedAt");
CREATE INDEX "DiagnosticAssignment_studentId_idx" ON "DiagnosticAssignment"("studentId");
CREATE INDEX "DiagnosticAssignment_enrollmentApplicationId_idx" ON "DiagnosticAssignment"("enrollmentApplicationId");
CREATE INDEX "DiagnosticSubmission_status_submittedAt_idx" ON "DiagnosticSubmission"("status", "submittedAt");
CREATE INDEX "DiagnosticSubmission_studentId_idx" ON "DiagnosticSubmission"("studentId");
CREATE INDEX "DiagnosticSubmission_enrollmentApplicationId_idx" ON "DiagnosticSubmission"("enrollmentApplicationId");
CREATE INDEX "DiagnosticAnalyticsSnapshot_generatedAt_idx" ON "DiagnosticAnalyticsSnapshot"("generatedAt");
CREATE INDEX "DiagnosticAnalyticsSnapshot_enrollmentApplicationId_idx" ON "DiagnosticAnalyticsSnapshot"("enrollmentApplicationId");
CREATE INDEX "DiagnosticApproval_submissionId_createdAt_idx" ON "DiagnosticApproval"("submissionId", "createdAt");

ALTER TABLE "DiagnosticTest" ADD CONSTRAINT "DiagnosticTest_createdByTeacherId_fkey" FOREIGN KEY ("createdByTeacherId") REFERENCES "TeacherProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DiagnosticTest" ADD CONSTRAINT "DiagnosticTest_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DiagnosticQuestion" ADD CONSTRAINT "DiagnosticQuestion_testId_fkey" FOREIGN KEY ("testId") REFERENCES "DiagnosticTest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiagnosticAssignment" ADD CONSTRAINT "DiagnosticAssignment_testId_fkey" FOREIGN KEY ("testId") REFERENCES "DiagnosticTest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiagnosticAssignment" ADD CONSTRAINT "DiagnosticAssignment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DiagnosticAssignment" ADD CONSTRAINT "DiagnosticAssignment_enrollmentApplicationId_fkey" FOREIGN KEY ("enrollmentApplicationId") REFERENCES "AdmissionApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DiagnosticSubmission" ADD CONSTRAINT "DiagnosticSubmission_testId_fkey" FOREIGN KEY ("testId") REFERENCES "DiagnosticTest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiagnosticSubmission" ADD CONSTRAINT "DiagnosticSubmission_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "DiagnosticAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DiagnosticSubmission" ADD CONSTRAINT "DiagnosticSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DiagnosticSubmission" ADD CONSTRAINT "DiagnosticSubmission_enrollmentApplicationId_fkey" FOREIGN KEY ("enrollmentApplicationId") REFERENCES "AdmissionApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DiagnosticAnswer" ADD CONSTRAINT "DiagnosticAnswer_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "DiagnosticSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiagnosticAnswer" ADD CONSTRAINT "DiagnosticAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "DiagnosticQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiagnosticAnalyticsSnapshot" ADD CONSTRAINT "DiagnosticAnalyticsSnapshot_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "DiagnosticSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiagnosticAnalyticsSnapshot" ADD CONSTRAINT "DiagnosticAnalyticsSnapshot_enrollmentApplicationId_fkey" FOREIGN KEY ("enrollmentApplicationId") REFERENCES "AdmissionApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DiagnosticApproval" ADD CONSTRAINT "DiagnosticApproval_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "DiagnosticSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiagnosticApproval" ADD CONSTRAINT "DiagnosticApproval_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
