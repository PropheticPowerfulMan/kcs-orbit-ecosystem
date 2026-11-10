import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma.js";
import { ApiError } from "../utils/api.js";
import {
  academicPeriodIsReadOnly,
  academicEntryPeriod,
  quarterTerms,
  type AcademicPeriodAccess,
} from "../utils/academicPeriodPolicy.js";
import { academicCalendars } from "./reportAttendance.service.js";

type Database = Prisma.TransactionClient | typeof prisma;
export async function academicPeriodAccess(
  db: Database = prisma,
): Promise<AcademicPeriodAccess & { activeEntryTerm: string | null; pendingClosureTerm: string | null; closureMode: string }> {
  const [calendars, closures] = await Promise.all([
    academicCalendars(),
    db.auditLog.findMany({
      where: {
        action: "ACADEMIC_PERIOD_CLOSED",
        targetType: "AcademicPeriodClosure",
      },
      select: { metadata: true, createdAt: true },
    }),
  ]);
  const access: AcademicPeriodAccess = {
    calendars: calendars.map((calendar) => ({
      name: calendar.name,
      startDate: calendar.startDate,
      endDate: calendar.endDate,
      periods: calendar.periods,
    })),
    activeAcademicYear:
      calendars.find((calendar) => calendar.isCurrent)?.name ?? null,
    closedPeriods: closures.map((row) => ({
      ...(row.metadata as { academicYear: string; term: string }),
      closedAt: row.createdAt.toISOString(),
    })),
  };
  return { ...access, ...academicEntryPeriod(access, access.activeAcademicYear || ''), closureMode: 'EXPLICIT_SUPERADMIN' as const };
}
export async function lockAcademicYears(
  db: Prisma.TransactionClient,
  years: string[],
  exclusive = false,
) {
  for (const year of [...new Set(years)].sort()) {
    const key = "kcs-academic-period:" + year;
    if (exclusive)
      await db.$queryRaw(
        Prisma.sql`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${key}))`,
      );
    else
      await db.$queryRaw(
        Prisma.sql`SELECT 1 FROM pg_advisory_xact_lock_shared(hashtext(${key}))`,
      );
  }
}
export function assertAcademicPeriodOpen(
  access: AcademicPeriodAccess,
  year: string,
  term: string,
) {
  if (academicPeriodIsReadOnly(access, year, term))
    throw new ApiError(
      409,
      "ACADEMIC_PERIOD_CLOSED: " +
        year +
        " · " +
        term +
        " is closed and read-only.",
    );
}
export async function protectAcademicPeriod(
  db: Prisma.TransactionClient,
  year: string,
  term: string,
) {
  await lockAcademicYears(db, [year]);
  assertAcademicPeriodOpen(await academicPeriodAccess(db), year, term);
}
export async function academicCycleForDate(date: Date) {
  const calendars = await academicCalendars();
  const day = date.toISOString().slice(0, 10);
  const calendar = calendars.find(
    (item) =>
      day >= item.startDate.slice(0, 10) && day <= item.endDate.slice(0, 10),
  );
  if (!calendar) {
    const start =
      date.getUTCMonth() >= 8
        ? date.getUTCFullYear()
        : date.getUTCFullYear() - 1;
    return { academicYear: start + "-" + (start + 1), term: "Annual final" };
  }
  const quarter = calendar.periods?.find(
    (item) =>
      ["QUARTER", "TRIMESTER"].includes(item.type) &&
      day >= item.startDate.slice(0, 10) &&
      day <= item.endDate.slice(0, 10),
  );
  return {
    academicYear: calendar.name,
    term: quarter ? quarterTerms[quarter.sequence - 1] : "Annual final",
  };
}
