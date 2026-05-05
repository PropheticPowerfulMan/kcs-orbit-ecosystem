import { Request, Response } from "express";
import { prisma } from "../db";

function splitFullName(fullName: string) {
  const trimmed = fullName.trim();
  if (!trimmed) {
    return { firstName: "", lastName: "" };
  }

  const parts = trimmed.split(/\s+/);
  return {
    firstName: parts.slice(0, -1).join(" ") || trimmed,
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

  const [students, externalLinks] = await Promise.all([
    prisma.student.findMany({
      where: { organizationId },
      include: {
        class: true,
        parent: true,
      },
      orderBy: [
        { class: { gradeLevel: "asc" } },
        { lastName: "asc" },
        { firstName: "asc" },
      ],
    }),
    prisma.externalLink.findMany({
      where: {
        organizationId,
        appSlug: "SAVANEX",
        entityType: { in: ["student", "parent"] },
      },
    }),
  ]);

  const studentExternalIds = new Map(
    externalLinks
      .filter((link) => link.entityType === "student")
      .map((link) => [link.nexusEntityId, link.externalId])
  );

  const parentExternalIds = new Map(
    externalLinks
      .filter((link) => link.entityType === "parent")
      .map((link) => [link.nexusEntityId, link.externalId])
  );

  const familiesMap = new Map<string, {
    id: string;
    familyLabel: string;
    parents: Array<{
      id: string;
      externalId?: string;
      relation: string;
      parent: { firstName: string; lastName: string; fullName: string; email?: string | null; phone?: string | null };
    }>;
    children: Array<{
      id: string;
      externalId?: string;
      studentNumber: string;
      grade: string;
      section: string;
      status: string;
      student: { firstName: string; lastName: string; fullName: string };
    }>;
  }>();

  for (const student of students) {
    const familyKey = student.parentId || `student:${student.id}`;
    const existingFamily = familiesMap.get(familyKey);

    if (!existingFamily) {
      const parentName = student.parent?.fullName;
      const splitParentName = parentName ? splitFullName(parentName) : null;

      familiesMap.set(familyKey, {
        id: student.parentId || student.id,
        familyLabel: buildFamilyLabel(parentName, student.lastName),
        parents: student.parent
          ? [{
            id: student.parent.id,
            externalId: parentExternalIds.get(student.parent.id),
            relation: "Parent",
            parent: {
              firstName: splitParentName?.firstName || student.parent.fullName,
              lastName: splitParentName?.lastName || "",
              fullName: student.parent.fullName,
              email: student.parent.email,
              phone: student.parent.phone,
            },
          }]
          : [],
        children: [],
      });
    }

    familiesMap.get(familyKey)!.children.push({
      id: student.id,
      externalId: studentExternalIds.get(student.id),
      studentNumber: studentExternalIds.get(student.id) || student.id,
      grade: student.class?.gradeLevel || "Unassigned",
      section: student.class?.name || "-",
      status: "ACTIVE",
      student: {
        firstName: student.firstName,
        lastName: student.lastName,
        fullName: `${student.firstName} ${student.lastName}`.trim(),
      },
    });
  }

  const families = Array.from(familiesMap.values())
    .map((family) => ({
      ...family,
      studentCount: family.children.length,
    }))
    .sort((left, right) => left.familyLabel.localeCompare(right.familyLabel));

  return res.json({ families, source: "orbit" });
}