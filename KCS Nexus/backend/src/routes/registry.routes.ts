import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../config/prisma.js'
import { env } from '../config/env.js'
import { authenticate, requireRoles } from '../middleware/auth.js'
import { ApiError, asyncHandler, success } from '../utils/api.js'

export const registryRouter = Router()

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

  return success(res, {
    source: 'local' as const,
    families: students.map((student) => ({
      id: student.id,
      studentNumber: student.studentNumber,
      grade: student.grade,
      section: student.section,
      status: student.status,
      student: student.user,
      parents: student.parentLinks.map((link) => ({
        relation: link.relation,
        parent: link.parent,
      })),
    })),
  })
}))

registryRouter.post('/families', authenticate, requireRoles('admin'), asyncHandler(async (req, res) => {
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
