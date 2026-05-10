import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../config/prisma.js'
import { env } from '../config/env.js'
import { authenticate, requireRoles } from '../middleware/auth.js'
import { ApiError, asyncHandler, success } from '../utils/api.js'

function generateAccessCode(role: string) {
  return `ACC-${role.slice(0, 3).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
}

async function generateUniqueAccessCode(tx: typeof prisma, role: string) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const accessCode = generateAccessCode(role)
    const existing = await tx.user.findFirst({ where: { accessCode } as any })
    if (!existing) {
      return accessCode
    }
  }

  return `ACC-${role.slice(0, 3).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`
}

export const registryRouter = Router()

type SharedDirectoryResponse = {
  source: 'orbit'
  visibility: 'shared-directory'
  parents: Array<{
    id: string
    fullName: string
    firstName?: string
    middleName?: string | null
    lastName?: string
    phone?: string | null
    email?: string | null
    mustChangePassword?: boolean
    organizationId?: string | null
    studentIds: string[]
    externalIds: Array<{ appSlug: string; externalId: string }>
  }>
  students: Array<{
    id: string
    fullName: string
    firstName: string
    middleName?: string | null
    lastName: string
    studentNumber?: string
    email?: string | null
    phone?: string | null
    dateOfBirth?: string | null
    status?: string | null
    mustChangePassword?: boolean
    classId?: string | null
    className?: string | null
    parentId?: string | null
    organizationId?: string | null
    externalIds: Array<{ appSlug: string; externalId: string }>
  }>
  teachers: Array<{
    id: string
    fullName: string
    firstName?: string
    middleName?: string | null
    lastName?: string
    phone?: string | null
    email?: string | null
    subject?: string | null
    employeeId?: string | null
    employeeType?: string | null
    department?: string | null
    jobTitle?: string | null
    mustChangePassword?: boolean
    organizationId?: string | null
    externalIds: Array<{ appSlug: string; externalId: string }>
  }>
}

type RegistryEntityType = 'parent' | 'student' | 'teacher'

function buildFamilyLabel(lastName: string | null | undefined, fallback: string) {
  return `${lastName || fallback} Family`
}

function orbitRegistryIsEnabled() {
  return Boolean(env.KCS_ORBIT_API_URL && env.KCS_ORBIT_API_KEY && env.KCS_ORBIT_ORGANIZATION_ID)
}

async function getFamiliesFromOrbit() {
  const response = await fetch(
    `${env.KCS_ORBIT_API_URL!.replace(/\/$/, '')}/api/integration/read/kcs-nexus/families?organizationId=${encodeURIComponent(env.KCS_ORBIT_ORGANIZATION_ID!)}`,
    {
      headers: {
        'x-api-key': env.KCS_ORBIT_API_KEY!,
      },
    }
  )

  if (!response.ok) {
    throw new ApiError(response.status, `Orbit registry request failed with status ${response.status}`)
  }

  return response.json() as Promise<{ families: unknown[]; source: 'orbit' }>
}

async function getSharedDirectoryFromOrbit() {
  const response = await fetch(
    `${env.KCS_ORBIT_API_URL!.replace(/\/$/, '')}/api/integration/read/shared-directory?organizationId=${encodeURIComponent(env.KCS_ORBIT_ORGANIZATION_ID!)}`,
    {
      headers: {
        'x-api-key': env.KCS_ORBIT_API_KEY!,
        'x-app-slug': 'KCS_NEXUS',
      },
    }
  )

  if (!response.ok) {
    throw new ApiError(response.status, `Orbit shared directory request failed with status ${response.status}`)
  }

  return response.json() as Promise<SharedDirectoryResponse>
}

async function sendRegistryEntityToOrbit(entityType: RegistryEntityType, payload: object) {
  const response = await fetch(
    `${env.KCS_ORBIT_API_URL!.replace(/\/$/, '')}/api/integration/registry/${entityType}`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.KCS_ORBIT_API_KEY!,
        'x-app-slug': 'KCS_NEXUS',
      },
      body: JSON.stringify(payload),
    }
  )

  const data = await response.json().catch(() => ({}))
  return { response, data }
}

async function createRegistryEntityInOrbit(entityType: RegistryEntityType, payload: object) {
  const { response, data } = await sendRegistryEntityToOrbit(entityType, payload)
  if (!response.ok) {
    throw new ApiError(response.status, typeof data?.message === 'string' ? data.message : `Orbit registry create failed with status ${response.status}`)
  }

  return data
}

async function deleteRegistryEntityInOrbit(entityType: RegistryEntityType, identifier: string, organizationId: string, identifierType: 'orbitId' | 'externalId' = 'orbitId') {
  const response = await fetch(
    `${env.KCS_ORBIT_API_URL!.replace(/\/$/, '')}/api/integration/registry/${entityType}/${encodeURIComponent(identifier)}?organizationId=${encodeURIComponent(organizationId)}&identifierType=${encodeURIComponent(identifierType)}`,
    {
      method: 'DELETE',
      headers: {
        'x-api-key': env.KCS_ORBIT_API_KEY!,
        'x-app-slug': 'KCS_NEXUS',
      },
    }
  )

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new ApiError(response.status, typeof data?.message === 'string' ? data.message : `Orbit registry delete failed with status ${response.status}`)
  }

  return data
}

async function updateRegistryEntityInOrbit(entityType: RegistryEntityType, identifier: string, organizationId: string, payload: object, identifierType: 'orbitId' | 'externalId' = 'orbitId') {
  const response = await fetch(
    `${env.KCS_ORBIT_API_URL!.replace(/\/$/, '')}/api/integration/registry/${entityType}/${encodeURIComponent(identifier)}?organizationId=${encodeURIComponent(organizationId)}&identifierType=${encodeURIComponent(identifierType)}`,
    {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.KCS_ORBIT_API_KEY!,
        'x-app-slug': 'KCS_NEXUS',
      },
      body: JSON.stringify(payload),
    }
  )

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new ApiError(response.status, typeof data?.message === 'string' ? data.message : `Orbit registry update failed with status ${response.status}`)
  }

  return data
}

async function updateLocalParentEntity(identifier: string, payload: { firstName?: string; lastName?: string; email?: string; phone?: string | null }) {
  const parent = await prisma.user.findFirst({
    where: { id: identifier, role: 'PARENT' },
    select: { id: true },
  })

  if (!parent) {
    throw new ApiError(404, 'Parent not found in the local registry.')
  }

  return prisma.user.update({
    where: { id: identifier },
    data: {
      ...(payload.firstName !== undefined ? { firstName: payload.firstName } : {}),
      ...(payload.lastName !== undefined ? { lastName: payload.lastName } : {}),
      ...(payload.email !== undefined && payload.email !== null ? { email: payload.email } : {}),
      ...(payload.phone !== undefined ? { phone: payload.phone || null } : {}),
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      role: true,
    },
  })
}

async function deleteLocalParentEntity(identifier: string) {
  const parent = await prisma.user.findFirst({
    where: { id: identifier, role: 'PARENT' },
    include: { parentLinks: { select: { id: true } } },
  })

  if (!parent) {
    throw new ApiError(404, 'Parent not found in the local registry.')
  }

  await prisma.$transaction(async (tx) => {
    await tx.parentStudentLink.deleteMany({ where: { parentId: identifier } })
    await tx.user.delete({ where: { id: identifier } })
  })

  return {
    id: identifier,
    deletedLinks: parent.parentLinks.length,
  }
}

const schoolLevels = [
  'K1', 'K2', 'K3', 'K4', 'K5',
  'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6',
  'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12',
] as const

const registerFamilySchema = z.object({
  parent: z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.string().email(),
    phone: z.string().optional(),
    relationship: z.string().default('Parent'),
  }),
  student: z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.string().email().optional(),
    studentNumber: z.string().min(2),
    grade: z.enum(schoolLevels),
    section: z.string().default('A'),
    gender: z.enum(['M', 'F', 'O']).default('O'),
  }),
})

registryRouter.get('/families', authenticate, requireRoles('admin', 'teacher'), asyncHandler(async (_req, res) => {
  if (orbitRegistryIsEnabled()) {
    const orbitData = await getFamiliesFromOrbit()
    return success(res, orbitData, 'Families loaded from Orbit')
  }

  const students = await prisma.studentProfile.findMany({
    include: {
      user: true,
      parentLinks: { include: { parent: true } },
    },
    orderBy: [{ grade: 'asc' }, { user: { lastName: 'asc' } }],
  })

  const familiesMap = new Map<string, {
    id: string
    familyLabel: string
    parents: Array<{ id: string; relation: string; parent: { firstName: string; middleName?: string | null; lastName: string; fullName: string; email: string | null; phone: string | null } }>
    children: Array<{ id: string; studentNumber: string; grade: string; section: string; status: string; student: { firstName: string; middleName?: string | null; lastName: string; fullName: string; email: string | null } }>
  }>()

  for (const student of students) {
    const uniqueParents = student.parentLinks.reduce<Array<{ id: string; relation: string; parent: typeof student.parentLinks[number]['parent'] }>>((accumulator, link) => {
      if (accumulator.some((item) => item.id === link.parent.id)) {
        return accumulator
      }

      accumulator.push({ id: link.parent.id, relation: link.relation, parent: link.parent })
      return accumulator
    }, [])

    const familyKey = uniqueParents.length
      ? uniqueParents.map((item) => item.id).sort().join('|')
      : `student:${student.id}`

    if (!familiesMap.has(familyKey)) {
      familiesMap.set(familyKey, {
        id: familyKey,
        familyLabel: buildFamilyLabel(uniqueParents[0]?.parent.lastName, student.user.lastName || student.user.firstName),
        parents: uniqueParents.map((item) => ({
          id: item.id,
          relation: item.relation,
          parent: {
            firstName: item.parent.firstName,
            middleName: null,
            lastName: item.parent.lastName,
            fullName: `${item.parent.firstName} ${item.parent.lastName}`.trim(),
            email: item.parent.email,
            phone: item.parent.phone,
          },
        })),
        children: [],
      })
    }

    familiesMap.get(familyKey)!.children.push({
      id: student.id,
      studentNumber: student.studentNumber,
      grade: student.grade,
      section: student.section,
      status: student.status,
      student: {
        firstName: student.user.firstName,
        middleName: null,
        lastName: student.user.lastName,
        fullName: `${student.user.firstName} ${student.user.lastName}`.trim(),
        email: student.user.email,
      },
    })
  }

  return success(res, {
    source: 'local' as const,
    families: Array.from(familiesMap.values()).map((family) => ({
      ...family,
      studentCount: family.children.length,
    })),
  })
}))

registryRouter.get('/directory', authenticate, asyncHandler(async (_req, res) => {
  if (orbitRegistryIsEnabled()) {
    const orbitData = await getSharedDirectoryFromOrbit()
    return success(res, orbitData, 'Shared directory loaded from Orbit')
  }

  const [students, teachers] = await Promise.all([
    prisma.studentProfile.findMany({
      include: {
        user: true,
        parentLinks: { include: { parent: true } },
      },
      orderBy: [{ user: { lastName: 'asc' } }, { user: { firstName: 'asc' } }],
    }),
    prisma.teacherProfile.findMany({
      include: { user: true },
      orderBy: [{ user: { lastName: 'asc' } }, { user: { firstName: 'asc' } }],
    }),
  ])

  const parentsMap = new Map<string, SharedDirectoryResponse['parents'][number]>()

  for (const student of students) {
    for (const link of student.parentLinks) {
      if (!parentsMap.has(link.parent.id)) {
        parentsMap.set(link.parent.id, {
          id: link.parent.id,
          fullName: `${link.parent.firstName} ${link.parent.lastName}`.trim(),
          firstName: link.parent.firstName,
          middleName: null,
          lastName: link.parent.lastName,
          phone: link.parent.phone,
          email: link.parent.email,
          mustChangePassword: false,
          organizationId: null,
          studentIds: [],
          externalIds: [],
        })
      }

      const parent = parentsMap.get(link.parent.id)!
      if (!parent.studentIds.includes(student.id)) {
        parent.studentIds.push(student.id)
      }
    }
  }

  return success(res, {
    source: 'local' as const,
    visibility: 'shared-directory' as const,
    parents: Array.from(parentsMap.values()).sort((left, right) => left.fullName.localeCompare(right.fullName)),
    students: students.map((student) => ({
      id: student.id,
      fullName: `${student.user.firstName} ${student.user.lastName}`.trim(),
      firstName: student.user.firstName,
      middleName: null,
      lastName: student.user.lastName,
      studentNumber: student.studentNumber,
      email: student.user.email,
      phone: null,
      dateOfBirth: null,
      status: student.status,
      mustChangePassword: false,
      classId: student.grade ? `${student.grade}-${student.section}` : null,
      className: student.grade ? `${student.grade} - Section ${student.section}` : null,
      parentId: student.parentLinks[0]?.parentId ?? null,
      organizationId: null,
      externalIds: [],
    })),
    teachers: teachers.map((teacher) => ({
      id: teacher.id,
      fullName: `${teacher.user.firstName} ${teacher.user.lastName}`.trim(),
      firstName: teacher.user.firstName,
      middleName: null,
      lastName: teacher.user.lastName,
      phone: teacher.user.phone,
      email: teacher.user.email,
      subject: null,
      employeeId: null,
      employeeType: null,
      department: null,
      jobTitle: null,
      mustChangePassword: false,
      organizationId: null,
      externalIds: [],
    })),
  }, 'Shared directory loaded locally')
}))

registryRouter.post('/entities/:entityType', authenticate, requireRoles('admin'), asyncHandler(async (req, res) => {
  if (!orbitRegistryIsEnabled()) {
    throw new ApiError(409, 'Orbit registry mode must be enabled to create shared entities from KCS Nexus.')
  }

  const entityType = z.enum(['parent', 'student', 'teacher']).parse(req.params.entityType) as RegistryEntityType
  const payload = { ...req.body, organizationId: env.KCS_ORBIT_ORGANIZATION_ID }
  const created = await createRegistryEntityInOrbit(entityType, payload)
  return success(res, created, 'Shared entity created through Orbit', 201)
}))

registryRouter.patch('/entities/:entityType/:identifier', authenticate, requireRoles('admin'), asyncHandler(async (req, res) => {
  const entityType = z.enum(['parent', 'student', 'teacher']).parse(req.params.entityType) as RegistryEntityType
  const identifierType = z.enum(['orbitId', 'externalId']).default('orbitId').parse(req.query.identifierType)

  if (orbitRegistryIsEnabled()) {
    const updated = await updateRegistryEntityInOrbit(entityType, String(req.params.identifier), env.KCS_ORBIT_ORGANIZATION_ID!, req.body ?? {}, identifierType)
    return success(res, updated, 'Shared entity updated through Orbit')
  }

  if (entityType !== 'parent') {
    throw new ApiError(409, 'Local registry editing is currently enabled for parent entities only.')
  }

  const payload = z.object({
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
    email: z.string().email().optional(),
    phone: z.string().nullable().optional(),
  }).parse(req.body ?? {})

  const updated = await updateLocalParentEntity(String(req.params.identifier), payload)
  return success(res, updated, 'Parent updated in local registry')
}))

registryRouter.delete('/entities/:entityType/:identifier', authenticate, requireRoles('admin'), asyncHandler(async (req, res) => {
  const entityType = z.enum(['parent', 'student', 'teacher']).parse(req.params.entityType) as RegistryEntityType
  const identifierType = z.enum(['orbitId', 'externalId']).default('orbitId').parse(req.query.identifierType)

  if (!orbitRegistryIsEnabled()) {
    if (entityType !== 'parent') {
      throw new ApiError(409, 'Local registry deletion is currently enabled for parent entities only.')
    }

    const deletedLocalParent = await deleteLocalParentEntity(String(req.params.identifier))
    return success(res, deletedLocalParent, 'Parent deleted from local registry')
  }

  const deleted = await deleteRegistryEntityInOrbit(entityType, String(req.params.identifier), env.KCS_ORBIT_ORGANIZATION_ID!, identifierType)
  return success(res, deleted, 'Shared entity deleted through Orbit')
}))

registryRouter.post('/families', authenticate, requireRoles('admin'), asyncHandler(async (req, res) => {
  if (orbitRegistryIsEnabled()) {
    const { parent, student } = registerFamilySchema.parse(req.body)
    const organizationId = env.KCS_ORBIT_ORGANIZATION_ID!

    const parentResult = await sendRegistryEntityToOrbit('parent', {
      organizationId,
      firstName: parent.firstName,
      lastName: parent.lastName,
      email: parent.email,
      phone: parent.phone,
    })

    if (!parentResult.response.ok && parentResult.response.status !== 409) {
      throw new ApiError(
        parentResult.response.status,
        typeof parentResult.data?.message === 'string'
          ? parentResult.data.message
          : `Orbit parent create failed with status ${parentResult.response.status}`
      )
    }

    const parentOrbitId = typeof parentResult.data?.orbitId === 'string' ? parentResult.data.orbitId : null
    if (!parentOrbitId) {
      throw new ApiError(502, 'Orbit did not return a parent identifier for this family.')
    }

    const createdStudent = await createRegistryEntityInOrbit('student', {
      organizationId,
      firstName: student.firstName,
      lastName: student.lastName,
      email: student.email,
      gender: student.gender,
      studentNumber: student.studentNumber,
      className: `${student.grade} ${student.section}`.trim(),
      parentOrbitId,
      status: 'ACTIVE',
    })

    return success(res, {
      source: 'orbit',
      parent: {
        orbitId: parentOrbitId,
        ...(typeof parentResult.data?.externalId === 'string' ? { externalId: parentResult.data.externalId } : {}),
          ...(typeof parentResult.data?.entity?.accessCode === 'string' ? { accessCode: parentResult.data.entity.accessCode } : {}),
      },
        student: {
          orbitId: typeof createdStudent?.orbitId === 'string' ? createdStudent.orbitId : undefined,
          ...(typeof createdStudent?.externalId === 'string' ? { externalId: createdStudent.externalId } : {}),
          ...(typeof createdStudent?.entity?.accessCode === 'string' ? { accessCode: createdStudent.entity.accessCode } : {}),
        },
    }, 'Family registered through Orbit', 201)
  }

  const { parent, student } = registerFamilySchema.parse(req.body)

  const exists = await prisma.studentProfile.findUnique({ where: { studentNumber: student.studentNumber } })
  if (exists) throw new ApiError(409, 'Student number already exists')

  const family = await prisma.$transaction(async (tx) => {
    const parentUser = await tx.user.upsert({
      where: { email: parent.email },
      update: {
        firstName: parent.firstName,
        lastName: parent.lastName,
        phone: parent.phone,
        role: 'PARENT',
      },
      create: {
        email: parent.email,
        accessCode: await generateUniqueAccessCode(tx as typeof prisma, 'parent'),
        firstName: parent.firstName,
        lastName: parent.lastName,
        phone: parent.phone,
        role: 'PARENT',
      },
    })

    const studentUser = await tx.user.create({
      data: {
        email: student.email ?? `${student.studentNumber.toLowerCase()}@students.kcs.local`,
        accessCode: await generateUniqueAccessCode(tx as typeof prisma, 'student'),
        firstName: student.firstName,
        lastName: student.lastName,
        role: 'STUDENT',
        studentProfile: {
          create: {
            studentNumber: student.studentNumber,
            grade: student.grade,
            section: student.section,
            parentLinks: {
              create: {
                parent: { connect: { id: parentUser.id } },
                relation: parent.relationship,
              },
            },
          },
        },
      },
      include: { studentProfile: { include: { parentLinks: { include: { parent: true } } } } },
    })

    return { parent: parentUser, student: studentUser }
  })

  return success(res, family, 'Family registered', 201)
}))
