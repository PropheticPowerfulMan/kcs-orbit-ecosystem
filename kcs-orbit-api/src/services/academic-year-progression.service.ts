import { AppSlug, Prisma } from "@prisma/client";
import {
  AcademicProgressionOverride,
  buildAcademicProgressionPlan,
  getAcademicYearWindow,
  KCS_ACADEMIC_PASSING_SCORE_PERCENT
} from "@ecosystem/shared-contracts";
import { prisma } from "../db";

export type AcademicYearRolloverInput = {
  organizationId: string;
  effectiveDate?: Date;
  force?: boolean;
  passThreshold?: number;
  overrides?: AcademicProgressionOverride[];
};

function normalizeDate(value?: Date) {
  return value || new Date();
}

async function loadRolloverCatalog(organizationId: string) {
  const [students, classes] = await Promise.all([
    prisma.student.findMany({
      where: { organizationId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        classId: true,
        className: true,
        status: true,
        grades: {
          select: {
            score: true,
            maxScore: true
          }
        }
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }]
    }),
    prisma.class.findMany({
      where: { organizationId },
      select: {
        id: true,
        name: true,
        gradeLevel: true,
        suffix: true
      },
      orderBy: [{ gradeLevel: "asc" }, { name: "asc" }]
    })
  ]);

  return {
    students: students.map((student) => {
      const totalScore = student.grades.reduce((sum, grade) => sum + grade.score, 0);
      const totalMaxScore = student.grades.reduce((sum, grade) => sum + grade.maxScore, 0);
      return {
        id: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        classId: student.classId,
        className: student.className,
        status: student.status,
        averagePercent: totalMaxScore > 0 ? Number(((totalScore / totalMaxScore) * 100).toFixed(2)) : null
      };
    }),
    classes
  };
}

export async function previewAcademicYearRollover(input: AcademicYearRolloverInput) {
  const { students, classes } = await loadRolloverCatalog(input.organizationId);

  return buildAcademicProgressionPlan({
    students,
    classes,
    overrides: input.overrides,
    effectiveDate: normalizeDate(input.effectiveDate),
    passThreshold: input.passThreshold
  });
}

function assertRunnablePlan(plan: Awaited<ReturnType<typeof previewAcademicYearRollover>>, force?: boolean) {
  if (!force && !plan.isRolloverWindow) {
    throw new Error("Academic rollover can run automatically only between July 1 and September 30. Use force for an administrator-approved correction.");
  }

  const blockingWarnings = plan.items
    .filter((item) => item.warnings.includes("MANUAL_TRANSFER_REQUIRES_TARGET_CLASS"))
    .map((item) => `${item.studentName} (${item.studentId})`);

  if (blockingWarnings.length > 0) {
    throw new Error(`Manual transfers require a target class: ${blockingWarnings.join(", ")}`);
  }
}

function buildStudentUpdate(item: Awaited<ReturnType<typeof previewAcademicYearRollover>>["items"][number]): Prisma.StudentUpdateInput {
  const data: Prisma.StudentUpdateInput = {
    className: item.toClassName,
    status: item.status
  };

  if (item.toClassId) {
    data.class = { connect: { id: item.toClassId } };
  } else {
    data.class = { disconnect: true };
  }

  return data;
}

export async function executeAcademicYearRollover(input: AcademicYearRolloverInput) {
  const plan = await previewAcademicYearRollover(input);
  assertRunnablePlan(plan, input.force);

  const applied = await prisma.$transaction(async (tx) => {
    const results = [];

    for (const item of plan.items) {
      const updatedStudent = await tx.student.update({
        where: { id: item.studentId },
        data: buildStudentUpdate(item),
        select: {
          id: true,
          firstName: true,
          lastName: true,
          classId: true,
          className: true,
          status: true
        }
      });

      await tx.syncEvent.create({
        data: {
          organizationId: input.organizationId,
          appSlug: AppSlug.KCS_NEXUS,
          eventType: item.eventType,
          entityType: "student",
          entityId: item.studentId,
          direction: "OUTBOUND",
          status: "PENDING",
          payload: {
            academicYear: plan.academicYear,
            nextAcademicYear: plan.nextAcademicYear,
            effectiveDate: plan.effectiveDate,
            action: item.action,
            decision: item.decision,
            fromClassId: item.fromClassId,
            fromClassName: item.fromClassName,
            toClassId: item.toClassId,
            toClassName: item.toClassName,
            averagePercent: item.averagePercent,
            passThreshold: item.passThreshold,
            warnings: item.warnings
          } as never
        }
      });

      results.push(updatedStudent);
    }

    await tx.auditLog.create({
      data: {
        organizationId: input.organizationId,
        action: "academic_year.rollover.executed",
        entityType: "academicYear",
        entityId: plan.nextAcademicYear,
        metadata: {
          academicYear: plan.academicYear,
          nextAcademicYear: plan.nextAcademicYear,
          effectiveDate: plan.effectiveDate,
          counts: plan.counts,
          passThreshold: KCS_ACADEMIC_PASSING_SCORE_PERCENT,
          force: Boolean(input.force),
          warningCount: plan.warnings.length
        } as never
      }
    });

    return results;
  });

  return {
    ...plan,
    applied: applied.length
  };
}

export async function runDueAcademicYearRollovers(effectiveDate = new Date()) {
  const window = getAcademicYearWindow(effectiveDate);
  if (!window.isRolloverWindow) {
    return {
      checked: 0,
      executed: 0,
      skipped: 0,
      reason: "outside_rollover_window"
    };
  }

  const nextAcademicYear = getAcademicYearWindow(new Date(Date.UTC(effectiveDate.getUTCFullYear() + 1, 8, 1))).academicYear;
  const organizations = await prisma.organization.findMany({
    where: { isActive: true },
    select: { id: true }
  });
  let executed = 0;
  let skipped = 0;

  for (const organization of organizations) {
    const alreadyExecuted = await prisma.auditLog.findFirst({
      where: {
        organizationId: organization.id,
        action: "academic_year.rollover.executed",
        entityType: "academicYear",
        entityId: nextAcademicYear
      },
      select: { id: true }
    });

    if (alreadyExecuted) {
      skipped += 1;
      continue;
    }

    await executeAcademicYearRollover({
      organizationId: organization.id,
      effectiveDate,
      force: false
    });
    executed += 1;
  }

  return {
    checked: organizations.length,
    executed,
    skipped,
    reason: "rollover_window"
  };
}

export function startAcademicYearRolloverScheduler(intervalMs = 24 * 60 * 60 * 1000) {
  if (process.env.ACADEMIC_ROLLOVER_AUTO_ENABLED === "false") {
    return null;
  }

  const run = async () => {
    try {
      const result = await runDueAcademicYearRollovers();
      if (result.checked > 0 || result.executed > 0) {
        console.log("[AcademicYear] rollover scheduler", result);
      }
    } catch (error) {
      console.error("[AcademicYear] rollover scheduler failed", error);
    }
  };

  void run();
  const timer = setInterval(run, intervalMs);
  return timer;
}
