import { AppSlug } from "@prisma/client";
import { Router } from "express";
import {
  getCurrentAcademicCalendarController,
  listAcademicCalendarsController,
  saveAcademicCalendarController,
  previewAcademicYearRolloverController,
  runAcademicYearRolloverController
} from "../controllers/academic-year.controller";
import { asyncHandler } from "../middleware/async-handler";
import { requireAnyIntegrationAccess } from "../middleware/auth";

const router = Router();
const integrationAccess = requireAnyIntegrationAccess(AppSlug.KCS_NEXUS, AppSlug.EDUPAY, AppSlug.EDUSYNCAI, AppSlug.SAVANEX);

router.get("/calendar/current", integrationAccess, asyncHandler(getCurrentAcademicCalendarController));
router.get("/calendar", integrationAccess, asyncHandler(listAcademicCalendarsController));
router.put("/calendar", integrationAccess, asyncHandler(saveAcademicCalendarController));
router.post("/rollover/preview", integrationAccess, asyncHandler(previewAcademicYearRolloverController));
router.post("/rollover/run", integrationAccess, asyncHandler(runAcademicYearRolloverController));

export default router;
