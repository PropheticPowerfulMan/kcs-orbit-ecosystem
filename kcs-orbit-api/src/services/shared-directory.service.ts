import { prisma } from "../db";
import { pickPreferredExternalId } from "@ecosystem/shared-contracts";

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

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function buildFullName(...parts: Array<unknown>) {
  return parts.map((part) => normalizeText(part)).filter(Boolean).join(" ");
}

export type SharedDirectoryStudent = {
  id: string;
  displayId: string;
  fullName: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  accessCode: string | null;
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
  displayId: string;
  fullName: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  accessCode: string | null;
  phone: string | null;
  email: string | null;
  mustChangePassword: boolean;
  organizationId: string | null;
  studentIds: string[];
  externalIds: ExternalIdEntry[];
};

export type SharedDirectoryTeacher = {
  id: string;
  displayId: string;
  fullName: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  accessCode: string | null;
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

export type SharedDirectoryFamily = {
  id: string;
  displayId: string;
  familyLabel: string;
  parentIds: string[];
  studentIds: string[];
  organizationId: string | null;
  externalIds: ExternalIdEntry[];
};

export type SharedDirectoryPayload = {
  source: "orbit";
  visibility: "shared-directory";
  counts: {
    families: number;
    parents: number;
    students: number;
    teachers: number;
  };
  families: SharedDirectoryFamily[];
  students: SharedDirectoryStudent[];
  parents: SharedDirectoryParent[];
  teachers: SharedDirectoryTeacher[];
};

function buildWhere(organizationId?: string) {
  return organizationId ? { organizationId } : {};
}

function splitFullName(fullName: string | null | undefined): CanonicalNameParts {
  const normalized = normalizeText(fullName).replace(/\s+/g, " ");
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

function mapExternalIds(entityIds: string[], links: Array<{ nexusEntityId: string; appSlug: string; externalId: string }>) {
  const lookup = new Map<string, ExternalIdEntry[]>();

  for (const entityId of entityIds) {
    lookup.set(entityId, []);
  }

  for (const link of links) {
    const externalId = normalizeText(link.externalId);
    if (!externalId) {
      continue;
    }

    const current = lookup.get(link.nexusEntityId) || [];
    current.push({ appSlug: link.appSlug, externalId });
    lookup.set(link.nexusEntityId, current);
  }

  return lookup;
}

function pickEntityDisplayId(
  externalIds: ExternalIdEntry[],
  entityType: "family" | "parent" | "student" | "teacher",
  fallback: string,
) {
  const entityCode = entityType === "family" ? "FAM" : entityType === "parent" ? "PAR" : entityType === "student" ? "STU" : "TEA";
  const roleBasedId = externalIds.find((entry) => new RegExp(`(^|-)${entityCode}(-|$)`, "i").test(normalizeText(entry.externalId)));
  if (roleBasedId) {
    return normalizeText(roleBasedId.externalId);
  }

  return pickPreferredExternalId(externalIds, normalizeText(fallback) || "UNKNOWN");
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
        accessCode: true,
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
        accessCode: true,
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
        accessCode: true,
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
        entityType: { in: ["family", "student", "parent", "teacher"] },
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
  const familyExternalIds = mapExternalIds(parents.map((parent) => parent.id), typedLinks.filter((link) => link.entityType === "family"));

  const families = parents.map((parent) => {
    const externalIds = familyExternalIds.get(parent.id) || [];
    const parts = splitFullName(parent.fullName);
    const familyName = normalizeText(parts.lastName) || normalizeText(parent.lastName) || normalizeText(parent.fullName) || parent.id;
    return {
      id: parent.id,
      displayId: pickEntityDisplayId(externalIds, "family", parent.id),
      familyLabel: `${familyName} Family`,
      parentIds: [parent.id],
      studentIds: parent.students.map((student) => student.id),
      organizationId: parent.organizationId,
      externalIds,
    };
  });

  return {
    source: "orbit",
    visibility: "shared-directory",
    counts: {
      families: families.length,
      parents: parents.length,
      students: students.length,
      teachers: teachers.length,
    },
    families,
    students: students.map((student) => {
      const externalIds = studentExternalIds.get(student.id) || [];
      const displayId = pickEntityDisplayId(externalIds, "student", student.studentNumber || student.id);
      const fullName = buildFullName(student.firstName, student.lastName) || displayId;
      return {
        id: student.id,
        displayId,
        fullName,
        firstName: normalizeText(student.firstName),
        middleName: student.middleName,
        lastName: normalizeText(student.lastName),
        accessCode: student.accessCode,
        studentNumber: student.studentNumber || displayId,
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
      const externalIds = parentExternalIds.get(parent.id) || [];
      const parts = splitFullName(parent.fullName);
      const firstName = normalizeText(parent.firstName) || parts.firstName;
      const middleName = normalizeText(parent.middleName) || parts.middleName;
      const lastName = normalizeText(parent.lastName) || parts.lastName;
      return {
        id: parent.id,
        displayId: pickEntityDisplayId(externalIds, "parent", parent.id),
        fullName: normalizeText(parent.fullName) || buildFullName(firstName, middleName, lastName) || parent.id,
        firstName,
        middleName,
        lastName,
        accessCode: parent.accessCode,
        phone: parent.phone,
        email: parent.email,
        mustChangePassword: parent.mustChangePassword,
        organizationId: parent.organizationId,
        studentIds: parent.students.map((student) => student.id),
        externalIds,
      };
    }),
    teachers: teachers.map((teacher) => {
      const externalIds = teacherExternalIds.get(teacher.id) || [];
      const parts = splitFullName(teacher.fullName);
      const firstName = normalizeText(teacher.firstName) || parts.firstName;
      const middleName = normalizeText(teacher.middleName) || parts.middleName;
      const lastName = normalizeText(teacher.lastName) || parts.lastName;
      return {
        id: teacher.id,
        displayId: pickEntityDisplayId(externalIds, "teacher", teacher.employeeId || teacher.id),
        fullName: normalizeText(teacher.fullName) || buildFullName(firstName, middleName, lastName) || teacher.id,
        firstName,
        middleName,
        lastName,
        accessCode: teacher.accessCode,
        phone: teacher.phone,
        email: teacher.email,
        subject: teacher.subject,
        employeeId: teacher.employeeId,
        employeeType: teacher.employeeType,
        department: teacher.department,
        jobTitle: teacher.jobTitle,
        mustChangePassword: teacher.mustChangePassword,
        organizationId: teacher.organizationId,
        externalIds,
      };
    }),
  };
}
