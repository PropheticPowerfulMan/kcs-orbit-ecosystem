CREATE INDEX IF NOT EXISTS "Grade_studentId_period_createdAt_idx" ON "Grade"("studentId", "period", "createdAt");
CREATE INDEX IF NOT EXISTS "ReportCard_term_updatedAt_idx" ON "ReportCard"("term", "updatedAt");
