ALTER TABLE "User" ADD COLUMN "orbitUserId" TEXT;
ALTER TABLE "User" ADD COLUMN "orbitOrganizationId" TEXT;
CREATE UNIQUE INDEX "User_orbitUserId_key" ON "User"("orbitUserId");
