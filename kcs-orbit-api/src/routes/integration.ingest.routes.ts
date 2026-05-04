import { AppSlug } from "@prisma/client";
import { Router } from "express";
import {
  ingestEduPayPayment,
  ingestEduSyncAiAnnouncement,
  ingestSavanexAttendance,
  ingestSavanexClass,
  ingestSavanexGrade,
  ingestSavanexParent,
  ingestSavanexStudent
  ,ingestSavanexTeacher
} from "../controllers/integration.ingest.controller";
import { requireIntegrationAccess } from "../middleware/auth";

const router = Router();

router.post("/edupay/payments", requireIntegrationAccess(AppSlug.EDUPAY), ingestEduPayPayment);

router.post("/savanex/parents", requireIntegrationAccess(AppSlug.SAVANEX), ingestSavanexParent);
router.post("/savanex/teachers", requireIntegrationAccess(AppSlug.SAVANEX), ingestSavanexTeacher);
router.post("/savanex/students", requireIntegrationAccess(AppSlug.SAVANEX), ingestSavanexStudent);
router.post("/savanex/classes", requireIntegrationAccess(AppSlug.SAVANEX), ingestSavanexClass);
router.post("/savanex/grades", requireIntegrationAccess(AppSlug.SAVANEX), ingestSavanexGrade);
router.post("/savanex/attendance", requireIntegrationAccess(AppSlug.SAVANEX), ingestSavanexAttendance);

router.post("/edusyncai/announcements", requireIntegrationAccess(AppSlug.EDUSYNCAI), ingestEduSyncAiAnnouncement);

export default router;