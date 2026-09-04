import { describe, expect, it, vi } from "vitest";
import {
  buildTuitionReminderMarker,
  canSendOverdueStage,
  isKcsTestFamily,
  isTuitionReminderRunDay,
  OVERDUE_REMINDER_STAGES,
  TUITION_REMINDER_WEEKDAYS
} from "../src/modules/finance/service";

describe("overdue tuition reminder cadence", () => {
  it("defines exactly seven daily warning stages in one week", () => {
    expect(OVERDUE_REMINDER_STAGES.map((stage) => stage.stage)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(OVERDUE_REMINDER_STAGES.map((stage) => stage.minDelayDays)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(OVERDUE_REMINDER_STAGES.slice(1).every((stage) => stage.minDaysAfterPreviousNotice === 1)).toBe(true);
  });

  it("requires the previous warning before sending the next stage", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-08T10:00:00.000Z"));

    expect(canSendOverdueStage({ stage: 1, delayDays: 1, logs: [] })).toBe(true);
    expect(canSendOverdueStage({ stage: 2, delayDays: 2, logs: [] })).toBe(false);
    expect(canSendOverdueStage({
      stage: 2,
      delayDays: 2,
      logs: [{ content: "[OVERDUE_INSTALLMENT:test:STAGE:1]", createdAt: new Date("2026-05-07T09:00:00.000Z") }]
    })).toBe(true);
    expect(canSendOverdueStage({
      stage: 2,
      delayDays: 2,
      logs: [
        { content: "[OVERDUE_INSTALLMENT:test:STAGE:1]", createdAt: new Date("2026-05-07T09:00:00.000Z") },
        { content: "[OVERDUE_INSTALLMENT:test:STAGE:2]", createdAt: new Date("2026-05-08T09:00:00.000Z") }
      ]
    })).toBe(false);

    vi.useRealTimers();
  });
});

describe("permanent KCS tuition reminder policy", () => {
  it("runs exactly Monday, Wednesday and Friday in Kinshasa", () => {
    expect(TUITION_REMINDER_WEEKDAYS).toEqual(["Mon", "Wed", "Fri"]);
    expect(isTuitionReminderRunDay(new Date("2026-09-07T10:00:00.000Z"))).toBe(true);
    expect(isTuitionReminderRunDay(new Date("2026-09-09T10:00:00.000Z"))).toBe(true);
    expect(isTuitionReminderRunDay(new Date("2026-09-11T10:00:00.000Z"))).toBe(true);
    expect(isTuitionReminderRunDay(new Date("2026-09-08T10:00:00.000Z"))).toBe(false);
  });

  it("deduplicates a reminder by installment and Kinshasa calendar date", () => {
    expect(buildTuitionReminderMarker("inst-1", new Date("2026-09-07T10:00:00.000Z")))
      .toBe("[TUITION_REMINDER:inst-1:DATE:2026-09-07]");
  });

  it("protects the permanent test-family exemption regardless of name order", () => {
    expect(isKcsTestFamily("LOKALA LOMBOTO Jonathan")).toBe(true);
    expect(isKcsTestFamily("Jonathan Lokala Lomboto")).toBe(true);
    expect(isKcsTestFamily("Other Parent")).toBe(false);
  });
});
