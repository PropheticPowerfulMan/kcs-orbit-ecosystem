import { NextFunction, Request, Response, Router } from "express";
import { z } from "zod";
import { authGuard, AuthenticatedRequest } from "../../middlewares/auth";
import { deleteOrbitTeacher, orbitRegistryIsEnabled, readOrbitSharedOptions, syncOrbitRegistryMirror, updateOrbitTeacher } from "../../integrations/orbitRegistry";
import { prisma } from "../../prisma";
import { notifyStandaloneEntityChange } from "../notifications/entityChange";

export const sharedDirectoryRouter = Router();
const denyEntityMutation = (_req: Request, res: Response, _next: NextFunction) => res.status(403).json({
  message: 'EduPay dispose d’un accès en lecture seule aux entités. Utilisez Savanex ou le superadministrateur KCS Nexus pour toute modification.',
});


const updateEmployeeSchema = z.object({
  fullName: z.string().trim().min(1).optional(),
  firstName: z.string().trim().min(1).nullable().optional(),
  middleName: z.string().trim().min(1).nullable().optional(),
  lastName: z.string().trim().min(1).nullable().optional(),
  phone: z.string().trim().min(1).nullable().optional(),
  email: z.string().trim().email().nullable().optional(),
  physicalAddress: z.string().trim().min(1).nullable().optional(),
  accessCode: z.string().trim().min(6).max(24).nullable().optional(),
  subject: z.string().trim().min(1).nullable().optional(),
  employeeType: z.string().trim().min(1).nullable().optional(),
  department: z.string().trim().min(1).nullable().optional(),
  jobTitle: z.string().trim().min(1).nullable().optional(),
  mustChangePassword: z.boolean().optional(),
}).refine((value) => Object.values(value).some((item) => item !== undefined), {
  message: "Au moins un champ doit être fourni.",
});

const activePlanAssignmentInclude = {
  where: { isActive: true },
  include: {
    tuitionPlan: true,
    financialAgreement: true,
  },
  orderBy: { updatedAt: "desc" as const },
} as const;

function splitFullName(fullName: string) {
  const normalized = fullName.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return { firstName: "", middleName: null as string | null, lastName: "" };
  }

  const parts = normalized.split(" ");
  if (parts.length === 1) {
    return { firstName: "", middleName: null as string | null, lastName: parts[0] };
  }

  if (parts.length === 2) {
    return { firstName: parts[1], middleName: null as string | null, lastName: parts[0] };
  }

  return {
    firstName: parts[parts.length - 1],
    middleName: parts.slice(1, -1).join(" "),
    lastName: parts[0],
  };
}

function resolveDisplayedAnnualFee(student: {
  annualFee?: number | null;
  planAssignments?: Array<{
    expectedTotal?: number | null;
    paymentOptionType?: string | null;
    tuitionPlan?: { name?: string | null; finalAmount?: number | null } | null;
    financialAgreement?: { title?: string | null; customTotal?: number | null } | null;
  }>;
}) {
  const assignment = student.planAssignments?.[0];
  const agreementAmount = assignment?.financialAgreement?.customTotal;
  const expectedTotal = assignment?.expectedTotal;
  const planFinalAmount = assignment?.tuitionPlan?.finalAmount;

  const displayedAnnualFee = Number(
    agreementAmount
      ?? expectedTotal
      ?? planFinalAmount
      ?? student.annualFee
      ?? 0
  );

  return Number.isFinite(displayedAnnualFee) ? displayedAnnualFee : 0;
}

function serializeSharedStudent(student: {
  id: string;
  orbitId?: string | null;
  displayId?: string | null;
  externalStudentId?: string | null;
  studentNumber?: string | null;
  accessCode?: string | null;
  mustChangePassword?: boolean | null;
  fullName: string;
  classId: string;
  createdAt?: Date | string | null;
  class?: { name?: string | null } | null;
  parentId?: string;
  annualFee?: number | null;
  planAssignments?: Array<{
    paymentOptionType?: string | null;
    tuitionPlan?: { name?: string | null; finalAmount?: number | null } | null;
    financialAgreement?: { title?: string | null; customTotal?: number | null } | null;
    expectedTotal?: number | null;
  }>;
}, schoolId: string, parentId?: string, financeStudent?: {
  expectedTotal: number;
  reductionTotal: number;
  originalAmount: number;
  paymentOptionType: string | null;
  planName: string;
}) {
  const assignment = student.planAssignments?.[0];

  return {
    ...splitFullName(student.fullName),
    id: student.id,
    orbitId: student.orbitId || undefined,
    displayId: student.displayId || student.externalStudentId || student.id,
    studentNumber: student.studentNumber || student.externalStudentId || student.id,
    externalStudentId: student.externalStudentId || undefined,
    accessCode: student.accessCode || undefined,
    mustChangePassword: student.mustChangePassword ?? undefined,
    fullName: student.fullName,
    classId: student.classId,
    className: student.class?.name || student.classId,
    createdAt: student.createdAt ? new Date(student.createdAt).toISOString() : undefined,
    parentId,
    organizationId: schoolId,
    externalIds: [],
    annualFee: Number(student.annualFee ?? 0),
    annualFeeDisplay: financeStudent?.expectedTotal ?? resolveDisplayedAnnualFee(student),
    originalAnnualFee: financeStudent?.originalAmount ?? Number(student.annualFee ?? 0),
    reductionTotal: financeStudent?.reductionTotal ?? 0,
    paymentOptionType: financeStudent?.paymentOptionType ?? assignment?.paymentOptionType ?? null,
    tuitionPlanName: financeStudent?.planName ?? assignment?.financialAgreement?.title ?? assignment?.tuitionPlan?.name ?? "",
  };
}

sharedDirectoryRouter.use(authGuard);

sharedDirectoryRouter.get("/", async (req: AuthenticatedRequest, res) => {
  if (orbitRegistryIsEnabled()) {
    const mirrored = await readOrbitSharedOptions();
    const mirroredStudentExternalIds = mirrored.students.map((student) => student.externalStudentId).filter((id): id is string => Boolean(id));
    const localStudents = mirroredStudentExternalIds.length
      ? await prisma.student.findMany({
        where: { schoolId: req.user!.schoolId, externalStudentId: { in: mirroredStudentExternalIds } },
        include: {
          class: true,
          planAssignments: activePlanAssignmentInclude,
        },
      })
      : [];
    const localStudentByExternalId = new Map(localStudents.filter((student) => student.externalStudentId).map((student) => [student.externalStudentId!, student]));
    const parents = mirrored.parents.map((parent) => ({
      ...parent,
      localId: undefined,
      id: parent.orbitId || parent.id,
      students: parent.students.map((student) => {
        const localStudent = student.externalStudentId ? localStudentByExternalId.get(student.externalStudentId) : undefined;
        const serialized = serializeSharedStudent(localStudent ? {
          ...localStudent,
          orbitId: student.orbitId,
          displayId: student.displayId,
          studentNumber: student.studentNumber,
          accessCode: student.accessCode,
          mustChangePassword: student.mustChangePassword,
        } : {
          ...student,
          class: { name: student.className },
          parentId: parent.id,
        }, req.user!.schoolId, parent.orbitId || parent.id);
        return {
          ...serialized,
          localId: localStudent?.id,
          id: student.orbitId || serialized.id,
          parentId: parent.orbitId || parent.id,
        };
      }),
    }));
    const students = mirrored.students.map((student) => {
      const localStudent = student.externalStudentId ? localStudentByExternalId.get(student.externalStudentId) : undefined;
      const serialized = serializeSharedStudent(localStudent ? {
        ...localStudent,
        orbitId: student.orbitId,
        displayId: student.displayId,
        studentNumber: student.studentNumber,
        accessCode: student.accessCode,
        mustChangePassword: student.mustChangePassword,
      } : {
        ...student,
        class: { name: student.className },
      }, req.user!.schoolId);
      return {
        ...serialized,
        localId: localStudent?.id,
        id: student.orbitId || student.id,
      };
    });

    const teachers = mirrored.teachers;

    return res.json({
      source: "orbit",
      visibility: "shared-directory",
      counts: {
        families: parents.length,
        parents: parents.length,
        students: students.length,
        teachers: teachers.length,
      },
      families: mirrored.parents.map((parent) => ({
        id: parent.orbitId || parent.id,
        displayId: parent.displayId || parent.orbitId || parent.id,
        familyLabel: `${splitFullName(parent.fullName).lastName || parent.fullName} Family`,
        parentIds: [parent.orbitId || parent.id],
        studentIds: parent.students.map((student) => student.orbitId || student.id),
        organizationId: req.user!.schoolId,
        externalIds: [],
      })),
      parents,
      students,
      teachers,
    });
  }

  return res.status(503).json({ message: 'Le registre Orbit est requis pour garantir des effectifs identiques dans tout l’écosystème.' });

  const [parents, students] = await Promise.all([
    prisma.parent.findMany({
      where: { schoolId: req.user!.schoolId },
      include: {
        students: {
          include: {
            class: true,
            planAssignments: activePlanAssignmentInclude,
          },
        },
      },
      orderBy: { fullName: "asc" },
    }),
    prisma.student.findMany({
      where: { schoolId: req.user!.schoolId },
      include: {
        class: true,
        planAssignments: activePlanAssignmentInclude,
      },
      orderBy: { fullName: "asc" },
    }),
  ]);
  return res.json({
    source: "local",
    visibility: "shared-directory",
    counts: {
      families: parents.length,
      parents: parents.length,
      students: students.length,
      teachers: 0,
    },
    families: parents.map((parent) => ({
      id: parent.id,
      displayId: parent.id,
      familyLabel: `${splitFullName(parent.fullName).lastName || parent.fullName} Family`,
      parentIds: [parent.id],
      studentIds: parent.students.map((student) => student.id),
      organizationId: req.user!.schoolId,
      externalIds: [],
    })),
    parents: parents.map((parent) => ({
      ...splitFullName(parent.fullName),
      id: parent.id,
      displayId: parent.id,
      fullName: parent.fullName,
      studentIds: parent.students.map((student) => student.id),
      organizationId: req.user!.schoolId,
      externalIds: [],
      phone: parent.phone,
      email: parent.email,
      physicalAddress: parent.physicalAddress,
      students: parent.students.map((student) => serializeSharedStudent(student, req.user!.schoolId, parent.id)),
    })),
    students: students.map((student) => serializeSharedStudent(student, req.user!.schoolId, student.parentId)),
    teachers: [],
  });
});

sharedDirectoryRouter.get("/teachers", async (req: AuthenticatedRequest, res) => {
  if (!orbitRegistryIsEnabled()) {
    return res.json([]);
  }

  const mirrored = await readOrbitSharedOptions();
  return res.json(mirrored.teachers);
});

sharedDirectoryRouter.put("/teachers/:id", async (req: AuthenticatedRequest, res) => {
  if (!orbitRegistryIsEnabled()) {
    return res.status(400).json({ message: "La synchronisation des employes n'est pas activee sur cet environnement." });
  }

  const payload = updateEmployeeSchema.parse(req.body);
  try {
    const result = await updateOrbitTeacher(req.params.id, payload);
    await syncOrbitRegistryMirror(req.user!.schoolId);
    const notificationStatus = await notifyStandaloneEntityChange({
      schoolId: req.user!.schoolId,
      subject: "Mise à jour du dossier employé EduPay",
      body: [
        `Le dossier employé ${payload.fullName || req.params.id} vient d'être modifié dans EduPay.`,
        "Les informations sont synchronisées avec le registre partagé de l'écosystème.",
      ].join("\n"),
      email: payload.email ?? undefined,
      phone: payload.phone ?? undefined,
    });
    return res.json({ ...result, notificationStatus });
  } catch (error) {
    console.error("[TEACHER_UPDATE_ORBIT] Unable to update teacher in shared registry", error);
    return res.status(502).json({ message: error instanceof Error ? error.message : "Modification employe indisponible dans le registre partage." });
  }
});

sharedDirectoryRouter.delete("/teachers/:id", async (req: AuthenticatedRequest, res) => {
  if (!orbitRegistryIsEnabled()) {
    return res.status(400).json({ message: "La synchronisation des employes n'est pas activee sur cet environnement." });
  }

  const result = await deleteOrbitTeacher(req.params.id);
  return res.json(result);
});
