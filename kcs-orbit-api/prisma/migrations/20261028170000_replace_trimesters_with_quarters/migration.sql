ALTER TYPE "AcademicPeriodType" RENAME TO "AcademicPeriodType_old";
CREATE TYPE "AcademicPeriodType" AS ENUM ('SEMESTER', 'QUARTER');

ALTER TABLE "AcademicPeriod" ALTER COLUMN "type" TYPE "AcademicPeriodType"
USING (CASE WHEN "type"::text = 'SEMESTER' THEN 'SEMESTER' ELSE 'QUARTER' END)::"AcademicPeriodType";

DROP TYPE "AcademicPeriodType_old";

DELETE FROM "AcademicPeriod" WHERE "type" = 'QUARTER';

INSERT INTO "AcademicPeriod" ("id", "academicYearId", "type", "sequence", "code", "name", "startDate", "endDate", "createdAt", "updatedAt")
SELECT
  'quarter-' || ay."id" || '-' || q.sequence,
  ay."id",
  'QUARTER'::"AcademicPeriodType",
  q.sequence,
  'Q' || q.sequence,
  'Quarter ' || q.sequence,
  q.start_date,
  q.end_date,
  NOW(),
  NOW()
FROM "AcademicYear" ay
CROSS JOIN LATERAL (
  VALUES
    (1, ay."startDate", ay."startDate" + INTERVAL '60 days'),
    (2, ay."startDate" + INTERVAL '61 days', LEAST(ay."startDate" + INTERVAL '144 days', ay."endDate")),
    (3, LEAST(ay."startDate" + INTERVAL '145 days', ay."endDate"), LEAST(ay."startDate" + INTERVAL '205 days', ay."endDate")),
    (4, LEAST(ay."startDate" + INTERVAL '206 days', ay."endDate"), ay."endDate")
) AS q(sequence, start_date, end_date);
