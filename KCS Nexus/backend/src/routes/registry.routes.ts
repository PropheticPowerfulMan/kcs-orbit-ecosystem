import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../config/prisma.js'
import { env } from '../config/env.js'
import { authenticate, requireRoles } from '../middleware/auth.js'
import { ApiError, asyncHandler, success } from '../utils/api.js'

export const registryRouter = Router()

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
    parents: Array<{ id: string; relation: string; parent: { firstName: string; lastName: string; fullName: string; email: string | null; phone: string | null } }>
    children: Array<{ id: string; studentNumber: string; grade: string; section: string; status: string; student: { firstName: string; lastName: string; fullName: string; email: string | null } }>
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

registryRouter.post('/families', authenticate, requireRoles('admin'), asyncHandler(async (req, res) => {
  if (orbitRegistryIsEnabled()) {
    throw new ApiError(409, 'Family creation is disabled in KCS Nexus while Orbit registry mode is enabled. Create the family in the owning source system.')
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
        firstName: parent.firstName,
        lastName: parent.lastName,
        phone: parent.phone,
        role: 'PARENT',
      },
    })

    const studentUser = await tx.user.create({
      data: {
        email: student.email ?? `${student.studentNumber.toLowerCase()}@students.kcs.local`,
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
