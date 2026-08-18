ALTER TABLE "User"
  ADD COLUMN "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "twoFactorSecret" TEXT,
  ADD COLUMN "twoFactorVerifiedAt" TIMESTAMP(3);

CREATE TABLE "TeacherWorkspace" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "state" JSONB NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TeacherWorkspace_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TeacherWorkspace_userId_key" ON "TeacherWorkspace"("userId");
ALTER TABLE "TeacherWorkspace" ADD CONSTRAINT "TeacherWorkspace_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Suggestion" (
  "id" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "anonymousRole" "UserRole" NOT NULL,
  "category" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'New',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Suggestion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Suggestion_createdAt_idx" ON "Suggestion"("createdAt");
CREATE INDEX "Suggestion_status_idx" ON "Suggestion"("status");
ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
