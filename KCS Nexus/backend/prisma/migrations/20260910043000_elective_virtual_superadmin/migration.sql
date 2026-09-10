ALTER TABLE "ElectiveCycle" ALTER COLUMN "createdById" DROP NOT NULL;
ALTER TABLE "ElectiveCycle" DROP CONSTRAINT IF EXISTS "ElectiveCycle_createdById_fkey";
ALTER TABLE "ElectiveCycle" ADD CONSTRAINT "ElectiveCycle_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
