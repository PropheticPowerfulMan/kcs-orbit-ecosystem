import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, flushOfflineMutationQueue, normalizeDemoPayment } from "./api";

if (typeof globalThis.localStorage === "undefined") {
  const storage = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    clear: () => storage.clear(),
    getItem: (key: string) => storage.get(key) ?? null,
    removeItem: (key: string) => storage.delete(key),
    setItem: (key: string, value: string) => storage.set(key, value)
  });
}

describe("EduPay offline mutation queue", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("queues a write while offline and replays it when the API returns", async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const queued = await api<{ offlineQueued: boolean; id: string }>("/api/contact", {
      method: "POST",
      body: JSON.stringify({ message: "offline note" })
    });

    expect(queued.offlineQueued).toBe(true);
    const result = await flushOfflineMutationQueue();

    expect(result).toMatchObject({ attempted: 1, sent: 1, remaining: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not invent a password reset or an authenticated account while the API is offline", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    for (const [path, body] of [
      ["/api/auth/forgot-password", { identifier: "admin@school.com" }],
      ["/api/auth/reset-password", { token: "invalid-test-token", newPassword: "newPassword123" }],
      ["/api/auth/login", { email: "admin@school.com", password: "newPassword123" }]
    ] as const) {
      await expect(api(path, { method: "POST", body: JSON.stringify(body) })).rejects.toThrow();
    }
    expect(localStorage.getItem("edupay_token")).toBeNull();
    expect(localStorage.getItem("edupay_demo_password_reset_tokens_v1")).toBeNull();
  });

  it("repairs legacy local payments for history and payment status views", async () => {
    const payment = normalizeDemoPayment({
      id: "legacy-1",
      transactionNumber: "LOCAL-OLD-1",
      amount: 40,
      status: "COMPLETED",
      reason: "Paiement historique"
    }, 0);

    expect(payment).toEqual(expect.objectContaining({
      parentFullName: "Parent EduPay",
      paymentSubjectName: "Parent EduPay",
      method: "CASH",
      amount: 40,
      date: expect.any(String)
    }));
  });
  it("records parent dashboard, email, and sms messages for local payments", async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValue(new Response("Service unavailable", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);

    const created = await api<{
      payment: { id: string };
      notificationStatus: { dashboard?: string; email?: string; sms?: string };
    }>("/api/payments", {
      method: "POST",
      body: JSON.stringify({
        paymentCategory: "SERVICE",
        parentId: "PAR-KCS-001",
        parentFullName: "Rachel Kabongo",
        studentDisplayName: "Rachel Kabongo",
        reason: "Fournitures scolaires",
        amount: 25,
        method: "CASH",
        status: "COMPLETED",
        notifyParent: true
      })
    });

    expect(created.notificationStatus).toMatchObject({
      dashboard: "OPEN",
      email: "SIMULATED",
      sms: "SIMULATED"
    });

    localStorage.setItem("edupay_parent_id", "PAR-KCS-001");
    const profile = await api<{ notificationHistory: Array<{ channel: string; content: string; status: string }> }>(
      "/api/finance/me/profile"
    );

    expect(profile.notificationHistory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ channel: "DASHBOARD", content: expect.stringContaining("Fournitures scolaires"), status: "OPEN" }),
        expect.objectContaining({ channel: "EMAIL", content: expect.stringContaining("Fournitures scolaires"), status: "SIMULATED" }),
        expect.objectContaining({ channel: "SMS", content: expect.stringContaining("Fournitures scolaires"), status: "SIMULATED" })
      ])
    );
  });
});
