ALTER TABLE "ReportCard"
  ADD COLUMN "attendanceSummary" JSONB;

CREATE TABLE "StaffAttendanceRecord" (
  "id" TEXT NOT NULL,
  "staffOrbitId" TEXT NOT NULL,
  "employeeNumber" TEXT,
  "staffName" TEXT NOT NULL,
  "staffEmail" TEXT,
  "department" TEXT,
  "date" TIMESTAMP(3) NOT NULL,
  "status" "AttendanceStatus" NOT NULL,
  "arrivalTime" TEXT,
  "departureTime" TEXT,
  "note" TEXT,
  "recordedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StaffAttendanceRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StaffAttendanceRecord_staffOrbitId_date_key" ON "StaffAttendanceRecord"("staffOrbitId", "date");
CREATE INDEX "StaffAttendanceRecord_date_idx" ON "StaffAttendanceRecord"("date");
CREATE INDEX "StaffAttendanceRecord_staffEmail_idx" ON "StaffAttendanceRecord"("staffEmail");
CREATE INDEX "StaffAttendanceRecord_status_idx" ON "StaffAttendanceRecord"("status");

ALTER TABLE "StaffAttendanceRecord"
  ADD CONSTRAINT "StaffAttendanceRecord_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
