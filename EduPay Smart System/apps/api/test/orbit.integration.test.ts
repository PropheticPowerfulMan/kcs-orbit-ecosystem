import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("payment Orbit outbox contract", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = {
      ...originalEnv,
      KCS_ORBIT_API_URL: "http://localhost:4500",
      KCS_ORBIT_API_KEY: "edupay-test-key",
      KCS_ORBIT_ORGANIZATION_ID: "org-test",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("builds an idempotent payment contract without performing network I/O", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
    const { buildPaymentEvent } = await import("../src/integrations/orbit");
    const event = buildPaymentEvent({
      payment: {
        id: "payment-1",
        transactionNumber: "SIM-TX-TEST-001",
        amount: 125.5,
        reason: "Tuition",
        method: "CASH",
        status: "COMPLETED",
        createdAt: new Date("2026-05-05T05:00:00.000Z"),
        schoolId: "school-1",
        parentId: "parent-1",
      },
      studentExternalIds: ["STU-EXT-001", "STU-EXT-002"],
      localStudentIds: ["student-1", "student-2"],
    })!;
    const body = event.payload;
    expect(fetchMock).not.toHaveBeenCalled();
    expect(event.path).toBe("/api/integration/ingest/edupay/payments");
    expect(event.idempotencyKey).toBe("EDUPAY:PAYMENT:SIM-TX-TEST-001");
    expect(body.sourceEventKey).toBe(event.idempotencyKey);
    expect(body.organizationId).toBe("org-test");
    expect(body.payload.studentExternalId).toBe("STU-EXT-001");
    expect(body.payload.reference).toBe("SIM-TX-TEST-001");
    expect(body.metadata.studentExternalIds).toEqual(["STU-EXT-001", "STU-EXT-002"]);
    expect(body.metadata.localStudentIds).toEqual(["student-1", "student-2"]);
  }, 15_000);

  it("uses a unique idempotency key when the same outbox event is enqueued twice", async () => {
    const upsert = vi.fn().mockResolvedValue({ id: "outbox-1" });
    const db = { integrationOutboxEvent: { upsert } };
    const { enqueueOrbitEvent } = await import("../src/integrations/orbit");
    const event = {
      eventType: "parent.deleted",
      aggregateType: "Parent",
      aggregateId: "parent-1",
      path: "/api/integration/registry/parent/orbit-parent-1",
      httpMethod: "DELETE" as const,
      idempotencyKey: "EDUPAY:PARENT_DELETED:parent-1",
    };

    await enqueueOrbitEvent(db as never, event);
    await enqueueOrbitEvent(db as never, event);

    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert.mock.calls[0][0].where.idempotencyKey).toBe(event.idempotencyKey);
    expect(upsert.mock.calls[1][0].where.idempotencyKey).toBe(event.idempotencyKey);
    expect(upsert.mock.calls[0][0].update).toEqual({});
  });
});
