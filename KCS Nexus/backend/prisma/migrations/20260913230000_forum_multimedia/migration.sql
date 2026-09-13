ALTER TABLE "ParentForumPost" ADD COLUMN "attachmentType" TEXT, ADD COLUMN "attachmentData" TEXT, ADD COLUMN "attachmentName" TEXT;
ALTER TABLE "ParentForumComment" ADD COLUMN "attachmentType" TEXT, ADD COLUMN "attachmentData" TEXT, ADD COLUMN "attachmentName" TEXT;
ALTER TABLE "StudentForumComment" ADD COLUMN "attachmentType" TEXT, ADD COLUMN "attachmentData" TEXT, ADD COLUMN "attachmentName" TEXT;
