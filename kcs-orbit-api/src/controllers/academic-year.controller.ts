import { Request, Response } from "express";
import { z } from "zod";
import { AcademicCalendarInputSchema, AcademicProgressionOverrideSchema } from "@ecosystem/shared-contracts";
import { AppSlug } from "@prisma/client";
import { getOrCreateCurrentAcademicCalendar, listAcademicCalendars, saveAcademicCalendar } from "../services/academic-calendar.service";
import {
  executeAcademicYearRollover,
  previewAcademicYearRollover
} from "../services/academic-year-progression.service";

const academicYearRolloverSchema = z.object({
  organizationId: z.string().min(1),
  effectiveDate: z.coerce.date().optional(),
  force: z.boolean().optional(),
  passThreshold: z.number().min(0).max(100).optional(),
  overrides: z.array(AcademicProgressionOverrideSchema).optional(),
  decisions: z.array(AcademicProgressionOverrideSchema).optional()
});

function parseRolloverRequest(req: Request) {
  const body = academicYearRolloverSchema.parse(req.body);
  return {
    organizationId: body.organizationId,
    effectiveDate: body.effectiveDate,
    force: body.force,
    passThreshold: body.passThreshold,
    overrides: body.overrides || body.decisions || []
  };
}

const organizationQuerySchema = z.object({ organizationId: z.string().min(1) });

export async function getCurrentAcademicCalendarController(req: Request, res: Response) {
  const { organizationId } = organizationQuerySchema.parse(req.query);
  return res.json({ calendar: await getOrCreateCurrentAcademicCalendar(organizationId) });
}
export async function listAcademicCalendarsController(req: Request, res: Response) {
  const { organizationId } = organizationQuerySchema.parse(req.query);
  return res.json({ calendars: await listAcademicCalendars(organizationId) });
}
export async function saveAcademicCalendarController(req: Request, res: Response) {
  const input = AcademicCalendarInputSchema.parse(req.body);
  const calendar = await saveAcademicCalendar(input, req.integration?.appSlug || AppSlug.KCS_NEXUS);
  return res.json({ calendar });
}

export async function previewAcademicYearRolloverController(req: Request, res: Response) {
  const input = parseRolloverRequest(req);
  const plan = await previewAcademicYearRollover(input);
  return res.json({ mode: "preview", plan });
}

export async function runAcademicYearRolloverController(req: Request, res: Response) {
  const input = parseRolloverRequest(req);

  try {
    const plan = await executeAcademicYearRollover(input);
    return res.json({ mode: "run", plan });
  } catch (error) {
    return res.status(409).json({
      message: error instanceof Error ? error.message : "Academic rollover could not be executed"
    });
  }
}
