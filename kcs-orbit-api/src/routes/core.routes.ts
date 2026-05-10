import { Router } from "express";
import {
  createAnnouncement,
  createAttendance,
  createClass,
  createGrade,
  createParent,
  createPayment,
  createStudent,
  createTeacher,
  listAnnouncements,
  listAttendance,
  listClasses,
  listGrades,
  listParents,
  listPayments,
  listSharedDirectory,
  listStudents,
  listTeachers,
  listUsers
} from "../controllers/core.controller";
import { asyncHandler } from "../middleware/async-handler";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

router.get("/users", requireAuth, requireRole("ADMIN"), asyncHandler(listUsers));
router.get("/shared-directory", requireAuth, asyncHandler(listSharedDirectory));

router.get("/students", requireAuth, asyncHandler(listStudents));
router.post("/students", requireAuth, requireRole("ADMIN", "STAFF"), asyncHandler(createStudent));

router.get("/parents", requireAuth, asyncHandler(listParents));
router.post("/parents", requireAuth, requireRole("ADMIN", "STAFF"), asyncHandler(createParent));

router.get("/teachers", requireAuth, asyncHandler(listTeachers));
router.post("/teachers", requireAuth, requireRole("ADMIN", "STAFF"), asyncHandler(createTeacher));

router.get("/classes", requireAuth, requireRole("ADMIN", "STAFF", "TEACHER"), asyncHandler(listClasses));
router.post("/classes", requireAuth, requireRole("ADMIN", "STAFF"), asyncHandler(createClass));

router.get("/payments", requireAuth, requireRole("ADMIN", "STAFF"), asyncHandler(listPayments));
router.post("/payments", requireAuth, requireRole("ADMIN", "STAFF"), asyncHandler(createPayment));

router.get("/grades", requireAuth, requireRole("ADMIN", "STAFF", "TEACHER"), asyncHandler(listGrades));
router.post("/grades", requireAuth, requireRole("ADMIN", "TEACHER"), asyncHandler(createGrade));

router.get("/attendance", requireAuth, requireRole("ADMIN", "STAFF", "TEACHER"), asyncHandler(listAttendance));
router.post("/attendance", requireAuth, requireRole("ADMIN", "TEACHER"), asyncHandler(createAttendance));

router.get("/announcements", requireAuth, asyncHandler(listAnnouncements));
router.post("/announcements", requireAuth, requireRole("ADMIN", "STAFF", "TEACHER"), asyncHandler(createAnnouncement));

export default router;
