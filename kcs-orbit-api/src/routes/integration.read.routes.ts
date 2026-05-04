import { AppSlug } from "@prisma/client";
import { Router } from "express";
import { readKcsNexusFamilies } from "../controllers/integration.read.controller";
import { requireIntegrationAccess } from "../middleware/auth";

const router = Router();

router.get("/kcs-nexus/families", requireIntegrationAccess(AppSlug.KCS_NEXUS), readKcsNexusFamilies);

export default router;