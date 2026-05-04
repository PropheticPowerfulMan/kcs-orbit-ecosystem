-- AlterTable
ALTER TABLE "Parent" ADD COLUMN "organizationId" TEXT;

-- AlterTable
ALTER TABLE "Teacher" ADD COLUMN "organizationId" TEXT;

-- AlterTable
ALTER TABLE "Class" ADD COLUMN "organizationId" TEXT;

-- AlterTable
ALTER TABLE "Student" ADD COLUMN "organizationId" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "organizationId" TEXT;

-- AlterTable
ALTER TABLE "Grade" ADD COLUMN "organizationId" TEXT;

-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN "organizationId" TEXT;

-- AlterTable
ALTER TABLE "Announcement" ADD COLUMN "organizationId" TEXT;

-- CreateIndex
CREATE INDEX "Parent_organizationId_idx" ON "Parent"("organizationId");

-- CreateIndex
CREATE INDEX "Teacher_organizationId_idx" ON "Teacher"("organizationId");

-- CreateIndex
CREATE INDEX "Class_organizationId_idx" ON "Class"("organizationId");

-- CreateIndex
CREATE INDEX "Student_organizationId_idx" ON "Student"("organizationId");

-- CreateIndex
CREATE INDEX "Payment_organizationId_idx" ON "Payment"("organizationId");

-- CreateIndex
CREATE INDEX "Grade_organizationId_idx" ON "Grade"("organizationId");

-- CreateIndex
CREATE INDEX "Attendance_organizationId_idx" ON "Attendance"("organizationId");

-- CreateIndex
CREATE INDEX "Announcement_organizationId_idx" ON "Announcement"("organizationId");

-- AddForeignKey
ALTER TABLE "Parent" ADD CONSTRAINT "Parent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Teacher" ADD CONSTRAINT "Teacher_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Class" ADD CONSTRAINT "Class_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;