import { AppSlug } from "@prisma/client";
import { NextFunction, Request, Response, Router } from "express";
import { createRegistryEntity, deleteRegistryEntity, updateRegistryEntity } from "../controllers/integration.registry.controller";
import { asyncHandler } from "../middleware/async-handler";
import { requireAnyIntegrationAccess } from "../middleware/auth";

const router = Router();

const registryMutationScopes: Partial<Record<AppSlug, readonly string[]>> = {
  [AppSlug.SAVANEX]: ['family', 'parent', 'student', 'teacher'],
  [AppSlug.EDUPAY]: ['family', 'parent', 'student', 'teacher'],
  [AppSlug.KCS_NEXUS]: ['family', 'parent', 'student'],
};

function restrictRegistryEntityScope(req: Request, res: Response, next: NextFunction) {
  const entityType = String(req.params.entityType || '').toLowerCase();
  const appSlug = req.integration?.appSlug;
  const baseAllowedTypes = appSlug ? registryMutationScopes[appSlug] : undefined;
  const allowedTypes = appSlug === AppSlug.KCS_NEXUS && req.method === 'PUT'
    ? ['family', 'parent', 'student', 'teacher']
    : baseAllowedTypes;
  if (!allowedTypes?.includes(entityType)) {
    return res.status(403).json({
      message: `${appSlug || 'This application'} cannot mutate ${entityType || 'unknown'} registry entities.`,
      allowedEntityTypes: allowedTypes || [],
    });
  }
  return next();
}

router.post("/:entityType", requireAnyIntegrationAccess(AppSlug.KCS_NEXUS, AppSlug.SAVANEX, AppSlug.EDUPAY), restrictRegistryEntityScope, asyncHandler(createRegistryEntity));
router.put("/:entityType/:identifier", requireAnyIntegrationAccess(AppSlug.KCS_NEXUS, AppSlug.SAVANEX, AppSlug.EDUPAY), restrictRegistryEntityScope, asyncHandler(updateRegistryEntity));
router.delete("/:entityType/:identifier", requireAnyIntegrationAccess(AppSlug.KCS_NEXUS, AppSlug.SAVANEX, AppSlug.EDUPAY), restrictRegistryEntityScope, asyncHandler(deleteRegistryEntity));

export default router;
