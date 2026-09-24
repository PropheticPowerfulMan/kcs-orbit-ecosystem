-- Preserve the full administrative communication history while keeping
-- cursor pagination responsive as the archive grows.
CREATE INDEX IF NOT EXISTS "InternalMessage_senderId_createdAt_idx"
  ON "InternalMessage"("senderId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "InternalMessage_recipientId_createdAt_idx"
  ON "InternalMessage"("recipientId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "InternalMessage_targetRole_createdAt_idx"
  ON "InternalMessage"("targetRole", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "InternalMessage_createdAt_id_idx"
  ON "InternalMessage"("createdAt" DESC, "id" DESC);
CREATE INDEX IF NOT EXISTS "CorrespondenceLog_senderId_createdAt_idx"
  ON "CorrespondenceLog"("senderId", "createdAt" DESC);
