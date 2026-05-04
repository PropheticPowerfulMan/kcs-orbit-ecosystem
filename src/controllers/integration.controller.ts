import { AppSlug, ConnectionStatus, Prisma, SyncDirection, SyncStatus } from "@prisma/client";
import { Request, Response } from "express";
import { prisma } from "../db";

function parseAppSlug(value: unknown): AppSlug | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.toUpperCase();
  return Object.values(AppSlug).includes(normalized as AppSlug)
    ? (normalized as AppSlug)
    : null;
}

function parseConnectionStatus(value: unknown): ConnectionStatus | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.toUpperCase();
  return Object.values(ConnectionStatus).includes(normalized as ConnectionStatus)
    ? (normalized as ConnectionStatus)
    : null;
}

function parseSyncDirection(value: unknown): SyncDirection | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.toUpperCase();
  return Object.values(SyncDirection).includes(normalized as SyncDirection)
    ? (normalized as SyncDirection)
    : null;
}

function parseSyncStatus(value: unknown): SyncStatus | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.toUpperCase();
  return Object.values(SyncStatus).includes(normalized as SyncStatus)
    ? (normalized as SyncStatus)
    : null;
}

function parseJsonInput(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return Prisma.JsonNull;
  }

  return value as Prisma.InputJsonValue;
}

export async function createOrganization(req: Request, res: Response) {
  const { name, slug } = req.body;

  if (!name || !slug) {
    return res.status(400).json({ message: "name and slug are required" });
  }

  const organization = await prisma.organization.create({
    data: { name, slug }
  });

  await prisma.auditLog.create({
    data: {
      organizationId: organization.id,
      userId: req.user?.userId,
      action: "organization.created",
      entityType: "organization",
      entityId: organization.id,
      metadata: { slug: organization.slug }
    }
  });

  return res.status(201).json(organization);
}

export async function listOrganizations(_req: Request, res: Response) {
  const organizations = await prisma.organization.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: {
        select: {
          users: true,
          appConnections: true,
          externalLinks: true,
          syncEvents: true
        }
      }
    }
  });

  return res.json(organizations);
}

export async function createAppConnection(req: Request, res: Response) {
  const { organizationId, appSlug, baseUrl, status } = req.body;
  const resolvedAppSlug = parseAppSlug(appSlug);
  const resolvedStatus = status ? parseConnectionStatus(status) : ConnectionStatus.ACTIVE;

  if (!organizationId || !resolvedAppSlug || !baseUrl || !resolvedStatus) {
    return res.status(400).json({ message: "organizationId, appSlug, baseUrl and valid status are required" });
  }

  const connection = await prisma.appConnection.upsert({
    where: {
      organizationId_appSlug: {
        organizationId,
        appSlug: resolvedAppSlug
      }
    },
    update: {
      baseUrl,
      status: resolvedStatus
    },
    create: {
      organizationId,
      appSlug: resolvedAppSlug,
      baseUrl,
      status: resolvedStatus
    }
  });

  await prisma.auditLog.create({
    data: {
      organizationId,
      userId: req.user?.userId,
      action: "appConnection.upserted",
      entityType: "appConnection",
      entityId: connection.id,
      metadata: { appSlug: connection.appSlug, baseUrl: connection.baseUrl }
    }
  });

  return res.status(201).json(connection);
}

export async function listAppConnections(req: Request, res: Response) {
  const organizationId = typeof req.query.organizationId === "string" ? req.query.organizationId : undefined;
  const appSlug = parseAppSlug(req.query.appSlug);

  const connections = await prisma.appConnection.findMany({
    where: {
      organizationId,
      appSlug: appSlug ?? undefined
    },
    orderBy: { createdAt: "desc" }
  });

  return res.json(connections);
}

export async function createExternalLink(req: Request, res: Response) {
  const { organizationId, appSlug, entityType, nexusEntityId, externalId, metadata } = req.body;
  const resolvedAppSlug = parseAppSlug(appSlug);

  if (!organizationId || !resolvedAppSlug || !entityType || !nexusEntityId || !externalId) {
    return res.status(400).json({ message: "organizationId, appSlug, entityType, nexusEntityId and externalId are required" });
  }

  const link = await prisma.externalLink.upsert({
    where: {
      organizationId_appSlug_entityType_externalId: {
        organizationId,
        appSlug: resolvedAppSlug,
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
      appSlug: resolvedAppSlug,
      entityType,
      nexusEntityId,
      externalId,
      metadata: parseJsonInput(metadata)
    }
  });

  await prisma.auditLog.create({
    data: {
      organizationId,
      userId: req.user?.userId,
      action: "externalLink.upserted",
      entityType: entityType,
      entityId: nexusEntityId,
      metadata: { appSlug: link.appSlug, externalId: link.externalId }
    }
  });

  return res.status(201).json(link);
}

export async function listExternalLinks(req: Request, res: Response) {
  const organizationId = typeof req.query.organizationId === "string" ? req.query.organizationId : undefined;
  const appSlug = parseAppSlug(req.query.appSlug);
  const entityType = typeof req.query.entityType === "string" ? req.query.entityType : undefined;

  const links = await prisma.externalLink.findMany({
    where: {
      organizationId,
      appSlug: appSlug ?? undefined,
      entityType
    },
    orderBy: { updatedAt: "desc" }
  });

  return res.json(links);
}

export async function createSyncEvent(req: Request, res: Response) {
  const { organizationId, appSlug, eventType, entityType, entityId, direction, status, payload, errorMessage } = req.body;
  const resolvedAppSlug = parseAppSlug(appSlug);
  const resolvedDirection = parseSyncDirection(direction);
  const resolvedStatus = status ? parseSyncStatus(status) : SyncStatus.PENDING;

  if (!organizationId || !resolvedAppSlug || !eventType || !entityType || !entityId || !resolvedDirection || !resolvedStatus) {
    return res.status(400).json({ message: "organizationId, appSlug, eventType, entityType, entityId, direction and valid status are required" });
  }

  const syncEvent = await prisma.syncEvent.create({
    data: {
      organizationId,
      appSlug: resolvedAppSlug,
      eventType,
      entityType,
      entityId,
      direction: resolvedDirection,
      status: resolvedStatus,
      payload: parseJsonInput(payload),
      errorMessage: errorMessage ?? null,
      processedAt: resolvedStatus === SyncStatus.PROCESSED ? new Date() : null
    }
  });

  await prisma.auditLog.create({
    data: {
      organizationId,
      userId: req.user?.userId,
      action: "syncEvent.created",
      entityType,
      entityId,
      metadata: { appSlug: syncEvent.appSlug, eventType: syncEvent.eventType, status: syncEvent.status }
    }
  });

  return res.status(201).json(syncEvent);
}

export async function listSyncEvents(req: Request, res: Response) {
  const organizationId = typeof req.query.organizationId === "string" ? req.query.organizationId : undefined;
  const appSlug = parseAppSlug(req.query.appSlug);
  const status = parseSyncStatus(req.query.status);

  const syncEvents = await prisma.syncEvent.findMany({
    where: {
      organizationId,
      appSlug: appSlug ?? undefined,
      status: status ?? undefined
    },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  return res.json(syncEvents);
}

export async function listAuditLogs(req: Request, res: Response) {
  const organizationId = typeof req.query.organizationId === "string" ? req.query.organizationId : undefined;

  const auditLogs = await prisma.auditLog.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  return res.json(auditLogs);
}