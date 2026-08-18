import { AppSlug } from "@prisma/client";
import { Router } from "express";
import {
  previewAcademicYearRolloverController,
  runAcademicYearRolloverController
} from "../controllers/academic-year.controller";
import { asyncHandler } from "../middleware/async-handler";
import { requireAnyIntegrationAccess } from "../middleware/auth";

const router = Router();
const integrationAccess = requireAnyIntegrationAccess(AppSlug.KCS_NEXUS, AppSlug.EDUPAY, AppSlug.EDUSYNCAI, AppSlug.SAVANEX);

router.post("/rollover/preview", integrationAccess, asyncHandler(previewAcademicYearRolloverController));
router.post("/rollover/run", integrationAccess, asyncHandler(runAcademicYearRolloverController));

export default router;
