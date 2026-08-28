import { Router } from "express";
import { z } from "zod";
import { AgreementStatus, PaymentOptionType } from "@prisma/client";
import { createOrbitStudent, deleteOrbitStudent, orbitRegistryIsEnabled, readOrbitRegistryMirror, readOrbitSharedOptions, syncOrbitRegistryMirror, updateOrbitStudent } from "../../integrations/orbitRegistry";
import { enqueueOrbitEvent } from "../../integrations/orbit";
import { prisma } from "../../prisma";
import { authGuard, authorize, AuthenticatedRequest } from "../../middlewares/auth";
import { notifyParentEntityChange } from "../notifications/entityChange";
import { createSpecialFinancialAgreement, upsertParentPlanAssignment } from "../finance/service";

const specialAgreementSchema = z.object({
  title: z.string().trim().min(1),
  customTotal: z.coerce.number().positive(),
  reductionAmount: z.coerce.number().nonnegative().default(0),
  notes: z.string().trim().default(""),
  installmentMode: z.enum(["ONE_TIME", "TWO_INSTALLMENTS", "THREE_INSTALLMENTS"]).default("THREE_INSTALLMENTS")
});

const createStudentSchema = z.object({
  parentId: z.string().min(1),
  classId: z.string().min(1),
  externalStudentId: z.string().min(1).optional(),
  fullName: z.string().min(3),
  firstName: z.string().trim().min(1).optional(),
  middleName: z.string().trim().min(1).nullable().optional(),
  lastName: z.string().trim().min(1).optional(),
  email: z.string().trim().email().nullable().optional(),
  phone: z.string().trim().min(6).nullable().optional(),
  dateOfBirth: z.coerce.date().nullable().optional(),
  gender: z.string().trim().min(1).nullable().optional(),
  annualFee: z.number().positive(),
  paymentOptionType: z.nativeEnum(PaymentOptionType).default(PaymentOptionType.STANDARD_MONTHLY),
  specialAgreement: specialAgreementSchema.optional()
});

const updateStudentSchema = z.object({
  parentId: z.string().min(1),
  classId: z.string().min(1),
  fullName: z.string().min(3),
  firstName: z.string().trim().min(1).optional(),
  middleName: z.string().trim().min(1).nullable().optional(),
  lastName: z.string().trim().min(1).optional(),
  email: z.string().trim().email().nullable().optional(),
  phone: z.string().trim().min(6).nullable().optional(),
  dateOfBirth: z.coerce.date().nullable().optional(),
  gender: z.string().trim().min(1).nullable().optional(),
  annualFee: z.number().nonnegative(),
  studentNumber: z.string().trim().min(1).nullable().optional(),
  mustChangePassword: z.boolean().optional()
});

function buildSpecialAgreementInstallments(total: number, reduction: number, mode: "ONE_TIME" | "TWO_INSTALLMENTS" | "THREE_INSTALLMENTS") {
  const balance = Math.round(Math.max(total - reduction, 0) * 100) / 100;
  const now = new Date();
  const startYear = now.getUTCMonth() >= 7 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  const dueDate = (month: number, day: number) => new Date(Date.UTC(month >= 8 ? startYear : startYear + 1, month - 1, day, 23, 59, 59, 999)).toISOString();
  if (mode === "ONE_TIME") return [{ label: "Versement unique", dueDate: dueDate(8, 31), amountDue: balance }];
  if (mode === "TWO_INSTALLMENTS") {
    const first = Math.round(balance * 0.6 * 100) / 100;
    return [{ label: "Premier versement", dueDate: dueDate(8, 31), amountDue: first }, { label: "Solde", dueDate: dueDate(1, 31), amountDue: Math.round((balance - first) * 100) / 100 }];
  }
  const first = Math.round(balance * 0.4 * 100) / 100;
  const second = Math.round(balance * 0.3 * 100) / 100;
  return [{ label: "Engagement initial", dueDate: dueDate(8, 31), amountDue: first }, { label: "Regularisation mi-annee", dueDate: dueDate(1, 31), amountDue: second }, { label: "Solde final", dueDate: dueDate(5, 31), amountDue: Math.round((balance - first - second) * 100) / 100 }];
}

export const studentRouter = Router();
studentRouter.use(authGuard);

function schoolEmailToken(value?: string | null) {
  return (value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}
function studentNameParts(payload: { fullName: string; firstName?: string; middleName?: string | null; lastName?: string }) {
  const parts = payload.fullName.trim().split(/\s+/).filter(Boolean);
  return { firstName: payload.firstName || parts[parts.length - 1] || "user", middleName: payload.middleName || (parts.length > 2 ? parts.slice(1, -1).join(" ") : ""), lastName: payload.lastName || parts[0] || "kcs" };
}
async function generateSchoolEmail(payload: { fullName: string; firstName?: string; middleName?: string | null; lastName?: string }, schoolId: string) {
  const names = studentNameParts(payload);
  const first = schoolEmailToken(names.firstName) || "user";
  const middle = schoolEmailToken(names.middleName);
  const last = schoolEmailToken(names.lastName) || "kcs";
  const bases = [first + "." + last];
  if (middle) bases.push(first + "." + middle[0] + "." + last, first + "." + middle + "." + last);
  const [students, parents, users] = await Promise.all([
    prisma.student.findMany({ where: { schoolId, email: { not: null } }, select: { email: true } }),
    prisma.parent.findMany({ where: { schoolId }, select: { email: true } }),
    prisma.user.findMany({ where: { schoolId }, select: { email: true } }),
  ]);
  const unavailable = new Set([...students, ...parents, ...users].map((entry) => entry.email?.trim().toLowerCase()).filter((email): email is string => Boolean(email)));
  for (const base of bases) { const candidate = base + "@ourkcs.org"; if (!unavailable.has(candidate)) return candidate; }
  for (let sequence = 2; sequence < 10_000; sequence += 1) { const candidate = bases[0] + sequence + "@ourkcs.org"; if (!unavailable.has(candidate)) return candidate; }
  return bases[0] + Date.now() + "@ourkcs.org";
}

studentRouter.post("/school-email-preview", authorize("ADMIN", "ACCOUNTANT"), async (req: AuthenticatedRequest, res) => {
  const payload = z.object({ fullName: z.string().trim().min(1), firstName: z.string().trim().optional(), middleName: z.string().trim().nullable().optional(), lastName: z.string().trim().optional() }).parse(req.body);
  return res.json({ email: await generateSchoolEmail(payload, req.user!.schoolId) });
});

studentRouter.post("/", authorize("ADMIN", "ACCOUNTANT"), async (req: AuthenticatedRequest, res) => {
  const payload = createStudentSchema.parse(req.body);
  const studentEmail = payload.email?.trim().toLowerCase() || await generateSchoolEmail(payload, req.user!.schoolId);
  if (orbitRegistryIsEnabled() && process.env.KCS_ORBIT_REGISTRY_DIRECT_WRITES === "true") {
    const mirrored = await syncOrbitRegistryMirror(req.user!.schoolId);
    const parent = mirrored.parents.find((entry) =>
      entry.id === payload.parentId
      || entry.localId === payload.parentId
      || entry.orbitId === payload.parentId
      || entry.displayId === payload.parentId
    );
    if (!parent?.orbitId) {
      return res.status(404).json({ message: "Parent introuvable dans le registre partagé." });
    }
    const classRow = await prisma.class.findFirst({
      where: { id: payload.classId, schoolId: req.user!.schoolId },
      select: { name: true },
    });
    const created = await createOrbitStudent({
      fullName: payload.fullName,
      parentOrbitId: parent.orbitId,
      className: classRow?.name || payload.classId,
      gender: payload.gender,
      studentNumber: payload.externalStudentId,
      email: studentEmail,
      dateOfBirth: payload.dateOfBirth,
    });
    await syncOrbitRegistryMirror(req.user!.schoolId);
    const local = await prisma.student.findFirst({
      where: { schoolId: req.user!.schoolId, orbitId: created.orbitId },
      include: { class: true, parent: true, payments: true },
    });
    if (!local) {
      return res.status(201).json({
        id: created.orbitId,
        orbitId: created.orbitId,
        fullName: payload.fullName,
        parentId: parent.orbitId,
        classId: payload.classId,
        annualFee: payload.annualFee,
        propagatedToOrbit: true,
        localSetupStatus: "PENDING",
        financeStatus: "PENDING",
        paymentOptionType: payload.paymentOptionType,
        notificationStatus: { dashboard: "PENDING" },
      });
    }
    const savedStudent = await prisma.student.update({
        where: { id: local.id },
        data: {
          fullName: payload.fullName,
          firstName: payload.firstName || null,
          middleName: payload.middleName || null,
          lastName: payload.lastName || null,
          email: studentEmail,
          phone: payload.phone || null,
          dateOfBirth: payload.dateOfBirth || null,
          gender: payload.gender || null,
          annualFee: payload.annualFee
        },
        include: { class: true, parent: true, payments: true },
      });
    let financeStatus = "SYNCED";
    try {
      if (payload.paymentOptionType === PaymentOptionType.SPECIAL_OWNER_AGREEMENT) {
        await createSpecialFinancialAgreement({
          schoolId: req.user!.schoolId, parentId: savedStudent.parentId, studentId: savedStudent.id,
          title: payload.specialAgreement?.title || "Arrangement avec l ecole - " + savedStudent.fullName,
          customTotal: payload.specialAgreement?.customTotal ?? payload.annualFee, reductionAmount: payload.specialAgreement?.reductionAmount ?? 0, status: AgreementStatus.APPROVED,
          notes: payload.specialAgreement?.notes || "Arrangement cree depuis la liste des eleves",
          installments: buildSpecialAgreementInstallments(payload.specialAgreement?.customTotal ?? payload.annualFee, payload.specialAgreement?.reductionAmount ?? 0, payload.specialAgreement?.installmentMode ?? "THREE_INSTALLMENTS"),
        });
      } else {
        await upsertParentPlanAssignment({
          schoolId: req.user!.schoolId, parentId: savedStudent.parentId, studentId: savedStudent.id,
          paymentOptionType: payload.paymentOptionType,
        });
      }
    } catch (error) {
      financeStatus = "PENDING";
      console.error("Student created and propagated; tuition plan assignment is pending", error);
    }

    let notificationStatus: { dashboard?: string; email?: string; sms?: string; adminEmail?: string } = { dashboard: "PENDING" };
    try {
      notificationStatus = await notifyParentEntityChange({
        schoolId: req.user!.schoolId,
        parentId: savedStudent.parentId,
        subject: "Nouvel élève ajouté dans EduPay",
        body: `${savedStudent.fullName} a été ajouté et synchronisé dans le registre partagé de l'écosystème.`,
      });
    } catch (error) {
      console.error("Student created and propagated; parent notification is pending", error);
    }

    return res.status(201).json({
      ...savedStudent,
      propagatedToOrbit: true,
      localSetupStatus: "SYNCED",
      financeStatus,
      paymentOptionType: payload.paymentOptionType,
      notificationStatus,
    });
  }

  const [parent, classRow] = await Promise.all([
    prisma.parent.findFirst({ where: { schoolId: req.user!.schoolId, OR: [{ id: payload.parentId }, { orbitId: payload.parentId }] }, select: { id: true, orbitId: true } }),
    prisma.class.findFirst({ where: { schoolId: req.user!.schoolId, OR: [{ id: payload.classId }, { name: { equals: payload.classId, mode: "insensitive" } }] }, select: { id: true, name: true } }),
  ]);
  if (!parent) return res.status(404).json({ message: "Parent introuvable dans EduPay ou dans le registre partagé." });
  if (!classRow) return res.status(404).json({ message: "Classe introuvable dans EduPay." });
  const student = await prisma.$transaction(async (tx) => {
    const created = await tx.student.create({
      data: {
        parentId: parent.id,
        classId: classRow.id,
        externalStudentId: payload.externalStudentId,
        fullName: payload.fullName,
        firstName: payload.firstName || null,
        middleName: payload.middleName || null,
        lastName: payload.lastName || null,
        email: studentEmail,
        phone: payload.phone || null,
        dateOfBirth: payload.dateOfBirth || null,
        gender: payload.gender || null,
        annualFee: payload.annualFee,
        schoolId: req.user!.schoolId
      }
    });
    const nameParts = payload.fullName.trim().split(/\s+/);
    await enqueueOrbitEvent(tx, {
      eventType: "student.created",
      aggregateType: "Student",
      aggregateId: created.id,
      path: "/api/integration/registry/student",
      idempotencyKey: `EDUPAY:STUDENT:CREATE:${created.id}`,
      payload: {
        organizationId: process.env.KCS_ORBIT_ORGANIZATION_ID || "",
        firstName: payload.firstName || nameParts[nameParts.length - 1] || "Student",
        middleName: payload.middleName || undefined,
        lastName: payload.lastName || nameParts[0] || "Student",
        gender: payload.gender || "O",
        className: classRow?.name || payload.classId,
        studentNumber: payload.externalStudentId || created.id,
        email: studentEmail,
        phone: payload.phone || undefined,
        dateOfBirth: payload.dateOfBirth || undefined,
        parentOrbitId: parent?.orbitId || undefined,
        __edupayParentId: parent.id,
        mustChangePassword: true
      }
    });
    return created;
  });

  if (payload.paymentOptionType === PaymentOptionType.SPECIAL_OWNER_AGREEMENT) {
    await createSpecialFinancialAgreement({
      schoolId: req.user!.schoolId, parentId: student.parentId, studentId: student.id,
      title: payload.specialAgreement?.title || "Arrangement avec l ecole - " + student.fullName,
      customTotal: payload.specialAgreement?.customTotal ?? payload.annualFee, reductionAmount: payload.specialAgreement?.reductionAmount ?? 0, status: AgreementStatus.APPROVED,
      notes: payload.specialAgreement?.notes || "Arrangement cree depuis la liste des eleves",
          installments: buildSpecialAgreementInstallments(payload.specialAgreement?.customTotal ?? payload.annualFee, payload.specialAgreement?.reductionAmount ?? 0, payload.specialAgreement?.installmentMode ?? "THREE_INSTALLMENTS"),
    });
  } else {
    await upsertParentPlanAssignment({
      schoolId: req.user!.schoolId, parentId: student.parentId, studentId: student.id,
      paymentOptionType: payload.paymentOptionType,
    });
  }

  let propagatedToOrbit = false;
  let propagatedStudent = student;
  if (orbitRegistryIsEnabled() && parent.orbitId) {
    try {
      const orbitStudent = await createOrbitStudent({
        fullName: payload.fullName, parentOrbitId: parent.orbitId, className: classRow.name,
        gender: payload.gender, studentNumber: payload.externalStudentId || student.id,
        email: studentEmail, dateOfBirth: payload.dateOfBirth,
      });
      propagatedStudent = await prisma.student.update({
        where: { id: student.id },
        data: { orbitId: orbitStudent.orbitId, externalStudentId: orbitStudent.externalId || payload.externalStudentId || student.id },
      });
      propagatedToOrbit = true;
    } catch (error) {
      console.error("Immediate Orbit propagation failed; queued outbox event will retry", error);
    }
  }

  res.status(201).json({ ...propagatedStudent, email: studentEmail, paymentOptionType: payload.paymentOptionType, propagatedToOrbit });
});

studentRouter.get("/", authorize("ADMIN", "ACCOUNTANT"), async (req: AuthenticatedRequest, res) => {
  if (orbitRegistryIsEnabled()) {
    await readOrbitRegistryMirror(req.user!.schoolId);
  }

  const students = await prisma.student.findMany({
    where: { schoolId: req.user!.schoolId },
    include: {
      class: true,
      parent: true,
      payments: true
    }
  });

  res.json(students);
});

studentRouter.put("/:id", authorize("ADMIN", "ACCOUNTANT"), async (req: AuthenticatedRequest, res) => {
  const payload = updateStudentSchema.parse(req.body);

  const [parent, classRow] = await Promise.all([
    prisma.parent.findFirst({ where: { schoolId: req.user!.schoolId, OR: [{ id: payload.parentId }, { orbitId: payload.parentId }] }, select: { id: true } }),
    prisma.class.findFirst({ where: { schoolId: req.user!.schoolId, OR: [{ id: payload.classId }, { name: { equals: payload.classId, mode: "insensitive" } }] }, select: { id: true } })
  ]);

  if (!parent) return res.status(404).json({ message: "Parent introuvable." });
  if (!classRow) return res.status(404).json({ message: "Classe introuvable." });

  const existing = await prisma.student.findFirst({
    where: { schoolId: req.user!.schoolId, OR: [{ id: req.params.id }, { orbitId: req.params.id }, { externalStudentId: req.params.id }] },
    select: { id: true, orbitId: true, externalStudentId: true }
  });
  if (!existing) return res.status(404).json({ message: "Eleve introuvable." });

  const nameParts = payload.fullName.trim().split(/\s+/);
  const student = await prisma.$transaction(async (tx) => {
    const updated = await tx.student.update({
      where: { id: existing.id },
      data: {
        fullName: payload.fullName,
        firstName: payload.firstName || nameParts[nameParts.length - 1] || null,
        middleName: payload.middleName ?? (nameParts.length > 2 ? nameParts.slice(1, -1).join(" ") : null),
        lastName: payload.lastName || nameParts[0] || null,
        email: payload.email ?? null,
        phone: payload.phone ?? null,
        externalStudentId: payload.studentNumber ?? existing.externalStudentId,
        dateOfBirth: payload.dateOfBirth ?? null,
        gender: payload.gender ?? null,
        classId: payload.classId,
        parentId: payload.parentId,
        annualFee: payload.annualFee
      },
      include: { class: true, parent: true, payments: true }
    });
    if (existing.orbitId) {
      await enqueueOrbitEvent(tx, {
        eventType: "student.updated",
        aggregateType: "Student",
        aggregateId: existing.id,
        path: `/api/integration/registry/student/${encodeURIComponent(existing.orbitId)}?identifierType=orbitId&organizationId=${encodeURIComponent(process.env.KCS_ORBIT_ORGANIZATION_ID || "")}`,
        httpMethod: "PUT",
        payload: {
          fullName: payload.fullName,
          firstName: payload.firstName || nameParts[nameParts.length - 1] || null,
          middleName: payload.middleName ?? (nameParts.length > 2 ? nameParts.slice(1, -1).join(" ") : null),
          lastName: payload.lastName || nameParts[0] || null,
          email: payload.email ?? undefined,
          phone: payload.phone ?? undefined,
          dateOfBirth: payload.dateOfBirth ?? undefined,
          gender: payload.gender ?? undefined,
          className: updated.class?.name ?? payload.classId,
          studentNumber: payload.studentNumber ?? existing.id,
          mustChangePassword: payload.mustChangePassword
        },
        idempotencyKey: `EDUPAY:STUDENT_UPDATED:${existing.id}:${Date.now()}`
      });
    }
    return updated;
  });

  const notificationStatus = await notifyParentEntityChange({
    schoolId: req.user!.schoolId,
    parentId: student.parentId,
    subject: "Mise à jour du dossier élève EduPay",
    body: [
      `Le dossier de l'élève ${student.fullName} vient d'être modifié dans EduPay.`,
      `Classe : ${student.class?.name ?? payload.classId}`,
      `Frais annuels affichés : ${student.annualFee}`,
      "La mise à jour est synchronisée avec le registre partagé de l'écosystème quand celui-ci est actif.",
    ].join("\n"),
  });

  return res.json({ ...student, notificationStatus });
});

studentRouter.delete("/:id", authorize("ADMIN", "ACCOUNTANT"), async (req: AuthenticatedRequest, res) => {
  {
    const localStudent = await prisma.student.findFirst({
      where: {
        schoolId: req.user!.schoolId,
        OR: [{ id: req.params.id }, { orbitId: req.params.id }, { externalStudentId: req.params.id }]
      },
      select: { id: true, orbitId: true }
    });
    if (!localStudent) return res.status(404).json({ message: "Eleve introuvable." });
    await prisma.$transaction(async (tx) => {
      await tx.student.delete({ where: { id: localStudent.id } });
      if (localStudent.orbitId) {
        await enqueueOrbitEvent(tx, {
          eventType: "student.deleted",
          aggregateType: "Student",
          aggregateId: localStudent.id,
          path: `/api/integration/registry/student/${encodeURIComponent(localStudent.orbitId)}?identifierType=orbitId&organizationId=${encodeURIComponent(process.env.KCS_ORBIT_ORGANIZATION_ID || "")}`,
          httpMethod: "DELETE",
          idempotencyKey: `EDUPAY:STUDENT_DELETED:${localStudent.id}`
        });
      }
    });
    return res.status(204).end();
  }

  /* Legacy direct-Orbit deletion path intentionally removed from execution.
  if (orbitRegistryIsEnabled()) {
    const mirrored = await syncOrbitRegistryMirror(req.user!.schoolId);
    const student = mirrored.students.find((entry) =>
      entry.id === req.params.id
      || entry.localId === req.params.id
      || entry.orbitId === req.params.id
      || entry.displayId === req.params.id
      || entry.externalStudentId === req.params.id
    );
    if (!student?.orbitId) {
      return res.status(404).json({ message: "Élève introuvable dans le registre partagé." });
    }
    await deleteOrbitStudent(student.orbitId);
    await syncOrbitRegistryMirror(req.user!.schoolId);
    return res.status(204).end();
  }
  const existing = await prisma.student.findFirst({
    where: { id: req.params.id, schoolId: req.user!.schoolId },
    select: { id: true, externalStudentId: true }
  });
  if (!existing) return res.status(404).json({ message: "Eleve introuvable." });

  if (orbitRegistryIsEnabled()) {
    const mirrored = await syncOrbitRegistryMirror(req.user!.schoolId);
    const mirroredStudent = mirrored.parents.flatMap((parent) => parent.students).find((student) => student.id === req.params.id || student.orbitId === req.params.id || student.externalStudentId === req.params.id || student.externalStudentId === existing.externalStudentId || student.displayId === existing.externalStudentId);
    await deleteOrbitStudent(mirroredStudent?.orbitId || req.params.id);
    await syncOrbitRegistryMirror(req.user!.schoolId);
  } else {
    await prisma.student.delete({ where: { id: req.params.id } });
  }
  return res.status(204).end();
  */
});
