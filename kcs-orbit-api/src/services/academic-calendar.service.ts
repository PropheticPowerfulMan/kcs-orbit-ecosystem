import { AcademicCalendarInput, AcademicCalendarInputSchema, buildDefaultAcademicCalendar } from "@ecosystem/shared-contracts";
import { AppSlug, Prisma } from "@prisma/client";
import { prisma } from "../db";

export function getDefaultAcademicStartYear(date = new Date()) {
  return date.getUTCMonth() >= 6 ? date.getUTCFullYear() : date.getUTCFullYear() - 1;
}

const day = (value: Date) => value.toISOString().slice(0, 10);

export function validateAcademicCalendar(raw: AcademicCalendarInput) {
  const input = AcademicCalendarInputSchema.parse(raw);
  const [startYear, endYear] = input.name.split("-").map(Number);
  const errors: string[] = [];
  if (endYear !== startYear + 1) errors.push("Academic year name must contain consecutive years.");
  if (day(input.startDate) !== `${startYear}-09-01`) errors.push("Academic year must start on September 1.");
  if (day(input.endDate) !== `${endYear}-06-30`) errors.push("Academic year must end on June 30.");
  if (input.startDate >= input.endDate) errors.push("Academic year end date must follow its start date.");

  for (const type of ["SEMESTER", "TRIMESTER"] as const) {
    const periods = input.periods.filter((item) => item.type === type).sort((a, b) => a.sequence - b.sequence);
    const expected = type === "SEMESTER" ? 2 : 3;
    if (periods.length !== expected) errors.push(`${type} must contain exactly ${expected} periods.`);
    periods.forEach((period, index) => {
      if (period.sequence !== index + 1) errors.push(`${type} sequences must be contiguous.`);
      if (period.startDate < input.startDate || period.endDate > input.endDate || period.startDate > period.endDate) {
        errors.push(`${period.code} must stay inside the academic year.`);
      }
      if (index) {
        const next = new Date(periods[index - 1].endDate);
        next.setUTCDate(next.getUTCDate() + 1);
        if (day(next) !== day(period.startDate)) errors.push(`${type} periods must be contiguous and non-overlapping.`);
      }
    });
    if (periods.length && (day(periods[0].startDate) !== day(input.startDate) || day(periods.at(-1)!.endDate) !== day(input.endDate))) {
      errors.push(`${type} periods must cover the complete academic year.`);
    }
  }
  if (errors.length) throw new Error([...new Set(errors)].join(" "));
  return input;
}

const includePeriods = { periods: { orderBy: [{ type: "asc" as const }, { sequence: "asc" as const }] } };

export async function saveAcademicCalendar(raw: AcademicCalendarInput, sourceApp: AppSlug) {
  const input = validateAcademicCalendar(raw);
  return prisma.$transaction(async (tx) => {
    if (input.isCurrent) {
      await tx.academicYear.updateMany({
        where: { organizationId: input.organizationId, isCurrent: true, NOT: { name: input.name } },
        data: { isCurrent: false, status: "CLOSED" }
      });
    }
    const year = await tx.academicYear.upsert({
      where: { organizationId_name: { organizationId: input.organizationId, name: input.name } },
      create: {
        organizationId: input.organizationId, name: input.name, startDate: input.startDate, endDate: input.endDate,
        status: input.isCurrent ? "ACTIVE" : input.status || "PLANNED", isCurrent: Boolean(input.isCurrent)
      },
      update: {
        startDate: input.startDate, endDate: input.endDate,
        status: input.isCurrent ? "ACTIVE" : input.status, isCurrent: Boolean(input.isCurrent)
      }
    });
    await tx.academicPeriod.deleteMany({ where: { academicYearId: year.id } });
    await tx.academicPeriod.createMany({ data: input.periods.map((period) => ({
      academicYearId: year.id, type: period.type, sequence: period.sequence, code: period.code,
      name: period.name, startDate: period.startDate, endDate: period.endDate
    })) });
    await tx.auditLog.create({ data: {
      organizationId: input.organizationId,
      action: input.isCurrent ? "academic_calendar.activated" : "academic_calendar.saved",
      entityType: "academicYear", entityId: year.id,
      metadata: { name: input.name, sourceApp } as Prisma.InputJsonValue
    } });
    return tx.academicYear.findUniqueOrThrow({ where: { id: year.id }, include: includePeriods });
  });
}

export async function getOrCreateCurrentAcademicCalendar(organizationId: string, effectiveDate = new Date()) {
  const current = await prisma.academicYear.findFirst({
    where: { organizationId, isCurrent: true }, include: includePeriods, orderBy: { updatedAt: "desc" }
  });
  return current || saveAcademicCalendar(
    buildDefaultAcademicCalendar(getDefaultAcademicStartYear(effectiveDate), organizationId),
    AppSlug.KCS_NEXUS
  );
}

export async function listAcademicCalendars(organizationId: string) {
  return prisma.academicYear.findMany({ where: { organizationId }, include: includePeriods, orderBy: { startDate: "desc" } });
}
