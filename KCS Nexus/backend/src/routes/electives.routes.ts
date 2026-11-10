import { Prisma, type ElectiveCycle } from "@prisma/client";
import { Router, type NextFunction, type Response } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import {
  authenticate,
  requireRoles,
  type AuthenticatedRequest,
} from "../middleware/auth.js";
import { ApiError, asyncHandler, success } from "../utils/api.js";
import { normalizeClassParts } from "../utils/className.js";
import { isSequentialAcademicYear } from "../utils/academicCycle.js";
import { allocateElectives } from "../utils/electiveAllocation.js";

export const electivesRouter = Router();
const allowedGrades = ["Grade 9", "Grade 10", "Grade 11", "Grade 12"] as const;
const cycleSchema = z
  .object({
    title: z.string().trim().min(3).max(140),
    academicYear: z
      .string()
      .refine(
        isSequentialAcademicYear,
        "Use a sequential academic year such as 2026-2027",
      ),
    semester: z.number().int().min(1).max(2),
    eligibleGrades: z
      .array(z.enum(allowedGrades))
      .min(1)
      .default([...allowedGrades]),
    opensAt: z.string().datetime().optional().nullable(),
    closesAt: z.string().datetime().optional().nullable(),
  })
  .superRefine((value, context) => {
    if (
      value.opensAt &&
      value.closesAt &&
      new Date(value.closesAt) <= new Date(value.opensAt)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["closesAt"],
        message: "Choice closing must be after choice opening",
      });
    }
  });
const offeringSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(30)
    .transform((value) => value.toUpperCase()),
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().min(10).max(2000),
  eligibleGrades: z.array(z.enum(allowedGrades)).min(1),
  capacity: z.number().int().min(1).max(24).default(24),
  teacherUserId: z.string().trim().optional().nullable(),
});
const studentGrade = (student: { grade: string; section?: string | null }) =>
  normalizeClassParts(student.grade, student.section).grade;
const canManage = (req: AuthenticatedRequest) =>
  req.user?.role === "admin" && req.user.sub !== "configured-superadmin";
const requireAdministrator =
  () => (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!canManage(req))
      return next(new ApiError(403, "Administrator access required"));
    next();
  };
const cycleWindowIsOpen = (cycle: {
  opensAt: Date | null;
  closesAt: Date | null;
}) => {
  const now = new Date();
  return (
    (!cycle.opensAt || cycle.opensAt <= now) &&
    (!cycle.closesAt || cycle.closesAt >= now)
  );
};
async function lockedCycle<T>(
  id: string,
  action: (tx: Prisma.TransactionClient, cycle: ElectiveCycle) => Promise<T>,
) {
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM "ElectiveCycle" WHERE id = ${id} FOR UPDATE`,
      );
      const cycle = await tx.electiveCycle.findUnique({ where: { id } });
      if (!cycle) throw new ApiError(404, "Elective cycle not found");
      return action(tx, cycle);
    },
    { maxWait: 10000, timeout: 30000 },
  );
}
async function eligibleStudents(
  tx: Prisma.TransactionClient,
  grades: string[],
) {
  const students = await tx.studentProfile.findMany({
    where: { status: { equals: "active", mode: "insensitive" } },
    select: { id: true, grade: true, section: true },
  });
  return students
    .map((student) => ({ ...student, grade: studentGrade(student) }))
    .filter((student) => grades.includes(student.grade));
}
async function validateTeacher(
  tx: Prisma.TransactionClient,
  id?: string | null,
) {
  if (
    id &&
    !(await tx.teacherProfile.findUnique({
      where: { userId: id },
      select: { id: true },
    }))
  )
    throw new ApiError(400, "Assigned teacher was not found");
}
function uniqueConflict(error: unknown, message: string): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  )
    throw new ApiError(409, message);
  throw error;
}

electivesRouter.get(
  "/",
  authenticate,
  requireRoles("admin", "teacher", "student"),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const studentMode = req.user!.role === "student";
    const manager = canManage(req);
    const teacher = studentMode
      ? null
      : await prisma.teacherProfile.findUnique({
          where: { userId: req.user!.sub },
          select: { id: true },
        });
    const cycles = await prisma.electiveCycle.findMany({
      where: studentMode
        ? { status: { in: ["OPEN", "CLOSED", "ALLOCATED", "PUBLISHED"] } }
        : {},
      include: {
        offerings: {
          where: studentMode ? { status: "APPROVED" } : {},
          include: {
            teacher: {
              select: {
                id: true,
                firstName: true,
                middleName: true,
                lastName: true,
              },
            },
            proposedBy: {
              select: {
                id: true,
                firstName: true,
                middleName: true,
                lastName: true,
              },
            },
          },
          orderBy: { name: "asc" },
        },
        _count: { select: { choices: true, allocations: true } },
      },
      orderBy: [{ academicYear: "desc" }, { semester: "desc" }],
    });
    const visibleCycles = cycles.map((cycle) => ({
      ...cycle,
      choiceWindowOpen: cycle.status === "OPEN" && cycleWindowIsOpen(cycle),
    }));
    const permissions = {
      canManage: manager,
      canPropose: Boolean(teacher) && !manager,
      canChoose: studentMode,
    };
    res.setHeader("Cache-Control", "private, no-store");
    if (studentMode) {
      const student = await prisma.studentProfile.findUnique({
        where: { userId: req.user!.sub },
        select: { id: true, grade: true, section: true, status: true },
      });
      if (
        !student ||
        student.status.toLowerCase() !== "active" ||
        !allowedGrades.includes(
          studentGrade(student) as (typeof allowedGrades)[number],
        )
      )
        return success(res, { eligible: false, cycles: [], permissions });
      const grade = studentGrade(student);
      const [choices, allocations] = await Promise.all([
        prisma.electiveChoice.findMany({
          where: { studentProfileId: student.id },
          orderBy: { rank: "asc" },
        }),
        prisma.electiveAllocation.findMany({
          where: {
            studentProfileId: student.id,
            published: true,
            cycle: { status: "PUBLISHED" },
          },
          include: { offering: true },
          orderBy: { preferenceRank: "asc" },
        }),
      ]);
      return success(res, {
        eligible: true,
        grade,
        cycles: visibleCycles.filter((cycle) =>
          cycle.eligibleGrades.includes(grade),
        ),
        choices,
        allocations,
        permissions,
      });
    }
    const teacherAssignments = teacher
      ? await prisma.electiveAllocation.findMany({
          where: {
            published: true,
            cycle: { status: "PUBLISHED" },
            offering: { teacherUserId: req.user!.sub },
          },
          select: {
            id: true,
            cycleId: true,
            offeringId: true,
            preferenceRank: true,
            offering: { select: { code: true, name: true } },
            student: {
              select: {
                id: true,
                studentNumber: true,
                grade: true,
                section: true,
                user: {
                  select: { firstName: true, middleName: true, lastName: true },
                },
              },
            },
          },
          orderBy: [
            { offeringId: "asc" },
            { student: { user: { lastName: "asc" } } },
          ],
        })
      : [];
    return success(res, {
      eligible: true,
      cycles: visibleCycles,
      permissions,
      teacherUserId: teacher ? req.user!.sub : null,
      teacherAssignments,
    });
  }),
);

electivesRouter.get(
  "/teachers",
  authenticate,
  requireAdministrator(),
  asyncHandler(async (_req, res) => {
    return success(
      res,
      await prisma.user.findMany({
        where: { teacherProfile: { isNot: null } },
        select: {
          id: true,
          firstName: true,
          middleName: true,
          lastName: true,
          email: true,
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      }),
    );
  }),
);

electivesRouter.post(
  "/",
  authenticate,
  requireAdministrator(),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = cycleSchema.parse(req.body);
    try {
      const cycle = await prisma.electiveCycle.create({
        data: {
          ...data,
          opensAt: data.opensAt ? new Date(data.opensAt) : null,
          closesAt: data.closesAt ? new Date(data.closesAt) : null,
          createdById: req.user!.sub,
        },
      });
      return success(res, cycle, "Elective cycle created", 201);
    } catch (error) {
      uniqueConflict(
        error,
        "An elective cycle already exists for this academic year and semester",
      );
    }
  }),
);

electivesRouter.patch(
  "/:cycleId/status",
  authenticate,
  requireAdministrator(),
  asyncHandler(async (req, res) => {
    const { status } = z
      .object({ status: z.enum(["DRAFT", "OPEN", "CLOSED"]) })
      .parse(req.body);
    const result = await lockedCycle(
      String(req.params.cycleId),
      async (tx, cycle) => {
        if (cycle.status === status) return cycle;
        const transitions: Record<string, string[]> = {
          DRAFT: ["OPEN"],
          OPEN: ["CLOSED"],
          CLOSED: ["OPEN"],
          ALLOCATED: ["OPEN"],
        };
        if (!transitions[cycle.status]?.includes(status))
          throw new ApiError(
            409,
            "Invalid elective cycle transition: " +
              cycle.status +
              " to " +
              status,
          );
        if (status === "OPEN") {
          const approved = await tx.electiveOffering.findMany({
            where: { cycleId: cycle.id, status: "APPROVED" },
          });
          if (
            approved.some(
              (offering) =>
                offering.capacity < 1 ||
                offering.capacity > 24 ||
                !offering.teacherUserId,
            )
          )
            throw new ApiError(
              409,
              "Every approved elective needs an assigned teacher and a capacity from 1 to 24",
            );
          const students = await eligibleStudents(tx, cycle.eligibleGrades);
          const insufficient = cycle.eligibleGrades.filter(
            (grade) =>
              approved.filter((offering) =>
                offering.eligibleGrades.includes(grade),
              ).length < cycle.choicesPerStudent,
          );
          if (insufficient.length)
            throw new ApiError(
              409,
              "At least six approved electives are required for every eligible grade: " +
                insufficient.join(", "),
            );
          const shortages = cycle.eligibleGrades.filter(
            (grade) =>
              approved
                .filter((offering) => offering.eligibleGrades.includes(grade))
                .reduce((sum, offering) => sum + offering.capacity, 0) <
              students.filter((student) => student.grade === grade).length *
                cycle.choicesPerStudent,
          );
          if (
            shortages.length ||
            approved.reduce((sum, offering) => sum + offering.capacity, 0) <
              students.length * cycle.choicesPerStudent
          )
            throw new ApiError(
              409,
              "The approved catalogue needs enough seats for every eligible student and grade",
            );
          await tx.electiveAllocation.deleteMany({
            where: { cycleId: cycle.id },
          });
        }
        return tx.electiveCycle.update({
          where: { id: cycle.id },
          data: { status, ...(status === "OPEN" ? { publishedAt: null } : {}) },
        });
      },
    );
    return success(res, result, "Elective cycle status updated");
  }),
);

electivesRouter.post(
  "/:cycleId/offerings",
  authenticate,
  requireRoles("admin", "teacher"),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const manager = canManage(req);
    if (
      !manager &&
      !(await prisma.teacherProfile.findUnique({
        where: { userId: req.user!.sub },
        select: { id: true },
      }))
    )
      throw new ApiError(
        403,
        "A teacher profile or administrator access is required",
      );
    const data = offeringSchema.parse(req.body);
    try {
      const offering = await lockedCycle(
        String(req.params.cycleId),
        async (tx, cycle) => {
          if (cycle.status !== "DRAFT")
            throw new ApiError(
              409,
              "Course proposals are only accepted while the catalogue is in draft",
            );
          if (
            data.eligibleGrades.some(
              (grade) => !cycle.eligibleGrades.includes(grade),
            )
          )
            throw new ApiError(
              400,
              "Every course grade must belong to this cycle",
            );
          const teacherUserId = manager
            ? data.teacherUserId || null
            : req.user!.sub;
          await validateTeacher(tx, teacherUserId);
          return tx.electiveOffering.create({
            data: {
              ...data,
              cycleId: cycle.id,
              teacherUserId,
              proposedById: req.user!.sub,
              status: manager ? "APPROVED" : "PROPOSED",
            },
          });
        },
      );
      return success(
        res,
        offering,
        manager ? "Elective added" : "Proposal submitted for approval",
        201,
      );
    } catch (error) {
      uniqueConflict(
        error,
        "This course code is already used in this elective cycle",
      );
    }
  }),
);

electivesRouter.patch(
  "/offerings/:offeringId",
  authenticate,
  requireAdministrator(),
  asyncHandler(async (req, res) => {
    const offeringId = String(req.params.offeringId);
    const existing = await prisma.electiveOffering.findUnique({
      where: { id: offeringId },
      select: { cycleId: true },
    });
    if (!existing) throw new ApiError(404, "Elective offering not found");
    const data = offeringSchema
      .partial()
      .extend({
        status: z.enum(["PROPOSED", "APPROVED", "REJECTED"]).optional(),
      })
      .parse(req.body);
    try {
      const result = await lockedCycle(existing.cycleId, async (tx, cycle) => {
        if (cycle.status !== "DRAFT")
          throw new ApiError(409, "The catalogue is locked after choices open");
        if (
          data.eligibleGrades?.some(
            (grade) => !cycle.eligibleGrades.includes(grade),
          )
        )
          throw new ApiError(
            400,
            "Every course grade must belong to this cycle",
          );
        await validateTeacher(tx, data.teacherUserId);
        return tx.electiveOffering.update({ where: { id: offeringId }, data });
      });
      return success(res, result, "Elective updated");
    } catch (error) {
      uniqueConflict(
        error,
        "This course code is already used in this elective cycle",
      );
    }
  }),
);

electivesRouter.delete(
  "/offerings/:offeringId",
  authenticate,
  requireAdministrator(),
  asyncHandler(async (req, res) => {
    const offeringId = String(req.params.offeringId);
    const existing = await prisma.electiveOffering.findUnique({
      where: { id: offeringId },
      select: { cycleId: true },
    });
    if (!existing)
      return success(res, { id: offeringId }, "Elective already removed");
    await lockedCycle(existing.cycleId, async (tx, cycle) => {
      if (cycle.status !== "DRAFT")
        throw new ApiError(409, "The catalogue is locked after choices open");
      const dependencies = await tx.electiveOffering.findUnique({
        where: { id: offeringId },
        select: { _count: { select: { choices: true, allocations: true } } },
      });
      if (!dependencies) return;
      if (dependencies._count.choices || dependencies._count.allocations)
        throw new ApiError(
          409,
          "An elective with choices or allocations cannot be deleted",
        );
      await tx.electiveOffering.delete({ where: { id: offeringId } });
    });
    return success(res, { id: offeringId }, "Elective removed");
  }),
);

electivesRouter.put(
  "/:cycleId/choices",
  authenticate,
  requireRoles("student"),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { offeringIds } = z
      .object({ offeringIds: z.array(z.string().min(1)).length(6) })
      .parse(req.body);
    if (new Set(offeringIds).size !== 6)
      throw new ApiError(400, "Six different electives are required");
    await lockedCycle(String(req.params.cycleId), async (tx, cycle) => {
      if (cycle.status !== "OPEN" || !cycleWindowIsOpen(cycle))
        throw new ApiError(
          409,
          "The elective selection window is not currently open",
        );
      if (cycle.choicesPerStudent !== 6)
        throw new ApiError(409, "This cycle is not configured for six choices");
      const student = await tx.studentProfile.findUnique({
        where: { userId: req.user!.sub },
      });
      if (
        !student ||
        student.status.toLowerCase() !== "active" ||
        !cycle.eligibleGrades.includes(studentGrade(student))
      )
        throw new ApiError(
          403,
          "Student is not eligible for this elective cycle",
        );
      const valid = await tx.electiveOffering.findMany({
        where: {
          id: { in: offeringIds },
          cycleId: cycle.id,
          status: "APPROVED",
        },
      });
      if (
        valid.length !== 6 ||
        valid.some(
          (offering) =>
            !offering.eligibleGrades.includes(studentGrade(student)),
        )
      )
        throw new ApiError(
          400,
          "One or more electives are unavailable for this grade",
        );
      await tx.electiveChoice.deleteMany({
        where: { cycleId: cycle.id, studentProfileId: student.id },
      });
      await tx.electiveChoice.createMany({
        data: offeringIds.map((offeringId, index) => ({
          cycleId: cycle.id,
          studentProfileId: student.id,
          offeringId,
          rank: index + 1,
          submittedAt: new Date(),
        })),
      });
    });
    return success(
      res,
      { submitted: true, count: 6 },
      "Six ranked elective choices submitted",
    );
  }),
);

electivesRouter.post(
  "/:cycleId/allocate",
  authenticate,
  requireAdministrator(),
  asyncHandler(async (req, res) => {
    const result = await lockedCycle(
      String(req.params.cycleId),
      async (tx, cycle) => {
        if (!["CLOSED", "ALLOCATED"].includes(cycle.status))
          throw new ApiError(409, "Close student choices before allocation");
        const [offerings, choices, students] = await Promise.all([
          tx.electiveOffering.findMany({
            where: { cycleId: cycle.id, status: "APPROVED" },
          }),
          tx.electiveChoice.findMany({
            where: { cycleId: cycle.id },
            orderBy: [{ rank: "asc" }, { studentProfileId: "asc" }],
          }),
          eligibleStudents(tx, cycle.eligibleGrades),
        ]);
        const allocation = allocateElectives(
          cycle.id,
          offerings,
          choices,
          students,
          cycle.choicesPerStudent,
        );
        await tx.electiveAllocation.deleteMany({
          where: { cycleId: cycle.id },
        });
        if (allocation.rows.length)
          await tx.electiveAllocation.createMany({ data: allocation.rows });
        await tx.electiveCycle.update({
          where: { id: cycle.id },
          data: { status: "ALLOCATED", publishedAt: null },
        });
        return {
          students: allocation.students,
          allocations: allocation.rows.length,
          complete: allocation.students - allocation.incomplete.length,
          incomplete: allocation.incomplete.length,
          fallbacks: allocation.fallbacks,
          remainingCapacity: allocation.remainingCapacity,
        };
      },
    );
    return success(res, result, "Allocation completed");
  }),
);

electivesRouter.post(
  "/:cycleId/publish",
  authenticate,
  requireAdministrator(),
  asyncHandler(async (req, res) => {
    const result = await lockedCycle(
      String(req.params.cycleId),
      async (tx, cycle) => {
        if (cycle.status === "PUBLISHED") return cycle;
        if (cycle.status !== "ALLOCATED")
          throw new ApiError(409, "Run allocation before publication");
        const [students, allocations, offerings] = await Promise.all([
          eligibleStudents(tx, cycle.eligibleGrades),
          tx.electiveAllocation.findMany({
            where: { cycleId: cycle.id },
            select: { studentProfileId: true, offeringId: true },
          }),
          tx.electiveOffering.findMany({
            where: { cycleId: cycle.id, status: "APPROVED" },
            select: { id: true, capacity: true, eligibleGrades: true },
          }),
        ]);
        const choices = await tx.electiveChoice.findMany({
          where: {
            cycleId: cycle.id,
            studentProfileId: { in: students.map((student) => student.id) },
          },
          select: { studentProfileId: true },
        });
        const submitted = new Set(
          choices.map((choice) => choice.studentProfileId),
        );
        const missing = students.filter(
          (student) => !submitted.has(student.id),
        );
        if (missing.length)
          throw new ApiError(
            409,
            "Publication blocked: " +
              missing.length +
              " eligible student(s) have not submitted six choices",
          );
        const byId = new Map(
          offerings.map((offering) => [offering.id, offering]),
        );
        const grades = new Map(
          students.map((student) => [student.id, student.grade]),
        );
        if (
          allocations.some(
            (row) =>
              !byId
                .get(row.offeringId)
                ?.eligibleGrades.includes(
                  grades.get(row.studentProfileId) ?? "",
                ),
          )
        )
          throw new ApiError(
            409,
            "An allocation no longer matches an active eligible student. Reopen choices and calculate again",
          );
        if (
          students.some(
            (student) =>
              allocations.filter((row) => row.studentProfileId === student.id)
                .length !== cycle.choicesPerStudent,
          )
        )
          throw new ApiError(
            409,
            "Some allocations are incomplete. Reopen choices and calculate again",
          );
        if (
          offerings.some(
            (offering) =>
              allocations.filter((row) => row.offeringId === offering.id)
                .length > offering.capacity,
          )
        )
          throw new ApiError(409, "An elective exceeds its approved capacity");
        await tx.electiveAllocation.updateMany({
          where: { cycleId: cycle.id },
          data: { published: true },
        });
        return tx.electiveCycle.update({
          where: { id: cycle.id },
          data: { status: "PUBLISHED", publishedAt: new Date() },
        });
      },
    );
    return success(res, result, "Final elective lists published");
  }),
);

electivesRouter.get(
  "/:cycleId/report",
  authenticate,
  requireAdministrator(),
  asyncHandler(async (req, res) => {
    const cycle = await prisma.electiveCycle.findUnique({
      where: { id: String(req.params.cycleId) },
    });
    if (!cycle) throw new ApiError(404, "Elective cycle not found");
    const [offerings, allocations, eligible, rankedChoices] = await Promise.all(
      [
        prisma.electiveOffering.findMany({
          where: { cycleId: cycle.id },
          include: {
            teacher: {
              select: { firstName: true, middleName: true, lastName: true },
            },
            _count: { select: { choices: true, allocations: true } },
          },
          orderBy: { name: "asc" },
        }),
        prisma.electiveAllocation.findMany({
          where: { cycleId: cycle.id },
          include: {
            offering: true,
            student: {
              include: {
                user: {
                  select: {
                    firstName: true,
                    middleName: true,
                    lastName: true,
                    email: true,
                  },
                },
              },
            },
          },
          orderBy: [{ offeringId: "asc" }, { studentProfileId: "asc" }],
        }),
        eligibleStudents(prisma, cycle.eligibleGrades),
        prisma.electiveChoice.findMany({
          where: { cycleId: cycle.id },
          include: {
            offering: { select: { id: true, code: true, name: true } },
            student: {
              include: {
                user: {
                  select: {
                    firstName: true,
                    middleName: true,
                    lastName: true,
                    email: true,
                  },
                },
              },
            },
          },
          orderBy: [{ studentProfileId: "asc" }, { rank: "asc" }],
        }),
      ],
    );
    const eligibleIds = new Set(eligible.map((student) => student.id));
    const participants = new Set(
      rankedChoices
        .filter((choice) => eligibleIds.has(choice.studentProfileId))
        .map((choice) => choice.studentProfileId),
    );
    const incomplete = [...participants].filter(
      (id) =>
        allocations.filter((row) => row.studentProfileId === id).length <
        cycle.choicesPerStudent,
    ).length;
    const missingStudents = await prisma.studentProfile.findMany({
      where: {
        id: {
          in: eligible
            .filter((student) => !participants.has(student.id))
            .map((student) => student.id),
        },
      },
      select: {
        id: true,
        studentNumber: true,
        grade: true,
        section: true,
        user: {
          select: {
            firstName: true,
            middleName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: [
        { grade: "asc" },
        { section: "asc" },
        { user: { lastName: "asc" } },
      ],
    });
    return success(res, {
      cycle,
      offerings,
      allocations,
      rankedChoices,
      missingStudents,
      summary: {
        eligible: eligible.length,
        participants: participants.size,
        missing: missingStudents.length,
        allocations: allocations.length,
        complete: participants.size - incomplete,
        incomplete,
        fallbacks: allocations.filter(
          (row) => row.preferenceRank > cycle.choicesPerStudent,
        ).length,
      },
    });
  }),
);
