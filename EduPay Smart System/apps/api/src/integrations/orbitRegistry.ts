import { prisma } from "../prisma";

type OrbitSharedDirectory = {
  source: "orbit";
  visibility: "shared-directory";
  counts?: {
    families: number;
    parents: number;
    students: number;
    teachers: number;
  };
  families?: Array<{
    id: string;
    displayId?: string;
    familyLabel: string;
    parentIds: string[];
    studentIds: string[];
    organizationId?: string | null;
    externalIds: Array<{ appSlug: string; externalId: string }>;
  }>;
  parents: Array<{
    id: string;
    displayId?: string;
    fullName: string;
    firstName?: string;
    middleName?: string | null;
    lastName?: string;
    organizationId?: string | null;
    phone?: string | null;
    email?: string | null;
    physicalAddress?: string | null;
    accessCode?: string | null;
    mustChangePassword?: boolean;
    studentIds: string[];
    externalIds: Array<{ appSlug: string; externalId: string }>;
  }>;
  students: Array<{
    id: string;
    displayId?: string;
    fullName: string;
    firstName?: string;
    middleName?: string | null;
    lastName?: string;
    studentNumber?: string;
    email?: string | null;
    phone?: string | null;
    accessCode?: string | null;
    dateOfBirth?: string | null;
    status?: string | null;
    mustChangePassword?: boolean;
    classId?: string | null;
    className?: string | null;
    parentId?: string | null;
    organizationId?: string | null;
    externalIds: Array<{ appSlug: string; externalId: string }>;
  }>;
  teachers: Array<{
    id: string;
    fullName: string;
    firstName?: string;
    middleName?: string | null;
    lastName?: string;
    phone?: string | null;
    email?: string | null;
    physicalAddress?: string | null;
    accessCode?: string | null;
    subject?: string | null;
    employeeId?: string | null;
    employeeType?: string | null;
    department?: string | null;
    jobTitle?: string | null;
    mustChangePassword?: boolean;
    organizationId?: string | null;
    externalIds: Array<{ appSlug: string; externalId: string }>;
  }>;
};

export type SharedStudentOption = {
  id: string;
  localId?: string;
  orbitId?: string;
  displayId?: string;
  externalStudentId?: string;
  studentNumber?: string;
  email?: string | null;
  phone?: string | null;
  accessCode?: string | null;
  dateOfBirth?: string | null;
  status?: string | null;
  mustChangePassword?: boolean;
  fullName: string;
  classId: string;
  className: string;
  annualFee: number;
};

export type SharedParentOption = {
  id: string;
  localId?: string;
  orbitId?: string;
  displayId?: string;
  createdAt?: Date;
  accessCode?: string | null;
  mustChangePassword?: boolean;
  fullName: string;
  phone: string;
  email: string;
  physicalAddress?: string | null;
  students: SharedStudentOption[];
};

export type SharedTeacherOption = {
  id: string;
  orbitId: string;
  displayId: string;
  fullName: string;
  firstName?: string;
  middleName?: string | null;
  lastName?: string;
  phone?: string | null;
  email?: string | null;
  physicalAddress?: string | null;
  accessCode?: string | null;
  subject?: string | null;
  employeeId?: string | null;
  employeeType?: string | null;
  department?: string | null;
  jobTitle?: string | null;
  mustChangePassword?: boolean;
  organizationId?: string | null;
  externalIds: Array<{ appSlug: string; externalId: string }>;
};

export function orbitRegistryIsEnabled() {
  return Boolean(process.env.KCS_ORBIT_API_URL && process.env.KCS_ORBIT_API_KEY && process.env.KCS_ORBIT_ORGANIZATION_ID);
}

export function matchesSharedParentIdentifier(parent: SharedParentOption, identifier: string) {
  const normalizedIdentifier = identifier.trim();
  return parent.id === normalizedIdentifier
    || parent.localId === normalizedIdentifier
    || parent.displayId === normalizedIdentifier
    || parent.orbitId === normalizedIdentifier;
}

function buildParentLookupKey(parent: { fullName: string; email?: string; phone?: string }) {
  if (parent.email?.trim()) {
    return `email:${parent.email.trim().toLowerCase()}`;
  }

  if (parent.phone?.trim()) {
    return `phone:${parent.phone.trim()}`;
  }

  return `name:${parent.fullName.trim().toLowerCase()}`;
}

function pickSharedStudentId(student: OrbitSharedDirectory["students"][number]) {
  if (student.displayId?.trim()) return student.displayId.trim();

  const priority = ["SAVANEX", "KCS_NEXUS", "EDUSYNCAI", "EDUPAY"];
  for (const appSlug of priority) {
    const match = student.externalIds.find((item) => item.appSlug === appSlug)?.externalId;
    if (match?.trim()) return match.trim();
  }

  return student.studentNumber?.trim() || student.id;
}

function pickSharedTeacherId(teacher: OrbitSharedDirectory["teachers"][number]) {
  const priority = ["SAVANEX", "KCS_NEXUS", "EDUSYNCAI", "EDUPAY"];
  for (const appSlug of priority) {
    const match = teacher.externalIds.find((item) => item.appSlug === appSlug)?.externalId;
    if (match?.trim()) return match.trim();
  }

  return teacher.employeeId?.trim() || teacher.id;
}

export function mapOrbitDirectoryToSharedOptions(directory: OrbitSharedDirectory) {
  const classNames = new Set<string>();
  const studentsById = new Map(directory.students.map((student) => [student.id, student]));

  const parents = directory.parents.map((parent) => {
    const students = parent.studentIds
      .map((studentId) => studentsById.get(studentId))
      .filter((student): student is OrbitSharedDirectory["students"][number] => Boolean(student))
      .map((student) => {
        const className = student.className || student.classId || "Classe non renseignee";
        classNames.add(className);
        const displayId = pickSharedStudentId(student);
        return {
          id: student.id,
          orbitId: student.id,
          displayId,
          externalStudentId: displayId,
          studentNumber: student.studentNumber,
          email: student.email,
          phone: student.phone,
          accessCode: student.accessCode,
          dateOfBirth: student.dateOfBirth,
          status: student.status,
          mustChangePassword: student.mustChangePassword,
          fullName: student.fullName,
          classId: className,
          className,
          annualFee: 0,
        };
      });

    const displayId = parent.displayId || parent.externalIds.find((item) => item.externalId)?.externalId || parent.id;

    return {
      id: displayId,
      orbitId: parent.id,
      displayId,
      accessCode: parent.accessCode,
      mustChangePassword: parent.mustChangePassword,
      lookupKey: buildParentLookupKey({
        fullName: parent.fullName,
        email: parent.email || undefined,
        phone: parent.phone || undefined,
      }),
      fullName: parent.fullName,
      phone: parent.phone || "",
      email: parent.email || "",
      physicalAddress: parent.physicalAddress || "",
      students,
    };
  });

  const students = directory.students.map((student) => {
    const className = student.className || student.classId || "Classe non renseignee";
    classNames.add(className);
    const displayId = pickSharedStudentId(student);
    return {
      id: student.id,
      orbitId: student.id,
      displayId,
      externalStudentId: displayId,
      studentNumber: student.studentNumber,
      email: student.email,
      phone: student.phone,
      accessCode: student.accessCode,
      dateOfBirth: student.dateOfBirth,
      status: student.status,
      mustChangePassword: student.mustChangePassword,
      fullName: student.fullName,
      classId: className,
      className,
      annualFee: 0,
    };
  });

  const classes = Array.from(classNames).sort((left, right) => left.localeCompare(right));
  const teachers = directory.teachers.map((teacher) => ({
    id: teacher.id,
    orbitId: teacher.id,
    displayId: pickSharedTeacherId(teacher),
    fullName: teacher.fullName,
    firstName: teacher.firstName,
    middleName: teacher.middleName,
    lastName: teacher.lastName,
    phone: teacher.phone,
    email: teacher.email,
    physicalAddress: teacher.physicalAddress,
    accessCode: teacher.accessCode,
    subject: teacher.subject,
    employeeId: teacher.employeeId,
    employeeType: teacher.employeeType,
    department: teacher.department,
    jobTitle: teacher.jobTitle,
    mustChangePassword: teacher.mustChangePassword,
    organizationId: teacher.organizationId,
    externalIds: teacher.externalIds,
  }));

  return {
    parents,
    students,
    classes,
    teachers,
    counts: directory.counts ?? {
      families: directory.families?.length ?? parents.length,
      parents: directory.parents.length,
      students: directory.students.length,
      teachers: directory.teachers.length,
    },
  };
}

export async function fetchOrbitSharedDirectory(): Promise<OrbitSharedDirectory> {
  const baseUrl = (process.env.KCS_ORBIT_API_URL || "").replace(/\/$/, "");
  const organizationId = process.env.KCS_ORBIT_ORGANIZATION_ID || "";
  const apiKey = process.env.KCS_ORBIT_API_KEY || "";

  const response = await fetch(
    `${baseUrl}/api/integration/read/shared-directory?organizationId=${encodeURIComponent(organizationId)}`,
    {
      headers: {
        "x-api-key": apiKey,
        "x-app-slug": "EDUPAY",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Orbit registry request failed with status ${response.status}`);
  }

  return response.json() as Promise<OrbitSharedDirectory>;
}


export async function readOrbitSharedOptions(): Promise<ReturnType<typeof mapOrbitDirectoryToSharedOptions>> {
  let directory: OrbitSharedDirectory;
  try {
    directory = await fetchOrbitSharedDirectory();
  } catch (error) {
    console.error('Orbit registry temporarily unavailable; continuing with an empty mirror.', error);
    return {
      parents: [],
      students: [],
      classes: [],
      teachers: [],
      counts: { families: 0, parents: 0, students: 0, teachers: 0 },
    } as ReturnType<typeof mapOrbitDirectoryToSharedOptions>;
  }
  return mapOrbitDirectoryToSharedOptions(directory);
}async function orbitRegistryRequest<T>(path: string, init: RequestInit): Promise<T> {
  const baseUrl = (process.env.KCS_ORBIT_API_URL || "").replace(/\/$/, "");
  const organizationId = process.env.KCS_ORBIT_ORGANIZATION_ID || "";
  const apiKey = process.env.KCS_ORBIT_API_KEY || "";
  const separator = path.includes("?") ? "&" : "?";
  const response = await fetch(`${baseUrl}${path}${separator}organizationId=${encodeURIComponent(organizationId)}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "x-app-slug": "EDUPAY",
      ...(init.headers || {}),
    },
  });
  const data = await response.json().catch(() => null) as T & { message?: string };
  if (response.status === 409 && data && typeof (data as { orbitId?: unknown }).orbitId === "string") {
    return data as T;
  }
  if (!response.ok) {
    throw new Error(data?.message || `Orbit registry request failed with status ${response.status}`);
  }
  return data as T;
}

export async function createOrbitParent(payload: {
  fullName: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  physicalAddress?: string;
  accessCode?: string;
  mustChangePassword?: boolean;
  students?: Array<{ fullName: string; className?: string; accessCode?: string; studentNumber?: string; mustChangePassword?: boolean }>;
}) {
  const organizationId = process.env.KCS_ORBIT_ORGANIZATION_ID || "";
  const students = payload.students || [];
  if (students.length > 0) {
    const parentNameParts = payload.fullName.trim().split(/\s+/);
    return orbitRegistryRequest<{ orbitId: string; parentExternalId: string; externalId: string }>("/api/integration/registry/family", {
      method: "POST",
      body: JSON.stringify({
        organizationId,
        parent: {
          fullName: payload.fullName,
          firstName: payload.firstName || parentNameParts[parentNameParts.length - 1] || "Parent",
          middleName: payload.middleName || (parentNameParts.length > 2 ? parentNameParts.slice(1, -1).join(" ") : undefined),
          lastName: payload.lastName || parentNameParts[0] || "Parent",
          email: payload.email,
          phone: payload.phone,
          physicalAddress: payload.physicalAddress,
          accessCode: payload.accessCode,
          mustChangePassword: payload.mustChangePassword ?? true,
        },
        students: students.map((student) => {
          const nameParts = student.fullName.trim().split(/\s+/);
          return {
            firstName: nameParts[nameParts.length - 1] || "Student",
            middleName: nameParts.length > 2 ? nameParts.slice(1, -1).join(" ") : undefined,
            lastName: nameParts[0] || "Student",
            gender: "O",
            className: student.className || "Non renseignee",
            accessCode: student.accessCode,
            studentNumber: student.studentNumber,
            mustChangePassword: student.mustChangePassword ?? true,
          };
        }),
      }),
    });
  }

  return orbitRegistryRequest<{ orbitId: string; externalId: string }>("/api/integration/registry/parent", {
    method: "POST",
    body: JSON.stringify({
      organizationId,
      fullName: payload.fullName,
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
      phone: payload.phone,
      physicalAddress: payload.physicalAddress,
      accessCode: payload.accessCode,
      mustChangePassword: payload.mustChangePassword ?? true,
    }),
  });
}

export async function updateOrbitParent(identifier: string, payload: { fullName?: string; firstName?: string; lastName?: string; email?: string; phone?: string; physicalAddress?: string | null }) {
  return orbitRegistryRequest<{ orbitId: string; updated: boolean }>(`/api/integration/registry/parent/${encodeURIComponent(identifier)}?identifierType=orbitId`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function updateOrbitTeacher(identifier: string, payload: {
  fullName?: string;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  physicalAddress?: string | null;
  accessCode?: string | null;
  subject?: string | null;
  employeeType?: string | null;
  department?: string | null;
  jobTitle?: string | null;
  mustChangePassword?: boolean;
}) {
  return orbitRegistryRequest<{ orbitId: string; updated: boolean }>(`/api/integration/registry/teacher/${encodeURIComponent(identifier)}?identifierType=orbitId`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function updateOrbitStudent(identifier: string, payload: {
  fullName?: string;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  dateOfBirth?: Date | string | null;
  gender?: string | null;
  className?: string | null;
  studentNumber?: string | null;
  mustChangePassword?: boolean;
}) {
  return orbitRegistryRequest<{ orbitId: string; updated: boolean }>(`/api/integration/registry/student/${encodeURIComponent(identifier)}?identifierType=orbitId`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function createOrbitStudent(payload: {
  fullName: string;
  parentOrbitId: string;
  className?: string;
  gender?: string | null;
  studentNumber?: string;
  email?: string | null;
}) {
  const organizationId = process.env.KCS_ORBIT_ORGANIZATION_ID || "";
  const nameParts = payload.fullName.trim().split(/\s+/);
  return orbitRegistryRequest<{ orbitId: string; externalId: string }>("/api/integration/registry/student", {
    method: "POST",
    body: JSON.stringify({
      organizationId,
      firstName: nameParts[nameParts.length - 1] || "Student",
      middleName: nameParts.length > 2 ? nameParts.slice(1, -1).join(" ") : undefined,
      lastName: nameParts[0] || "Student",
      gender: payload.gender || "O",
      className: payload.className || "Non renseignee",
      studentNumber: payload.studentNumber,
      email: payload.email || undefined,
      parentOrbitId: payload.parentOrbitId,
      mustChangePassword: true,
    }),
  });
}

export async function deleteOrbitStudent(identifier: string) {
  return orbitRegistryRequest<{ orbitId: string; deleted: boolean }>(`/api/integration/registry/student/${encodeURIComponent(identifier)}?identifierType=orbitId`, {
    method: "DELETE",
  });
}

export async function deleteOrbitParent(identifier: string) {
  return orbitRegistryRequest<{ orbitId: string; deleted: boolean }>(`/api/integration/registry/parent/${encodeURIComponent(identifier)}?identifierType=orbitId`, {
    method: "DELETE",
  });
}

export async function deleteOrbitFamily(identifier: string) {
  return orbitRegistryRequest<{ orbitId: string; deleted: boolean }>(`/api/integration/registry/family/${encodeURIComponent(identifier)}?identifierType=orbitId`, {
    method: "DELETE",
  });
}

export async function deleteOrbitTeacher(identifier: string) {
  return orbitRegistryRequest<{ orbitId: string; deleted: boolean }>(`/api/integration/registry/teacher/${encodeURIComponent(identifier)}?identifierType=orbitId`, {
    method: "DELETE",
  });
}

export async function syncOrbitRegistryMirror(schoolId: string, options: { pruneMissing?: boolean } = {}) {
  if (!orbitRegistryIsEnabled()) {
    return {
      parents: [] as SharedParentOption[],
      students: [] as SharedStudentOption[],
      classes: [] as Array<{ id: string; name: string; level: string }>,
      teachers: [] as SharedTeacherOption[],
      counts: { families: 0, parents: 0, students: 0, teachers: 0 },
    };
  }

  // Abort a mirror refresh when Orbit is unavailable. An empty fallback here
  // would be indistinguishable from a real empty directory and trigger pruning.
  const mapped = mapOrbitDirectoryToSharedOptions(await fetchOrbitSharedDirectory());
  const activeExternalStudentIds = new Set(
    mapped.parents
      .flatMap((parent) => parent.students)
      .map((student) => student.externalStudentId)
      .filter((externalStudentId): externalStudentId is string => Boolean(externalStudentId))
  );

  const classIdByName = new Map<string, string>();
  for (const className of mapped.classes) {
    const classRecord = await prisma.class.upsert({
      where: { schoolId_name: { schoolId, name: className } },
      update: { level: className.split(" - ")[0] || className },
      create: {
        schoolId,
        name: className,
        level: className.split(" - ")[0] || className,
      },
    });
    classIdByName.set(className, classRecord.id);
  }

  const parentIdByLookupKey = new Map<string, string>();
  for (const parent of mapped.parents) {
    // Contact details and names are editable. Use Orbit's immutable id first;
    // the remaining branches only adopt legacy mirror rows once.
    const existingParent = await prisma.parent.findFirst({
      where: {
        schoolId,
        OR: [
          { orbitId: parent.orbitId },
          ...(parent.email ? [{ orbitId: null, email: parent.email }] : []),
          ...(parent.phone ? [{ orbitId: null, phone: parent.phone }] : []),
          { orbitId: null, fullName: parent.fullName },
        ],
      },
    });

    const savedParent = existingParent
      ? await prisma.parent.update({
        where: { id: existingParent.id },
        data: {
          orbitId: parent.orbitId,
          fullName: parent.fullName,
          phone: parent.phone,
          email: parent.email,
          physicalAddress: parent.physicalAddress || null,
        },
      })
      : await prisma.parent.upsert({
        where: { schoolId_orbitId: { schoolId, orbitId: parent.orbitId } },
        update: {
          fullName: parent.fullName,
          phone: parent.phone,
          email: parent.email,
          physicalAddress: parent.physicalAddress || null,
        },
        create: {
          schoolId,
          orbitId: parent.orbitId,
          fullName: parent.fullName,
          phone: parent.phone,
          email: parent.email,
          physicalAddress: parent.physicalAddress || null,
          preferredLanguage: "fr",
        },
      });

    parentIdByLookupKey.set(parent.lookupKey, savedParent.id);

    for (const student of parent.students) {
      const classId = classIdByName.get(student.className);
      if (!classId) {
        continue;
      }

      const studentAnnualFee = Number(student.annualFee || 0);
      const annualFeeUpdate = studentAnnualFee > 0 ? { annualFee: studentAnnualFee } : {};

      if (student.externalStudentId) {
        const existingStudent = await prisma.student.findFirst({
          where: {
            schoolId,
            OR: [
              { orbitId: student.orbitId },
              { orbitId: null, externalStudentId: student.externalStudentId },
            ],
          },
        });
        if (existingStudent) {
          await prisma.student.update({
            where: { id: existingStudent.id },
            data: {
              orbitId: student.orbitId,
              externalStudentId: student.externalStudentId,
              fullName: student.fullName,
              parentId: savedParent.id,
              classId,
              ...annualFeeUpdate,
            },
          });
        } else {
          await prisma.student.upsert({
            where: { schoolId_orbitId: { schoolId, orbitId: student.orbitId } },
            update: {
              externalStudentId: student.externalStudentId,
              fullName: student.fullName,
              parentId: savedParent.id,
              classId,
              ...annualFeeUpdate,
            },
            create: {
              schoolId,
              orbitId: student.orbitId,
              parentId: savedParent.id,
              classId,
              externalStudentId: student.externalStudentId,
              fullName: student.fullName,
              annualFee: studentAnnualFee,
            },
          });
        }
        continue;
      }

      const existingStudent = await prisma.student.findFirst({
        where: {
          schoolId,
          parentId: savedParent.id,
          fullName: student.fullName,
        },
      });

      if (existingStudent) {
        await prisma.student.update({
          where: { id: existingStudent.id },
          data: {
            fullName: student.fullName,
            classId,
            ...annualFeeUpdate,
          },
        });
      } else {
        await prisma.student.create({
          data: {
            schoolId,
            parentId: savedParent.id,
            classId,
            fullName: student.fullName,
            annualFee: studentAnnualFee,
          },
        });
      }
    }
  }

  if (options.pruneMissing !== false) {
    const activeOrbitStudentIds = mapped.students
      .map((student) => student.orbitId)
      .filter((orbitId): orbitId is string => Boolean(orbitId));
    const activeExternalStudentIdList = Array.from(activeExternalStudentIds);
    await prisma.student.deleteMany({
      where: {
        schoolId,
        OR: [
          {
            orbitId: { not: null },
            ...(activeOrbitStudentIds.length > 0 ? { NOT: { orbitId: { in: activeOrbitStudentIds } } } : {}),
          },
          {
            orbitId: null,
            externalStudentId: { not: null },
            ...(activeExternalStudentIdList.length > 0
              ? { NOT: { externalStudentId: { in: activeExternalStudentIdList } } }
              : {}),
          },
        ],
      },
    });
  }

  const activeParentIds = Array.from(parentIdByLookupKey.values());
  if (options.pruneMissing !== false && activeParentIds.length > 0) {
    await prisma.parent.deleteMany({
      where: {
        schoolId,
        id: { notIn: activeParentIds },
        students: { none: {} },
      },
    });
  }
  const parents = activeParentIds.length > 0
    ? await prisma.parent.findMany({
      where: {
        schoolId,
        id: { in: activeParentIds },
      },
      select: {
        id: true,
        createdAt: true,
        fullName: true,
        phone: true,
        email: true,
        physicalAddress: true,
        students: {
          include: {
            class: true,
          },
        },
      },
    })
    : [];

  const parentById = new Map(parents.map((parent) => [parent.id, parent]));
  const classes = mapped.classes.length > 0
    ? await prisma.class.findMany({
      where: {
        schoolId,
        name: { in: mapped.classes },
      },
      orderBy: { name: "asc" },
    })
    : [];

  return {
    parents: mapped.parents.map((orbitParent) => {
      const localParentId = parentIdByLookupKey.get(orbitParent.lookupKey);
      const parent = localParentId ? parentById.get(localParentId) : undefined;
      return {
        ...orbitParent,
        id: orbitParent.orbitId,
        localId: parent?.id,
        createdAt: parent?.createdAt,
        students: orbitParent.students.map((orbitStudent) => {
          const localStudent = parent?.students.find((student) =>
            student.externalStudentId === orbitStudent.externalStudentId
            || student.fullName === orbitStudent.fullName
          );
          return {
            ...orbitStudent,
            id: orbitStudent.orbitId,
            localId: localStudent?.id,
            classId: localStudent?.classId || orbitStudent.classId,
            className: localStudent?.class.name || orbitStudent.className,
            annualFee: localStudent?.annualFee || orbitStudent.annualFee,
          };
        }),
      };
    }),    students: mapped.students.map((orbitStudent) => {
      const localStudent = parents.flatMap((parent) => parent.students).find((student) =>
        student.externalStudentId === orbitStudent.externalStudentId
        || student.fullName === orbitStudent.fullName
      );
      return {
        ...orbitStudent,
        id: orbitStudent.orbitId,
        localId: localStudent?.id,
        classId: localStudent?.classId || orbitStudent.classId,
        className: localStudent?.class.name || orbitStudent.className,
        annualFee: localStudent?.annualFee || orbitStudent.annualFee,
      };
    }),    classes,
    teachers: mapped.teachers,
    counts: {
      families: mapped.parents.length,
      parents: mapped.parents.length,
      students: mapped.parents.reduce((total, parent) => total + parent.students.length, 0),
      teachers: mapped.counts.teachers,
    },
  };
}
