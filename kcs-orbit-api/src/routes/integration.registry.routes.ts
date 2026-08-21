import { AppSlug } from "@prisma/client";
import { NextFunction, Request, Response, Router } from "express";
import { createRegistryEntity, deleteRegistryEntity, updateRegistryEntity } from "../controllers/integration.registry.controller";
import { asyncHandler } from "../middleware/async-handler";
import { requireAnyIntegrationAccess } from "../middleware/auth";

const router = Router();

function restrictEduPayEntityScope(req: Request, res: Response, next: NextFunction) {
  const entityType = String(req.params.entityType || '').toLowerCase();
  if (req.integration?.appSlug === AppSlug.EDUPAY && !['family', 'parent', 'student', 'teacher'].includes(entityType)) {
    return res.status(403).json({ message: 'EduPay registry mutations are limited to families, parents, students and employees.' });
  }
  return next();
}

router.post("/:entityType", requireAnyIntegrationAccess(AppSlug.KCS_NEXUS, AppSlug.SAVANEX, AppSlug.EDUPAY), restrictEduPayEntityScope, asyncHandler(createRegistryEntity));
router.put("/:entityType/:identifier", requireAnyIntegrationAccess(AppSlug.KCS_NEXUS, AppSlug.SAVANEX, AppSlug.EDUPAY), restrictEduPayEntityScope, asyncHandler(updateRegistryEntity));
router.delete("/:entityType/:identifier", requireAnyIntegrationAccess(AppSlug.KCS_NEXUS, AppSlug.SAVANEX, AppSlug.EDUPAY), restrictEduPayEntityScope, asyncHandler(deleteRegistryEntity));

export default router;
