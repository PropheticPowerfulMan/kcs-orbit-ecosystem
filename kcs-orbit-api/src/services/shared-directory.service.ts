import { prisma } from "../db";

type ExternalIdEntry = {
  appSlug: string;
  externalId: string;
};

export type SharedDirectoryStudent = {
  id: string;
  fullName: string;
  firstName: string;
  lastName: string;
  classId: string | null;
  parentId: string | null;
  organizationId: string | null;
  externalIds: ExternalIdEntry[];
};

export type SharedDirectoryParent = {
  id: string;
  fullName: string;
  organizationId: string | null;
  studentIds: string[];
  externalIds: ExternalIdEntry[];
};

export type SharedDirectoryTeacher = {
  id: string;
  fullName: string;
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
        lastName: true,
        classId: true,
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
        appSlug: true,
        externalId: true,
      },
      orderBy: [{ appSlug: "asc" }, { externalId: "asc" }],
    }),
  ]);

  const studentExternalIds = new Map<string, ExternalIdEntry[]>();
  const parentExternalIds = new Map<string, ExternalIdEntry[]>();
  const teacherExternalIds = new Map<string, ExternalIdEntry[]>();

  for (const student of students) {
    studentExternalIds.set(student.id, []);
  }

  for (const parent of parents) {
    parentExternalIds.set(parent.id, []);
  }

  for (const teacher of teachers) {
    teacherExternalIds.set(teacher.id, []);
  }

  for (const link of externalLinks as Array<{ nexusEntityId: string; appSlug: string; externalId: string; entityType?: string }>) {
    const entry = { appSlug: link.appSlug, externalId: link.externalId };

    if (studentExternalIds.has(link.nexusEntityId)) {
      studentExternalIds.get(link.nexusEntityId)!.push(entry);
    }

    if (parentExternalIds.has(link.nexusEntityId)) {
      parentExternalIds.get(link.nexusEntityId)!.push(entry);
    }

    if (teacherExternalIds.has(link.nexusEntityId)) {
      teacherExternalIds.get(link.nexusEntityId)!.push(entry);
    }
  }

  return {
    source: "orbit",
    visibility: "shared-directory",
    students: students.map((student) => ({
      id: student.id,
      fullName: `${student.firstName} ${student.lastName}`.trim(),
      firstName: student.firstName,
      lastName: student.lastName,
      classId: student.classId,
      parentId: student.parentId,
      organizationId: student.organizationId,
      externalIds: studentExternalIds.get(student.id) || [],
    })),
    parents: parents.map((parent) => ({
      id: parent.id,
      fullName: parent.fullName,
      organizationId: parent.organizationId,
      studentIds: parent.students.map((student) => student.id),
      externalIds: parentExternalIds.get(parent.id) || [],
    })),
    teachers: teachers.map((teacher) => ({
      id: teacher.id,
      fullName: teacher.fullName,
      organizationId: teacher.organizationId,
      externalIds: teacherExternalIds.get(teacher.id) || [],
    })),
  };
}