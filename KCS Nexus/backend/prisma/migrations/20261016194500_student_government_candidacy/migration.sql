ALTER TABLE "StudentGovernmentCandidate"
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'APPROVED';

CREATE INDEX IF NOT EXISTS "StudentGovernmentCandidate_electionId_status_idx"
  ON "StudentGovernmentCandidate"("electionId", "status");
