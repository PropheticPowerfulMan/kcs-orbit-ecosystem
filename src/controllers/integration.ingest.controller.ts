import { AppSlug, Prisma, SyncDirection, SyncStatus } from "@prisma/client";
import { Request, Response } from "express";
import { prisma } from "../db";
import { eventBus } from "../events/eventBus";

function parseJsonInput(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return Prisma.JsonNull;
  }

  return value as Prisma.InputJsonValue;
}

async function ensureOrganizationExists(organizationId: string) {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, slug: true, name: true }
  });

  return organization;
}

async function resolveLinkedEntityId(
  organizationId: string,
  appSlug: AppSlug,
  entityType: string,
  externalId?: string
) {
  if (!externalId) {
    return undefined;
  }

  const link = await prisma.externalLink.findUnique({
    where: {
      organizationId_appSlug_entityType_externalId: {
        organizationId,
        appSlug,
        entityType,
        externalId
      }
    },
    select: { nexusEntityId: true }
  });

  return link?.nexusEntityId;
}

async function upsertExternalLink(params: {
  organizationId: string;
  appSlug: AppSlug;
  entityType: string;
  nexusEntityId: string;
  externalId: string;
  metadata?: unknown;
}) {
  const { organizationId, appSlug, entityType, nexusEntityId, externalId, metadata } = params;

  return prisma.externalLink.upsert({
    where: {
      organizationId_appSlug_entityType_externalId: {
        organizationId,
        appSlug,
        entityType,
        externalId
      }
    },
    update: {
      nexusEntityId,
      metadata: parseJsonInput(metadata),
      updatedAt: new Date()
    },
    create: {
      organizationId,
      appSlug,
      entityType,
      nexusEntityId,
      externalId,
      metadata: parseJsonInput(metadata)
    }
  });
}

async function recordInboundSyncEvent(params: {
  organizationId: string;
  appSlug: AppSlug;
  eventType: string;
  entityType: string;
  entityId: string;
  payload?: unknown;
}) {
  const { organizationId, appSlug, eventType, entityType, entityId, payload } = params;

  return prisma.syncEvent.create({
    data: {
      organizationId,
      appSlug,
      eventType,
      entityType,
      entityId,
      direction: SyncDirection.INBOUND,
      status: SyncStatus.PROCESSED,
      payload: parseJsonInput(payload),
      processedAt: new Date()
    }
  });
}

async function recordAudit(params: {
  organizationId: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: unknown;
}) {
  const { organizationId, action, entityType, entityId, metadata } = params;

  return prisma.auditLog.create({
    data: {
      organizationId,
      action,
      entityType,
      entityId,
      metadata: parseJsonInput(metadata)
    }
  });
}

function getAppSlug(req: Request) {
  return req.integration?.appSlug;
}

function ensureSavanexContext(appSlug: AppSlug | undefined, res: Response) {
  if (appSlug !== AppSlug.SAVANEX) {
    res.status(403).json({ message: "Invalid integration context" });
    return false;
  }

  return true;
}

export async function ingestEduPayPayment(req: Request, res: Response) {
  const appSlug = getAppSlug(req);
  const { organizationId, externalId, studentExternalId, amount, motif, method, reference, metadata } = req.body;

  if (appSlug !== AppSlug.EDUPAY) {
    return res.status(403).json({ message: "Invalid integration context" });
  }

  if (!organizationId || !externalId || !studentExternalId || amount === undefined || !motif) {
    return res.status(400).json({ message: "organizationId, externalId, studentExternalId, amount and motif are required" });
  }

  const organization = await ensureOrganizationExists(organizationId);
  if (!organization) {
    return res.status(404).json({ message: "Organization not found" });
  }

  const studentId = await resolveLinkedEntityId(organizationId, AppSlug.SAVANEX, "student", studentExternalId)
    ?? await resolveLinkedEntityId(organizationId, AppSlug.EDUPAY, "student", studentExternalId);

  if (!studentId) {
    return res.status(404).json({ message: "Student link not found for studentExternalId" });
  }

  const existingLink = await prisma.externalLink.findUnique({
    where: {
      organizationId_appSlug_entityType_externalId: {
        organizationId,
        appSlug,
        entityType: "payment",
        externalId
      }
    },
    select: { nexusEntityId: true }
  });

  const payment = existingLink
    ? await prisma.payment.update({
      where: { id: existingLink.nexusEntityId },
      data: {
        studentId,
        amount: Number(amount),
        motif,
        method,
        reference,
        organizationId
      }
    })
    : await prisma.payment.create({
      data: {
        studentId,
        amount: Number(amount),
        motif,
        method,
        reference,
        organizationId
      }
    });

  await upsertExternalLink({
    organizationId,
    appSlug,
    entityType: "payment",
    nexusEntityId: payment.id,
    externalId,
    metadata
  });

  await recordInboundSyncEvent({
    organizationId,
    appSlug,
    eventType: existingLink ? "payment.updated" : "payment.created",
    entityType: "payment",
    entityId: payment.id,
    payload: req.body
  });

  await recordAudit({
    organizationId,
    action: existingLink ? "edupay.payment.updated" : "edupay.payment.created",
    entityType: "payment",
    entityId: payment.id,
    metadata: { externalId, studentExternalId }
  });

  eventBus.emit("payment.created", payment);

  return res.status(existingLink ? 200 : 201).json({ payment });
}

export async function ingestSavanexStudent(req: Request, res: Response) {
  const appSlug = getAppSlug(req);
  const savanexAppSlug = AppSlug.SAVANEX;
  const {
    organizationId,
    externalId,
    firstName,
    lastName,
    gender,
    classExternalId,
    parentExternalId,
    metadata
  } = req.body;

  if (!ensureSavanexContext(appSlug, res)) {
    return;
  }

  if (!organizationId || !externalId || !firstName || !lastName || !gender) {
    return res.status(400).json({ message: "organizationId, externalId, firstName, lastName and gender are required" });
  }

  const organization = await ensureOrganizationExists(organizationId);
  if (!organization) {
    return res.status(404).json({ message: "Organization not found" });
  }

  const classId = await resolveLinkedEntityId(organizationId, savanexAppSlug, "class", classExternalId);
  const parentId = await resolveLinkedEntityId(organizationId, savanexAppSlug, "parent", parentExternalId);

  const existingLink = await prisma.externalLink.findUnique({
    where: {
      organizationId_appSlug_entityType_externalId: {
        organizationId,
        appSlug: savanexAppSlug,
        entityType: "student",
        externalId
      }
    },
    select: { nexusEntityId: true }
  });

  const student = existingLink
    ? await prisma.student.update({
      where: { id: existingLink.nexusEntityId },
      data: {
        firstName,
        lastName,
        gender,
        classId,
        parentId,
        organizationId
      }
    })
    : await prisma.student.create({
      data: {
        firstName,
        lastName,
        gender,
        classId,
        parentId,
        organizationId
      }
    });

  await upsertExternalLink({
    organizationId,
    appSlug: savanexAppSlug,
    entityType: "student",
    nexusEntityId: student.id,
    externalId,
    metadata
  });

  await recordInboundSyncEvent({
    organizationId,
    appSlug: savanexAppSlug,
    eventType: existingLink ? "student.updated" : "student.created",
    entityType: "student",
    entityId: student.id,
    payload: req.body
  });

  await recordAudit({
    organizationId,
    action: existingLink ? "savanex.student.updated" : "savanex.student.created",
    entityType: "student",
    entityId: student.id,
    metadata: { externalId, classExternalId, parentExternalId }
  });

  return res.status(existingLink ? 200 : 201).json({ student });
}

export async function ingestSavanexClass(req: Request, res: Response) {
  const appSlug = getAppSlug(req);
  const savanexAppSlug = AppSlug.SAVANEX;
  const { organizationId, externalId, name, gradeLevel, teacherExternalId, metadata } = req.body;

  if (!ensureSavanexContext(appSlug, res)) {
    return;
  }

  if (!organizationId || !externalId || !name) {
    return res.status(400).json({ message: "organizationId, externalId and name are required" });
  }

  const organization = await ensureOrganizationExists(organizationId);
  if (!organization) {
    return res.status(404).json({ message: "Organization not found" });
  }

  const teacherId = await resolveLinkedEntityId(organizationId, savanexAppSlug, "teacher", teacherExternalId);

  const existingLink = await prisma.externalLink.findUnique({
    where: {
      organizationId_appSlug_entityType_externalId: {
        organizationId,
        appSlug: savanexAppSlug,
        entityType: "class",
        externalId
      }
    },
    select: { nexusEntityId: true }
  });

  const klass = existingLink
    ? await prisma.class.update({
      where: { id: existingLink.nexusEntityId },
      data: {
        name,
        gradeLevel,
        teacherId,
        organizationId
      }
    })
    : await prisma.class.create({
      data: {
        name,
        gradeLevel,
        teacherId,
        organizationId
      }
    });

  await upsertExternalLink({
    organizationId,
    appSlug: savanexAppSlug,
    entityType: "class",
    nexusEntityId: klass.id,
    externalId,
    metadata
  });

  await recordInboundSyncEvent({
    organizationId,
    appSlug: savanexAppSlug,
    eventType: existingLink ? "class.updated" : "class.created",
    entityType: "class",
    entityId: klass.id,
    payload: req.body
  });

  await recordAudit({
    organizationId,
    action: existingLink ? "savanex.class.updated" : "savanex.class.created",
    entityType: "class",
    entityId: klass.id,
    metadata: { externalId, teacherExternalId }
  });

  return res.status(existingLink ? 200 : 201).json({ class: klass });
}

export async function ingestSavanexParent(req: Request, res: Response) {
  const appSlug = getAppSlug(req);
  const savanexAppSlug = AppSlug.SAVANEX;
  const { organizationId, externalId, fullName, phone, email, metadata } = req.body;

  if (!ensureSavanexContext(appSlug, res)) {
    return;
  }

  if (!organizationId || !externalId || !fullName) {
    return res.status(400).json({ message: "organizationId, externalId and fullName are required" });
  }

  const organization = await ensureOrganizationExists(organizationId);
  if (!organization) {
    return res.status(404).json({ message: "Organization not found" });
  }

  const existingLink = await prisma.externalLink.findUnique({
    where: {
      organizationId_appSlug_entityType_externalId: {
        organizationId,
        appSlug: savanexAppSlug,
        entityType: "parent",
        externalId
      }
    },
    select: { nexusEntityId: true }
  });

  const parent = existingLink
    ? await prisma.parent.update({
      where: { id: existingLink.nexusEntityId },
      data: { fullName, phone, email, organizationId }
    })
    : await prisma.parent.create({
      data: { fullName, phone, email, organizationId }
    });

  await upsertExternalLink({
    organizationId,
    appSlug: savanexAppSlug,
    entityType: "parent",
    nexusEntityId: parent.id,
    externalId,
    metadata
  });

  await recordInboundSyncEvent({
    organizationId,
    appSlug: savanexAppSlug,
    eventType: existingLink ? "parent.updated" : "parent.created",
    entityType: "parent",
    entityId: parent.id,
    payload: req.body
  });

  await recordAudit({
    organizationId,
    action: existingLink ? "savanex.parent.updated" : "savanex.parent.created",
    entityType: "parent",
    entityId: parent.id,
    metadata: { externalId, email }
  });

  return res.status(existingLink ? 200 : 201).json({ parent });
}

export async function ingestSavanexTeacher(req: Request, res: Response) {
  const appSlug = getAppSlug(req);
  const savanexAppSlug = AppSlug.SAVANEX;
  const { organizationId, externalId, fullName, phone, email, subject, metadata } = req.body;

  if (!ensureSavanexContext(appSlug, res)) {
    return;
  }

  if (!organizationId || !externalId || !fullName) {
    return res.status(400).json({ message: "organizationId, externalId and fullName are required" });
  }

  const organization = await ensureOrganizationExists(organizationId);
  if (!organization) {
    return res.status(404).json({ message: "Organization not found" });
  }

  const existingLink = await prisma.externalLink.findUnique({
    where: {
      organizationId_appSlug_entityType_externalId: {
        organizationId,
        appSlug: savanexAppSlug,
        entityType: "teacher",
        externalId
      }
    },
    select: { nexusEntityId: true }
  });

  const teacher = existingLink
    ? await prisma.teacher.update({
      where: { id: existingLink.nexusEntityId },
      data: { fullName, phone, email, subject, organizationId }
    })
    : await prisma.teacher.create({
      data: { fullName, phone, email, subject, organizationId }
    });

  await upsertExternalLink({
    organizationId,
    appSlug: savanexAppSlug,
    entityType: "teacher",
    nexusEntityId: teacher.id,
    externalId,
    metadata
  });

  await recordInboundSyncEvent({
    organizationId,
    appSlug: savanexAppSlug,
    eventType: existingLink ? "teacher.updated" : "teacher.created",
    entityType: "teacher",
    entityId: teacher.id,
    payload: req.body
  });

  await recordAudit({
    organizationId,
    action: existingLink ? "savanex.teacher.updated" : "savanex.teacher.created",
    entityType: "teacher",
    entityId: teacher.id,
    metadata: { externalId, subject }
  });

  return res.status(existingLink ? 200 : 201).json({ teacher });
}

export async function ingestSavanexGrade(req: Request, res: Response) {
  const appSlug = getAppSlug(req);
  const savanexAppSlug = AppSlug.SAVANEX;
  const { organizationId, externalId, studentExternalId, subject, score, maxScore, term, metadata } = req.body;

  if (!ensureSavanexContext(appSlug, res)) {
    return;
  }

  if (!organizationId || !externalId || !studentExternalId || !subject || score === undefined || maxScore === undefined) {
    return res.status(400).json({ message: "organizationId, externalId, studentExternalId, subject, score and maxScore are required" });
  }

  const organization = await ensureOrganizationExists(organizationId);
  if (!organization) {
    return res.status(404).json({ message: "Organization not found" });
  }

  const studentId = await resolveLinkedEntityId(organizationId, savanexAppSlug, "student", studentExternalId);
  if (!studentId) {
    return res.status(404).json({ message: "Student link not found for studentExternalId" });
  }

  const existingLink = await prisma.externalLink.findUnique({
    where: {
      organizationId_appSlug_entityType_externalId: {
        organizationId,
        appSlug: savanexAppSlug,
        entityType: "grade",
        externalId
      }
    },
    select: { nexusEntityId: true }
  });

  const grade = existingLink
    ? await prisma.grade.update({
      where: { id: existingLink.nexusEntityId },
      data: { studentId, subject, score: Number(score), maxScore: Number(maxScore), term, organizationId }
    })
    : await prisma.grade.create({
      data: { studentId, subject, score: Number(score), maxScore: Number(maxScore), term, organizationId }
    });

  await upsertExternalLink({
    organizationId,
    appSlug: savanexAppSlug,
    entityType: "grade",
    nexusEntityId: grade.id,
    externalId,
    metadata
  });

  await recordInboundSyncEvent({
    organizationId,
    appSlug: savanexAppSlug,
    eventType: existingLink ? "grade.updated" : "grade.created",
    entityType: "grade",
    entityId: grade.id,
    payload: req.body
  });

  await recordAudit({
    organizationId,
    action: existingLink ? "savanex.grade.updated" : "savanex.grade.created",
    entityType: "grade",
    entityId: grade.id,
    metadata: { externalId, studentExternalId, subject }
  });

  eventBus.emit("grade.created", grade);

  return res.status(existingLink ? 200 : 201).json({ grade });
}

export async function ingestSavanexAttendance(req: Request, res: Response) {
  const appSlug = getAppSlug(req);
  const savanexAppSlug = AppSlug.SAVANEX;
  const { organizationId, externalId, studentExternalId, date, status, metadata } = req.body;

  if (!ensureSavanexContext(appSlug, res)) {
    return;
  }

  if (!organizationId || !externalId || !studentExternalId || !date || !status) {
    return res.status(400).json({ message: "organizationId, externalId, studentExternalId, date and status are required" });
  }

  const organization = await ensureOrganizationExists(organizationId);
  if (!organization) {
    return res.status(404).json({ message: "Organization not found" });
  }

  const studentId = await resolveLinkedEntityId(organizationId, savanexAppSlug, "student", studentExternalId);
  if (!studentId) {
    return res.status(404).json({ message: "Student link not found for studentExternalId" });
  }

  const existingLink = await prisma.externalLink.findUnique({
    where: {
      organizationId_appSlug_entityType_externalId: {
        organizationId,
        appSlug: savanexAppSlug,
        entityType: "attendance",
        externalId
      }
    },
    select: { nexusEntityId: true }
  });

  const attendance = existingLink
    ? await prisma.attendance.update({
      where: { id: existingLink.nexusEntityId },
      data: { studentId, date: new Date(date), status, organizationId }
    })
    : await prisma.attendance.create({
      data: { studentId, date: new Date(date), status, organizationId }
    });

  await upsertExternalLink({
    organizationId,
    appSlug: savanexAppSlug,
    entityType: "attendance",
    nexusEntityId: attendance.id,
    externalId,
    metadata
  });

  await recordInboundSyncEvent({
    organizationId,
    appSlug: savanexAppSlug,
    eventType: existingLink ? "attendance.updated" : "attendance.created",
    entityType: "attendance",
    entityId: attendance.id,
    payload: req.body
  });

  await recordAudit({
    organizationId,
    action: existingLink ? "savanex.attendance.updated" : "savanex.attendance.created",
    entityType: "attendance",
    entityId: attendance.id,
    metadata: { externalId, studentExternalId, date }
  });

  return res.status(existingLink ? 200 : 201).json({ attendance });
}

export async function ingestEduSyncAiAnnouncement(req: Request, res: Response) {
  const appSlug = getAppSlug(req);
  const { organizationId, externalId, title, message, audience, metadata } = req.body;

  if (appSlug !== AppSlug.EDUSYNCAI) {
    return res.status(403).json({ message: "Invalid integration context" });
  }

  if (!organizationId || !externalId || !title || !message || !audience) {
    return res.status(400).json({ message: "organizationId, externalId, title, message and audience are required" });
  }

  const organization = await ensureOrganizationExists(organizationId);
  if (!organization) {
    return res.status(404).json({ message: "Organization not found" });
  }

  const existingLink = await prisma.externalLink.findUnique({
    where: {
      organizationId_appSlug_entityType_externalId: {
        organizationId,
        appSlug,
        entityType: "announcement",
        externalId
      }
    },
    select: { nexusEntityId: true }
  });

  const announcement = existingLink
    ? await prisma.announcement.update({
      where: { id: existingLink.nexusEntityId },
      data: {
        title,
        message,
        audience,
        organizationId
      }
    })
    : await prisma.announcement.create({
      data: {
        title,
        message,
        audience,
        organizationId
      }
    });

  await upsertExternalLink({
    organizationId,
    appSlug,
    entityType: "announcement",
    nexusEntityId: announcement.id,
    externalId,
    metadata
  });

  await recordInboundSyncEvent({
    organizationId,
    appSlug,
    eventType: existingLink ? "announcement.updated" : "announcement.published",
    entityType: "announcement",
    entityId: announcement.id,
    payload: req.body
  });

  await recordAudit({
    organizationId,
    action: existingLink ? "edusyncai.announcement.updated" : "edusyncai.announcement.published",
    entityType: "announcement",
    entityId: announcement.id,
    metadata: { externalId, audience }
  });

  return res.status(existingLink ? 200 : 201).json({ announcement });
}