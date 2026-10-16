CREATE TABLE "StudentGovernmentElection" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "academicYear" TEXT NOT NULL,
  "startAt" TIMESTAMP(3) NOT NULL,
  "endAt" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "createdById" TEXT NOT NULL,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudentGovernmentElection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StudentGovernmentPosition" (
  "id" TEXT NOT NULL,
  "electionId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "scope" TEXT NOT NULL DEFAULT 'GLOBAL',
  "grade" TEXT,
  "section" TEXT,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudentGovernmentPosition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StudentGovernmentCandidate" (
  "id" TEXT NOT NULL,
  "electionId" TEXT NOT NULL,
  "positionId" TEXT NOT NULL,
  "studentProfileId" TEXT NOT NULL,
  "ballotNumber" INTEGER NOT NULL,
  "firstName" TEXT NOT NULL,
  "middleName" TEXT,
  "lastName" TEXT NOT NULL,
  "grade" TEXT NOT NULL,
  "section" TEXT,
  "manifesto" TEXT,
  "photoUrl" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudentGovernmentCandidate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StudentGovernmentVote" (
  "id" TEXT NOT NULL,
  "electionId" TEXT NOT NULL,
  "voterUserId" TEXT NOT NULL,
  "voterStudentProfileId" TEXT NOT NULL,
  "voterGrade" TEXT NOT NULL,
  "voterSection" TEXT,
  "confirmationCode" TEXT NOT NULL,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudentGovernmentVote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StudentGovernmentChoice" (
  "id" TEXT NOT NULL,
  "voteId" TEXT NOT NULL,
  "positionId" TEXT NOT NULL,
  "candidateId" TEXT NOT NULL,
  CONSTRAINT "StudentGovernmentChoice_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StudentGovernmentElection_status_startAt_endAt_idx" ON "StudentGovernmentElection"("status", "startAt", "endAt");
CREATE INDEX "StudentGovernmentElection_academicYear_idx" ON "StudentGovernmentElection"("academicYear");
CREATE UNIQUE INDEX "StudentGovernmentPosition_electionId_name_grade_section_key" ON "StudentGovernmentPosition"("electionId", "name", "grade", "section");
CREATE INDEX "StudentGovernmentPosition_electionId_displayOrder_idx" ON "StudentGovernmentPosition"("electionId", "displayOrder");
CREATE UNIQUE INDEX "StudentGovernmentCandidate_positionId_studentProfileId_key" ON "StudentGovernmentCandidate"("positionId", "studentProfileId");
CREATE UNIQUE INDEX "StudentGovernmentCandidate_positionId_ballotNumber_key" ON "StudentGovernmentCandidate"("positionId", "ballotNumber");
CREATE INDEX "StudentGovernmentCandidate_electionId_active_idx" ON "StudentGovernmentCandidate"("electionId", "active");
CREATE UNIQUE INDEX "StudentGovernmentVote_confirmationCode_key" ON "StudentGovernmentVote"("confirmationCode");
CREATE UNIQUE INDEX "StudentGovernmentVote_electionId_voterUserId_key" ON "StudentGovernmentVote"("electionId", "voterUserId");
CREATE INDEX "StudentGovernmentVote_electionId_submittedAt_idx" ON "StudentGovernmentVote"("electionId", "submittedAt");
CREATE UNIQUE INDEX "StudentGovernmentChoice_voteId_positionId_key" ON "StudentGovernmentChoice"("voteId", "positionId");
CREATE INDEX "StudentGovernmentChoice_candidateId_idx" ON "StudentGovernmentChoice"("candidateId");

ALTER TABLE "StudentGovernmentPosition" ADD CONSTRAINT "StudentGovernmentPosition_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "StudentGovernmentElection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentGovernmentCandidate" ADD CONSTRAINT "StudentGovernmentCandidate_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "StudentGovernmentElection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentGovernmentCandidate" ADD CONSTRAINT "StudentGovernmentCandidate_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "StudentGovernmentPosition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentGovernmentVote" ADD CONSTRAINT "StudentGovernmentVote_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "StudentGovernmentElection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentGovernmentChoice" ADD CONSTRAINT "StudentGovernmentChoice_voteId_fkey" FOREIGN KEY ("voteId") REFERENCES "StudentGovernmentVote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentGovernmentChoice" ADD CONSTRAINT "StudentGovernmentChoice_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "StudentGovernmentPosition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentGovernmentChoice" ADD CONSTRAINT "StudentGovernmentChoice_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "StudentGovernmentCandidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
