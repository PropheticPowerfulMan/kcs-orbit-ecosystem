CREATE TABLE "ElectiveCycle" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "academicYear" TEXT NOT NULL,
  "semester" INTEGER NOT NULL,
  "eligibleGrades" TEXT[],
  "choicesPerStudent" INTEGER NOT NULL DEFAULT 6,
  "defaultCapacity" INTEGER NOT NULL DEFAULT 24,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "opensAt" TIMESTAMP(3),
  "closesAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ElectiveCycle_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ElectiveOffering" (
  "id" TEXT NOT NULL, "cycleId" TEXT NOT NULL, "code" TEXT NOT NULL, "name" TEXT NOT NULL,
  "description" TEXT NOT NULL, "eligibleGrades" TEXT[], "capacity" INTEGER NOT NULL DEFAULT 24,
  "teacherUserId" TEXT, "proposedById" TEXT, "status" TEXT NOT NULL DEFAULT 'APPROVED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ElectiveOffering_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ElectiveChoice" (
  "id" TEXT NOT NULL, "cycleId" TEXT NOT NULL, "studentProfileId" TEXT NOT NULL,
  "offeringId" TEXT NOT NULL, "rank" INTEGER NOT NULL, "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ElectiveChoice_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ElectiveAllocation" (
  "id" TEXT NOT NULL, "cycleId" TEXT NOT NULL, "studentProfileId" TEXT NOT NULL,
  "offeringId" TEXT NOT NULL, "preferenceRank" INTEGER NOT NULL, "published" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ElectiveAllocation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ElectiveCycle_academicYear_semester_key" ON "ElectiveCycle"("academicYear","semester");
CREATE INDEX "ElectiveCycle_status_academicYear_idx" ON "ElectiveCycle"("status","academicYear");
CREATE UNIQUE INDEX "ElectiveOffering_cycleId_code_key" ON "ElectiveOffering"("cycleId","code");
CREATE INDEX "ElectiveOffering_cycleId_status_idx" ON "ElectiveOffering"("cycleId","status");
CREATE INDEX "ElectiveOffering_teacherUserId_idx" ON "ElectiveOffering"("teacherUserId");
CREATE UNIQUE INDEX "ElectiveChoice_cycleId_studentProfileId_rank_key" ON "ElectiveChoice"("cycleId","studentProfileId","rank");
CREATE UNIQUE INDEX "ElectiveChoice_cycleId_studentProfileId_offeringId_key" ON "ElectiveChoice"("cycleId","studentProfileId","offeringId");
CREATE INDEX "ElectiveChoice_offeringId_rank_idx" ON "ElectiveChoice"("offeringId","rank");
CREATE UNIQUE INDEX "ElectiveAllocation_cycleId_studentProfileId_offeringId_key" ON "ElectiveAllocation"("cycleId","studentProfileId","offeringId");
CREATE INDEX "ElectiveAllocation_cycleId_studentProfileId_idx" ON "ElectiveAllocation"("cycleId","studentProfileId");
CREATE INDEX "ElectiveAllocation_offeringId_idx" ON "ElectiveAllocation"("offeringId");
ALTER TABLE "ElectiveCycle" ADD CONSTRAINT "ElectiveCycle_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ElectiveOffering" ADD CONSTRAINT "ElectiveOffering_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "ElectiveCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ElectiveOffering" ADD CONSTRAINT "ElectiveOffering_teacherUserId_fkey" FOREIGN KEY ("teacherUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ElectiveOffering" ADD CONSTRAINT "ElectiveOffering_proposedById_fkey" FOREIGN KEY ("proposedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ElectiveChoice" ADD CONSTRAINT "ElectiveChoice_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "ElectiveCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ElectiveChoice" ADD CONSTRAINT "ElectiveChoice_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ElectiveChoice" ADD CONSTRAINT "ElectiveChoice_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "ElectiveOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ElectiveAllocation" ADD CONSTRAINT "ElectiveAllocation_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "ElectiveCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ElectiveAllocation" ADD CONSTRAINT "ElectiveAllocation_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ElectiveAllocation" ADD CONSTRAINT "ElectiveAllocation_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "ElectiveOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE;
