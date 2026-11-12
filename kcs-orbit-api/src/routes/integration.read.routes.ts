import { AppSlug } from "@prisma/client";
import { Router } from "express";
import { readKcsNexusFamilies, readSharedDirectory } from "../controllers/integration.read.controller";
import { asyncHandler } from "../middleware/async-handler";
import { requireAnyIntegrationAccess, requireIntegrationAccess } from "../middleware/auth";

import { identityAccess } from '../services/student-access';
const router = Router();
router.get('/identity-access/:id', requireAnyIntegrationAccess(AppSlug.KCS_NEXUS,AppSlug.KCS_KITCHEN,AppSlug.KCS_SENTINEL), asyncHandler(async(req,res)=>{
  const organizationId = typeof req.query.organizationId === 'string' ? req.query.organizationId : '';
  if (!organizationId) return res.status(400).json({message:'Organization is required'});
  res.setHeader('Cache-Control','no-store');
  return res.json(await identityAccess(String(req.params.id),organizationId));
}));

router.get("/kcs-nexus/families", requireIntegrationAccess(AppSlug.KCS_NEXUS), asyncHandler(readKcsNexusFamilies));
router.get("/shared-directory", requireAnyIntegrationAccess(AppSlug.KCS_NEXUS, AppSlug.KCS_KITCHEN, AppSlug.KCS_SENTINEL, AppSlug.EDUPAY, AppSlug.EDUSYNCAI, AppSlug.SAVANEX), asyncHandler(readSharedDirectory));

export default router;
