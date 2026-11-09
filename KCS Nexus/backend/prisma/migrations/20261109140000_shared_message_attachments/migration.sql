CREATE TABLE "MessageAttachment" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "mime" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "data" BYTEA NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MessageAttachment_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "InternalMessage" ADD COLUMN "sharedAttachmentId" TEXT;
CREATE INDEX "InternalMessage_sharedAttachmentId_idx" ON "InternalMessage"("sharedAttachmentId");
ALTER TABLE "InternalMessage" ADD CONSTRAINT "InternalMessage_sharedAttachmentId_fkey" FOREIGN KEY ("sharedAttachmentId") REFERENCES "MessageAttachment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
