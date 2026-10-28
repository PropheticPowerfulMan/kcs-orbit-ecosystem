import assert from "node:assert/strict";
import test from "node:test";
import { buildDefaultAcademicCalendar } from "@ecosystem/shared-contracts";
import { getDefaultAcademicStartYear, validateAcademicCalendar } from "./services/academic-calendar.service";

test("August 2026 defaults to 2026-2027", () => {
  assert.equal(getDefaultAcademicStartYear(new Date("2026-08-31T12:00:00Z")), 2026);
});
test("February 2027 remains in 2026-2027", () => {
  assert.equal(getDefaultAcademicStartYear(new Date("2027-02-10T12:00:00Z")), 2026);
});
test("2026-2027 calendar follows the official KCS instruction dates", () => {
  const calendar = validateAcademicCalendar(buildDefaultAcademicCalendar(2026, "org-kcs"));
  assert.equal(calendar.name, "2026-2027");
  assert.equal(calendar.startDate.toISOString().slice(0, 10), "2026-09-07");
  assert.equal(calendar.endDate.toISOString().slice(0, 10), "2027-06-11");
  assert.equal(calendar.periods.filter((p) => p.type === "SEMESTER").length, 2);
  assert.equal(calendar.periods.filter((p) => p.type === "QUARTER").length, 4);
  assert.deepEqual(
    calendar.periods.map((period) => [period.code, period.startDate.toISOString().slice(0, 10), period.endDate.toISOString().slice(0, 10)]),
    [
      ["S1", "2026-09-07", "2027-01-29"],
      ["S2", "2027-02-01", "2027-06-11"],
      ["Q1", "2026-09-07", "2026-11-06"],
      ["Q2", "2026-11-09", "2027-01-29"],
      ["Q3", "2027-02-01", "2027-04-02"],
      ["Q4", "2027-04-05", "2027-06-11"]
    ]
  );
});
test("July end date is rejected", () => {
  const calendar = buildDefaultAcademicCalendar(2026, "org-kcs");
  calendar.endDate = new Date("2027-07-01T00:00:00Z");
  assert.throws(() => validateAcademicCalendar(calendar), /during June/);
});
test("overlapping periods are rejected", () => {
  const calendar = buildDefaultAcademicCalendar(2026, "org-kcs");
  calendar.periods.find((p) => p.code === "Q2")!.startDate = new Date("2026-10-01T00:00:00Z");
  assert.throws(() => validateAcademicCalendar(calendar), /must not overlap/);
});
