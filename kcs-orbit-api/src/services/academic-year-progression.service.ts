import { verifyGraduationApproval,officialAnnualAverage, type GraduationApproval } from "./graduation-approval";
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
  graduationApproval?: GraduationApproval;
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
      return {
        id: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        classId: student.classId,
        className: student.className,
        status: student.status,
        averagePercent: null as number|null
      };
    }),
    classes
  };
}

export async function previewAcademicYearRollover(input: AcademicYearRolloverInput) {
  const { students, classes } = await loadRolloverCatalog(input.organizationId);
  const approval = verifyGraduationApproval(input.graduationApproval, input.organizationId);
  const approved = new Map((approval?.students ?? []).map(student => [student.id, student.average]));
  for (const student of students) student.averagePercent=officialAnnualAverage(approval,student.id,student.className)
  for (const override of input.overrides ?? []) {
    const student=students.find(s=>s.id===override.studentId);
    if(student&&/^(?:k|kg|kindergarten)\s*[3-5](?:\s|$)/i.test(student.className||'')&&override.decision!=='AUTO'){
      const authorized=approval?.earlyYearsDecisions?.find(d=>d.studentId===override.studentId);
      if(!authorized||!(['studentId','decision','targetClassId','targetClassName','reason'] as const).every(key=>String(authorized[key]??'').trim()===String(override[key]??'').trim()))throw new Error('Kindergarten decisions require an explicit signed SuperAdmin decision.');
    }
    if (override.decision === 'GRADUATE' && (!approved.has(override.studentId) || !students.some(s => s.id === override.studentId && /^grade\s*12(?:\s|$)/i.test(s.className ?? '')))) throw new Error('Graduation requires an approved Grade 12 annual report with an average of at least 70%.');
  }

  const plan=buildAcademicProgressionPlan({
    students:students.filter(student=>!/(?:graduat|archiv|delet|dismiss|inactive|expell)/i.test(student.status||'')),
    classes,
    overrides: input.overrides,
    effectiveDate: normalizeDate(input.effectiveDate),
    passThreshold: KCS_ACADEMIC_PASSING_SCORE_PERCENT
  });
  if(approval){const start=Number(approval.academicYear.slice(0,4));plan.academicYear=approval.academicYear;plan.nextAcademicYear=(start+1)+'-'+(start+2);if(approval.endDate)plan.isRolloverWindow=normalizeDate(input.effectiveDate).toISOString().slice(0,10)>approval.endDate;}
  const previous=approval?await prisma.auditLog.findFirst({where:{organizationId:input.organizationId,action:'academic_year.rollover.executed',entityType:'academicYear',entityId:plan.nextAcademicYear},select:{id:true}}):null;
  return {...plan,alreadyExecuted:Boolean(previous)};
}

function assertRunnablePlan(plan: Awaited<ReturnType<typeof previewAcademicYearRollover>>, force?: boolean) {
  if(plan.items.some(item=>item.action==='HOLD'))throw new Error('Resolve every pending annual result and every kindergarten decision before applying the year transition.');

  if (!force && !plan.isRolloverWindow) {
    throw new Error("Academic rollover can run automatically only between July 1 and September 30. Use force for an administrator-approved correction.");
  }

  const blockingWarnings = plan.items
    .filter((item) => item.warnings.includes("MANUAL_TRANSFER_REQUIRES_TARGET_CLASS")||item.warnings.includes("TARGET_CLASS_NOT_IN_CATALOG"))
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
  if(!plan.alreadyExecuted)assertRunnablePlan(plan, input.force);
  const approval = verifyGraduationApproval(input.graduationApproval, input.organizationId);
  if (!approval?.closed || approval.academicYear !== plan.academicYear) throw new Error('Academic rollover requires explicit SuperAdmin annual closure and current Nexus authorization.');
  const approved = new Set(approval.students.map(student => student.id));
  if (plan.items.some(item => item.action === 'GRADUATE' && !approved.has(item.studentId))) throw new Error('A graduation decision lacks an approved annual report.');

  const applied = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${'kcs-rollover:'+input.organizationId+':'+plan.academicYear}))`);
    const previous = await tx.auditLog.findFirst({where:{organizationId:input.organizationId,action:'academic_year.rollover.executed',entityType:'academicYear',entityId:plan.nextAcademicYear},select:{id:true}});
    if (previous) return [];
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
  }, {maxWait:10000,timeout:60000});

  return {
    ...plan,
    applied: applied.length,
    graduatedStudentIds: (await prisma.student.findMany({ where: { organizationId: input.organizationId, id: { in: approval.students.map(student=>student.id) }, status: 'GRADUATED' }, select: { id: true } })).map(student=>student.id)
  };
}

export async function runDueAcademicYearRollovers(effectiveDate = new Date()) {
  return { checked: 0, executed: 0, skipped: 0, reason: "explicit_superadmin_approval_required" };
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
