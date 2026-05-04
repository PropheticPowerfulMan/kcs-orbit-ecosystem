DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AttendanceStatus') THEN
        CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED', 'SICK', 'SUSPENDED');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FeeStatus') THEN
        CREATE TYPE "FeeStatus" AS ENUM ('PENDING', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'WAIVED');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS "AttendanceRecord" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "recordedById" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "className" TEXT NOT NULL,
    "period" TEXT,
    "subject" TEXT,
    "status" "AttendanceStatus" NOT NULL,
    "note" TEXT,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "InternalMessage" (
    "id" TEXT NOT NULL,
    "senderId" TEXT,
    "recipientId" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "targetRole" "UserRole",
    "readAt" TIMESTAMP(3),
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InternalMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ReportCard" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "average" DOUBLE PRECISION NOT NULL,
    "conduct" TEXT,
    "teacherComment" TEXT,
    "principalStatus" TEXT NOT NULL DEFAULT 'DRAFT',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "pdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportCard_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Transcript" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicYears" TEXT NOT NULL,
    "credits" DOUBLE PRECISION NOT NULL,
    "cumulativeGpa" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "pdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transcript_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FeeInvoice" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "invoiceNo" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL,
    "status" "FeeStatus" NOT NULL DEFAULT 'PENDING',
    "dueDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeeInvoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FeePayment" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receiptUrl" TEXT,

    CONSTRAINT "FeePayment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AttendanceRecord_date_idx" ON "AttendanceRecord"("date");
CREATE INDEX IF NOT EXISTS "AttendanceRecord_status_idx" ON "AttendanceRecord"("status");
CREATE UNIQUE INDEX IF NOT EXISTS "AttendanceRecord_studentId_date_className_period_key" ON "AttendanceRecord"("studentId", "date", "className", "period");
CREATE INDEX IF NOT EXISTS "InternalMessage_targetRole_idx" ON "InternalMessage"("targetRole");
CREATE INDEX IF NOT EXISTS "InternalMessage_createdAt_idx" ON "InternalMessage"("createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "ReportCard_studentId_term_key" ON "ReportCard"("studentId", "term");
CREATE UNIQUE INDEX IF NOT EXISTS "FeeInvoice_invoiceNo_key" ON "FeeInvoice"("invoiceNo");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AttendanceRecord_studentId_fkey') THEN
        ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AttendanceRecord_recordedById_fkey') THEN
        ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InternalMessage_senderId_fkey') THEN
        ALTER TABLE "InternalMessage" ADD CONSTRAINT "InternalMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InternalMessage_recipientId_fkey') THEN
        ALTER TABLE "InternalMessage" ADD CONSTRAINT "InternalMessage_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ReportCard_studentId_fkey') THEN
        ALTER TABLE "ReportCard" ADD CONSTRAINT "ReportCard_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ReportCard_approvedById_fkey') THEN
        ALTER TABLE "ReportCard" ADD CONSTRAINT "ReportCard_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Transcript_studentId_fkey') THEN
        ALTER TABLE "Transcript" ADD CONSTRAINT "Transcript_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FeeInvoice_studentId_fkey') THEN
        ALTER TABLE "FeeInvoice" ADD CONSTRAINT "FeeInvoice_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FeePayment_invoiceId_fkey') THEN
        ALTER TABLE "FeePayment" ADD CONSTRAINT "FeePayment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "FeeInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
