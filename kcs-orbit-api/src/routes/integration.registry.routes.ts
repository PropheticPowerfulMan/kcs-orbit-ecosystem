import { AppSlug } from "@prisma/client";
import { Router } from "express";
import { createRegistryEntity, deleteRegistryEntity, updateRegistryEntity } from "../controllers/integration.registry.controller";
import { requireAnyIntegrationAccess } from "../middleware/auth";

const router = Router();

router.post("/:entityType", requireAnyIntegrationAccess(AppSlug.KCS_NEXUS, AppSlug.EDUPAY, AppSlug.EDUSYNCAI, AppSlug.SAVANEX), createRegistryEntity);
router.put("/:entityType/:identifier", requireAnyIntegrationAccess(AppSlug.KCS_NEXUS, AppSlug.EDUPAY, AppSlug.EDUSYNCAI, AppSlug.SAVANEX), updateRegistryEntity);
router.delete("/:entityType/:identifier", requireAnyIntegrationAccess(AppSlug.KCS_NEXUS, AppSlug.EDUPAY, AppSlug.EDUSYNCAI, AppSlug.SAVANEX), deleteRegistryEntity);

export default router;
