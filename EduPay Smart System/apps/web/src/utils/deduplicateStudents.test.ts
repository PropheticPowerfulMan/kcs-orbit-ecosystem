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
  it("removes mirrored records with different identifiers but the same child name and class", () => {
    const students = [
      { id: "local-1", externalStudentId: "STU-001", fullName: "Élodie K.", className: "6e A" },
      { id: "local-2", externalStudentId: "STU-999", fullName: "elodie k.", className: " 6E A " }
    ];

    expect(deduplicateStudents(students)).toEqual([students[0]]);
  });

  it("keeps children with the same name when their classes differ", () => {
    const students = [
      { id: "student-1", fullName: "Chris K.", className: "5e A" },
      { id: "student-2", fullName: "Chris K.", className: "6e A" }
    ];

    expect(deduplicateStudents(students)).toEqual(students);
  });
});
