import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAcademicProgressionPlan,
  getAcademicYearWindow,
  getNextAcademicClassName
} from "@ecosystem/shared-contracts";

const classes = [
  { id: "k4-a", name: "K4 A", gradeLevel: "K4", suffix: "A" },
  { id: "k5-a", name: "K5 A", gradeLevel: "K5", suffix: "A" },
  { id: "grade-1-a", name: "Grade 1 A", gradeLevel: "Grade 1", suffix: "A" },
  { id: "grade-4-b", name: "Grade 4 B", gradeLevel: "Grade 4", suffix: "B" },
  { id: "grade-7-a", name: "Grade 7 A", gradeLevel: "Grade 7", suffix: "A" },
  { id: "grade-12-a", name: "Grade 12 A", gradeLevel: "Grade 12", suffix: "A" }
];

test("academic year runs from September through June and rolls over in July", () => {
  const duringSchoolYear = getAcademicYearWindow(new Date("2026-05-30T12:00:00.000Z"));
  assert.equal(duringSchoolYear.academicYear, "2025-2026");
  assert.equal(duringSchoolYear.startDate, "2025-09-01");
  assert.equal(duringSchoolYear.endDate, "2026-06-30");
  assert.equal(duringSchoolYear.isRolloverWindow, false);

  const duringRollover = getAcademicYearWindow(new Date("2026-07-15T12:00:00.000Z"));
  assert.equal(duringRollover.academicYear, "2025-2026");
  assert.equal(duringRollover.rolloverDate, "2026-07-01");
  assert.equal(duringRollover.isRolloverWindow, true);
});

test("class progression preserves sections and graduates the final grade", () => {
  assert.equal(getNextAcademicClassName("K4 A"), "K5 A");
  assert.equal(getNextAcademicClassName("K5 A"), "Grade 1 A");
  assert.equal(getNextAcademicClassName("Grade 11 B"), "Grade 12 B");
  assert.equal(getNextAcademicClassName("Grade 12 A"), null);
});

test("progression plan promotes only students who meet the 75 percent KCS success threshold", () => {
  const plan = buildAcademicProgressionPlan({
    effectiveDate: new Date("2026-07-15T12:00:00.000Z"),
    classes,
    students: [
      { id: "student-k5", firstName: "Amina", lastName: "K.", classId: "k5-a", className: "K5 A", status: "ACTIVE", averagePercent: 75 },
      { id: "student-failed", firstName: "Beni", lastName: "M.", classId: "grade-4-b", className: "Grade 4 B", status: "ACTIVE", averagePercent: 74.99 },
      { id: "student-repeat", firstName: "Celine", lastName: "L.", classId: "grade-4-b", className: "Grade 4 B", status: "ACTIVE", averagePercent: 90 },
      { id: "student-transfer", firstName: "Clara", lastName: "N.", classId: "k4-a", className: "K4 A", status: "ACTIVE", averagePercent: 30 },
      { id: "student-unknown", firstName: "David", lastName: "P.", className: "Blue Room", status: "ACTIVE", averagePercent: 95 },
      { id: "student-missing-average", firstName: "Dina", lastName: "R.", classId: "k4-a", className: "K4 A", status: "ACTIVE" },
      { id: "student-final", firstName: "Elie", lastName: "S.", classId: "grade-12-a", className: "Grade 12 A", status: "ACTIVE", averagePercent: 88 }
    ],
    overrides: [
      { studentId: "student-repeat", decision: "REPEAT", reason: "Needs another year" },
      { studentId: "student-transfer", decision: "MANUAL_TRANSFER", targetClassId: "grade-7-a", reason: "Administrator correction" }
    ]
  });

  const byStudent = new Map(plan.items.map((item) => [item.studentId, item]));

  assert.equal(plan.isRolloverWindow, true);
  assert.equal(byStudent.get("student-k5")?.action, "PROMOTE");
  assert.equal(byStudent.get("student-k5")?.toClassId, "grade-1-a");
  assert.equal(byStudent.get("student-k5")?.passThreshold, 75);
  assert.equal(byStudent.get("student-failed")?.action, "REPEAT");
  assert.deepEqual(byStudent.get("student-failed")?.warnings, ["PASS_THRESHOLD_NOT_MET"]);
  assert.equal(byStudent.get("student-repeat")?.action, "REPEAT");
  assert.equal(byStudent.get("student-repeat")?.toClassId, "grade-4-b");
  assert.equal(byStudent.get("student-transfer")?.action, "MANUAL_TRANSFER");
  assert.equal(byStudent.get("student-transfer")?.toClassName, "Grade 7 A");
  assert.equal(byStudent.get("student-unknown")?.action, "HOLD");
  assert.deepEqual(byStudent.get("student-unknown")?.warnings, ["CLASS_LEVEL_COULD_NOT_BE_PARSED"]);
  assert.equal(byStudent.get("student-missing-average")?.action, "HOLD");
  assert.deepEqual(byStudent.get("student-missing-average")?.warnings, ["PASS_AVERAGE_MISSING"]);
  assert.equal(byStudent.get("student-final")?.action, "GRADUATE");
  assert.equal(byStudent.get("student-final")?.status, "GRADUATED");
  assert.deepEqual(plan.counts, {
    PROMOTE: 1,
    REPEAT: 2,
    MANUAL_TRANSFER: 1,
    HOLD: 2,
    GRADUATE: 1
  });
});
