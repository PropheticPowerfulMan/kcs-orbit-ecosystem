ALTER TABLE "User" ADD COLUMN "accountBlockedAt" TIMESTAMP(3), ADD COLUMN "accountBlockedReason" TEXT, ADD COLUMN "accountBlockedBy" TEXT;
CREATE INDEX "User_role_accountBlockedAt_idx" ON "User"("role", "accountBlockedAt");
