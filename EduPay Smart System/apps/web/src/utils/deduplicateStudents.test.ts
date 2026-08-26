import { describe, expect, it } from "vitest";
import { deduplicateStudents } from "./deduplicateStudents";

describe("deduplicateStudents", () => {
  it("removes duplicate local student identifiers", () => {
    const students = [
      { id: "student-1", fullName: "Ada K." },
      { id: "student-1", fullName: "Ada K." }
    ];

    expect(deduplicateStudents(students)).toEqual([students[0]]);
  });

  it("removes mirrored records that share an external student identifier", () => {
    const students = [
      { id: "local-1", externalStudentId: "STU-KCS-001", fullName: "Ada K." },
      { id: "local-2", externalStudentId: "stu-kcs-001", fullName: "Ada K." }
    ];

    expect(deduplicateStudents(students)).toEqual([students[0]]);
  });

  it("keeps distinct siblings", () => {
    const students = [
      { id: "student-1", externalStudentId: "STU-001", fullName: "Ada K." },
      { id: "student-2", externalStudentId: "STU-002", fullName: "Grace K." }
    ];

    expect(deduplicateStudents(students)).toEqual(students);
  });
});