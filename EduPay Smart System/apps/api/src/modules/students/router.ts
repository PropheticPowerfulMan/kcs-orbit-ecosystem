import { Router } from "express";
import { z } from "zod";
import { PaymentOptionType } from "@prisma/client";
import { createOrbitStudent, deleteOrbitStudent, orbitRegistryIsEnabled, readOrbitSharedOptions, syncOrbitRegistryMirror, updateOrbitStudent } from "../../integrations/orbitRegistry";
import { enqueueOrbitEvent } from "../../integrations/orbit";
import { prisma } from "../../prisma";
import { authGuard, authorize, AuthenticatedRequest } from "../../middlewares/auth";
import { notifyParentEntityChange } from "../notifications/entityChange";
import { upsertParentPlanAssignment } from "../finance/service";

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
  paymentOptionType: z.nativeEnum(PaymentOptionType).default(PaymentOptionType.STANDARD_MONTHLY)
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

export const studentRouter = Router();
studentRouter.use(authGuard);

studentRouter.post("/", authorize("ADMIN", "ACCOUNTANT"), async (req: AuthenticatedRequest, res) => {
  const payload = createStudentSchema.parse(req.body);
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
      email: payload.email,
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
          email: payload.email || null,
          phone: payload.phone || null,
          dateOfBirth: payload.dateOfBirth || null,
          gender: payload.gender || null,
          annualFee: payload.annualFee
        },
        include: { class: true, parent: true, payments: true },
      });
    let financeStatus = "SYNCED";
    try {
      await upsertParentPlanAssignment({
        schoolId: req.user!.schoolId,
        parentId: savedStudent.parentId,
        studentId: savedStudent.id,
        paymentOptionType: payload.paymentOptionType,
      });
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

  const student = await prisma.$transaction(async (tx) => {
    const [parent, classRow] = await Promise.all([
      tx.parent.findFirst({ where: { id: payload.parentId, schoolId: req.user!.schoolId }, select: { orbitId: true } }),
      tx.class.findFirst({ where: { id: payload.classId, schoolId: req.user!.schoolId }, select: { name: true } })
    ]);
    const created = await tx.student.create({
      data: {
        parentId: payload.parentId,
        classId: payload.classId,
        externalStudentId: payload.externalStudentId,
        fullName: payload.fullName,
        firstName: payload.firstName || null,
        middleName: payload.middleName || null,
        lastName: payload.lastName || null,
        email: payload.email || null,
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
        email: payload.email || undefined,
        phone: payload.phone || undefined,
        dateOfBirth: payload.dateOfBirth || undefined,
        parentOrbitId: parent?.orbitId || undefined,
        __edupayParentId: payload.parentId,
        mustChangePassword: true
      }
    });
    return created;
  });

  await upsertParentPlanAssignment({
    schoolId: req.user!.schoolId,
    parentId: student.parentId,
    studentId: student.id,
    paymentOptionType: payload.paymentOptionType,
  });

  res.status(201).json({ ...student, paymentOptionType: payload.paymentOptionType, propagatedToOrbit: false });
});

studentRouter.get("/", authorize("ADMIN", "ACCOUNTANT"), async (req: AuthenticatedRequest, res) => {
  if (orbitRegistryIsEnabled()) {
    await syncOrbitRegistryMirror(req.user!.schoolId);
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

  if (orbitRegistryIsEnabled()) {
    const mirrored = await syncOrbitRegistryMirror(req.user!.schoolId);
    const mirroredStudent = mirrored.students.find((student) =>
      student.localId === req.params.id
      || student.id === req.params.id
      || student.orbitId === req.params.id
      || student.displayId === req.params.id
      || student.externalStudentId === req.params.id
    );
    if (!mirroredStudent?.orbitId) {
      return res.status(404).json({ message: "Eleve introuvable dans le registre partage." });
    }
    const localClass = await prisma.class.findFirst({
      where: { id: payload.classId, schoolId: req.user!.schoolId },
      select: { name: true },
    });
    const className = String(req.body?.className || localClass?.name || payload.classId);
    const nameParts = payload.fullName.trim().split(String.fromCharCode(32)).filter(Boolean);
    await updateOrbitStudent(mirroredStudent.orbitId, {
      fullName: payload.fullName,
      firstName: payload.firstName || nameParts[nameParts.length - 1],
      middleName: payload.middleName ?? (nameParts.length > 2 ? nameParts.slice(1, -1).join(String.fromCharCode(32)) : null),
      lastName: payload.lastName || nameParts[0],
      email: payload.email,
      phone: payload.phone,
      dateOfBirth: payload.dateOfBirth,
      // Orbit rejects `null` for this optional field. Omitting it preserves the
      // current value and prevents the whole student update from failing.
      gender: payload.gender ?? undefined,
      className,
      studentNumber: payload.studentNumber,
      mustChangePassword: payload.mustChangePassword
    });
    await syncOrbitRegistryMirror(req.user!.schoolId);
    const directory = await readOrbitSharedOptions();
    const updated = directory.students.find((student) => student.orbitId === mirroredStudent.orbitId);
    return res.json({ ...updated, notificationStatus: { dashboard: "SYNCED", email: "SKIPPED", sms: "SKIPPED", adminEmail: "SKIPPED" } });
  }

  const [parent, classRow] = await Promise.all([
    prisma.parent.findFirst({ where: { id: payload.parentId, schoolId: req.user!.schoolId }, select: { id: true } }),
    prisma.class.findFirst({ where: { id: payload.classId, schoolId: req.user!.schoolId }, select: { id: true } })
  ]);

  if (!parent) return res.status(404).json({ message: "Parent introuvable." });
  if (!classRow) return res.status(404).json({ message: "Classe introuvable." });

  const existing = await prisma.student.findFirst({
    where: { id: req.params.id, schoolId: req.user!.schoolId },
    select: { id: true, externalStudentId: true }
  });
  if (!existing) return res.status(404).json({ message: "Eleve introuvable." });

  if (orbitRegistryIsEnabled()) {
    try {
      const mirrored = await syncOrbitRegistryMirror(req.user!.schoolId);
      const mirroredStudent = mirrored.parents
        .flatMap((parent) => parent.students)
        .find((student) => student.id === req.params.id
          || student.orbitId === req.params.id
          || student.externalStudentId === existing.externalStudentId
          || student.displayId === existing.externalStudentId);
      const className = await prisma.class.findUnique({ where: { id: payload.classId }, select: { name: true } });
      const nameParts = payload.fullName.trim().split(/\s+/);
      await updateOrbitStudent(mirroredStudent?.orbitId || req.params.id, {
        fullName: payload.fullName,
        firstName: payload.firstName || nameParts[nameParts.length - 1] || null,
        middleName: payload.middleName ?? (nameParts.length > 2 ? nameParts.slice(1, -1).join(" ") : null),
        lastName: payload.lastName || nameParts[0] || null,
        email: payload.email ?? undefined,
        phone: payload.phone ?? undefined,
        dateOfBirth: payload.dateOfBirth ?? undefined,
        gender: payload.gender ?? undefined,
        className: className?.name ?? payload.classId,
        studentNumber: payload.studentNumber ?? undefined,
        mustChangePassword: payload.mustChangePassword
      });
      await syncOrbitRegistryMirror(req.user!.schoolId);
    } catch (error) {
      console.error("[STUDENT_UPDATE_ORBIT] Orbit sync failed but local update will continue", error);
    }
  }

  const student = await prisma.student.update({
    where: { id: req.params.id },
    data: {
      fullName: payload.fullName,
      classId: payload.classId,
      parentId: payload.parentId,
      annualFee: payload.annualFee
    },
    include: {
      class: true,
      parent: true,
      payments: true
    }
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
});
