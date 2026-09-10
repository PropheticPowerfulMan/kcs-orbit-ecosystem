import { timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { env } from "../config/env.js";
import { authenticate, requireRoles, type AuthenticatedRequest } from "../middleware/auth.js";
import { asyncHandler, ApiError, success } from "../utils/api.js";
import { prisma } from "../config/prisma.js";
import { academicScheduleForGrade, academicScheduleForTeacher, fullAcademicSchedule } from "../utils/academicSchedule.js";

export const academyRouter = Router();
academyRouter.post("/launch", authenticate, requireRoles("teacher", "student", "staff", "admin"), asyncHandler(async (req: AuthenticatedRequest, res) => {
  if (!env.KCS_ORBIT_API_URL || !env.ACADEMY_INTEGRATION_KEY || !env.ACADEMY_PUBLIC_URL) throw new ApiError(503, "Academy integration is not configured");
  let user = req.user!.sub === "configured-superadmin"
    ? await prisma.user.findUnique({ where: { email: (process.env.SUPERADMIN_EMAIL || "").trim().toLowerCase() }, include: { teacherProfile: true, studentProfile: true } })
    : await prisma.user.findUnique({ where: { id: req.user!.sub }, include: { teacherProfile: true, studentProfile: true } });
  const isTeacher = user?.role === "TEACHER" || (user?.role === "STAFF" && Boolean(user.teacherProfile));
  if (!user || (!isTeacher && !["STUDENT", "ADMIN"].includes(user.role))) throw new ApiError(403, "Academy access is not enabled for this role");

  if (!user.orbitUserId) {
    if (!env.KCS_ORBIT_API_KEY || !env.KCS_ORBIT_ORGANIZATION_ID) throw new ApiError(503, "Orbit identity synchronization is not configured");
    const entityType = isTeacher ? "teacher" : user.role === "STUDENT" ? "student" : null;
    if (!entityType) throw new ApiError(409, "This administrator account is not linked to a verified Orbit identity");
    const body = entityType === "teacher"
      ? { organizationId: env.KCS_ORBIT_ORGANIZATION_ID, firstName: user.firstName, middleName: user.middleName || undefined, lastName: user.lastName, email: user.email, phone: user.phone || undefined, accessCode: user.accessCode || undefined, subject: user.teacherProfile?.department || undefined }
      : { organizationId: env.KCS_ORBIT_ORGANIZATION_ID, firstName: user.firstName, middleName: user.middleName || undefined, lastName: user.lastName, email: user.email, phone: user.phone || undefined, accessCode: user.accessCode || undefined, studentNumber: user.studentProfile?.studentNumber || undefined, gender: "UNSPECIFIED", className: [user.studentProfile?.grade, user.studentProfile?.section].filter(Boolean).join(" ") || undefined };
    const synced = await fetch(env.KCS_ORBIT_API_URL.replace(/\/$/, "") + "/api/integration/registry/" + entityType, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": env.KCS_ORBIT_API_KEY, "x-app-slug": "KCS_NEXUS" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    const syncPayload = await synced.json().catch(() => ({})) as { orbitId?: string; message?: string };
    if (![201, 409].includes(synced.status) || !syncPayload.orbitId) throw new ApiError(synced.status, syncPayload.message || "Orbit identity synchronization failed");
    user = await prisma.user.update({ where: { id: user.id }, data: { orbitUserId: syncPayload.orbitId, orbitOrganizationId: env.KCS_ORBIT_ORGANIZATION_ID, ...(isTeacher ? { role: "TEACHER" as const } : {}) }, include: { teacherProfile: true, studentProfile: true } });
  }

  const response = await fetch(env.KCS_ORBIT_API_URL.replace(/\/$/, "") + "/api/academy/sso/service-tickets", {
    method: "POST", headers: { "content-type": "application/json", "x-api-key": env.ACADEMY_INTEGRATION_KEY },
    body: JSON.stringify({ userId: user.orbitUserId }), signal: AbortSignal.timeout(10_000)
  });
  const payload = await response.json().catch(() => ({})) as { ticket?: string; message?: string };
  if (!response.ok || !payload.ticket) throw new ApiError(response.status, payload.message || "Academy launch failed");
  const url = new URL("/api/auth/callback", env.ACADEMY_PUBLIC_URL);
  url.searchParams.set("ticket", payload.ticket);
  return success(res, { url: url.toString() });
}));

function validAcademyKey(provided: string | undefined) {
  const expected = env.ACADEMY_INTEGRATION_KEY;
  if (!provided || !expected) return false;
  const left = Buffer.from(provided); const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

academyRouter.post("/context", asyncHandler(async (req, res) => {
  if (!validAcademyKey(req.header("x-api-key"))) throw new ApiError(401, "Unauthorized Academy service");
  const email = String(req.body?.email || "").trim().toLowerCase();
  const requestedRole = String(req.body?.role || "").toUpperCase();
  if (!email || !["TEACHER", "STUDENT", "ADMIN", "SUPER_ADMIN"].includes(requestedRole)) throw new ApiError(400, "Invalid Academy identity");
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, role: true, firstName: true, middleName: true, lastName: true, teacherProfile: { select: { id: true, courses: { select: { id: true, name: true, code: true, description: true, grade: true, credits: true, updatedAt: true, schedules: { select: { id: true, day: true, startTime: true, endTime: true, room: true } }, enrollments: { select: { studentId: true } }, assignments: { select: { id: true, title: true, description: true, dueDate: true, maxScore: true, type: true }, orderBy: { dueDate: "asc" } } } } } }, studentProfile: { select: { id: true, studentNumber: true, grade: true, section: true, enrollments: { select: { course: { select: { id: true, name: true, code: true, description: true, grade: true, credits: true, updatedAt: true, teacher: { select: { user: { select: { firstName: true, middleName: true, lastName: true } } } }, schedules: { select: { id: true, day: true, startTime: true, endTime: true, room: true } }, assignments: { select: { id: true, title: true, description: true, dueDate: true, maxScore: true, type: true }, orderBy: { dueDate: "asc" } } } } } } } } } });
  if (!user) throw new ApiError(404, "Nexus institutional identity not found");
  const isTeacher = Boolean(user.teacherProfile) && ["TEACHER", "STAFF"].includes(user.role);
  if (requestedRole === "TEACHER" && !isTeacher) throw new ApiError(403, "Teacher identity mismatch");
  if (requestedRole === "STUDENT" && (user.role !== "STUDENT" || !user.studentProfile)) throw new ApiError(403, "Student identity mismatch");
  if (["ADMIN", "SUPER_ADMIN"].includes(requestedRole) && user.role !== "ADMIN") throw new ApiError(403, "Administrator identity mismatch");
  const displayName = [user.lastName, user.middleName, user.firstName].filter(Boolean).join(" ");
  if (requestedRole === "TEACHER") return success(res, { source: "KCS_NEXUS_INSTITUTIONAL_RECORDS", displayName, dailySchedule: await academicScheduleForTeacher(user), courses: (user.teacherProfile?.courses || []).map(course => ({ ...course, enrolledStudents: course.enrollments.length })) });
  if (requestedRole === "STUDENT") return success(res, { source: "KCS_NEXUS_INSTITUTIONAL_RECORDS", displayName, dailySchedule: user.studentProfile ? await academicScheduleForGrade(user.studentProfile.grade, user.studentProfile.section) : [], profile: user.studentProfile ? { id: user.studentProfile.id, studentNumber: user.studentProfile.studentNumber, grade: user.studentProfile.grade, section: user.studentProfile.section } : null, courses: (user.studentProfile?.enrollments || []).map(item => ({ ...item.course, teacherName: [item.course.teacher.user.lastName, item.course.teacher.user.middleName, item.course.teacher.user.firstName].filter(Boolean).join(" ") })) });
  const [students, parents, teachers, courses] = await Promise.all([prisma.studentProfile.count(), prisma.user.count({ where: { role: "PARENT" } }), prisma.teacherProfile.count(), prisma.course.count()]);
  return success(res, { source: "KCS_NEXUS_INSTITUTIONAL_RECORDS", displayName, dailySchedule: await fullAcademicSchedule(), population: { students, parents, teachers, courses } });
}));