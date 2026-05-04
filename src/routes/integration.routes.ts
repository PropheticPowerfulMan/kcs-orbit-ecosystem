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
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

router.get("/organizations", requireAuth, requireRole("ADMIN"), listOrganizations);
router.post("/organizations", requireAuth, requireRole("ADMIN"), createOrganization);

router.get("/app-connections", requireAuth, requireRole("ADMIN", "STAFF"), listAppConnections);
router.post("/app-connections", requireAuth, requireRole("ADMIN"), createAppConnection);

router.get("/external-links", requireAuth, requireRole("ADMIN", "STAFF"), listExternalLinks);
router.post("/external-links", requireAuth, requireRole("ADMIN", "STAFF"), createExternalLink);

router.get("/sync-events", requireAuth, requireRole("ADMIN", "STAFF"), listSyncEvents);
router.post("/sync-events", requireAuth, requireRole("ADMIN", "STAFF"), createSyncEvent);

router.get("/audit-logs", requireAuth, requireRole("ADMIN"), listAuditLogs);

export default router;