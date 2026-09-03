ALTER TABLE "InternalMessage"
ADD COLUMN "attachmentName" TEXT,
ADD COLUMN "attachmentMime" TEXT,
ADD COLUMN "attachmentSize" INTEGER,
ADD COLUMN "attachmentData" BYTEA;
