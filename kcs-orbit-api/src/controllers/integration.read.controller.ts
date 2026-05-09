import { Request, Response } from "express";
import { prisma } from "../db";
import { loadSharedDirectory } from "../services/shared-directory.service";

function splitFullName(fullName: string) {
  const trimmed = fullName.trim();
  if (!trimmed) {
    return { firstName: "", middleName: null as string | null, lastName: "" };
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], middleName: null as string | null, lastName: "" };
  }

  if (parts.length === 2) {
    return { firstName: parts[0], middleName: null as string | null, lastName: parts[1] };
  }

  return {
    firstName: parts[0],
    middleName: parts.slice(1, -1).join(" "),
    lastName: parts.slice(-1).join(" "),
  };
}

function buildFamilyLabel(parentFullName: string | null | undefined, studentLastName: string) {
  if (parentFullName?.trim()) {
    const { lastName } = splitFullName(parentFullName);
    return `${lastName || parentFullName} Family`;
  }

  return `${studentLastName} Family`;
}

export async function readKcsNexusFamilies(req: Request, res: Response) {
  const organizationId = String(req.query.organizationId || "").trim();

  if (!organizationId) {
    return res.status(400).json({ message: "organizationId is required" });
  }

  const directory = await loadSharedDirectory(organizationId);
  const parentsById = new Map(directory.parents.map((parent) => [parent.id, parent]));
  const studentsById = new Map(directory.students.map((student) => [student.id, student]));

  const families = directory.families.map((family) => {
    const parents = family.parentIds
      .map((parentId) => parentsById.get(parentId))
      .filter((parent): parent is NonNullable<typeof parent> => Boolean(parent))
      .map((parent) => ({
        id: parent.id,
        externalId: parent.displayId,
        relation: "Parent",
        parent: {
          firstName: parent.firstName,
          middleName: parent.middleName,
          lastName: parent.lastName,
          fullName: parent.fullName,
          email: parent.email,
          phone: parent.phone,
        },
      }));

    const children = family.studentIds
      .map((studentId) => studentsById.get(studentId))
      .filter((student): student is NonNullable<typeof student> => Boolean(student))
      .map((student) => ({
        id: student.id,
        externalId: student.displayId,
        studentNumber: student.studentNumber || student.displayId,
        grade: student.className || "Unassigned",
        section: student.className || "-",
        status: student.status || "ACTIVE",
        student: {
          firstName: student.firstName,
          middleName: student.middleName,
          lastName: student.lastName,
          fullName: student.fullName,
        },
      }));

    return {
      id: family.id,
      familyLabel: family.familyLabel,
      parents,
      children,
    };
  })
    .map((family) => ({
      ...family,
      studentCount: family.children.length,
    }))
    .sort((left, right) => left.familyLabel.localeCompare(right.familyLabel));

  return res.json({ families, source: "orbit" });
}

export async function readSharedDirectory(req: Request, res: Response) {
  const organizationId = String(req.query.organizationId || "").trim();

  if (!organizationId) {
    return res.status(400).json({ message: "organizationId is required" });
  }

  const directory = await loadSharedDirectory(organizationId);
  return res.json(directory);
}
