import assert from "node:assert/strict";
import test from "node:test";
import { allocateElectives } from "./electiveAllocation.js";

const offering = (id: string, capacity = 24, grade = "Grade 11") => ({
  id,
  code: id,
  capacity,
  eligibleGrades: [grade],
});
test("elective allocation preserves ranked choices, six distinct courses and capacity limits", () => {
  const offerings = Array.from({ length: 6 }, (_, i) =>
    offering("course-" + i),
  );
  const students = [
    { id: "a", grade: "Grade 11" },
    { id: "b", grade: "Grade 11" },
  ];
  const choices = students.flatMap((student) =>
    offerings.map((course, index) => ({
      studentProfileId: student.id,
      offeringId: course.id,
      rank: index + 1,
    })),
  );
  const result = allocateElectives("cycle", offerings, choices, students, 6);
  assert.equal(result.rows.length, 12);
  assert.deepEqual(result.incomplete, []);
  for (const student of students)
    assert.equal(
      new Set(
        result.rows
          .filter((row) => row.studentProfileId === student.id)
          .map((row) => row.offeringId),
      ).size,
      6,
    );
  assert.ok(
    Object.values(result.remainingCapacity).every((value) => value >= 0),
  );
});
test("removed and ineligible learners cannot consume another learner’s place", () => {
  const result = allocateElectives(
    "cycle",
    [offering("course", 1)],
    [
      { studentProfileId: "removed", offeringId: "course", rank: 1 },
      { studentProfileId: "wrong-grade", offeringId: "course", rank: 1 },
      { studentProfileId: "eligible", offeringId: "course", rank: 1 },
    ],
    [
      { id: "wrong-grade", grade: "Grade 12" },
      { id: "eligible", grade: "Grade 11" },
    ],
    1,
  );
  assert.deepEqual(
    result.rows.map((row) => row.studentProfileId),
    ["eligible"],
  );
});
test("allocation is deterministic and offers an eligible fallback when a preference is full", () => {
  const offerings = [offering("preferred", 1), offering("fallback", 1)];
  const students = [
    { id: "a", grade: "Grade 11" },
    { id: "b", grade: "Grade 11" },
  ];
  const choices = students.map((student) => ({
    studentProfileId: student.id,
    offeringId: "preferred",
    rank: 1,
  }));
  const result = allocateElectives("cycle", offerings, choices, students, 1);
  assert.deepEqual(
    result,
    allocateElectives(
      "cycle",
      offerings,
      [...choices].reverse(),
      [...students].reverse(),
      1,
    ),
  );
  assert.equal(result.rows.length, 2);
  assert.equal(result.fallbacks, 1);
  assert.deepEqual(result.incomplete, []);
});
