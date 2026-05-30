import { Request, Response } from "express";
import { z } from "zod";
import { AcademicProgressionOverrideSchema } from "@ecosystem/shared-contracts";
import {
  executeAcademicYearRollover,
  previewAcademicYearRollover
} from "../services/academic-year-progression.service";

const academicYearRolloverSchema = z.object({
  organizationId: z.string().min(1),
  effectiveDate: z.coerce.date().optional(),
  force: z.boolean().optional(),
  overrides: z.array(AcademicProgressionOverrideSchema).optional(),
  decisions: z.array(AcademicProgressionOverrideSchema).optional()
});

function parseRolloverRequest(req: Request) {
  const body = academicYearRolloverSchema.parse(req.body);
  return {
    organizationId: body.organizationId,
    effectiveDate: body.effectiveDate,
    force: body.force,
    overrides: body.overrides || body.decisions || []
  };
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
