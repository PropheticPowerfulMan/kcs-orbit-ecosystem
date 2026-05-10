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
import { asyncHandler } from "../middleware/async-handler";
import { requireIntegrationAccess } from "../middleware/auth";

const router = Router();

router.post("/edupay/payments", requireIntegrationAccess(AppSlug.EDUPAY), asyncHandler(ingestEduPayPayment));

router.post("/savanex/parents", requireIntegrationAccess(AppSlug.SAVANEX), asyncHandler(ingestSavanexParent));
router.post("/savanex/teachers", requireIntegrationAccess(AppSlug.SAVANEX), asyncHandler(ingestSavanexTeacher));
router.post("/savanex/students", requireIntegrationAccess(AppSlug.SAVANEX), asyncHandler(ingestSavanexStudent));
router.post("/savanex/classes", requireIntegrationAccess(AppSlug.SAVANEX), asyncHandler(ingestSavanexClass));
router.post("/savanex/grades", requireIntegrationAccess(AppSlug.SAVANEX), asyncHandler(ingestSavanexGrade));
router.post("/savanex/attendance", requireIntegrationAccess(AppSlug.SAVANEX), asyncHandler(ingestSavanexAttendance));

router.post("/edusyncai/announcements", requireIntegrationAccess(AppSlug.EDUSYNCAI), asyncHandler(ingestEduSyncAiAnnouncement));

export default router;