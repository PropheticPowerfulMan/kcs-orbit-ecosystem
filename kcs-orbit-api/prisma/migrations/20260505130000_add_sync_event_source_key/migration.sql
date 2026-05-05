ALTER TABLE "SyncEvent"
ADD COLUMN "sourceEventKey" TEXT;

CREATE UNIQUE INDEX "SyncEvent_organizationId_appSlug_direction_sourceEventKey_key"
ON "SyncEvent"("organizationId", "appSlug", "direction", "sourceEventKey");