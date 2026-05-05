import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { AddressInfo } from "node:net";
import { createServer } from "node:http";
import { prisma } from "./db";
import { createApp } from "./app";
import { signToken } from "./utils/jwt";

type StudentRecord = {
  id: string;
  firstName: string;
  lastName: string;
  classId: string | null;
  parentId: string | null;
  organizationId: string | null;
};

type ParentRecord = {
  id: string;
  fullName: string;
  organizationId: string | null;
  students: Array<{ id: string }>;
};

type TeacherRecord = {
  id: string;
  fullName: string;
  organizationId: string | null;
};

const originalStudentFindMany = prisma.student.findMany.bind(prisma.student);
const originalParentFindMany = prisma.parent.findMany.bind(prisma.parent);
const originalTeacherFindMany = prisma.teacher.findMany.bind(prisma.teacher);
const originalExternalLinkFindMany = prisma.externalLink.findMany.bind(prisma.externalLink);
const originalOrganizationFindUnique = prisma.organization.findUnique.bind(prisma.organization);
const originalParentFindFirst = prisma.parent.findFirst.bind(prisma.parent);
const originalParentCreate = prisma.parent.create.bind(prisma.parent);
const originalExternalLinkCreate = prisma.externalLink.create.bind(prisma.externalLink);
const originalSyncEventCreate = prisma.syncEvent.create.bind(prisma.syncEvent);
const originalAuditLogCreate = prisma.auditLog.create.bind(prisma.auditLog);

async function withServer(run: (baseUrl: string) => Promise<void>) {
  const server = createServer(createApp());
  await new Promise<void>((resolve) => server.listen(0, resolve));

  try {
    const address = server.address() as AddressInfo;
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

function mockSharedDirectoryData() {
  (prisma.student.findMany as unknown as typeof prisma.student.findMany) = (async () => [
    {
      id: "student-1",
      firstName: "Amina",
      lastName: "K.",
      classId: "class-6a",
      parentId: "parent-1",
      organizationId: "org-1",
    },
  ]) as never;

  (prisma.parent.findMany as unknown as typeof prisma.parent.findMany) = (async () => [
    {
      id: "parent-1",
      fullName: "Parent One",
      organizationId: "org-1",
      students: [{ id: "student-1" }],
    },
  ]) as never;

  (prisma.teacher.findMany as unknown as typeof prisma.teacher.findMany) = (async () => [
    {
      id: "teacher-1",
      fullName: "Teacher One",
      organizationId: "org-1",
    },
  ]) as never;

  (prisma.externalLink.findMany as unknown as typeof prisma.externalLink.findMany) = (async () => [
    {
      nexusEntityId: "student-1",
      appSlug: "SAVANEX",
      externalId: "sav-student-1",
    },
    {
      nexusEntityId: "parent-1",
      appSlug: "SAVANEX",
      externalId: "sav-parent-1",
    },
    {
      nexusEntityId: "teacher-1",
      appSlug: "SAVANEX",
      externalId: "sav-teacher-1",
    },
  ]) as never;
}

function restorePrisma() {
  (prisma.student.findMany as unknown as typeof prisma.student.findMany) = originalStudentFindMany as never;
  (prisma.parent.findMany as unknown as typeof prisma.parent.findMany) = originalParentFindMany as never;
  (prisma.teacher.findMany as unknown as typeof prisma.teacher.findMany) = originalTeacherFindMany as never;
  (prisma.externalLink.findMany as unknown as typeof prisma.externalLink.findMany) = originalExternalLinkFindMany as never;
  (prisma.organization.findUnique as unknown as typeof prisma.organization.findUnique) = originalOrganizationFindUnique as never;
  (prisma.parent.findFirst as unknown as typeof prisma.parent.findFirst) = originalParentFindFirst as never;
  (prisma.parent.create as unknown as typeof prisma.parent.create) = originalParentCreate as never;
  (prisma.externalLink.create as unknown as typeof prisma.externalLink.create) = originalExternalLinkCreate as never;
  (prisma.syncEvent.create as unknown as typeof prisma.syncEvent.create) = originalSyncEventCreate as never;
  (prisma.auditLog.create as unknown as typeof prisma.auditLog.create) = originalAuditLogCreate as never;
}

test("parent role receives only shared-directory data on /api/students", async () => {
  mockSharedDirectoryData();

  const token = signToken({ userId: "parent-user", role: "PARENT", organizationId: "org-1" });

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/students`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      assert.equal(response.status, 200);
      const data = await response.json() as { visibility: string; students: StudentRecord[] };
      assert.equal(data.visibility, "shared-directory");
      assert.equal(data.students.length, 1);
      assert.equal(data.students[0]?.id, "student-1");
    });
  } finally {
    restorePrisma();
  }
});

test("parent role is forbidden from payments", async () => {
  const token = signToken({ userId: "parent-user", role: "PARENT", organizationId: "org-1" });

  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/payments`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    assert.equal(response.status, 403);
  });
});

test("shared-directory endpoint returns the unified directory", async () => {
  mockSharedDirectoryData();

  const token = signToken({ userId: "teacher-user", role: "TEACHER", organizationId: "org-1" });

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/shared-directory`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      assert.equal(response.status, 200);
      const data = await response.json() as {
        visibility: string;
        parents: ParentRecord[];
        students: StudentRecord[];
        teachers: TeacherRecord[];
      };
      assert.equal(data.visibility, "shared-directory");
      assert.equal(data.parents.length, 1);
      assert.equal(data.students.length, 1);
      assert.equal(data.teachers.length, 1);
    });
  } finally {
    restorePrisma();
  }
});

test("registry creation rejects duplicate parents", async () => {
  process.env.KCS_NEXUS_INTEGRATION_KEY = "test-kcs-key";

  (prisma.organization.findUnique as unknown as typeof prisma.organization.findUnique) = (async () => ({ id: "org-1" })) as never;
  (prisma.parent.findFirst as unknown as typeof prisma.parent.findFirst) = (async () => ({ id: "parent-1" })) as never;

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/integration/registry/parent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": "test-kcs-key",
          "x-app-slug": "KCS_NEXUS",
        },
        body: JSON.stringify({ organizationId: "org-1", fullName: "Parent One", email: "parent@example.org" }),
      });

      assert.equal(response.status, 409);
    });
  } finally {
    restorePrisma();
  }
});

test("registry creation generates an external id for a new parent", async () => {
  process.env.KCS_NEXUS_INTEGRATION_KEY = "test-kcs-key";

  (prisma.organization.findUnique as unknown as typeof prisma.organization.findUnique) = (async () => ({ id: "org-1" })) as never;
  (prisma.parent.findFirst as unknown as typeof prisma.parent.findFirst) = (async () => null) as never;
  (prisma.parent.create as unknown as typeof prisma.parent.create) = (async () => ({ id: "parent-2", fullName: "Parent Two" })) as never;
  (prisma.externalLink.create as unknown as typeof prisma.externalLink.create) = (async () => ({ id: "link-1" })) as never;
  (prisma.syncEvent.create as unknown as typeof prisma.syncEvent.create) = (async () => ({ id: "sync-1" })) as never;
  (prisma.auditLog.create as unknown as typeof prisma.auditLog.create) = (async () => ({ id: "audit-1" })) as never;

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/integration/registry/parent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": "test-kcs-key",
          "x-app-slug": "KCS_NEXUS",
        },
        body: JSON.stringify({ organizationId: "org-1", fullName: "Parent Two", email: "new-parent@example.org" }),
      });

      assert.equal(response.status, 201);
      const data = await response.json() as { externalId: string; orbitId: string };
      assert.equal(data.orbitId, "parent-2");
      assert.match(data.externalId, /^KCSNEX-PAR-/);
    });
  } finally {
    restorePrisma();
  }
});

test("registry route rejects EduPay integration clients", async () => {
  process.env.EDUPAY_INTEGRATION_KEY = "test-edupay-key";

  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/integration/registry/parent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "test-edupay-key",
        "x-app-slug": "EDUPAY",
      },
      body: JSON.stringify({ organizationId: "org-1", fullName: "Blocked Parent" }),
    });

    assert.equal(response.status, 401);
  });
});