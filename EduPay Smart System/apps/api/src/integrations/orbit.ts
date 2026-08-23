import { IntegrationOutboxStatus, Prisma } from "@prisma/client";
import { PaymentCreatedSchema } from "@ecosystem/shared-contracts";
import { prisma } from "../prisma";

const orbitApiUrl = (process.env.KCS_ORBIT_API_URL || "").replace(/\/$/, "");
const orbitApiKey = process.env.KCS_ORBIT_API_KEY || "";
const orbitOrganizationId = process.env.KCS_ORBIT_ORGANIZATION_ID || "";
const OUTBOX_FLUSH_BATCH_SIZE = 10;
const DEFAULT_OUTBOX_RETRY_INTERVAL_MS = 30_000;
let flushInFlight: Promise<number> | null = null;

type DbClient = Prisma.TransactionClient | typeof prisma;
type PaymentOrbitInput = {
  payment: {
    id: string;
    transactionNumber: string;
    amount: number;
    reason: string;
    method: string;
    status: string;
    createdAt: Date;
    schoolId: string;
    parentId: string;
  };
  studentExternalIds: string[];
  localStudentIds: string[];
};

export type OrbitOutboxInput = {
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  path: string;
  httpMethod?: "POST" | "PUT" | "DELETE";
  payload?: Prisma.InputJsonValue;
  idempotencyKey: string;
};

export function orbitSyncEnabled() {
  return Boolean(orbitApiUrl && orbitApiKey && orbitOrganizationId);
}

export function buildPaymentEvent(input: PaymentOrbitInput) {
  const primaryStudentExternalId = input.studentExternalIds[0];
  if (!primaryStudentExternalId) return null;
  const contract = PaymentCreatedSchema.parse({
    organizationId: orbitOrganizationId,
    externalId: input.payment.transactionNumber,
    sourceApp: "EDUPAY",
    occurredAt: input.payment.createdAt.toISOString(),
    version: "1.0.0",
    payload: {
      studentExternalId: primaryStudentExternalId,
      amount: input.payment.amount,
      currency: "USD",
      motif: input.payment.reason,
      method: input.payment.method,
      reference: input.payment.transactionNumber,
      status: input.payment.status
    }
  });
  return {
    path: "/api/integration/ingest/edupay/payments",
    payload: {
      ...contract,
      sourceEventKey: `EDUPAY:PAYMENT:${input.payment.transactionNumber}`,
      metadata: {
        schoolId: input.payment.schoolId,
        parentId: input.payment.parentId,
        localStudentIds: input.localStudentIds,
        studentExternalIds: input.studentExternalIds
      }
    },
    idempotencyKey: `EDUPAY:PAYMENT:${input.payment.transactionNumber}`
  };
}

export async function enqueuePaymentOrbitEvent(db: DbClient, input: PaymentOrbitInput) {
  if (!orbitSyncEnabled()) return null;
  const event = buildPaymentEvent(input);
  if (!event) return null;
  return db.integrationOutboxEvent.upsert({
    where: { idempotencyKey: event.idempotencyKey },
    update: {},
    create: {
      eventType: "payment.created",
      aggregateType: "Payment",
      aggregateId: input.payment.id,
      path: event.path,
      payload: event.payload,
      idempotencyKey: event.idempotencyKey
    }
  });
}

export async function enqueueOrbitEvent(db: DbClient, input: OrbitOutboxInput) {
  if (!orbitSyncEnabled()) return null;
  const payload = JSON.parse(JSON.stringify(input.payload ?? {})) as Prisma.InputJsonValue;
  return db.integrationOutboxEvent.upsert({
    where: { idempotencyKey: input.idempotencyKey },
    update: {},
    create: {
      eventType: input.eventType,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      path: input.path,
      httpMethod: input.httpMethod ?? "POST",
      payload,
      idempotencyKey: input.idempotencyKey
    }
  });
}

async function sendJson(path: string, payload: Prisma.JsonValue, method = "POST", idempotencyKey?: string) {
  if (!orbitSyncEnabled()) throw new Error("Missing Orbit configuration");
  const response = await fetch(`${orbitApiUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": orbitApiKey,
      "x-app-slug": "EDUPAY",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {})
    },
    ...(method === "DELETE" ? {} : { body: JSON.stringify(payload) })
  });
  if (!response.ok) {
    const body = await response.text();
    if (response.status === 409) {
      try {
        const conflict = JSON.parse(body) as { orbitId?: unknown };
        if (typeof conflict.orbitId === "string") return;
      } catch {
        // A non-JSON conflict is retryable and must remain in the outbox.
      }
    }
    throw new Error(`HTTP ${response.status}: ${body}`);
  }
}

function retryDelayMs(retryCount: number) {
  return Math.min(15 * 60_000, 5_000 * 2 ** Math.min(retryCount, 8));
}

async function resolveEventPayload(eventType: string, payload: Prisma.JsonValue): Promise<Prisma.JsonValue> {
  if (eventType !== "student.created" || !payload || Array.isArray(payload) || typeof payload !== "object") {
    return payload;
  }
  const record = payload as Record<string, Prisma.JsonValue>;
  const localParentId = typeof record.__edupayParentId === "string" ? record.__edupayParentId : "";
  if (!localParentId) return payload;
  const parent = await prisma.parent.findUnique({ where: { id: localParentId }, select: { orbitId: true } });
  if (!parent?.orbitId) throw new Error("Parent Orbit mapping is not available yet");
  const { __edupayParentId: _internalParentId, ...publicPayload } = record;
  return { ...publicPayload, parentOrbitId: parent.orbitId };
}

export async function flushOutbox(maxItems = OUTBOX_FLUSH_BATCH_SIZE) {
  if (flushInFlight) return flushInFlight;
  flushInFlight = (async () => {
    if (!orbitSyncEnabled()) return 0;
    const now = new Date();
    await prisma.integrationOutboxEvent.updateMany({
      where: {
        status: IntegrationOutboxStatus.PROCESSING,
        lastAttemptAt: { lt: new Date(now.getTime() - 5 * 60_000) }
      },
      data: {
        status: IntegrationOutboxStatus.FAILED,
        errorMessage: "Worker lease expired",
        nextAttemptAt: now
      }
    });
    const events = await prisma.integrationOutboxEvent.findMany({
      where: {
        status: { in: [IntegrationOutboxStatus.PENDING, IntegrationOutboxStatus.FAILED] },
        nextAttemptAt: { lte: now }
      },
      orderBy: { createdAt: "asc" },
      take: maxItems
    });
    let completed = 0;
    for (const event of events) {
      const claimed = await prisma.integrationOutboxEvent.updateMany({
        where: {
          id: event.id,
          status: { in: [IntegrationOutboxStatus.PENDING, IntegrationOutboxStatus.FAILED] }
        },
        data: { status: IntegrationOutboxStatus.PROCESSING, lastAttemptAt: new Date() }
      });
      if (!claimed.count) continue;
      try {
        const payload = await resolveEventPayload(event.eventType, event.payload);
        await sendJson(event.path, payload, event.httpMethod, event.idempotencyKey);
        await prisma.integrationOutboxEvent.update({
          where: { id: event.id },
          data: { status: IntegrationOutboxStatus.COMPLETED, completedAt: new Date(), errorMessage: null }
        });
        completed += 1;
      } catch (error) {
        const retryCount = event.retryCount + 1;
        const exhausted = retryCount >= event.maxRetries;
        await prisma.integrationOutboxEvent.update({
          where: { id: event.id },
          data: {
            status: exhausted ? IntegrationOutboxStatus.DEAD_LETTER : IntegrationOutboxStatus.FAILED,
            retryCount,
            errorMessage: error instanceof Error ? error.message.slice(0, 2000) : String(error).slice(0, 2000),
            nextAttemptAt: new Date(Date.now() + retryDelayMs(retryCount))
          }
        });
      }
    }
    return completed;
  })();
  try { return await flushInFlight; }
  finally { flushInFlight = null; }
}

function getOutboxRetryIntervalMs() {
  const configured = Number(process.env.KCS_ORBIT_OUTBOX_RETRY_INTERVAL_MS ?? DEFAULT_OUTBOX_RETRY_INTERVAL_MS);
  return Number.isFinite(configured) && configured >= 1_000 ? Math.floor(configured) : DEFAULT_OUTBOX_RETRY_INTERVAL_MS;
}

export function startOrbitOutboxWorker() {
  if (!orbitSyncEnabled()) return () => undefined;
  const run = () => void flushOutbox().catch((error) => console.warn("Orbit outbox worker failed", error));
  run();
  const interval = setInterval(run, getOutboxRetryIntervalMs());
  interval.unref?.();
  return () => clearInterval(interval);
}
