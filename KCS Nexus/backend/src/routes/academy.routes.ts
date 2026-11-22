import { timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { env } from "../config/env.js";
import {
  authenticate,
  requireRoles,
  type AuthenticatedRequest,
} from "../middleware/auth.js";
import { asyncHandler, ApiError, success } from "../utils/api.js";
import { prisma } from "../config/prisma.js";
import {
  academicScheduleForGrade,
  academicScheduleForTeacher,
  fullAcademicSchedule,
} from "../utils/academicSchedule.js";

import { academyScheduleBelongsTo } from "../utils/academyScheduleIdentity.js";
import { assertAccountAccess } from "../services/accountAccess.service.js";
import { plannerTickets } from "../services/lessonPlanTickets.js";
import { academicCalendars } from "../services/reportAttendance.service.js";
import { publishedSemesterScope } from "../utils/publishedSemesterScope.js";
import { coursePeriodStates } from "../services/courseTeachingPeriods.service.js";
import {
  courseMatchesPeriod,
  validAcademicYear,
} from "../utils/courseTeachingPeriods.js";

export const academyRouter = Router();
academyRouter.post(
  "/launch",
  authenticate,
  requireRoles("teacher", "student", "staff", "admin"),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (
      !env.KCS_ORBIT_API_URL ||
      !env.ACADEMY_INTEGRATION_KEY ||
      !env.ACADEMY_PUBLIC_URL
    )
      throw new ApiError(503, "Academy integration is not configured");
    let user =
      req.user!.sub === "configured-superadmin"
        ? await prisma.user.findUnique({
            where: {
              email: (process.env.SUPERADMIN_EMAIL || "").trim().toLowerCase(),
            },
            include: { teacherProfile: true, studentProfile: true },
          })
        : await prisma.user.findUnique({
            where: { id: req.user!.sub },
            include: { teacherProfile: true, studentProfile: true },
          });
    const isTeacher =
      user?.role === "TEACHER" ||
      (user?.role === "STAFF" && Boolean(user.teacherProfile));
    if (!user || (!isTeacher && !["STUDENT", "ADMIN"].includes(user.role)))
      throw new ApiError(403, "Academy access is not enabled for this role");

    await assertAccountAccess(user.id);
    if (!user.orbitUserId) {
      if (!env.KCS_ORBIT_API_KEY || !env.KCS_ORBIT_ORGANIZATION_ID)
        throw new ApiError(
          503,
          "Orbit identity synchronization is not configured",
        );
      const entityType = isTeacher
        ? "teacher"
        : user.role === "STUDENT"
          ? "student"
          : null;
      if (!entityType)
        throw new ApiError(
          409,
          "This administrator account is not linked to a verified Orbit identity",
        );
      const body =
        entityType === "teacher"
          ? {
              organizationId: env.KCS_ORBIT_ORGANIZATION_ID,
              firstName: user.firstName,
              middleName: user.middleName || undefined,
              lastName: user.lastName,
              email: user.email,
              phone: user.phone || undefined,
              accessCode: user.accessCode || undefined,
              subject: user.teacherProfile?.department || undefined,
            }
          : {
              organizationId: env.KCS_ORBIT_ORGANIZATION_ID,
              firstName: user.firstName,
              middleName: user.middleName || undefined,
              lastName: user.lastName,
              email: user.email,
              phone: user.phone || undefined,
              accessCode: user.accessCode || undefined,
              studentNumber: user.studentProfile?.studentNumber || undefined,
              gender: "UNSPECIFIED",
              className:
                [user.studentProfile?.grade, user.studentProfile?.section]
                  .filter(Boolean)
                  .join(" ") || undefined,
            };
      const synced = await fetch(
        env.KCS_ORBIT_API_URL.replace(/\/$/, "") +
          "/api/integration/registry/" +
          entityType,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": env.KCS_ORBIT_API_KEY,
            "x-app-slug": "KCS_NEXUS",
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(10_000),
        },
      );
      const syncPayload = (await synced.json().catch(() => ({}))) as {
        orbitId?: string;
        message?: string;
      };
      if (![201, 409].includes(synced.status) || !syncPayload.orbitId)
        throw new ApiError(
          synced.status,
          syncPayload.message || "Orbit identity synchronization failed",
        );
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          orbitUserId: syncPayload.orbitId,
          orbitOrganizationId: env.KCS_ORBIT_ORGANIZATION_ID,
        },
        include: { teacherProfile: true, studentProfile: true },
      });
    }

    const response = await fetch(
      env.KCS_ORBIT_API_URL.replace(/\/$/, "") +
        "/api/academy/sso/service-tickets",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": env.ACADEMY_INTEGRATION_KEY,
        },
        body: JSON.stringify({ userId: user.orbitUserId }),
        signal: AbortSignal.timeout(10_000),
      },
    );
    const payload = (await response.json().catch(() => ({}))) as {
      ticket?: string;
      message?: string;
    };
    if (!response.ok || !payload.ticket)
      throw new ApiError(
        response.status,
        payload.message || "Academy launch failed",
      );
    const academyBaseUrl = env.ACADEMY_PUBLIC_URL.endsWith("/")
      ? env.ACADEMY_PUBLIC_URL
      : env.ACADEMY_PUBLIC_URL + "/";
    const url = new URL("api/auth/callback", academyBaseUrl);
    url.searchParams.set("ticket", payload.ticket);
    return success(res, { url: url.toString() });
  }),
);

function validAcademyKey(provided: string | undefined) {
  const expected = env.ACADEMY_INTEGRATION_KEY;
  if (!provided || !expected) return false;
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

// This private service endpoint binds the verified Orbit registry identity. No credential or grade is returned.
academyRouter.post(
  "/context",
  asyncHandler(async (req, res) => {
    if (!validAcademyKey(req.header("x-api-key")))
      throw new ApiError(401, "Unauthorized Academy service");
    const role = String(req.body?.role || "").toUpperCase();
    const user = await prisma.user.findUnique({
      // Preserve the previous private service contract during a rolling deployment.
      // An explicit registry ID always takes precedence and never falls back to email.
      where: req.body?.orbitId
        ? { orbitUserId: String(req.body.orbitId) }
        : {
            email: String(req.body?.email || "")
              .trim()
              .toLowerCase(),
          },
      include: { teacherProfile: true, studentProfile: true },
    });
    if (!user || (req.body?.orbitId && user.orbitUserId !== req.body.orbitId))
      throw new ApiError(403, "Academy identity mismatch");
    await assertAccountAccess(user.id);
    const teacher =
      Boolean(user.teacherProfile) && ["TEACHER", "STAFF"].includes(user.role);
    if (
      !(
        (role === "TEACHER" && teacher) ||
        (role === "STUDENT" &&
          user.role === "STUDENT" &&
          user.studentProfile) ||
        (["ADMIN", "SUPER_ADMIN"].includes(role) && user.role === "ADMIN")
      )
    )
      throw new ApiError(403, "Academy role mismatch");
    const calendars = await academicCalendars();
    const current = publishedSemesterScope(
      calendars,
      new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Kinshasa" }),
    );
    const academicYear = String(
      req.body?.academicYear || current?.academicYear || "",
    );
    const semester = Number(req.body?.semester || current?.semester || 1);
    if (
      (academicYear &&
        (!validAcademicYear(academicYear) ||
          !calendars.some((c) => c.name === academicYear))) ||
      ![1, 2].includes(semester)
    )
      throw new ApiError(400, "Select a published academic year and semester");
    const where =
      role === "TEACHER"
        ? { teacherId: user.teacherProfile!.id }
        : role === "STUDENT"
          ? { enrollments: { some: { studentId: user.studentProfile!.id } } }
          : {};
    const selectedCalendar = calendars.find((c) => c.name === academicYear);
    const semesterDates = selectedCalendar?.periods?.find(
      (v) => v.type === "SEMESTER" && v.sequence === semester,
    );
    const assignmentDates = semesterDates || selectedCalendar;
    const raw = await prisma.course.findMany({
      where,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
        grade: true,
        credits: true,
        updatedAt: true,
        teacher: {
          select: {
            user: {
              select: { firstName: true, middleName: true, lastName: true },
            },
          },
        },
        schedules: {
          select: {
            id: true,
            day: true,
            startTime: true,
            endTime: true,
            room: true,
          },
        },
        enrollments: {
          where: {
            student: {
              status: { equals: "active", mode: "insensitive" },
              archive: null,
              user: { accountBlockedAt: null },
            },
          },
          select: {
            student: {
              select: {
                id: true,
                grade: true,
                section: true,
                user: {
                  select: { firstName: true, middleName: true, lastName: true },
                },
              },
            },
          },
        },
        assignments: {
          where: {
            publishedAt: { lte: new Date() },
            ...(assignmentDates
              ? {
                  dueDate: {
                    gte: new Date(assignmentDates.startDate),
                    lte: new Date(
                      assignmentDates.endDate.slice(0, 10) + "T23:59:59.999Z",
                    ),
                  },
                }
              : {}),
          },
          select: {
            id: true,
            title: true,
            description: true,
            dueDate: true,
            maxScore: true,
            type: true,
            publishedAt: true,
            submissions: {
              ...(role === "STUDENT"
                ? { where: { studentId: user.studentProfile!.id } }
                : {}),
              select: {
                studentId: true,
                status: true,
                submittedAt: true,
                gradedAt: true,
              },
            },
          },
          orderBy: { dueDate: "asc" },
        },
      },
    });
    const states = await coursePeriodStates(raw.map((c) => c.id));
    const name = (v: {
      firstName: string;
      middleName: string | null;
      lastName: string;
    }) => [v.lastName, v.middleName, v.firstName].filter(Boolean).join(" ");
    const courses = raw
      .filter(
        (c) =>
          !academicYear ||
          courseMatchesPeriod(
            states.get(c.id)?.periods || [],
            academicYear,
            "Semester " + semester,
          ),
      )
      .map((c) => ({
        id: c.id,
        name: c.name,
        code: c.code,
        description: c.description,
        grade: c.grade,
        credits: c.credits,
        updatedAt: c.updatedAt,
        teacherName: name(c.teacher.user),
        schedules: c.schedules,
        enrolledStudents: c.enrollments.length,
        ...(role !== "STUDENT"
          ? {
              learners: c.enrollments.map((e) => ({
                id: e.student.id,
                name: name(e.student.user),
                grade: e.student.grade,
                section: e.student.section,
              })),
            }
          : {}),
        assignments: c.assignments.map((a) => ({
          id: a.id,
          title: a.title,
          description: a.description,
          dueDate: a.dueDate,
          maxScore: a.maxScore,
          type: a.type,
          ...(role === "STUDENT"
            ? {
                myStatus: a.submissions[0]?.status || "PENDING",
                submittedAt: a.submissions[0]?.submittedAt || null,
              }
            : {
                submitted: a.submissions.filter((s) => s.submittedAt).length,
                pendingReview: a.submissions.filter(
                  (s) => s.submittedAt && !s.gradedAt,
                ).length,
              }),
        })),
      }));
    // Always query the selected published scope rather than reusing another semester's timetable.
    const dailySchedule = academicYear
      ? await prisma.academicScheduleEntry.findMany({
          where: {
            academicYear,
            semester,
            active: true,
            ...(role === "STUDENT"
              ? {
                  grade: {
                    equals: user.studentProfile!.grade,
                    mode: "insensitive",
                  },
                }
              : {}),
          },
          orderBy: [{ day: "asc" }, { startTime: "asc" }],
        })
      : [];
    const teachers =
      role === "TEACHER"
        ? await prisma.user.findMany({
            where: { teacherProfile: { isNot: null } },
            select: {
              id: true,
              firstName: true,
              middleName: true,
              lastName: true,
            },
          })
        : [];
    const normalizeGrade = (v: string) =>
      v.toLowerCase().replace(/[^a-z0-9]/g, "");
    const daily =
      role === "TEACHER"
        ? dailySchedule.filter((e) =>
            academyScheduleBelongsTo(e.teacherName, user.id, teachers),
          )
        : role === "STUDENT"
          ? dailySchedule.filter(
              (e) =>
                !e.classGroup ||
                normalizeGrade(e.classGroup) ===
                  normalizeGrade(user.studentProfile!.section) ||
                normalizeGrade(e.classGroup) ===
                  normalizeGrade(
                    "G" +
                      (user.studentProfile!.grade.match(/\d+/)?.[0] || "") +
                      user.studentProfile!.section,
                  ),
            )
          : dailySchedule;
    const [unreadNotifications, unreadMessages] = await Promise.all([
      prisma.notification.count({ where: { userId: user.id, isRead: false } }),
      prisma.internalMessage.count({
        where: { recipientId: user.id, readAt: null },
      }),
    ]);
    const population =
      role === "ADMIN" || role === "SUPER_ADMIN"
        ? {
            students: await prisma.studentProfile.count({
              where: {
                status: { equals: "active", mode: "insensitive" },
                archive: null,
              },
            }),
            teachers: await prisma.teacherProfile.count(),
            courses: courses.length,
            parents: await prisma.user.count({
              where: { role: "PARENT", accountBlockedAt: null },
            }),
          }
        : undefined;
    res.set("Cache-Control", "private, no-store");
    return success(res, {
      source: "KCS_NEXUS_INSTITUTIONAL_RECORDS",
      syncedAt: new Date().toISOString(),
      displayName: name(user),
      dashboardAvatar: user.avatar,
      academicYear,
      semester,
      calendars: calendars.map((c) => ({
        name: c.name,
        isCurrent: c.isCurrent,
        startDate: c.startDate,
        endDate: c.endDate,
        periods: c.periods || [],
      })),
      courses,
      dailySchedule: daily.map((e) => ({
        id: e.id,
        academicYear: e.academicYear,
        semester: e.semester,
        grade: e.grade,
        sourceKey: e.sourceKey,
        sourceDocument: e.sourceDocument,
        period: e.period,
        classGroup: e.classGroup,
        day: e.day,
        startTime: e.startTime,
        endTime: e.endTime,
        room: e.room,
        teacher: e.teacherName,
        course: {
          id: e.sourceKey,
          name: e.subject,
          code: e.sourceKey,
          description: "",
        },
      })),
      profile: user.studentProfile
        ? {
            id: user.studentProfile.id,
            studentNumber: user.studentProfile.studentNumber,
            grade: user.studentProfile.grade,
            section: user.studentProfile.section,
          }
        : null,
      population,
      communications: { unreadNotifications, unreadMessages },
    });
  }),
);

academyRouter.post(
  "/eduplanner-ticket",
  asyncHandler(async (req, res) => {
    if (!validAcademyKey(req.header("x-api-key")))
      throw new ApiError(401, "Unauthorized Academy service");
    if (!env.KCS_ORBIT_API_URL) throw new ApiError(503, "Orbit is unavailable");
    const verified = await fetch(
      env.KCS_ORBIT_API_URL.replace(/\/$/, "") + "/api/academy/sso/validate",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": env.ACADEMY_INTEGRATION_KEY!,
        },
        body: JSON.stringify({ token: req.body?.sessionToken }),
        signal: AbortSignal.timeout(8000),
      },
    );
    const identity = (await verified.json().catch(() => null)) as any;
    if (
      !verified.ok ||
      !identity?.orbitId ||
      identity.organizationId !== env.KCS_ORBIT_ORGANIZATION_ID
    )
      throw new ApiError(401, "The Academy session could not be verified");
    const user = await prisma.user.findUnique({
      where: { orbitUserId: identity.sourceIdentityId || identity.orbitId },
      include: { teacherProfile: true },
    });
    if (!user || !user.email || (!user.teacherProfile && user.role !== "ADMIN"))
      throw new ApiError(
        403,
        "Eduplanner is reserved for teachers and authorized school leaders",
      );
    await assertAccountAccess(user.id);
    const purpose =
      req.body?.purpose === "academy-read" ? "academy-read" : "login";
    const ticket = plannerTickets.issue(
      {
        userId: user.id,
        email: user.email,
        firstName: user.firstName,
        middleName: user.middleName,
        lastName: user.lastName,
        role: user.role,
        accessRoles: [
          user.role.toLowerCase(),
          ...(user.teacherProfile ? ["teacher"] : []),
        ],
      },
      purpose,
    );
    return success(res, {
      ticket,
      purpose,
      url:
        "/lesson-plan/?from=academy#/sso?ticket=" + encodeURIComponent(ticket),
    });
  }),
);
