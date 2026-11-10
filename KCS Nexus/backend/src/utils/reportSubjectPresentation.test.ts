import test from "node:test";
import assert from "node:assert/strict";
import { replaceSubmittedSubjectCorrection } from "./reportSubjectPresentation.js";
test("new grades retain bulletin names but supersede marks and leave other subjects unchanged", () => {
  const subjects = [
    {
      courseId: "math",
      courseName: "Mathematics",
      percentage: 88,
      letterGrade: "B",
    },
    { courseId: "english", percentage: 90 },
  ];
  assert.deepEqual(replaceSubmittedSubjectCorrection(subjects, "math", 72), [
    { courseId: "math", courseName: "Mathematics", percentage: 72 },
    subjects[1],
  ]);
  assert.deepEqual(
    replaceSubmittedSubjectCorrection(
      [{ courseId: "math", percentage: 88 }],
      "math",
      72,
    ),
    [],
  );
  assert.deepEqual(replaceSubmittedSubjectCorrection(subjects, "math", null), [
    subjects[1],
  ]);
});
