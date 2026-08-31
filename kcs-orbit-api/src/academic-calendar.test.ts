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
test("calendar has September-June, two semesters and three trimesters", () => {
  const calendar = validateAcademicCalendar(buildDefaultAcademicCalendar(2026, "org-kcs"));
  assert.equal(calendar.name, "2026-2027");
  assert.equal(calendar.periods.filter((p) => p.type === "SEMESTER").length, 2);
  assert.equal(calendar.periods.filter((p) => p.type === "TRIMESTER").length, 3);
});
test("July end date is rejected", () => {
  const calendar = buildDefaultAcademicCalendar(2026, "org-kcs");
  calendar.endDate = new Date("2027-07-01T00:00:00Z");
  assert.throws(() => validateAcademicCalendar(calendar), /June 30/);
});
test("period gaps are rejected", () => {
  const calendar = buildDefaultAcademicCalendar(2026, "org-kcs");
  calendar.periods.find((p) => p.code === "T2")!.startDate = new Date("2027-01-03T00:00:00Z");
  assert.throws(() => validateAcademicCalendar(calendar), /contiguous/);
});
