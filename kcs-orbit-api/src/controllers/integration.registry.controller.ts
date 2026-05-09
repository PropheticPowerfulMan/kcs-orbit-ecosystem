import { AppSlug, Prisma } from "@prisma/client";
import { buildCanonicalExternalId, RegistryEntityTypeSchema } from "@ecosystem/shared-contracts";
import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../db";

const entityTypeSchema = RegistryEntityTypeSchema;

const canonicalNameShape = {
  fullName: z.string().min(1).optional(),
  firstName: z.string().min(1).optional(),
  middleName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
};

function withCanonicalNameValidation<T extends z.ZodRawShape>(shape: T) {
  return z.object({
    ...canonicalNameShape,
    ...shape,
  }).superRefine((value, ctx) => {
  if (value.fullName || (value.firstName && value.lastName)) {
    return;
  }

  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    message: "fullName or firstName and lastName are required",
  });
  });
}

const createParentSchema = withCanonicalNameValidation({
  organizationId: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().min(6).optional(),
  mustChangePassword: z.boolean().optional(),
});

const createTeacherSchema = withCanonicalNameValidation({
  organizationId: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().min(6).optional(),
  subject: z.string().min(1).optional(),
});

const createStudentSchema = z.object({
  organizationId: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  gender: z.string().min(1),
  studentNumber: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(6).optional(),
  dateOfBirth: z.coerce.date().optional(),
  status: z.string().min(1).optional(),
  mustChangePassword: z.boolean().optional(),
  className: z.string().min(1).optional(),
  parentOrbitId: z.string().optional(),
  classOrbitId: z.string().optional(),
});

const createFamilySchema = z.object({
  organizationId: z.string().min(1),
  parent: withCanonicalNameValidation({
    email: z.string().email().optional(),
    phone: z.string().min(6).optional(),
    mustChangePassword: z.boolean().optional(),
  }),
  students: z.array(createStudentSchema.omit({ organizationId: true, parentOrbitId: true })).min(1),
});

const deleteQuerySchema = z.object({
  organizationId: z.string().min(1),
  identifierType: z.enum(["orbitId", "externalId"]).default("orbitId"),
});

const updateParentSchema = z.object({
  fullName: z.string().min(1).optional(),
  firstName: z.string().min(1).nullable().optional(),
  middleName: z.string().min(1).nullable().optional(),
  lastName: z.string().min(1).nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().min(6).nullable().optional(),
  mustChangePassword: z.boolean().optional(),
}).refine((value) => Object.values(value).some((item) => item !== undefined), {
  message: "At least one field must be provided",
});

const updateStudentSchema = z.object({
  firstName: z.string().min(1).optional(),
  middleName: z.string().min(1).nullable().optional(),
  lastName: z.string().min(1).optional(),
  gender: z.string().min(1).optional(),
  studentNumber: z.string().min(1).optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().min(6).nullable().optional(),
  dateOfBirth: z.coerce.date().nullable().optional(),
  status: z.string().min(1).optional(),
  mustChangePassword: z.boolean().optional(),
  className: z.string().min(1).nullable().optional(),
  parentOrbitId: z.string().nullable().optional(),
  classOrbitId: z.string().nullable().optional(),
}).refine((value) => Object.values(value).some((item) => item !== undefined), {
  message: "At least one field must be provided",
});

function getAppSlug(req: Request) {
  return req.integration?.appSlug;
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function buildCanonicalFullName(input: { fullName?: string | null; firstName?: string | null; middleName?: string | null; lastName?: string | null }) {
  if (input.fullName?.trim()) {
    return normalizeText(input.fullName);
  }

  return normalizeText([input.firstName, input.middleName, input.lastName].filter(Boolean).join(" "));
}

function buildGeneratedExternalId(appSlug: AppSlug, entityType: z.infer<typeof entityTypeSchema>) {
  return buildCanonicalExternalId({ appSlug, entityType });
}

async function ensureOrganizationExists(organizationId: string) {
  return prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true },
  });
}

async function createExternalLink(db: Prisma.TransactionClient, params: {
  organizationId: string;
  appSlug: AppSlug;
  entityType: string;
  nexusEntityId: string;
  externalId: string;
}) {
  return db.externalLink.create({
    data: params,
  });
}

async function createAuditLog(db: Prisma.TransactionClient, params: {
  organizationId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}) {
  return db.auditLog.create({
    data: {
      organizationId: params.organizationId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      ...(params.metadata !== undefined ? { metadata: params.metadata as never } : {}),
    },
  });
}

async function createSyncEvent(db: Prisma.TransactionClient, params: {
  organizationId: string;
  appSlug: AppSlug;
  eventType: string;
  entityType: string;
  entityId: string;
  payload: unknown;
}) {
  return db.syncEvent.create({
    data: {
      organizationId: params.organizationId,
      appSlug: params.appSlug,
      eventType: params.eventType,
      entityType: params.entityType,
      entityId: params.entityId,
      direction: "INBOUND",
      status: "PROCESSED",
      payload: params.payload as never,
      processedAt: new Date(),
    },
  });
}

async function findDuplicateParent(organizationId: string, input: z.infer<typeof createParentSchema>) {
  const fullName = buildCanonicalFullName(input);

  return prisma.parent.findFirst({
    where: {
      organizationId,
      OR: [
        ...(input.email ? [{ email: { equals: input.email, mode: "insensitive" as const } }] : []),
        ...(input.phone ? [{ phone: input.phone }] : []),
        { fullName: { equals: fullName, mode: "insensitive" as const } },
      ],
    },
  });
}

async function findDuplicateTeacher(organizationId: string, input: z.infer<typeof createTeacherSchema>) {
  const fullName = buildCanonicalFullName(input);

  return prisma.teacher.findFirst({
    where: {
      organizationId,
      OR: [
        ...(input.email ? [{ email: { equals: input.email, mode: "insensitive" as const } }] : []),
        ...(input.phone ? [{ phone: input.phone }] : []),
        { fullName: { equals: fullName, mode: "insensitive" as const } },
      ],
    },
  });
}

async function findDuplicateStudent(organizationId: string, input: z.infer<typeof createStudentSchema>) {
  const duplicateFilters: Prisma.StudentWhereInput[] = [
    {
      firstName: { equals: normalizeText(input.firstName), mode: "insensitive" },
      lastName: { equals: normalizeText(input.lastName), mode: "insensitive" },
      gender: { equals: input.gender, mode: "insensitive" },
      ...(input.parentOrbitId ? { parentId: input.parentOrbitId } : {}),
      ...(input.classOrbitId ? { classId: input.classOrbitId } : {}),
    },
  ];

  if (input.studentNumber) {
    duplicateFilters.push({ studentNumber: { equals: input.studentNumber, mode: "insensitive" } });
  }

  if (input.email) {
    duplicateFilters.push({ email: { equals: input.email, mode: "insensitive" } });
  }

  return prisma.student.findFirst({
    where: {
      organizationId,
      OR: duplicateFilters,
    },
  });
}

async function resolveEntityByIdentifier(params: {
  organizationId: string;
  appSlug: AppSlug;
  entityType: z.infer<typeof entityTypeSchema>;
  identifier: string;
  identifierType: "orbitId" | "externalId";
}) {
  if (params.identifierType === "orbitId") {
    const entity = await findEntityByOrbitId(params.organizationId, params.entityType, params.identifier);
    if (!entity) {
      return null;
    }

    return { orbitId: params.identifier, externalLinkId: null };
  }

  const link = await prisma.externalLink.findUnique({
    where: {
      organizationId_appSlug_entityType_externalId: {
        organizationId: params.organizationId,
        appSlug: params.appSlug,
        entityType: params.entityType,
        externalId: params.identifier,
      },
    },
  });

  if (!link) {
    return null;
  }

  return { orbitId: link.nexusEntityId, externalLinkId: link.id };
}

async function findEntityByOrbitId(organizationId: string, entityType: z.infer<typeof entityTypeSchema>, orbitId: string) {
  switch (entityType) {
    case "family":
      return prisma.parent.findFirst({ where: { id: orbitId, organizationId }, select: { id: true } });
    case "parent":
      return prisma.parent.findFirst({ where: { id: orbitId, organizationId }, select: { id: true } });
    case "student":
      return prisma.student.findFirst({ where: { id: orbitId, organizationId }, select: { id: true } });
    case "teacher":
      return prisma.teacher.findFirst({ where: { id: orbitId, organizationId }, select: { id: true } });
  }
}

async function deleteEntity(db: Prisma.TransactionClient, entityType: z.infer<typeof entityTypeSchema>, orbitId: string) {
  switch (entityType) {
    case "family": {
      const children = await db.student.findMany({ where: { parentId: orbitId }, select: { id: true } });
      const childIds = children.map((student) => student.id);
      if (childIds.length > 0) {
        await db.payment.deleteMany({ where: { studentId: { in: childIds } } });
        await db.grade.deleteMany({ where: { studentId: { in: childIds } } });
        await db.attendance.deleteMany({ where: { studentId: { in: childIds } } });
        await db.externalLink.deleteMany({ where: { entityType: "student", nexusEntityId: { in: childIds } } });
        await db.student.deleteMany({ where: { id: { in: childIds } } });
      }
      await db.externalLink.deleteMany({ where: { entityType: "parent", nexusEntityId: orbitId } });
      return db.parent.delete({ where: { id: orbitId } });
    }
    case "parent":
      await db.student.updateMany({ where: { parentId: orbitId }, data: { parentId: null } });
      return db.parent.delete({ where: { id: orbitId } });
    case "student":
      await db.payment.deleteMany({ where: { studentId: orbitId } });
      await db.grade.deleteMany({ where: { studentId: orbitId } });
      await db.attendance.deleteMany({ where: { studentId: orbitId } });
      return db.student.delete({ where: { id: orbitId } });
    case "teacher":
      await db.class.updateMany({ where: { teacherId: orbitId }, data: { teacherId: null } });
      return db.teacher.delete({ where: { id: orbitId } });
  }
}

export async function updateRegistryEntity(req: Request, res: Response) {
  const appSlug = getAppSlug(req);
  if (!appSlug) {
    return res.status(401).json({ message: "Unauthorized integration request" });
  }

  const entityType = entityTypeSchema.parse(req.params.entityType);
  const query = deleteQuerySchema.parse(req.query);
  const payload = entityType === "parent"
    ? updateParentSchema.parse(req.body)
    : entityType === "student"
      ? updateStudentSchema.parse(req.body)
      : null;

  if (!payload) {
    return res.status(400).json({ message: "Only parent and student updates are supported through this endpoint" });
  }

  const target = await resolveEntityByIdentifier({
    organizationId: query.organizationId,
    appSlug,
    entityType,
    identifier: String(req.params.identifier),
    identifierType: query.identifierType,
  });

  if (!target) {
    return res.status(404).json({ message: "Entity not found for this application" });
  }

  if (entityType === "parent") {
    const parentPayload = payload as z.infer<typeof updateParentSchema>;
    const duplicateFilters: Prisma.ParentWhereInput[] = [];
    if (parentPayload.email) {
      duplicateFilters.push({ email: { equals: parentPayload.email, mode: "insensitive" } });
    }
    if (parentPayload.phone) {
      duplicateFilters.push({ phone: parentPayload.phone });
    }

    if (duplicateFilters.length > 0) {
      const duplicate = await prisma.parent.findFirst({
        where: {
          organizationId: query.organizationId,
          id: { not: target.orbitId },
          OR: duplicateFilters,
        },
        select: { email: true, phone: true },
      });

      if (duplicate) {
        if (parentPayload.email && duplicate.email?.toLowerCase() === parentPayload.email.toLowerCase()) {
          return res.status(409).json({ message: `Parent email already exists: ${parentPayload.email}` });
        }

        if (parentPayload.phone && duplicate.phone === parentPayload.phone) {
          return res.status(409).json({ message: `Parent phone already exists: ${parentPayload.phone}` });
        }
      }
    }

    const parent = await prisma.$transaction(async (tx) => {
      const fullName = parentPayload.fullName || parentPayload.firstName || parentPayload.lastName
        ? buildCanonicalFullName(parentPayload)
        : undefined;
      const updatedParent = await tx.parent.update({
        where: { id: target.orbitId },
        data: {
          ...(fullName !== undefined ? { fullName } : {}),
          ...(parentPayload.firstName !== undefined ? { firstName: parentPayload.firstName ? normalizeText(parentPayload.firstName) : null } : {}),
          ...(parentPayload.middleName !== undefined ? { middleName: parentPayload.middleName ? normalizeText(parentPayload.middleName) : null } : {}),
          ...(parentPayload.lastName !== undefined ? { lastName: parentPayload.lastName ? normalizeText(parentPayload.lastName) : null } : {}),
          ...(parentPayload.email !== undefined ? { email: parentPayload.email } : {}),
          ...(parentPayload.phone !== undefined ? { phone: parentPayload.phone } : {}),
          ...(parentPayload.mustChangePassword !== undefined ? { mustChangePassword: parentPayload.mustChangePassword } : {}),
        },
      });

      await createSyncEvent(tx, { organizationId: query.organizationId, appSlug, eventType: "parent.updated", entityType, entityId: target.orbitId, payload });
      await createAuditLog(tx, { organizationId: query.organizationId, action: `${appSlug.toLowerCase()}.parent.updated`, entityType, entityId: target.orbitId, metadata: { identifier: req.params.identifier, identifierType: query.identifierType } });

      return updatedParent;
    });

    return res.json({ entityType, orbitId: parent.id, updated: true, entity: parent });
  }

  const studentPayload = payload as z.infer<typeof updateStudentSchema>;
  if (studentPayload.parentOrbitId) {
    const parent = await prisma.parent.findFirst({ where: { id: studentPayload.parentOrbitId, organizationId: query.organizationId } });
    if (!parent) return res.status(404).json({ message: "Parent not found" });
  }

  if (studentPayload.classOrbitId) {
    const klass = await prisma.class.findFirst({ where: { id: studentPayload.classOrbitId, organizationId: query.organizationId } });
    if (!klass) return res.status(404).json({ message: "Class not found" });
  }

  const duplicateFilters: Prisma.StudentWhereInput[] = [];
  if (studentPayload.studentNumber) {
    duplicateFilters.push({ studentNumber: { equals: studentPayload.studentNumber, mode: "insensitive" } });
  }
  if (studentPayload.email) {
    duplicateFilters.push({ email: { equals: studentPayload.email, mode: "insensitive" } });
  }

  if (duplicateFilters.length > 0) {
    const duplicate = await prisma.student.findFirst({
      where: {
        organizationId: query.organizationId,
        id: { not: target.orbitId },
        OR: duplicateFilters,
      },
      select: { studentNumber: true, email: true },
    });

    if (duplicate) {
      if (studentPayload.studentNumber && duplicate.studentNumber?.toLowerCase() === studentPayload.studentNumber.toLowerCase()) {
        return res.status(409).json({ message: `Student number already exists: ${studentPayload.studentNumber}` });
      }

      if (studentPayload.email && duplicate.email?.toLowerCase() === studentPayload.email.toLowerCase()) {
        return res.status(409).json({ message: `Student email already exists: ${studentPayload.email}` });
      }
    }
  }

  const student = await prisma.$transaction(async (tx) => {
    const updatedStudent = await tx.student.update({
      where: { id: target.orbitId },
      data: {
        ...(studentPayload.firstName !== undefined ? { firstName: normalizeText(studentPayload.firstName) } : {}),
        ...(studentPayload.middleName !== undefined ? { middleName: studentPayload.middleName ? normalizeText(studentPayload.middleName) : null } : {}),
        ...(studentPayload.lastName !== undefined ? { lastName: normalizeText(studentPayload.lastName) } : {}),
        ...(studentPayload.gender !== undefined ? { gender: studentPayload.gender } : {}),
        ...(studentPayload.studentNumber !== undefined ? { studentNumber: studentPayload.studentNumber } : {}),
        ...(studentPayload.email !== undefined ? { email: studentPayload.email } : {}),
        ...(studentPayload.phone !== undefined ? { phone: studentPayload.phone } : {}),
        ...(studentPayload.dateOfBirth !== undefined ? { dateOfBirth: studentPayload.dateOfBirth } : {}),
        ...(studentPayload.status !== undefined ? { status: studentPayload.status } : {}),
        ...(studentPayload.mustChangePassword !== undefined ? { mustChangePassword: studentPayload.mustChangePassword } : {}),
        ...(studentPayload.className !== undefined ? { className: studentPayload.className } : {}),
        ...(studentPayload.parentOrbitId !== undefined ? { parentId: studentPayload.parentOrbitId } : {}),
        ...(studentPayload.classOrbitId !== undefined ? { classId: studentPayload.classOrbitId } : {}),
      },
    });

    await createSyncEvent(tx, { organizationId: query.organizationId, appSlug, eventType: "student.updated", entityType, entityId: target.orbitId, payload });
    await createAuditLog(tx, { organizationId: query.organizationId, action: `${appSlug.toLowerCase()}.student.updated`, entityType, entityId: target.orbitId, metadata: { identifier: req.params.identifier, identifierType: query.identifierType } });

    return updatedStudent;
  });

  return res.json({ entityType, orbitId: student.id, updated: true, entity: student });
}

export async function createRegistryEntity(req: Request, res: Response) {
  const appSlug = getAppSlug(req);
  if (!appSlug) {
    return res.status(401).json({ message: "Unauthorized integration request" });
  }

  const entityType = entityTypeSchema.parse(req.params.entityType);

  if (entityType === "family") {
    const payload = createFamilySchema.parse(req.body);
    const organization = await ensureOrganizationExists(payload.organizationId);
    if (!organization) return res.status(404).json({ message: "Organization not found" });

    const duplicateParent = await findDuplicateParent(payload.organizationId, { ...payload.parent, organizationId: payload.organizationId });
    if (duplicateParent) {
      return res.status(409).json({ message: "Family parent already exists", entityType, orbitId: duplicateParent.id });
    }

    for (const student of payload.students) {
      const duplicateStudent = await findDuplicateStudent(payload.organizationId, { ...student, organizationId: payload.organizationId });
      if (duplicateStudent) {
        return res.status(409).json({ message: "Family student already exists", entityType: "student", orbitId: duplicateStudent.id });
      }

      if (student.classOrbitId) {
        const klass = await prisma.class.findFirst({ where: { id: student.classOrbitId, organizationId: payload.organizationId } });
        if (!klass) return res.status(404).json({ message: "Class not found", classOrbitId: student.classOrbitId });
      }
    }

    const familyExternalId = buildGeneratedExternalId(appSlug, "family");
    const parentExternalId = buildGeneratedExternalId(appSlug, "parent");
    const studentExternalIds = payload.students.map(() => buildGeneratedExternalId(appSlug, "student"));
    const family = await prisma.$transaction(async (tx) => {
      const parent = await tx.parent.create({
        data: {
          organizationId: payload.organizationId,
          fullName: buildCanonicalFullName(payload.parent),
          firstName: payload.parent.firstName ? normalizeText(payload.parent.firstName) : undefined,
          middleName: payload.parent.middleName ? normalizeText(payload.parent.middleName) : undefined,
          lastName: payload.parent.lastName ? normalizeText(payload.parent.lastName) : undefined,
          email: payload.parent.email,
          phone: payload.parent.phone,
          mustChangePassword: payload.parent.mustChangePassword,
        },
      });

      const students = [];
      for (const [index, studentPayload] of payload.students.entries()) {
        const createdStudent = await tx.student.create({
          data: {
            organizationId: payload.organizationId,
            firstName: normalizeText(studentPayload.firstName),
            lastName: normalizeText(studentPayload.lastName),
            gender: studentPayload.gender,
            studentNumber: studentPayload.studentNumber || studentExternalIds[index],
            email: studentPayload.email,
            phone: studentPayload.phone,
            dateOfBirth: studentPayload.dateOfBirth,
            status: studentPayload.status,
            mustChangePassword: studentPayload.mustChangePassword,
            className: studentPayload.className,
            parentId: parent.id,
            classId: studentPayload.classOrbitId,
          },
        });
        students.push(createdStudent);
      }

      await createExternalLink(tx, { organizationId: payload.organizationId, appSlug, entityType: "family", nexusEntityId: parent.id, externalId: familyExternalId });
      await createExternalLink(tx, { organizationId: payload.organizationId, appSlug, entityType: "parent", nexusEntityId: parent.id, externalId: parentExternalId });
      for (const [index, student] of students.entries()) {
        await createExternalLink(tx, { organizationId: payload.organizationId, appSlug, entityType: "student", nexusEntityId: student.id, externalId: studentExternalIds[index] });
      }
      await createSyncEvent(tx, { organizationId: payload.organizationId, appSlug, eventType: "family.created", entityType, entityId: parent.id, payload });
      await createAuditLog(tx, { organizationId: payload.organizationId, action: `${appSlug.toLowerCase()}.family.created`, entityType, entityId: parent.id, metadata: { familyExternalId, parentExternalId, studentExternalIds } });

      return { parent, students };
    });

    return res.status(201).json({
      entityType,
      orbitId: family.parent.id,
      externalId: familyExternalId,
      parentExternalId,
      studentExternalIds,
      counts: { parents: 1, students: family.students.length, families: 1 },
      entity: family,
    });
  }

  if (entityType === "parent") {
    const payload = createParentSchema.parse(req.body);
    const fullName = buildCanonicalFullName(payload);
    const organization = await ensureOrganizationExists(payload.organizationId);
    if (!organization) return res.status(404).json({ message: "Organization not found" });

    const duplicate = await findDuplicateParent(payload.organizationId, payload);
    if (duplicate) {
      return res.status(409).json({ message: "Parent already exists", entityType, orbitId: duplicate.id });
    }

    const externalId = buildGeneratedExternalId(appSlug, entityType);
    const parent = await prisma.$transaction(async (tx) => {
      const createdParent = await tx.parent.create({
        data: {
          organizationId: payload.organizationId,
          fullName,
          firstName: payload.firstName ? normalizeText(payload.firstName) : undefined,
          middleName: payload.middleName ? normalizeText(payload.middleName) : undefined,
          lastName: payload.lastName ? normalizeText(payload.lastName) : undefined,
          email: payload.email,
          phone: payload.phone,
          mustChangePassword: payload.mustChangePassword,
        },
      });

      await createExternalLink(tx, { organizationId: payload.organizationId, appSlug, entityType, nexusEntityId: createdParent.id, externalId });
      await createSyncEvent(tx, { organizationId: payload.organizationId, appSlug, eventType: "parent.created", entityType, entityId: createdParent.id, payload });
      await createAuditLog(tx, { organizationId: payload.organizationId, action: `${appSlug.toLowerCase()}.parent.created`, entityType, entityId: createdParent.id, metadata: { externalId } });

      return createdParent;
    });

    return res.status(201).json({ entityType, orbitId: parent.id, externalId, entity: parent });
  }

  if (entityType === "teacher") {
    const payload = createTeacherSchema.parse(req.body);
    const fullName = buildCanonicalFullName(payload);
    const organization = await ensureOrganizationExists(payload.organizationId);
    if (!organization) return res.status(404).json({ message: "Organization not found" });

    const duplicate = await findDuplicateTeacher(payload.organizationId, payload);
    if (duplicate) {
      return res.status(409).json({ message: "Teacher already exists", entityType, orbitId: duplicate.id });
    }

    const externalId = buildGeneratedExternalId(appSlug, entityType);
    const teacher = await prisma.$transaction(async (tx) => {
      const createdTeacher = await tx.teacher.create({
        data: {
          organizationId: payload.organizationId,
          fullName,
          email: payload.email,
          phone: payload.phone,
          subject: payload.subject,
        },
      });

      await createExternalLink(tx, { organizationId: payload.organizationId, appSlug, entityType, nexusEntityId: createdTeacher.id, externalId });
      await createSyncEvent(tx, { organizationId: payload.organizationId, appSlug, eventType: "teacher.created", entityType, entityId: createdTeacher.id, payload });
      await createAuditLog(tx, { organizationId: payload.organizationId, action: `${appSlug.toLowerCase()}.teacher.created`, entityType, entityId: createdTeacher.id, metadata: { externalId } });

      return createdTeacher;
    });

    return res.status(201).json({ entityType, orbitId: teacher.id, externalId, entity: teacher });
  }

  const payload = createStudentSchema.parse(req.body);
  const organization = await ensureOrganizationExists(payload.organizationId);
  if (!organization) return res.status(404).json({ message: "Organization not found" });

  if (payload.parentOrbitId) {
    const parent = await prisma.parent.findFirst({ where: { id: payload.parentOrbitId, organizationId: payload.organizationId } });
    if (!parent) return res.status(404).json({ message: "Parent not found" });
  }

  if (payload.classOrbitId) {
    const klass = await prisma.class.findFirst({ where: { id: payload.classOrbitId, organizationId: payload.organizationId } });
    if (!klass) return res.status(404).json({ message: "Class not found" });
  }

  const duplicate = await findDuplicateStudent(payload.organizationId, payload);
  if (duplicate) {
    return res.status(409).json({ message: "Student already exists", entityType, orbitId: duplicate.id });
  }

  const externalId = buildGeneratedExternalId(appSlug, entityType);
  const student = await prisma.$transaction(async (tx) => {
    const createdStudent = await tx.student.create({
      data: {
        organizationId: payload.organizationId,
        firstName: normalizeText(payload.firstName),
        lastName: normalizeText(payload.lastName),
        gender: payload.gender,
        studentNumber: payload.studentNumber,
        email: payload.email,
        phone: payload.phone,
        dateOfBirth: payload.dateOfBirth,
        status: payload.status,
        mustChangePassword: payload.mustChangePassword,
        className: payload.className,
        parentId: payload.parentOrbitId,
        classId: payload.classOrbitId,
      },
    });

    await createExternalLink(tx, { organizationId: payload.organizationId, appSlug, entityType, nexusEntityId: createdStudent.id, externalId });
    await createSyncEvent(tx, { organizationId: payload.organizationId, appSlug, eventType: "student.created", entityType, entityId: createdStudent.id, payload });
    await createAuditLog(tx, { organizationId: payload.organizationId, action: `${appSlug.toLowerCase()}.student.created`, entityType, entityId: createdStudent.id, metadata: { externalId } });

    return createdStudent;
  });

  return res.status(201).json({ entityType, orbitId: student.id, externalId, entity: student });
}

export async function deleteRegistryEntity(req: Request, res: Response) {
  const appSlug = getAppSlug(req);
  if (!appSlug) {
    return res.status(401).json({ message: "Unauthorized integration request" });
  }

  const entityType = entityTypeSchema.parse(req.params.entityType);
  const query = deleteQuerySchema.parse(req.query);
  const target = await resolveEntityByIdentifier({
    organizationId: query.organizationId,
    appSlug,
    entityType,
    identifier: String(req.params.identifier),
    identifierType: query.identifierType,
  });

  if (!target) {
    return res.status(404).json({ message: "Entity not found for this application" });
  }

  const links = await prisma.externalLink.findMany({
    where: {
      organizationId: query.organizationId,
      entityType,
      nexusEntityId: target.orbitId,
    },
    select: { id: true, appSlug: true, externalId: true },
  });

  try {
    await prisma.$transaction(async (tx) => {
      await tx.externalLink.deleteMany({ where: { organizationId: query.organizationId, entityType, nexusEntityId: target.orbitId } });
      await deleteEntity(tx, entityType, target.orbitId);
      await tx.syncEvent.create({
        data: {
          organizationId: query.organizationId,
          appSlug,
          eventType: `${entityType}.deleted`,
          entityType,
          entityId: target.orbitId,
          direction: "INBOUND",
          status: "PROCESSED",
          payload: { identifier: req.params.identifier, identifierType: query.identifierType } as never,
          processedAt: new Date(),
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId: query.organizationId,
          action: `${appSlug.toLowerCase()}.${entityType}.deleted`,
          entityType,
          entityId: target.orbitId,
          metadata: {
            identifier: req.params.identifier,
            identifierType: query.identifierType,
            removedExternalLinks: links,
          } as never,
        },
      });
    });
  } catch (error) {
    return res.status(409).json({
      message: "Entity cannot be deleted because it is still referenced by the ecosystem",
      details: error instanceof Error ? error.message : String(error),
    });
  }

  return res.json({ entityType, orbitId: target.orbitId, deleted: true });
}
