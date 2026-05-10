import { AppSlug } from "@prisma/client";
import { Router } from "express";
import { readKcsNexusFamilies, readSharedDirectory } from "../controllers/integration.read.controller";
import { asyncHandler } from "../middleware/async-handler";
import { requireAnyIntegrationAccess, requireIntegrationAccess } from "../middleware/auth";

const router = Router();

router.get("/kcs-nexus/families", requireIntegrationAccess(AppSlug.KCS_NEXUS), asyncHandler(readKcsNexusFamilies));
router.get("/shared-directory", requireAnyIntegrationAccess(AppSlug.KCS_NEXUS, AppSlug.EDUPAY, AppSlug.EDUSYNCAI, AppSlug.SAVANEX), asyncHandler(readSharedDirectory));

export default router;