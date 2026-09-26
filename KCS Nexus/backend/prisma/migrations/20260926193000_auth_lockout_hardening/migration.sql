ALTER TABLE "User"
  ADD COLUMN "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "loginLockedUntil" TIMESTAMP(3),
  ADD COLUMN "lastFailedLoginAt" TIMESTAMP(3),
  ADD COLUMN "lastLoginAt" TIMESTAMP(3),
  ADD COLUMN "passwordChangedAt" TIMESTAMP(3);

CREATE INDEX "User_loginLockedUntil_idx" ON "User"("loginLockedUntil");
