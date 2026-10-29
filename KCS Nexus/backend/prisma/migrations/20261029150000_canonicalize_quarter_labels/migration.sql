-- Canonicalize the historical KCS term labels after the move from trimesters
-- to four 45-day quarters. Values are renamed in place; no academic result is
-- recalculated or deleted.

UPDATE "Grade"
SET "period" = replace("period", 'Semester 1 · Trimester 1', 'Semester 1 · Quarter 1')
WHERE "period" LIKE '%Semester 1 · Trimester 1%';

UPDATE "Grade"
SET "period" = replace("period", 'Semester 1 · Trimester 2', 'Semester 1 · Quarter 2')
WHERE "period" LIKE '%Semester 1 · Trimester 2%';

UPDATE "Grade"
SET "period" = replace("period", 'Semester 2 · Trimester 3', 'Semester 2 · Quarter 3')
WHERE "period" LIKE '%Semester 2 · Trimester 3%';

-- ReportCard has a unique (studentId, term) constraint. Avoid overwriting a
-- canonical record if an environment already contains both spellings.
UPDATE "ReportCard" legacy
SET "term" = replace(legacy."term", 'Semester 1 · Trimester 1', 'Semester 1 · Quarter 1')
WHERE legacy."term" LIKE '%Semester 1 · Trimester 1%'
  AND NOT EXISTS (
    SELECT 1 FROM "ReportCard" canonical
    WHERE canonical."studentId" = legacy."studentId"
      AND canonical."term" = replace(legacy."term", 'Semester 1 · Trimester 1', 'Semester 1 · Quarter 1')
  );

UPDATE "ReportCard" legacy
SET "term" = replace(legacy."term", 'Semester 1 · Trimester 2', 'Semester 1 · Quarter 2')
WHERE legacy."term" LIKE '%Semester 1 · Trimester 2%'
  AND NOT EXISTS (
    SELECT 1 FROM "ReportCard" canonical
    WHERE canonical."studentId" = legacy."studentId"
      AND canonical."term" = replace(legacy."term", 'Semester 1 · Trimester 2', 'Semester 1 · Quarter 2')
  );

UPDATE "ReportCard" legacy
SET "term" = replace(legacy."term", 'Semester 2 · Trimester 3', 'Semester 2 · Quarter 3')
WHERE legacy."term" LIKE '%Semester 2 · Trimester 3%'
  AND NOT EXISTS (
    SELECT 1 FROM "ReportCard" canonical
    WHERE canonical."studentId" = legacy."studentId"
      AND canonical."term" = replace(legacy."term", 'Semester 2 · Trimester 3', 'Semester 2 · Quarter 3')
  );
