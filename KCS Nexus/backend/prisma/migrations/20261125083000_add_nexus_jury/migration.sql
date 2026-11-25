-- CreateTable
CREATE TABLE "JuryProject" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "objectives" TEXT NOT NULL DEFAULT '',
    "instructions" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL DEFAULT 'PROJECT_PRESENTATION',
    "mode" TEXT NOT NULL DEFAULT 'INDIVIDUAL',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "academicYear" TEXT NOT NULL,
    "semester" INTEGER NOT NULL,
    "quarter" INTEGER NOT NULL,
    "term" TEXT NOT NULL,
    "maximum" DECIMAL(20,8) NOT NULL,
    "settings" JSONB NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "resultVersion" INTEGER NOT NULL DEFAULT 0,
    "ownerReference" TEXT NOT NULL,
    "registrationDeadline" TIMESTAMP(3),
    "submissionDeadline" TIMESTAMP(3),
    "presentationAt" TIMESTAMP(3),
    "durationSeconds" INTEGER NOT NULL DEFAULT 600,
    "venue" TEXT NOT NULL DEFAULT '',
    "archivedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ownerId" TEXT,
    "activeRubricId" TEXT,

    CONSTRAINT "JuryProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JuryProjectCourse" (
    "id" TEXT NOT NULL,
    "courseReference" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "courseId" TEXT,

    CONSTRAINT "JuryProjectCourse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JuryProjectSession" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "venue" TEXT NOT NULL DEFAULT '',
    "state" TEXT NOT NULL DEFAULT 'WAITING',
    "startedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "elapsedMilliseconds" INTEGER NOT NULL DEFAULT 0,
    "durationSeconds" INTEGER NOT NULL DEFAULT 600,
    "questionsSeconds" INTEGER NOT NULL DEFAULT 180,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "displayTokenHash" TEXT,
    "displayExpiresAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "projectId" TEXT NOT NULL,
    "currentCandidateId" TEXT,

    CONSTRAINT "JuryProjectSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JuryParticipant" (
    "id" TEXT NOT NULL,
    "studentReference" TEXT NOT NULL,
    "displayNameSnapshot" TEXT NOT NULL,
    "gradeSnapshot" TEXT NOT NULL,
    "sectionSnapshot" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "statusReason" TEXT NOT NULL DEFAULT '',
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "projectId" TEXT NOT NULL,
    "studentId" TEXT,

    CONSTRAINT "JuryParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JuryGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "topic" TEXT NOT NULL DEFAULT '',
    "leaderParticipantId" TEXT,
    "avatarAttachmentId" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "JuryGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JuryGroupMember" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,

    CONSTRAINT "JuryGroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JuryCandidate" (
    "id" TEXT NOT NULL,
    "topic" TEXT NOT NULL DEFAULT '',
    "position" INTEGER NOT NULL,
    "checkIn" TEXT NOT NULL DEFAULT 'PENDING',
    "checkInAt" TIMESTAMP(3),
    "statusReason" TEXT NOT NULL DEFAULT '',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "projectId" TEXT NOT NULL,
    "participantId" TEXT,
    "groupId" TEXT,

    CONSTRAINT "JuryCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JuryPanel" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "projectId" TEXT NOT NULL,
    "presidentId" TEXT,

    CONSTRAINT "JuryPanel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JuryInvitation" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByReference" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "JuryInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JuryMember" (
    "id" TEXT NOT NULL,
    "userReference" TEXT,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "weight" DECIMAL(20,8) NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'INVITED',
    "availability" JSONB NOT NULL,
    "conflictOfInterest" BOOLEAN NOT NULL DEFAULT false,
    "conflictReason" TEXT NOT NULL DEFAULT '',
    "conflictAcknowledgedBy" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "panelId" TEXT NOT NULL,
    "userId" TEXT,
    "invitationId" TEXT,

    CONSTRAINT "JuryMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JuryAssignment" (
    "id" TEXT NOT NULL,
    "criterionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "memberId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,

    CONSTRAINT "JuryAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JuryRubricTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "visibility" TEXT NOT NULL DEFAULT 'PRIVATE',
    "definition" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ownerId" TEXT,

    CONSTRAINT "JuryRubricTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JuryRubricVersion" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "title" TEXT NOT NULL,
    "maximum" DECIMAL(20,8) NOT NULL,
    "weightingMode" TEXT NOT NULL DEFAULT 'MANUAL',
    "sourceTemplateId" TEXT,
    "sourceTemplateVersion" INTEGER,
    "lockedAt" TIMESTAMP(3),
    "definitionHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "JuryRubricVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JuryCriterion" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "instructions" TEXT NOT NULL DEFAULT '',
    "maximum" DECIMAL(20,8) NOT NULL,
    "weight" DECIMAL(20,8) NOT NULL,
    "mandatory" BOOLEAN NOT NULL DEFAULT true,
    "applicability" TEXT NOT NULL DEFAULT 'BOTH',
    "commentRule" TEXT NOT NULL DEFAULT 'OPTIONAL',
    "commentThreshold" DECIMAL(20,8) NOT NULL DEFAULT 50,
    "minimumJudges" INTEGER NOT NULL DEFAULT 1,
    "position" INTEGER NOT NULL,
    "rubricVersionId" TEXT NOT NULL,
    "parentId" TEXT,

    CONSTRAINT "JuryCriterion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JuryPerformanceLevel" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "minimum" DECIMAL(20,8) NOT NULL,
    "maximum" DECIMAL(20,8) NOT NULL,
    "position" INTEGER NOT NULL,
    "criterionId" TEXT NOT NULL,

    CONSTRAINT "JuryPerformanceLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JuryEvaluation" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "comment" TEXT NOT NULL DEFAULT '',
    "total" DECIMAL(20,8),
    "submittedAt" TIMESTAMP(3),
    "reopenedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "rubricVersionId" TEXT NOT NULL,

    CONSTRAINT "JuryEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JuryEvaluationScore" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'UNSCORED',
    "points" DECIMAL(20,8),
    "comment" TEXT NOT NULL DEFAULT '',
    "evaluationId" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,

    CONSTRAINT "JuryEvaluationScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JuryEvaluationRevision" (
    "id" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "requestId" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "action" TEXT NOT NULL,
    "actorReference" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "evaluationId" TEXT NOT NULL,

    CONSTRAINT "JuryEvaluationRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JuryReopenRequest" (
    "id" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projectId" TEXT NOT NULL,
    "evaluationId" TEXT,

    CONSTRAINT "JuryReopenRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JuryResultRun" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "settings" JSONB NOT NULL,
    "checksum" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_VALIDATION',
    "approvedByReference" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projectId" TEXT NOT NULL,
    "rubricVersionId" TEXT NOT NULL,

    CONSTRAINT "JuryResultRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JuryCandidateResult" (
    "id" TEXT NOT NULL,
    "score" DECIMAL(20,8),
    "maximum" DECIMAL(20,8) NOT NULL,
    "percentage" DECIMAL(20,8),
    "judgeCount" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "statistics" JSONB NOT NULL,
    "criterionResults" JSONB NOT NULL,
    "flags" JSONB NOT NULL,
    "runId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,

    CONSTRAINT "JuryCandidateResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JuryStudentResult" (
    "id" TEXT NOT NULL,
    "groupScore" DECIMAL(20,8),
    "individualScore" DECIMAL(20,8),
    "score" DECIMAL(20,8),
    "maximum" DECIMAL(20,8) NOT NULL,
    "percentage" DECIMAL(20,8),
    "status" TEXT NOT NULL,
    "rank" INTEGER,
    "feedback" TEXT NOT NULL DEFAULT '',
    "runId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,

    CONSTRAINT "JuryStudentResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JuryPublicationPreview" (
    "id" TEXT NOT NULL,
    "actorReference" TEXT NOT NULL,
    "courseReference" TEXT NOT NULL,
    "teacherReference" TEXT NOT NULL,
    "request" JSONB NOT NULL,
    "resultVersion" INTEGER NOT NULL,
    "workspaceRevision" INTEGER NOT NULL,
    "previewHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "JuryPublicationPreview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JuryGradebookLink" (
    "id" TEXT NOT NULL,
    "courseReference" TEXT NOT NULL,
    "teacherReference" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "columnId" TEXT NOT NULL,
    "latestPublicationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projectId" TEXT NOT NULL,
    "courseId" TEXT,

    CONSTRAINT "JuryGradebookLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JuryPublication" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "courseReference" TEXT NOT NULL,
    "teacherReference" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "columnId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'VERIFIED',
    "workspaceRevisionBefore" INTEGER NOT NULL,
    "workspaceRevisionAfter" INTEGER NOT NULL,
    "actorReference" TEXT NOT NULL,
    "receiptReference" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projectId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "courseId" TEXT,

    CONSTRAINT "JuryPublication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JuryPublicationItem" (
    "id" TEXT NOT NULL,
    "studentReference" TEXT NOT NULL,
    "previousValue" JSONB NOT NULL,
    "points" DECIMAL(20,8) NOT NULL,
    "maximum" DECIMAL(20,8) NOT NULL,
    "verifiedHash" TEXT NOT NULL,
    "publicationId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,

    CONSTRAINT "JuryPublicationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JurySubmission" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "repositoryUrl" TEXT,
    "demonstrationUrl" TEXT,
    "links" JSONB NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "projectId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,

    CONSTRAINT "JurySubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JuryAttachment" (
    "id" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "uploadedByReference" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),
    "projectId" TEXT NOT NULL,
    "submissionId" TEXT,

    CONSTRAINT "JuryAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JuryAward" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "rule" JSONB NOT NULL,
    "decisionReason" TEXT NOT NULL,
    "grantedByReference" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projectId" TEXT NOT NULL,
    "candidateId" TEXT,
    "participantId" TEXT,

    CONSTRAINT "JuryAward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JuryCertificate" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "verificationHash" TEXT NOT NULL,
    "documentHash" TEXT NOT NULL,
    "issuedByReference" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "settings" JSONB NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "revocationReason" TEXT,
    "projectId" TEXT NOT NULL,
    "participantId" TEXT,
    "memberId" TEXT,

    CONSTRAINT "JuryCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JuryAudit" (
    "id" TEXT NOT NULL,
    "actorReference" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projectId" TEXT,

    CONSTRAINT "JuryAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JuryOutbox" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "deduplicationKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projectId" TEXT,

    CONSTRAINT "JuryOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JuryAppSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "csrfToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "invitationId" TEXT,

    CONSTRAINT "JuryAppSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JuryLaunchTicket" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "JuryLaunchTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JuryDraftKey" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "wrappedKey" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "invitationId" TEXT,

    CONSTRAINT "JuryDraftKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JuryRoleGrant" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "grantedByReference" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "JuryRoleGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JuryProject_academicYear_semester_quarter_status_idx" ON "JuryProject"("academicYear", "semester", "quarter", "status");

-- CreateIndex
CREATE INDEX "JuryProject_ownerReference_status_updatedAt_idx" ON "JuryProject"("ownerReference", "status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "JuryProjectCourse_projectId_courseReference_key" ON "JuryProjectCourse"("projectId", "courseReference");

-- CreateIndex
CREATE UNIQUE INDEX "JuryProjectSession_displayTokenHash_key" ON "JuryProjectSession"("displayTokenHash");

-- CreateIndex
CREATE INDEX "JuryParticipant_studentReference_projectId_idx" ON "JuryParticipant"("studentReference", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "JuryParticipant_projectId_studentReference_key" ON "JuryParticipant"("projectId", "studentReference");

-- CreateIndex
CREATE UNIQUE INDEX "JuryGroup_projectId_name_key" ON "JuryGroup"("projectId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "JuryGroupMember_projectId_participantId_key" ON "JuryGroupMember"("projectId", "participantId");

-- CreateIndex
CREATE INDEX "JuryCandidate_projectId_position_idx" ON "JuryCandidate"("projectId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "JuryCandidate_projectId_participantId_key" ON "JuryCandidate"("projectId", "participantId");

-- CreateIndex
CREATE UNIQUE INDEX "JuryCandidate_projectId_groupId_key" ON "JuryCandidate"("projectId", "groupId");

-- CreateIndex
CREATE UNIQUE INDEX "JuryPanel_projectId_key" ON "JuryPanel"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "JuryInvitation_tokenHash_key" ON "JuryInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX "JuryInvitation_projectId_email_idx" ON "JuryInvitation"("projectId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "JuryMember_panelId_userReference_key" ON "JuryMember"("panelId", "userReference");

-- CreateIndex
CREATE UNIQUE INDEX "JuryMember_panelId_invitationId_key" ON "JuryMember"("panelId", "invitationId");

-- CreateIndex
CREATE UNIQUE INDEX "JuryAssignment_memberId_candidateId_key" ON "JuryAssignment"("memberId", "candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "JuryRubricVersion_projectId_version_key" ON "JuryRubricVersion"("projectId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "JuryCriterion_rubricVersionId_key_key" ON "JuryCriterion"("rubricVersionId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "JuryEvaluation_assignmentId_rubricVersionId_key" ON "JuryEvaluation"("assignmentId", "rubricVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "JuryEvaluationScore_evaluationId_criterionId_key" ON "JuryEvaluationScore"("evaluationId", "criterionId");

-- CreateIndex
CREATE UNIQUE INDEX "JuryEvaluationRevision_evaluationId_requestId_key" ON "JuryEvaluationRevision"("evaluationId", "requestId");

-- CreateIndex
CREATE UNIQUE INDEX "JuryEvaluationRevision_evaluationId_revision_key" ON "JuryEvaluationRevision"("evaluationId", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "JuryResultRun_projectId_version_key" ON "JuryResultRun"("projectId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "JuryCandidateResult_runId_candidateId_key" ON "JuryCandidateResult"("runId", "candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "JuryStudentResult_runId_participantId_key" ON "JuryStudentResult"("runId", "participantId");

-- CreateIndex
CREATE UNIQUE INDEX "JuryGradebookLink_projectId_courseReference_academicYear_te_key" ON "JuryGradebookLink"("projectId", "courseReference", "academicYear", "term");

-- CreateIndex
CREATE UNIQUE INDEX "JuryPublication_receiptReference_key" ON "JuryPublication"("receiptReference");

-- CreateIndex
CREATE UNIQUE INDEX "JuryPublication_projectId_idempotencyKey_key" ON "JuryPublication"("projectId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "JuryPublication_projectId_runId_courseReference_academicYea_key" ON "JuryPublication"("projectId", "runId", "courseReference", "academicYear", "term");

-- CreateIndex
CREATE UNIQUE INDEX "JuryPublicationItem_publicationId_studentReference_key" ON "JuryPublicationItem"("publicationId", "studentReference");

-- CreateIndex
CREATE UNIQUE INDEX "JuryAttachment_storageKey_key" ON "JuryAttachment"("storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "JuryCertificate_reference_key" ON "JuryCertificate"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "JuryCertificate_verificationHash_key" ON "JuryCertificate"("verificationHash");

-- CreateIndex
CREATE INDEX "JuryAudit_projectId_createdAt_idx" ON "JuryAudit"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "JuryAudit_actorReference_createdAt_idx" ON "JuryAudit"("actorReference", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "JuryOutbox_deduplicationKey_key" ON "JuryOutbox"("deduplicationKey");

-- CreateIndex
CREATE INDEX "JuryOutbox_status_nextAttemptAt_idx" ON "JuryOutbox"("status", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "JuryAppSession_tokenHash_key" ON "JuryAppSession"("tokenHash");

-- CreateIndex
CREATE INDEX "JuryAppSession_userId_expiresAt_idx" ON "JuryAppSession"("userId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "JuryLaunchTicket_tokenHash_key" ON "JuryLaunchTicket"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "JuryDraftKey_userId_deviceId_key" ON "JuryDraftKey"("userId", "deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "JuryDraftKey_invitationId_deviceId_key" ON "JuryDraftKey"("invitationId", "deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "JuryRoleGrant_userId_role_key" ON "JuryRoleGrant"("userId", "role");

-- AddForeignKey
ALTER TABLE "JuryProject" ADD CONSTRAINT "JuryProject_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JuryProject" ADD CONSTRAINT "JuryProject_activeRubricId_fkey" FOREIGN KEY ("activeRubricId") REFERENCES "JuryRubricVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JuryProjectCourse" ADD CONSTRAINT "JuryProjectCourse_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "JuryProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JuryProjectCourse" ADD CONSTRAINT "JuryProjectCourse_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JuryProjectSession" ADD CONSTRAINT "JuryProjectSession_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "JuryProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JuryProjectSession" ADD CONSTRAINT "JuryProjectSession_currentCandidateId_fkey" FOREIGN KEY ("currentCandidateId") REFERENCES "JuryCandidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JuryParticipant" ADD CONSTRAINT "JuryParticipant_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "JuryProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JuryParticipant" ADD CONSTRAINT "JuryParticipant_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JuryGroup" ADD CONSTRAINT "JuryGroup_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "JuryProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JuryGroupMember" ADD CONSTRAINT "JuryGroupMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "JuryProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JuryGroupMember" ADD CONSTRAINT "JuryGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "JuryGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JuryGroupMember" ADD CONSTRAINT "JuryGroupMember_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "JuryParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JuryCandidate" ADD CONSTRAINT "JuryCandidate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "JuryProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JuryCandidate" ADD CONSTRAINT "JuryCandidate_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "JuryParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JuryCandidate" ADD CONSTRAINT "JuryCandidate_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "JuryGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JuryPanel" ADD CONSTRAINT "JuryPanel_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "JuryProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JuryPanel" ADD CONSTRAINT "JuryPanel_presidentId_fkey" FOREIGN KEY ("presidentId") REFERENCES "JuryMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JuryInvitation" ADD CONSTRAINT "JuryInvitation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "JuryProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JuryMember" ADD CONSTRAINT "JuryMember_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "JuryPanel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JuryMember" ADD CONSTRAINT "JuryMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JuryMember" ADD CONSTRAINT "JuryMember_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "JuryInvitation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JuryAssignment" ADD CONSTRAINT "JuryAssignment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "JuryMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JuryAssignment" ADD CONSTRAINT "JuryAssignment_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "JuryCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JuryRubricTemplate" ADD CONSTRAINT "JuryRubricTemplate_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JuryRubricVersion" ADD CONSTRAINT "JuryRubricVersion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "JuryProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JuryCriterion" ADD CONSTRAINT "JuryCriterion_rubricVersionId_fkey" FOREIGN KEY ("rubricVersionId") REFERENCES "JuryRubricVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JuryCriterion" ADD CONSTRAINT "JuryCriterion_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "JuryCriterion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JuryPerformanceLevel" ADD CONSTRAINT "JuryPerformanceLevel_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "JuryCriterion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JuryEvaluation" ADD CONSTRAINT "JuryEvaluation_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "JuryAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JuryEvaluation" ADD CONSTRAINT "JuryEvaluation_rubricVersionId_fkey" FOREIGN KEY ("rubricVersionId") REFERENCES "JuryRubricVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JuryEvaluationScore" ADD CONSTRAINT "JuryEvaluationScore_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "JuryEvaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JuryEvaluationScore" ADD CONSTRAINT "JuryEvaluationScore_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "JuryCriterion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JuryEvaluationRevision" ADD CONSTRAINT "JuryEvaluationRevision_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "JuryEvaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JuryReopenRequest" ADD CONSTRAINT "JuryReopenRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "JuryProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JuryReopenRequest" ADD CONSTRAINT "JuryReopenRequest_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "JuryEvaluation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JuryResultRun" ADD CONSTRAINT "JuryResultRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "JuryProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JuryResultRun" ADD CONSTRAINT "JuryResultRun_rubricVersionId_fkey" FOREIGN KEY ("rubricVersionId") REFERENCES "JuryRubricVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JuryCandidateResult" ADD CONSTRAINT "JuryCandidateResult_runId_fkey" FOREIGN KEY ("runId") REFERENCES "JuryResultRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JuryCandidateResult" ADD CONSTRAINT "JuryCandidateResult_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "JuryCandidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JuryStudentResult" ADD CONSTRAINT "JuryStudentResult_runId_fkey" FOREIGN KEY ("runId") REFERENCES "JuryResultRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JuryStudentResult" ADD CONSTRAINT "JuryStudentResult_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "JuryParticipant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JuryPublicationPreview" ADD CONSTRAINT "JuryPublicationPreview_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "JuryProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JuryGradebookLink" ADD CONSTRAINT "JuryGradebookLink_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "JuryProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JuryGradebookLink" ADD CONSTRAINT "JuryGradebookLink_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JuryPublication" ADD CONSTRAINT "JuryPublication_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "JuryProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JuryPublication" ADD CONSTRAINT "JuryPublication_runId_fkey" FOREIGN KEY ("runId") REFERENCES "JuryResultRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JuryPublication" ADD CONSTRAINT "JuryPublication_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JuryPublicationItem" ADD CONSTRAINT "JuryPublicationItem_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "JuryPublication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JuryPublicationItem" ADD CONSTRAINT "JuryPublicationItem_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "JuryParticipant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JurySubmission" ADD CONSTRAINT "JurySubmission_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "JuryProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JurySubmission" ADD CONSTRAINT "JurySubmission_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "JuryCandidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JuryAttachment" ADD CONSTRAINT "JuryAttachment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "JuryProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JuryAttachment" ADD CONSTRAINT "JuryAttachment_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "JurySubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JuryAward" ADD CONSTRAINT "JuryAward_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "JuryProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JuryAward" ADD CONSTRAINT "JuryAward_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "JuryCandidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JuryAward" ADD CONSTRAINT "JuryAward_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "JuryParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JuryCertificate" ADD CONSTRAINT "JuryCertificate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "JuryProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JuryCertificate" ADD CONSTRAINT "JuryCertificate_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "JuryParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JuryCertificate" ADD CONSTRAINT "JuryCertificate_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "JuryMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JuryAudit" ADD CONSTRAINT "JuryAudit_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "JuryProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JuryOutbox" ADD CONSTRAINT "JuryOutbox_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "JuryProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JuryAppSession" ADD CONSTRAINT "JuryAppSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JuryAppSession" ADD CONSTRAINT "JuryAppSession_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "JuryInvitation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JuryLaunchTicket" ADD CONSTRAINT "JuryLaunchTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JuryDraftKey" ADD CONSTRAINT "JuryDraftKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JuryDraftKey" ADD CONSTRAINT "JuryDraftKey_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "JuryInvitation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JuryRoleGrant" ADD CONSTRAINT "JuryRoleGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- New-table domain invariants. Existing academic tables are not altered.
ALTER TABLE "JuryProject" ADD CONSTRAINT "JuryProject_period_check" CHECK (quarter BETWEEN 1 AND 4 AND semester=CASE WHEN quarter<=2 THEN 1 ELSE 2 END AND maximum>0);
ALTER TABLE "JuryCandidate" ADD CONSTRAINT "JuryCandidate_identity_check" CHECK (("participantId" IS NOT NULL)::int + ("groupId" IS NOT NULL)::int = 1);
ALTER TABLE "JuryAppSession" ADD CONSTRAINT "JuryAppSession_identity_check" CHECK (("userId" IS NOT NULL)::int + ("invitationId" IS NOT NULL)::int = 1);
ALTER TABLE "JuryDraftKey" ADD CONSTRAINT "JuryDraftKey_identity_check" CHECK (("userId" IS NOT NULL)::int + ("invitationId" IS NOT NULL)::int = 1);
ALTER TABLE "JuryEvaluationScore" ADD CONSTRAINT "JuryEvaluationScore_value_check" CHECK ((kind='SCORED' AND points IS NOT NULL AND points>=0) OR (kind IN ('UNSCORED','NOT_APPLICABLE') AND points IS NULL));
ALTER TABLE "JuryMember" ADD CONSTRAINT "JuryMember_weight_check" CHECK (weight>0);
ALTER TABLE "JuryCriterion" ADD CONSTRAINT "JuryCriterion_values_check" CHECK (maximum>0 AND weight>0 AND "minimumJudges">0);
