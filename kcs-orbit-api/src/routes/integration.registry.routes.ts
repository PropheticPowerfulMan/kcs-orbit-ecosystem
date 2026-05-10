import { AppSlug } from "@prisma/client";
import { Router } from "express";
import { createRegistryEntity, deleteRegistryEntity, updateRegistryEntity } from "../controllers/integration.registry.controller";
import { asyncHandler } from "../middleware/async-handler";
import { requireAnyIntegrationAccess } from "../middleware/auth";

const router = Router();

router.post("/:entityType", requireAnyIntegrationAccess(AppSlug.KCS_NEXUS, AppSlug.EDUPAY, AppSlug.EDUSYNCAI, AppSlug.SAVANEX), asyncHandler(createRegistryEntity));
router.put("/:entityType/:identifier", requireAnyIntegrationAccess(AppSlug.KCS_NEXUS, AppSlug.EDUPAY, AppSlug.EDUSYNCAI, AppSlug.SAVANEX), asyncHandler(updateRegistryEntity));
router.delete("/:entityType/:identifier", requireAnyIntegrationAccess(AppSlug.KCS_NEXUS, AppSlug.EDUPAY, AppSlug.EDUSYNCAI, AppSlug.SAVANEX), asyncHandler(deleteRegistryEntity));

export default router;
