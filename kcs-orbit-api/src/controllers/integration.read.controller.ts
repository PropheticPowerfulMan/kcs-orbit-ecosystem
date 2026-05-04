import { Request, Response } from "express";
import { prisma } from "../db";

export async function readKcsNexusFamilies(req: Request, res: Response) {
  const organizationId = String(req.query.organizationId || "").trim();

  if (!organizationId) {
    return res.status(400).json({ message: "organizationId is required" });
  }

  const students = await prisma.student.findMany({
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
  });

  const families = students.map((student) => ({
    id: student.id,
    studentNumber: student.id,
    grade: student.class?.gradeLevel || "Unassigned",
    section: student.class?.name || "-",
    status: "ACTIVE",
    student: {
      firstName: student.firstName,
      lastName: student.lastName,
      email: student.parent?.email || undefined,
    },
    parents: student.parent
      ? [{
        relation: "Parent",
        parent: {
          firstName: student.parent.fullName.split(" ").slice(0, -1).join(" ") || student.parent.fullName,
          lastName: student.parent.fullName.split(" ").slice(-1).join(" "),
          email: student.parent.email,
          phone: student.parent.phone,
        },
      }]
      : [],
  }));

  return res.json({ families, source: "orbit" });
}