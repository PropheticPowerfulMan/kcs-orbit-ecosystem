ALTER TABLE "Event"
  ADD COLUMN "audienceRoles" "UserRole"[] NOT NULL DEFAULT ARRAY['ADMIN','STAFF','TEACHER','STUDENT','PARENT']::"UserRole"[],
  ADD COLUMN "audienceGrades" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "reminderEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "reminderDaysBefore" INTEGER NOT NULL DEFAULT 7,
  ADD COLUMN "reminderChannels" TEXT[] NOT NULL DEFAULT ARRAY['IN_APP','EMAIL','SMS']::TEXT[],
  ADD COLUMN "reminderRevision" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "EventReminderDelivery" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "inAppSentAt" TIMESTAMP(3),
  "emailQueuedAt" TIMESTAMP(3),
  "smsAttemptedAt" TIMESTAMP(3),
  "smsSentAt" TIMESTAMP(3),
  "emailFailure" TEXT,
  "smsFailure" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EventReminderDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EventReminderDelivery_eventId_userId_revision_key" ON "EventReminderDelivery"("eventId", "userId", "revision");
CREATE INDEX "EventReminderDelivery_eventId_revision_idx" ON "EventReminderDelivery"("eventId", "revision");
CREATE INDEX "EventReminderDelivery_userId_createdAt_idx" ON "EventReminderDelivery"("userId", "createdAt");
ALTER TABLE "EventReminderDelivery" ADD CONSTRAINT "EventReminderDelivery_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventReminderDelivery" ADD CONSTRAINT "EventReminderDelivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
