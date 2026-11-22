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
  const startDay = day(input.startDate);
  const endDay = day(input.endDate);
  if (startDay < `${startYear}-09-01` || startDay > `${startYear}-09-30`) {
    errors.push("Academic year must start during September.");
  }
  if (endDay < `${endYear}-06-01` || endDay > `${endYear}-06-30`) {
    errors.push("Academic year must end during June.");
  }
  if (input.startDate >= input.endDate) errors.push("Academic year end date must follow its start date.");

  for (const type of ["SEMESTER", "QUARTER"] as const) {
    const periods = input.periods.filter((item) => item.type === type).sort((a, b) => a.sequence - b.sequence);
    const expected = type === "SEMESTER" ? 2 : 4;
    if (periods.length !== expected) errors.push(`${type} must contain exactly ${expected} periods.`);
    periods.forEach((period, index) => {
      if (period.sequence !== index + 1) errors.push(`${type} sequences must be contiguous.`);
      if (period.startDate < input.startDate || period.endDate > input.endDate || period.startDate > period.endDate) {
        errors.push(`${period.code} must stay inside the academic year.`);
      }
      if (index) {
        const previous = periods[index - 1];
        if (period.startDate <= previous.endDate) errors.push(`${type} periods must not overlap.`);
      }
    });
  }
  if (errors.length) throw new Error([...new Set(errors)].join(" "));
  return input;
}

const includePeriods = { periods: { orderBy: [{ type: "asc" as const }, { sequence: "asc" as const }] } };

export async function saveAcademicCalendar(raw: AcademicCalendarInput, sourceApp: AppSlug) {
  const input = validateAcademicCalendar(raw);
  return prisma.$transaction(async (tx) => {
    const before = await tx.academicYear.findUnique({where:{organizationId_name:{organizationId:input.organizationId,name:input.name}},include:includePeriods});
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
    // Stable period IDs preserve references when dates or labels are corrected.
    for (const period of input.periods) {
      const data={code:period.code,name:period.name,startDate:period.startDate,endDate:period.endDate};
      await tx.academicPeriod.upsert({
        where:{academicYearId_type_sequence:{academicYearId:year.id,type:period.type,sequence:period.sequence}},
        create:{academicYearId:year.id,type:period.type,sequence:period.sequence,...data},update:data
      });
    }
    const after=await tx.academicYear.findUniqueOrThrow({where:{id:year.id},include:includePeriods});
    await tx.auditLog.create({ data: {
      organizationId: input.organizationId,
      action: input.isCurrent ? "academic_calendar.activated" : "academic_calendar.saved",
      entityType: "academicYear", entityId: year.id,
      metadata: JSON.parse(JSON.stringify({name:input.name,sourceApp,formatVersion:1,before,after})) as Prisma.InputJsonValue
    } });
    return after;
  });
}

export async function getOrCreateCurrentAcademicCalendar(organizationId: string, effectiveDate = new Date()) {
  const current = await prisma.academicYear.findFirst({
    where: { organizationId, isCurrent: true }, include: includePeriods, orderBy: { updatedAt: "desc" }
  });
  if (current) return current;
  // A read after an explicit year closure must never activate a new year by date.
  const latest = await prisma.academicYear.findFirst({ where: { organizationId }, include: includePeriods, orderBy: { startDate: "desc" } });
  if (latest) return latest;
  return saveAcademicCalendar(
    buildDefaultAcademicCalendar(getDefaultAcademicStartYear(effectiveDate), organizationId),
    AppSlug.KCS_NEXUS
  );
}

export async function listAcademicCalendars(organizationId: string) {
  return prisma.academicYear.findMany({ where: { organizationId }, include: includePeriods, orderBy: { startDate: "desc" } });
}
