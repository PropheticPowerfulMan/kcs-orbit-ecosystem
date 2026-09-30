ALTER TABLE "Assignment"
  ADD COLUMN "isInteractive" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "aiSource" TEXT,
  ADD COLUMN "passingScore" DOUBLE PRECISION NOT NULL DEFAULT 70,
  ADD COLUMN "shuffleQuestions" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "resultsPublishedAt" TIMESTAMP(3),
  ADD COLUMN "gradebookSyncedAt" TIMESTAMP(3);

ALTER TABLE "AssignmentSubmission"
  ADD COLUMN "startedAt" TIMESTAMP(3),
  ADD COLUMN "autoScore" DOUBLE PRECISION,
  ADD COLUMN "percentage" DOUBLE PRECISION,
  ADD COLUMN "aiFeedback" TEXT,
  ADD COLUMN "answersJson" JSONB,
  ADD COLUMN "gradedAt" TIMESTAMP(3);

CREATE TABLE "AssignmentQuestion" (
  "id" TEXT NOT NULL,
  "assignmentId" TEXT NOT NULL,
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
  CONSTRAINT "AssignmentQuestion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AssignmentSubmissionAnswer" (
  "id" TEXT NOT NULL,
  "submissionId" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "answer" JSONB,
  "isCorrect" BOOLEAN,
  "pointsAwarded" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "feedback" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssignmentSubmissionAnswer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssignmentQuestion_assignmentId_order_idx" ON "AssignmentQuestion"("assignmentId", "order");
CREATE INDEX "AssignmentSubmissionAnswer_questionId_idx" ON "AssignmentSubmissionAnswer"("questionId");
CREATE UNIQUE INDEX "AssignmentSubmissionAnswer_submissionId_questionId_key" ON "AssignmentSubmissionAnswer"("submissionId", "questionId");

ALTER TABLE "AssignmentQuestion"
  ADD CONSTRAINT "AssignmentQuestion_assignmentId_fkey"
  FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AssignmentSubmissionAnswer"
  ADD CONSTRAINT "AssignmentSubmissionAnswer_submissionId_fkey"
  FOREIGN KEY ("submissionId") REFERENCES "AssignmentSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AssignmentSubmissionAnswer"
  ADD CONSTRAINT "AssignmentSubmissionAnswer_questionId_fkey"
  FOREIGN KEY ("questionId") REFERENCES "AssignmentQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
