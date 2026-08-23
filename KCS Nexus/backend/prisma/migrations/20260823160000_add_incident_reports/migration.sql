CREATE TYPE "IncidentReportStatus" AS ENUM ('SUBMITTED','UNDER_REVIEW','CLOSED');
CREATE TYPE "IncidentConfidentiality" AS ENUM ('STANDARD','CONFIDENTIAL');
CREATE TABLE "IncidentReport" ("id" TEXT NOT NULL,"reference" TEXT NOT NULL,"title" TEXT NOT NULL,"category" TEXT NOT NULL,"occurredAt" TIMESTAMP(3) NOT NULL,"location" TEXT NOT NULL,"description" TEXT NOT NULL,"peopleInvolved" TEXT,"immediateActions" TEXT,"confidentiality" "IncidentConfidentiality" NOT NULL DEFAULT 'STANDARD',"status" "IncidentReportStatus" NOT NULL DEFAULT 'SUBMITTED',"adminNotes" TEXT,"authorId" TEXT NOT NULL,"authorRole" "UserRole" NOT NULL,"authorName" TEXT NOT NULL,"attachmentName" TEXT,"attachmentMime" TEXT,"attachmentSize" INTEGER,"attachmentData" BYTEA,"verificationHash" TEXT NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "IncidentReport_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "IncidentReport_reference_key" ON "IncidentReport"("reference");
CREATE UNIQUE INDEX "IncidentReport_verificationHash_key" ON "IncidentReport"("verificationHash");
CREATE INDEX "IncidentReport_authorId_createdAt_idx" ON "IncidentReport"("authorId","createdAt");
CREATE INDEX "IncidentReport_status_createdAt_idx" ON "IncidentReport"("status","createdAt");
