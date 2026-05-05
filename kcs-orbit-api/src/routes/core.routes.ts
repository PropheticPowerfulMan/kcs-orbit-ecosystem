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
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

router.get("/users", requireAuth, requireRole("ADMIN"), listUsers);
router.get("/shared-directory", requireAuth, listSharedDirectory);

router.get("/students", requireAuth, listStudents);
router.post("/students", requireAuth, requireRole("ADMIN", "STAFF"), createStudent);

router.get("/parents", requireAuth, listParents);
router.post("/parents", requireAuth, requireRole("ADMIN", "STAFF"), createParent);

router.get("/teachers", requireAuth, listTeachers);
router.post("/teachers", requireAuth, requireRole("ADMIN", "STAFF"), createTeacher);

router.get("/classes", requireAuth, requireRole("ADMIN", "STAFF", "TEACHER"), listClasses);
router.post("/classes", requireAuth, requireRole("ADMIN", "STAFF"), createClass);

router.get("/payments", requireAuth, requireRole("ADMIN", "STAFF"), listPayments);
router.post("/payments", requireAuth, requireRole("ADMIN", "STAFF"), createPayment);

router.get("/grades", requireAuth, requireRole("ADMIN", "STAFF", "TEACHER"), listGrades);
router.post("/grades", requireAuth, requireRole("ADMIN", "TEACHER"), createGrade);

router.get("/attendance", requireAuth, requireRole("ADMIN", "STAFF", "TEACHER"), listAttendance);
router.post("/attendance", requireAuth, requireRole("ADMIN", "TEACHER"), createAttendance);

router.get("/announcements", requireAuth, listAnnouncements);
router.post("/announcements", requireAuth, requireRole("ADMIN", "STAFF", "TEACHER"), createAnnouncement);

export default router;
