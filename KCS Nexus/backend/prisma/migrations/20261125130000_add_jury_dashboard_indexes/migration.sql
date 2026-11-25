-- Additive indexes for manager-scoped dashboard and candidate evaluation joins.
CREATE INDEX IF NOT EXISTS "JuryProject_ownerId_updatedAt_idx" ON "JuryProject" ("ownerId", "updatedAt");
CREATE INDEX IF NOT EXISTS "JuryAssignment_candidateId_enabled_idx" ON "JuryAssignment" ("candidateId", "enabled");
