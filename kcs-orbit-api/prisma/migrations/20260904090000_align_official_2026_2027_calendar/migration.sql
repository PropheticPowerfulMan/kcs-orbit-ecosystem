UPDATE "AcademicYear"
SET
  "startDate" = TIMESTAMP '2026-09-07 00:00:00',
  "endDate" = TIMESTAMP '2027-06-11 23:59:59.999',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "name" = '2026-2027';

UPDATE "AcademicPeriod" AS period
SET
  "name" = schedule."name",
  "startDate" = schedule."startDate",
  "endDate" = schedule."endDate",
  "updatedAt" = CURRENT_TIMESTAMP
FROM "AcademicYear" AS year,
  (
    VALUES
      ('SEMESTER'::"AcademicPeriodType", 1, 'Semestre 1', TIMESTAMP '2026-09-07 00:00:00', TIMESTAMP '2027-01-29 23:59:59.999'),
      ('SEMESTER'::"AcademicPeriodType", 2, 'Semestre 2', TIMESTAMP '2027-02-01 00:00:00', TIMESTAMP '2027-06-11 23:59:59.999'),
      ('TRIMESTER'::"AcademicPeriodType", 1, 'Trimestre 1', TIMESTAMP '2026-09-07 00:00:00', TIMESTAMP '2026-12-18 23:59:59.999'),
      ('TRIMESTER'::"AcademicPeriodType", 2, 'Trimestre 2', TIMESTAMP '2027-01-05 00:00:00', TIMESTAMP '2027-03-19 23:59:59.999'),
      ('TRIMESTER'::"AcademicPeriodType", 3, 'Trimestre 3', TIMESTAMP '2027-04-05 00:00:00', TIMESTAMP '2027-06-11 23:59:59.999')
  ) AS schedule("type", "sequence", "name", "startDate", "endDate")
WHERE period."academicYearId" = year."id"
  AND year."name" = '2026-2027'
  AND period."type" = schedule."type"
  AND period."sequence" = schedule."sequence";
