-- Update UserRole enum for staff portal users.
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'STAFF';

-- Keep the User table aligned with the current Prisma schema.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "staffFunction" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Staff profile records used by the staff portal and registry workflows.
CREATE TABLE IF NOT EXISTS "StaffProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "employeeNumber" TEXT NOT NULL,
    "function" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StaffProfile_userId_key" ON "StaffProfile"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "StaffProfile_employeeNumber_key" ON "StaffProfile"("employeeNumber");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'StaffProfile_userId_fkey'
    ) THEN
        ALTER TABLE "StaffProfile"
        ADD CONSTRAINT "StaffProfile_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Audit log records for administrative activity tracking.
CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AuditLog_targetType_idx" ON "AuditLog"("targetType");
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'AuditLog_actorId_fkey'
    ) THEN
        ALTER TABLE "AuditLog"
        ADD CONSTRAINT "AuditLog_actorId_fkey"
        FOREIGN KEY ("actorId") REFERENCES "User"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
