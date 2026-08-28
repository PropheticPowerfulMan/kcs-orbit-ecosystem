import { NextFunction, Request, Response, Router } from "express";
import { z } from "zod";
import { authGuard, AuthenticatedRequest } from "../../middlewares/auth";
import { deleteOrbitTeacher, orbitRegistryIsEnabled, readOrbitRegistryMirror, readOrbitSharedOptions, syncOrbitRegistryMirror, updateOrbitTeacher } from "../../integrations/orbitRegistry";
import { prisma } from "../../prisma";
import { notifyStandaloneEntityChange } from "../notifications/entityChange";
import { env } from "../../config/env";

import bcrypt from 'bcryptjs';

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
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  dateOfBirth?: Date | string | null;
  gender?: string | null;
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
    firstName: student.firstName || splitFullName(student.fullName).firstName,
    middleName: student.middleName || splitFullName(student.fullName).middleName,
    lastName: student.lastName || splitFullName(student.fullName).lastName,
    email: student.email || null,
    phone: student.phone || null,
    dateOfBirth: student.dateOfBirth ? new Date(student.dateOfBirth).toISOString() : null,
    gender: student.gender || null,
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

sharedDirectoryRouter.post("/reset-access/:entityType/:id", async (req: AuthenticatedRequest, res) => {
  const entityType = z.enum(["parent", "student", "employee"]).parse(req.params.entityType);
  if (!env.SAVANEX_API_URL || !env.KCS_ORBIT_API_KEY) {
    return res.status(503).json({ message: "Le service central de réinitialisation des accès est indisponible." });
  }

  const directory = await readOrbitSharedOptions();
  const collection = entityType === "parent"
    ? directory.parents
    : entityType === "student"
      ? directory.students
      : directory.teachers;
  const entity = collection.find((item) =>
    item.id === req.params.id
    || item.orbitId === req.params.id
    || item.displayId === req.params.id
    || (item as { externalIds?: Array<{ externalId: string }> }).externalIds?.some((link) => link.externalId === req.params.id)
  );
  if (!entity) {
    return res.status(404).json({ message: "Entité introuvable dans le registre partagé." });
  }

  const sharedEntity = entity as typeof entity & {
    localId?: string;
    externalIds?: Array<{ appSlug: string; externalId: string }>;
    studentNumber?: string;
    employeeId?: string;
    email?: string | null;
  };
  const savanexId = sharedEntity.externalIds?.find((link) => link.appSlug.toUpperCase() === "SAVANEX")?.externalId;
  const identifier = savanexId
    || (entityType === "student" ? sharedEntity.studentNumber : undefined)
    || (entityType === "employee" ? sharedEntity.employeeId : undefined)
    || sharedEntity.email
    || sharedEntity.displayId
    || sharedEntity.id;
  const upstreamType = entityType === "employee" ? "employee" : entityType;
  const response = await fetch(
    `${env.SAVANEX_API_URL.replace(/\/$/, "")}/api/integration/entities/${upstreamType}/${encodeURIComponent(String(identifier))}/reset-access/`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": env.KCS_ORBIT_API_KEY,
      },
      body: JSON.stringify(sharedEntity),
    }
  );
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 404 && entityType === 'parent') {
      const localParent = await prisma.parent.findFirst({
        where: {
          schoolId: req.user!.schoolId,
          OR: [
            { id: sharedEntity.localId || sharedEntity.id },
            { orbitId: sharedEntity.orbitId || sharedEntity.id },
            ...(sharedEntity.email ? [{ email: sharedEntity.email }] : []),
          ],
        },
        include: { user: true },
      });
      if (!localParent?.user) {
        return res.status(404).json({ message: 'Compte parent EduPay introuvable pour cette entité.' });
      }
      const temporaryPassword = 'KCS-' + Math.floor(100000 + Math.random() * 900000);
      await prisma.user.update({
        where: { id: localParent.user.id },
        data: {
          passwordHash: await bcrypt.hash(temporaryPassword, 10),
          mustChangePassword: true,
        },
      });
      return res.json({
        entityType,
        orbitId: sharedEntity.orbitId || sharedEntity.id,
        parentId: localParent.id,
        username: localParent.user.email,
        email: localParent.user.email,
        accessCode: localParent.user.accessCode,
        temporaryPassword,
        mustChangePassword: true,
        source: 'EDUPAY',
      });
    }
    return res.status(response.status).json({
      message: typeof result.detail === "string" ? result.detail : "Impossible de réinitialiser cet accès.",
    });
  }

  await syncOrbitRegistryMirror(req.user!.schoolId);
  return res.json({ ...result, entityType, orbitId: sharedEntity.orbitId || sharedEntity.id });
});

sharedDirectoryRouter.get("/", async (req: AuthenticatedRequest, res) => {
  if (orbitRegistryIsEnabled()) {
    const mirrored = await readOrbitRegistryMirror(req.user!.schoolId);
    const mirroredStudentExternalIds = mirrored.students.map((student) => student.externalStudentId).filter((id): id is string => Boolean(id));
    const mirroredStudentOrbitIds = mirrored.students.map((student) => student.orbitId).filter((id): id is string => Boolean(id));
    const localStudents = (mirroredStudentExternalIds.length || mirroredStudentOrbitIds.length)
      ? await prisma.student.findMany({
        where: { schoolId: req.user!.schoolId, OR: [{ externalStudentId: { in: mirroredStudentExternalIds } }, { orbitId: { in: mirroredStudentOrbitIds } }] },
        include: {
          class: true,
          planAssignments: activePlanAssignmentInclude,
        },
      })
      : [];
    const localStudentByExternalId = new Map(localStudents.filter((student) => student.externalStudentId).map((student) => [student.externalStudentId!, student]));
    const localStudentByOrbitId = new Map(localStudents.filter((student) => student.orbitId).map((student) => [student.orbitId!, student]));
    const parents = mirrored.parents.map((parent) => ({
      ...parent,
      id: parent.orbitId || parent.id,
      students: parent.students.map((student) => {
        const localStudent = (student.externalStudentId ? localStudentByExternalId.get(student.externalStudentId) : undefined) || (student.orbitId ? localStudentByOrbitId.get(student.orbitId) : undefined);
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
      const localStudent = (student.externalStudentId ? localStudentByExternalId.get(student.externalStudentId) : undefined) || (student.orbitId ? localStudentByOrbitId.get(student.orbitId) : undefined);
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
