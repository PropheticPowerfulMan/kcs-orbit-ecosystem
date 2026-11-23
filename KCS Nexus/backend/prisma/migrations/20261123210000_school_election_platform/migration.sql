-- CreateTable
CREATE TABLE "SchoolElection" (
    "id" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "eligibleGrades" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "eligibleUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "eligibilityMode" TEXT NOT NULL DEFAULT 'ALL',
    "showInterimResults" BOOLEAN NOT NULL DEFAULT false,
    "allowAbstention" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolElection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolElectionOffice" (
    "id" TEXT NOT NULL,
    "electionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'GLOBAL',
    "grade" TEXT,
    "section" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchoolElectionOffice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolElectionCandidate" (
    "id" TEXT NOT NULL,
    "electionId" TEXT NOT NULL,
    "officeId" TEXT NOT NULL,
    "memberUserId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "lastName" TEXT NOT NULL,
    "grade" TEXT,
    "section" TEXT,
    "biography" TEXT NOT NULL DEFAULT '',
    "photoUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "ballotNumber" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolElectionCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolElectionParticipation" (
    "id" TEXT NOT NULL,
    "electionId" TEXT NOT NULL,
    "voterKey" TEXT NOT NULL,
    "receiptCode" TEXT NOT NULL,
    "grade" TEXT,
    "section" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchoolElectionParticipation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolElectionBallot" (
    "id" TEXT NOT NULL,
    "electionId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchoolElectionBallot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolElectionChoice" (
    "id" TEXT NOT NULL,
    "ballotId" TEXT NOT NULL,
    "officeId" TEXT NOT NULL,
    "candidateId" TEXT,
    "abstained" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SchoolElectionChoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SchoolElection_audience_status_startAt_idx" ON "SchoolElection"("audience", "status", "startAt");

-- CreateIndex
CREATE INDEX "SchoolElection_academicYear_idx" ON "SchoolElection"("academicYear");

-- CreateIndex
CREATE INDEX "SchoolElectionOffice_electionId_displayOrder_idx" ON "SchoolElectionOffice"("electionId", "displayOrder");

-- CreateIndex
CREATE INDEX "SchoolElectionCandidate_electionId_status_idx" ON "SchoolElectionCandidate"("electionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolElectionCandidate_officeId_memberUserId_key" ON "SchoolElectionCandidate"("officeId", "memberUserId");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolElectionParticipation_receiptCode_key" ON "SchoolElectionParticipation"("receiptCode");

-- CreateIndex
CREATE INDEX "SchoolElectionParticipation_electionId_submittedAt_idx" ON "SchoolElectionParticipation"("electionId", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolElectionParticipation_electionId_voterKey_key" ON "SchoolElectionParticipation"("electionId", "voterKey");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolElectionBallot_idempotencyKey_key" ON "SchoolElectionBallot"("idempotencyKey");

-- CreateIndex
CREATE INDEX "SchoolElectionBallot_electionId_idx" ON "SchoolElectionBallot"("electionId");

-- CreateIndex
CREATE INDEX "SchoolElectionChoice_candidateId_idx" ON "SchoolElectionChoice"("candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolElectionChoice_ballotId_officeId_key" ON "SchoolElectionChoice"("ballotId", "officeId");

-- AddForeignKey
ALTER TABLE "SchoolElectionOffice" ADD CONSTRAINT "SchoolElectionOffice_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "SchoolElection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolElectionCandidate" ADD CONSTRAINT "SchoolElectionCandidate_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "SchoolElection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolElectionCandidate" ADD CONSTRAINT "SchoolElectionCandidate_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "SchoolElectionOffice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolElectionParticipation" ADD CONSTRAINT "SchoolElectionParticipation_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "SchoolElection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolElectionBallot" ADD CONSTRAINT "SchoolElectionBallot_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "SchoolElection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolElectionChoice" ADD CONSTRAINT "SchoolElectionChoice_ballotId_fkey" FOREIGN KEY ("ballotId") REFERENCES "SchoolElectionBallot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolElectionChoice" ADD CONSTRAINT "SchoolElectionChoice_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "SchoolElectionOffice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolElectionChoice" ADD CONSTRAINT "SchoolElectionChoice_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "SchoolElectionCandidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Integrity rules apply to the new electoral tables only.
ALTER TABLE "SchoolElection" ADD CONSTRAINT "SchoolElection_audience_check" CHECK ("audience" IN ('PARENT','STUDENT'));
ALTER TABLE "SchoolElection" ADD CONSTRAINT "SchoolElection_status_check" CHECK ("status" IN ('DRAFT','OPEN','CLOSED','PUBLISHED','ARCHIVED'));
ALTER TABLE "SchoolElection" ADD CONSTRAINT "SchoolElection_mode_check" CHECK ("eligibilityMode" IN ('ALL','SELECTED'));
ALTER TABLE "SchoolElection" ADD CONSTRAINT "SchoolElection_dates_check" CHECK ("endAt">"startAt");
ALTER TABLE "SchoolElectionOffice" ADD CONSTRAINT "SchoolElectionOffice_scope_check" CHECK (("scope"='GLOBAL' AND "grade" IS NULL AND "section" IS NULL) OR ("scope"='CLASS' AND length(trim("grade"))>0));
ALTER TABLE "SchoolElectionCandidate" ADD CONSTRAINT "SchoolElectionCandidate_status_check" CHECK ("status" IN ('PENDING','APPROVED','REJECTED','WITHDRAWN'));
ALTER TABLE "SchoolElectionChoice" ADD CONSTRAINT "SchoolElectionChoice_abstention_check" CHECK (("abstained" AND "candidateId" IS NULL) OR (NOT "abstained" AND "candidateId" IS NOT NULL));
CREATE UNIQUE INDEX "SchoolElection_one_open_audience" ON "SchoolElection"("audience") WHERE "status"='OPEN';

CREATE FUNCTION "protect_school_election_vote"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'ELECTION_IMMUTABLE_BALLOT' USING ERRCODE='23000';
END;
$$;
CREATE TRIGGER "SchoolElectionBallot_immutable" BEFORE UPDATE OR DELETE ON "SchoolElectionBallot" FOR EACH ROW EXECUTE FUNCTION "protect_school_election_vote"();
CREATE TRIGGER "SchoolElectionChoice_immutable" BEFORE UPDATE OR DELETE ON "SchoolElectionChoice" FOR EACH ROW EXECUTE FUNCTION "protect_school_election_vote"();
CREATE TRIGGER "SchoolElectionParticipation_immutable" BEFORE UPDATE OR DELETE ON "SchoolElectionParticipation" FOR EACH ROW EXECUTE FUNCTION "protect_school_election_vote"();

CREATE FUNCTION "validate_school_election_choice"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM "SchoolElectionBallot" b JOIN "SchoolElectionOffice" o ON o."electionId"=b."electionId" WHERE b.id=NEW."ballotId" AND o.id=NEW."officeId") THEN
  RAISE EXCEPTION 'ELECTION_INVALID_OFFICE' USING ERRCODE='23000';
 END IF;
 IF NOT NEW.abstained AND NOT EXISTS (SELECT 1 FROM "SchoolElectionCandidate" c JOIN "SchoolElectionOffice" o ON o.id=c."officeId" WHERE c.id=NEW."candidateId" AND c."officeId"=NEW."officeId" AND c."electionId"=o."electionId" AND c.status='APPROVED') THEN
  RAISE EXCEPTION 'ELECTION_INVALID_CANDIDATE' USING ERRCODE='23000';
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER "SchoolElectionChoice_validate" BEFORE INSERT ON "SchoolElectionChoice" FOR EACH ROW EXECUTE FUNCTION "validate_school_election_choice"();
