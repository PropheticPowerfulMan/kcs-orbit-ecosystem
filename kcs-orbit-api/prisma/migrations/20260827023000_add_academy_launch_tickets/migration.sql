ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';

CREATE TABLE "AcademyLaunchTicket" (
  "id" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AcademyLaunchTicket_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AcademyLaunchTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AcademyLaunchTicket_tokenHash_key" ON "AcademyLaunchTicket"("tokenHash");
CREATE INDEX "AcademyLaunchTicket_userId_createdAt_idx" ON "AcademyLaunchTicket"("userId", "createdAt");
CREATE INDEX "AcademyLaunchTicket_organizationId_expiresAt_idx" ON "AcademyLaunchTicket"("organizationId", "expiresAt");
CREATE TABLE "AcademySession" (
  "id" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AcademySession_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AcademySession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AcademySession_tokenHash_key" ON "AcademySession"("tokenHash");
CREATE INDEX "AcademySession_userId_expiresAt_idx" ON "AcademySession"("userId", "expiresAt");
CREATE INDEX "AcademySession_organizationId_expiresAt_idx" ON "AcademySession"("organizationId", "expiresAt");
