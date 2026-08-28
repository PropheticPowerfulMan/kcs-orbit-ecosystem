-- CreateEnum
CREATE TYPE "BankTransferRequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'NEEDS_MORE_INFO', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentProofStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'SUPERSEDED');

-- CreateTable
CREATE TABLE "BankTransferRequest" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "paymentId" TEXT,
    "status" "BankTransferRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "amount" DOUBLE PRECISION NOT NULL,
    "bankName" TEXT NOT NULL,
    "referenceNumber" TEXT NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "payerName" TEXT NOT NULL,
    "comment" TEXT,
    "reviewReason" TEXT,
    "possibleDuplicate" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankTransferRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankTransferRequestAllocation" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "installmentId" TEXT NOT NULL,
    "feeLabel" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankTransferRequestAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentProof" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "PaymentProofStatus" NOT NULL DEFAULT 'PENDING',
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),

    CONSTRAINT "PaymentProof_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BankTransferRequest_paymentId_key" ON "BankTransferRequest"("paymentId");

-- CreateIndex
CREATE INDEX "BankTransferRequest_schoolId_status_submittedAt_idx" ON "BankTransferRequest"("schoolId", "status", "submittedAt");

-- CreateIndex
CREATE INDEX "BankTransferRequest_schoolId_bankName_referenceNumber_payme_idx" ON "BankTransferRequest"("schoolId", "bankName", "referenceNumber", "paymentDate");

-- CreateIndex
CREATE INDEX "BankTransferRequestAllocation_studentId_idx" ON "BankTransferRequestAllocation"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "BankTransferRequestAllocation_requestId_installmentId_key" ON "BankTransferRequestAllocation"("requestId", "installmentId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentProof_storageKey_key" ON "PaymentProof"("storageKey");

-- CreateIndex
CREATE INDEX "PaymentProof_schoolId_sha256_idx" ON "PaymentProof"("schoolId", "sha256");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentProof_requestId_version_key" ON "PaymentProof"("requestId", "version");

-- AddForeignKey
ALTER TABLE "BankTransferRequest" ADD CONSTRAINT "BankTransferRequest_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankTransferRequest" ADD CONSTRAINT "BankTransferRequest_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankTransferRequest" ADD CONSTRAINT "BankTransferRequest_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankTransferRequest" ADD CONSTRAINT "BankTransferRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankTransferRequestAllocation" ADD CONSTRAINT "BankTransferRequestAllocation_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "BankTransferRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankTransferRequestAllocation" ADD CONSTRAINT "BankTransferRequestAllocation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankTransferRequestAllocation" ADD CONSTRAINT "BankTransferRequestAllocation_installmentId_fkey" FOREIGN KEY ("installmentId") REFERENCES "PaymentInstallment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentProof" ADD CONSTRAINT "PaymentProof_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentProof" ADD CONSTRAINT "PaymentProof_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "BankTransferRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentProof" ADD CONSTRAINT "PaymentProof_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentProof" ADD CONSTRAINT "PaymentProof_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
