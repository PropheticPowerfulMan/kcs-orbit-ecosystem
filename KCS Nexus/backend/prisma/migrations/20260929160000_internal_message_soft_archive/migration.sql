ALTER TABLE "InternalMessage"
  ADD COLUMN "senderArchivedAt" TIMESTAMP(3),
  ADD COLUMN "recipientArchivedAt" TIMESTAMP(3);

CREATE INDEX "InternalMessage_senderId_senderArchivedAt_createdAt_idx"
  ON "InternalMessage"("senderId", "senderArchivedAt", "createdAt");
CREATE INDEX "InternalMessage_recipientId_recipientArchivedAt_createdAt_idx"
  ON "InternalMessage"("recipientId", "recipientArchivedAt", "createdAt");
