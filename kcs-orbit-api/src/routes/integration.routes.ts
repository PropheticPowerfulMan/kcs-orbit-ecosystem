import { Router } from "express";
import {
  createAppConnection,
  createExternalLink,
  createOrganization,
  createSyncEvent,
  listAppConnections,
  listAuditLogs,
  listExternalLinks,
  listOrganizations,
  listSyncEvents
} from "../controllers/integration.controller";
import { asyncHandler } from "../middleware/async-handler";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

router.get("/organizations", requireAuth, requireRole("ADMIN"), asyncHandler(listOrganizations));
router.post("/organizations", requireAuth, requireRole("ADMIN"), asyncHandler(createOrganization));

router.get("/app-connections", requireAuth, requireRole("ADMIN", "STAFF"), asyncHandler(listAppConnections));
router.post("/app-connections", requireAuth, requireRole("ADMIN"), asyncHandler(createAppConnection));

router.get("/external-links", requireAuth, requireRole("ADMIN", "STAFF"), asyncHandler(listExternalLinks));
router.post("/external-links", requireAuth, requireRole("ADMIN", "STAFF"), asyncHandler(createExternalLink));

router.get("/sync-events", requireAuth, requireRole("ADMIN", "STAFF"), asyncHandler(listSyncEvents));
router.post("/sync-events", requireAuth, requireRole("ADMIN", "STAFF"), asyncHandler(createSyncEvent));

router.get("/audit-logs", requireAuth, requireRole("ADMIN"), asyncHandler(listAuditLogs));

export default router;