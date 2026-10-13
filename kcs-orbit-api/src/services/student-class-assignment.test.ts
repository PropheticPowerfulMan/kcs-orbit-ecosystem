import assert from "node:assert/strict";
import test from "node:test";
import {
  buildStudentClassUpdate,
  normalizeClassKey,
  resolveSharedStudentClassName,
} from "./student-class-assignment";

test("an explicit class name replaces a stale relational class", () => {
  assert.deepEqual(
    buildStudentClassUpdate(
      { className: "  Grade 11  " },
      { id: "grade-11", name: "Grade 11" },
    ),
    { className: "Grade 11", classId: "grade-11" },
  );
});

test("an unmatched explicit class clears the stale class relation", () => {
  assert.deepEqual(
    buildStudentClassUpdate({ className: "Grade 9 C" }, null),
    { className: "Grade 9 C", classId: null },
  );
});

test("a selected class id also refreshes the legacy class-name snapshot", () => {
  assert.deepEqual(
    buildStudentClassUpdate(
      { classOrbitId: "grade-9-b" },
      { id: "grade-9-b", name: "Grade 9 B" },
    ),
    { classId: "grade-9-b", className: "Grade 9 B" },
  );
});

test("clearing the class clears both fields when the name is explicit", () => {
  assert.deepEqual(
    buildStudentClassUpdate({ className: null, classOrbitId: null }, null),
    { classId: null, className: null },
  );
});

test("the shared directory never lets a stale relation shadow an explicit class", () => {
  assert.equal(
    resolveSharedStudentClassName({
      className: "Grade 11",
      relatedClassName: "Grade 1",
      classId: "old-grade-1",
    }),
    "Grade 11",
  );
});

test("class matching is whitespace and case insensitive", () => {
  assert.equal(normalizeClassKey(" Grade   9 b "), normalizeClassKey("grade 9 B"));
});
