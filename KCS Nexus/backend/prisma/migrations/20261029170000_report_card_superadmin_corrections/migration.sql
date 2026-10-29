-- Preserve Super Administration report-card corrections without altering the
-- teacher-submitted source grades. Approval freezes the corrected snapshot.
ALTER TABLE "ReportCard" ADD COLUMN "academicCorrections" JSONB;
