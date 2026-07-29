CREATE TYPE "TeacherStatus" AS ENUM ('HOMEROOM_TEACHER', 'TEACHER', 'ASSISTANT_TEACHER');
CREATE TYPE "AdmissionInquiryStatus" AS ENUM ('NEW', 'CONTACTED', 'TOUR_SCHEDULED', 'APPLICATION_INVITED', 'CLOSED');
CREATE TYPE "FeeChargeKind" AS ENUM ('STANDARD_FEE', 'DISCOUNT', 'SCHOLARSHIP', 'FAMILY_PAYMENT', 'ADJUSTMENT');
CREATE TYPE "ReportPublicationStatus" AS ENUM ('DRAFT', 'READY_FOR_REVIEW', 'APPROVED', 'EMAILED', 'POSTED_TO_PORTAL');
CREATE TYPE "CorrespondenceChannel" AS ENUM ('EMAIL', 'TEXT', 'LETTER', 'CALL', 'PORTAL');
CREATE TYPE "CorrespondenceStatus" AS ENUM ('DRAFT', 'QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'LOGGED');
CREATE TYPE "DisciplineSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "DisciplineResolutionStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'PARENT_CONTACTED', 'RESOLVED', 'ESCALATED');

ALTER TABLE "TeacherProfile"
  ADD COLUMN "status" "TeacherStatus" NOT NULL DEFAULT 'TEACHER',
  ADD COLUMN "homeroomGrade" TEXT,
  ADD COLUMN "homeroomSection" TEXT;

ALTER TABLE "InternalMessage"
  ADD COLUMN "channel" "CorrespondenceChannel" NOT NULL DEFAULT 'PORTAL';

ALTER TABLE "ReportCard"
  ADD COLUMN "paymentCondition" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
  ADD COLUMN "feeSummary" JSONB,
  ADD COLUMN "publicationStatus" "ReportPublicationStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "emailedAt" TIMESTAMP(3),
  ADD COLUMN "portalPostedAt" TIMESTAMP(3);

CREATE TABLE "TeacherReview" (
  "id" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "reviewerId" TEXT,
  "rating" INTEGER NOT NULL,
  "summary" TEXT NOT NULL,
  "goals" TEXT,
  "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeacherReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FeeCharge" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "kind" "FeeChargeKind" NOT NULL,
  "label" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FeeCharge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdmissionInquiry" (
  "id" TEXT NOT NULL,
  "inquiryNumber" TEXT NOT NULL,
  "parentName" TEXT NOT NULL,
  "parentEmail" TEXT NOT NULL,
  "parentPhone" TEXT,
  "studentName" TEXT,
  "gradeInterest" TEXT NOT NULL,
  "source" TEXT,
  "message" TEXT,
  "status" "AdmissionInquiryStatus" NOT NULL DEFAULT 'NEW',
  "nextFollowUpAt" TIMESTAMP(3),
  "convertedApplicationId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdmissionInquiry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CorrespondenceLog" (
  "id" TEXT NOT NULL,
  "channel" "CorrespondenceChannel" NOT NULL,
  "status" "CorrespondenceStatus" NOT NULL DEFAULT 'LOGGED',
  "subject" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "senderId" TEXT,
  "recipientName" TEXT,
  "recipientEmail" TEXT,
  "recipientPhone" TEXT,
  "studentId" TEXT,
  "reportCardId" TEXT,
  "disciplineCaseId" TEXT,
  "sentAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "failureReason" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CorrespondenceLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DisciplineCase" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "reportedById" TEXT,
  "resolvedById" TEXT,
  "incidentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "category" TEXT NOT NULL,
  "severity" "DisciplineSeverity" NOT NULL DEFAULT 'MEDIUM',
  "gradeImpact" TEXT,
  "incident" TEXT NOT NULL,
  "resolution" TEXT,
  "actionTaken" TEXT,
  "parentNotifiedAt" TIMESTAMP(3),
  "studentNotifiedAt" TIMESTAMP(3),
  "status" "DisciplineResolutionStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DisciplineCase_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdmissionInquiry_inquiryNumber_key" ON "AdmissionInquiry"("inquiryNumber");
CREATE INDEX "AdmissionInquiry_status_idx" ON "AdmissionInquiry"("status");
CREATE INDEX "AdmissionInquiry_createdAt_idx" ON "AdmissionInquiry"("createdAt");
CREATE INDEX "TeacherReview_teacherId_idx" ON "TeacherReview"("teacherId");
CREATE INDEX "TeacherReview_reviewedAt_idx" ON "TeacherReview"("reviewedAt");
CREATE INDEX "FeeCharge_invoiceId_idx" ON "FeeCharge"("invoiceId");
CREATE INDEX "FeeCharge_kind_idx" ON "FeeCharge"("kind");
CREATE INDEX "CorrespondenceLog_channel_idx" ON "CorrespondenceLog"("channel");
CREATE INDEX "CorrespondenceLog_status_idx" ON "CorrespondenceLog"("status");
CREATE INDEX "CorrespondenceLog_createdAt_idx" ON "CorrespondenceLog"("createdAt");
CREATE INDEX "CorrespondenceLog_reportCardId_idx" ON "CorrespondenceLog"("reportCardId");
CREATE INDEX "CorrespondenceLog_disciplineCaseId_idx" ON "CorrespondenceLog"("disciplineCaseId");
CREATE INDEX "DisciplineCase_studentId_idx" ON "DisciplineCase"("studentId");
CREATE INDEX "DisciplineCase_status_idx" ON "DisciplineCase"("status");
CREATE INDEX "DisciplineCase_severity_idx" ON "DisciplineCase"("severity");
CREATE INDEX "DisciplineCase_incidentDate_idx" ON "DisciplineCase"("incidentDate");

ALTER TABLE "TeacherReview" ADD CONSTRAINT "TeacherReview_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TeacherProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeacherReview" ADD CONSTRAINT "TeacherReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FeeCharge" ADD CONSTRAINT "FeeCharge_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "FeeInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CorrespondenceLog" ADD CONSTRAINT "CorrespondenceLog_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CorrespondenceLog" ADD CONSTRAINT "CorrespondenceLog_reportCardId_fkey" FOREIGN KEY ("reportCardId") REFERENCES "ReportCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CorrespondenceLog" ADD CONSTRAINT "CorrespondenceLog_disciplineCaseId_fkey" FOREIGN KEY ("disciplineCaseId") REFERENCES "DisciplineCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DisciplineCase" ADD CONSTRAINT "DisciplineCase_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DisciplineCase" ADD CONSTRAINT "DisciplineCase_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DisciplineCase" ADD CONSTRAINT "DisciplineCase_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
