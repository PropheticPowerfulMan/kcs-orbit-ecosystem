import { prisma } from "../db";

type ExternalIdEntry = {
  appSlug: string;
  externalId: string;
};

type CanonicalNameParts = {
  firstName: string;
  middleName: string | null;
  lastName: string;
  fullName: string;
};

export type SharedDirectoryStudent = {
  id: string;
  fullName: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  studentNumber: string;
  email: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  status: string | null;
  mustChangePassword: boolean;
  classId: string | null;
  className: string | null;
  parentId: string | null;
  organizationId: string | null;
  externalIds: ExternalIdEntry[];
};

export type SharedDirectoryParent = {
  id: string;
  fullName: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  phone: string | null;
  email: string | null;
  mustChangePassword: boolean;
  organizationId: string | null;
  studentIds: string[];
  externalIds: ExternalIdEntry[];
};

export type SharedDirectoryTeacher = {
  id: string;
  fullName: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  phone: string | null;
  email: string | null;
  subject: string | null;
  employeeId: string | null;
  employeeType: string | null;
  department: string | null;
  jobTitle: string | null;
  mustChangePassword: boolean;
  organizationId: string | null;
  externalIds: ExternalIdEntry[];
};

export type SharedDirectoryPayload = {
  source: "orbit";
  visibility: "shared-directory";
  students: SharedDirectoryStudent[];
  parents: SharedDirectoryParent[];
  teachers: SharedDirectoryTeacher[];
};

function buildWhere(organizationId?: string) {
  return organizationId ? { organizationId } : {};
}

function splitFullName(fullName: string): CanonicalNameParts {
  const normalized = fullName.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return { firstName: "", middleName: null, lastName: "", fullName: "" };
  }

  const parts = normalized.split(" ");
  if (parts.length === 1) {
    return { firstName: parts[0], middleName: null, lastName: "", fullName: normalized };
  }

  if (parts.length === 2) {
    return { firstName: parts[0], middleName: null, lastName: parts[1], fullName: normalized };
  }

  return {
    firstName: parts[0],
    middleName: parts.slice(1, -1).join(" "),
    lastName: parts[parts.length - 1],
    fullName: normalized,
  };
}

function pickPreferredStudentNumber(entityId: string, externalIds: ExternalIdEntry[]) {
  const priority = ["SAVANEX", "KCS_NEXUS", "EDUPAY", "EDUSYNCAI"];

  for (const appSlug of priority) {
    const match = externalIds.find((entry) => entry.appSlug === appSlug);
    if (match) {
      return match.externalId;
    }
  }

  return externalIds[0]?.externalId || entityId;
}

function mapExternalIds(entityIds: string[], links: Array<{ nexusEntityId: string; appSlug: string; externalId: string }>) {
  const lookup = new Map<string, ExternalIdEntry[]>();

  for (const entityId of entityIds) {
    lookup.set(entityId, []);
  }

  for (const link of links) {
    const current = lookup.get(link.nexusEntityId) || [];
    current.push({ appSlug: link.appSlug, externalId: link.externalId });
    lookup.set(link.nexusEntityId, current);
  }

  return lookup;
}

export async function loadSharedDirectory(organizationId?: string): Promise<SharedDirectoryPayload> {
  const where = buildWhere(organizationId);

  const [students, parents, teachers, externalLinks] = await Promise.all([
    prisma.student.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        middleName: true,
        lastName: true,
        studentNumber: true,
        email: true,
        phone: true,
        dateOfBirth: true,
        status: true,
        mustChangePassword: true,
        classId: true,
        className: true,
        class: {
          select: {
            name: true,
          },
        },
        parentId: true,
        organizationId: true,
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.parent.findMany({
      where,
      select: {
        id: true,
        fullName: true,
        firstName: true,
        middleName: true,
        lastName: true,
        phone: true,
        email: true,
        mustChangePassword: true,
        organizationId: true,
        students: {
          select: { id: true },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { fullName: "asc" },
    }),
    prisma.teacher.findMany({
      where,
      select: {
        id: true,
        fullName: true,
        firstName: true,
        middleName: true,
        lastName: true,
        phone: true,
        email: true,
        subject: true,
        employeeId: true,
        employeeType: true,
        department: true,
        jobTitle: true,
        mustChangePassword: true,
        organizationId: true,
      },
      orderBy: { fullName: "asc" },
    }),
    prisma.externalLink.findMany({
      where: {
        ...where,
        entityType: { in: ["student", "parent", "teacher"] },
      },
      select: {
        nexusEntityId: true,
        entityType: true,
        appSlug: true,
        externalId: true,
      },
      orderBy: [{ appSlug: "asc" }, { externalId: "asc" }],
    }),
  ]);

  const typedLinks = externalLinks as Array<{ nexusEntityId: string; entityType: string; appSlug: string; externalId: string }>;
  const studentExternalIds = mapExternalIds(students.map((student) => student.id), typedLinks.filter((link) => link.entityType === "student"));
  const parentExternalIds = mapExternalIds(parents.map((parent) => parent.id), typedLinks.filter((link) => link.entityType === "parent"));
  const teacherExternalIds = mapExternalIds(teachers.map((teacher) => teacher.id), typedLinks.filter((link) => link.entityType === "teacher"));

  return {
    source: "orbit",
    visibility: "shared-directory",
    students: students.map((student) => {
      const externalIds = studentExternalIds.get(student.id) || [];
      return {
        id: student.id,
        fullName: `${student.firstName} ${student.lastName}`.trim(),
        firstName: student.firstName,
        middleName: student.middleName,
        lastName: student.lastName,
        studentNumber: student.studentNumber || pickPreferredStudentNumber(student.id, externalIds),
        email: student.email,
        phone: student.phone,
        dateOfBirth: student.dateOfBirth?.toISOString() ?? null,
        status: student.status,
        mustChangePassword: student.mustChangePassword,
        classId: student.classId,
        className: student.class?.name || student.className || student.classId || null,
        parentId: student.parentId,
        organizationId: student.organizationId,
        externalIds,
      };
    }),
    parents: parents.map((parent) => {
      const parts = splitFullName(parent.fullName);
      const firstName = parent.firstName || parts.firstName;
      const middleName = parent.middleName || parts.middleName;
      const lastName = parent.lastName || parts.lastName;
      return {
        id: parent.id,
        fullName: parent.fullName || `${firstName} ${lastName}`.trim(),
        firstName,
        middleName,
        lastName,
        phone: parent.phone,
        email: parent.email,
        mustChangePassword: parent.mustChangePassword,
        organizationId: parent.organizationId,
        studentIds: parent.students.map((student) => student.id),
        externalIds: parentExternalIds.get(parent.id) || [],
      };
    }),
    teachers: teachers.map((teacher) => {
      const parts = splitFullName(teacher.fullName);
      const firstName = teacher.firstName || parts.firstName;
      const middleName = teacher.middleName || parts.middleName;
      const lastName = teacher.lastName || parts.lastName;
      return {
        id: teacher.id,
        fullName: teacher.fullName || `${firstName} ${lastName}`.trim(),
        firstName,
        middleName,
        lastName,
        phone: teacher.phone,
        email: teacher.email,
        subject: teacher.subject,
        employeeId: teacher.employeeId,
        employeeType: teacher.employeeType,
        department: teacher.department,
        jobTitle: teacher.jobTitle,
        mustChangePassword: teacher.mustChangePassword,
        organizationId: teacher.organizationId,
        externalIds: teacherExternalIds.get(teacher.id) || [],
      };
    }),
  };
}
