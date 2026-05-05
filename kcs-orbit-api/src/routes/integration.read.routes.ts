import { AppSlug } from "@prisma/client";
import { Router } from "express";
import { readKcsNexusFamilies, readSharedDirectory } from "../controllers/integration.read.controller";
import { requireAnyIntegrationAccess, requireIntegrationAccess } from "../middleware/auth";

const router = Router();

router.get("/kcs-nexus/families", requireIntegrationAccess(AppSlug.KCS_NEXUS), readKcsNexusFamilies);
router.get("/shared-directory", requireAnyIntegrationAccess(AppSlug.KCS_NEXUS, AppSlug.EDUPAY, AppSlug.EDUSYNCAI, AppSlug.SAVANEX), readSharedDirectory);

export default router;