import { AppSlug, Prisma } from "@prisma/client";
import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../db";

const entityTypeSchema = z.enum(["parent", "student", "teacher"]);

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
  parentOrbitId: z.string().optional(),
  classOrbitId: z.string().optional(),
});

const deleteQuerySchema = z.object({
  organizationId: z.string().min(1),
  identifierType: z.enum(["orbitId", "externalId"]).default("orbitId"),
});

function getAppSlug(req: Request) {
  return req.integration?.appSlug;
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function buildCanonicalFullName(input: { fullName?: string; firstName?: string; middleName?: string; lastName?: string }) {
  if (input.fullName?.trim()) {
    return normalizeText(input.fullName);
  }

  return normalizeText([input.firstName, input.middleName, input.lastName].filter(Boolean).join(" "));
}

function buildGeneratedExternalId(appSlug: AppSlug, entityType: z.infer<typeof entityTypeSchema>) {
  const appPrefix = {
    [AppSlug.KCS_NEXUS]: "KCSNEX",
    [AppSlug.EDUSYNCAI]: "EDUSAI",
    [AppSlug.SAVANEX]: "SAV",
    [AppSlug.EDUPAY]: "EDUPAY",
  }[appSlug];

  const entityPrefix = {
    parent: "PAR",
    student: "STU",
    teacher: "TEA",
  }[entityType];

  const stamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();

  return `${appPrefix}-${entityPrefix}-${stamp}-${random}`;
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
  return prisma.student.findFirst({
    where: {
      organizationId,
      firstName: { equals: normalizeText(input.firstName), mode: "insensitive" },
      lastName: { equals: normalizeText(input.lastName), mode: "insensitive" },
      gender: { equals: input.gender, mode: "insensitive" },
      ...(input.parentOrbitId ? { parentId: input.parentOrbitId } : {}),
      ...(input.classOrbitId ? { classId: input.classOrbitId } : {}),
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
    const link = await prisma.externalLink.findFirst({
      where: {
        organizationId: params.organizationId,
        appSlug: params.appSlug,
        entityType: params.entityType,
        nexusEntityId: params.identifier,
      },
    });

    if (!link) {
      return null;
    }

    return { orbitId: params.identifier, externalLinkId: link.id };
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

async function deleteEntity(db: Prisma.TransactionClient, entityType: z.infer<typeof entityTypeSchema>, orbitId: string) {
  switch (entityType) {
    case "parent":
      return db.parent.delete({ where: { id: orbitId } });
    case "student":
      return db.student.delete({ where: { id: orbitId } });
    case "teacher":
      return db.teacher.delete({ where: { id: orbitId } });
  }
}

export async function createRegistryEntity(req: Request, res: Response) {
  const appSlug = getAppSlug(req);
  if (!appSlug) {
    return res.status(401).json({ message: "Unauthorized integration request" });
  }

  const entityType = entityTypeSchema.parse(req.params.entityType);

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
          email: payload.email,
          phone: payload.phone,
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

  if (entityType === "parent") {
    const childCount = await prisma.student.count({
      where: {
        organizationId: query.organizationId,
        parentId: target.orbitId,
      },
    });

    if (childCount > 0) {
      return res.status(409).json({
        message: "Parent cannot be deleted while students are still attached",
        entityType,
        orbitId: target.orbitId,
        childCount,
      });
    }
  }

  const links = await prisma.externalLink.findMany({
    where: {
      organizationId: query.organizationId,
      entityType,
      nexusEntityId: target.orbitId,
    },
    select: { id: true, appSlug: true, externalId: true },
  });

  if (links.length > 1) {
    return res.status(409).json({
      message: "Entity is already linked to other applications and cannot be deleted here",
      entityType,
      orbitId: target.orbitId,
      linkedApps: links.map((link) => link.appSlug),
    });
  }

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
          metadata: { identifier: req.params.identifier, identifierType: query.identifierType } as never,
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
