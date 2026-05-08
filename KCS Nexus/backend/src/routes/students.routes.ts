import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { env } from '../config/env.js'
import { prisma } from '../config/prisma.js'
import { authenticate, requireRoles } from '../middleware/auth.js'
import { ApiError, asyncHandler, success } from '../utils/api.js'
import { getRouteParam } from '../utils/request.js'

export const studentsRouter = Router()

const schoolLevels = [
  'K1', 'K2', 'K3', 'K4', 'K5',
  'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6',
  'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12',
] as const

type OrbitPerson = {
  id: string
  fullName: string
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  phone?: string | null
  studentIds?: string[]
}

type OrbitStudent = {
  id: string
  fullName: string
  firstName?: string | null
  lastName?: string | null
  studentNumber?: string | null
  email?: string | null
  phone?: string | null
  status?: string | null
  className?: string | null
  parentId?: string | null
  externalIds?: Array<{ appSlug: string; externalId: string }>
}

type OrbitSharedDirectory = {
  parents: OrbitPerson[]
  students: OrbitStudent[]
}

const studentUpdateSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  studentNumber: z.string().min(2).optional(),
  grade: z.enum(schoolLevels).optional(),
  section: z.string().max(10).optional(),
  status: z.string().min(1).optional(),
}).refine((value) => Object.values(value).some((item) => item !== undefined), {
  message: 'At least one field must be provided for student update.',
})

function orbitRegistryIsEnabled() {
  return Boolean(env.KCS_ORBIT_API_URL && env.KCS_ORBIT_API_KEY && env.KCS_ORBIT_ORGANIZATION_ID)
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

  return response.json() as Promise<OrbitSharedDirectory>
}

function splitName(person: { fullName?: string | null; firstName?: string | null; lastName?: string | null }) {
  const cleanFullName = (person.fullName ?? '').trim()
  const parts = cleanFullName.split(/\s+/).filter(Boolean)
  return {
    firstName: person.firstName || parts[0] || '',
    lastName: person.lastName || parts.slice(1).join(' ') || '',
  }
}

function splitClassName(className?: string | null) {
  const cleanClassName = (className ?? '').trim()
  if (!cleanClassName) {
    return { grade: 'Grade 1', section: '' }
  }

  const match = cleanClassName.match(/^(.*?)(?:\s+([A-Z]))?$/)
  return {
    grade: match?.[1]?.trim() || cleanClassName,
    section: match?.[2] || '',
  }
}

function orbitExternalId(student: OrbitStudent) {
  const savanexId = student.externalIds?.find((item) => item.appSlug === 'SAVANEX')?.externalId
  return student.studentNumber || savanexId || student.id
}

function orbitManagingApp(student: OrbitStudent) {
  if (student.externalIds?.some((item) => item.appSlug === 'KCS_NEXUS')) {
    return 'KCS_NEXUS'
  }

  return student.externalIds?.[0]?.appSlug ?? null
}

async function updateRegistryEntityInOrbit(identifier: string, organizationId: string, payload: object, identifierType: 'orbitId' | 'externalId' = 'orbitId') {
  const response = await fetch(
    `${env.KCS_ORBIT_API_URL!.replace(/\/$/, '')}/api/integration/registry/student/${encodeURIComponent(identifier)}?organizationId=${encodeURIComponent(organizationId)}&identifierType=${encodeURIComponent(identifierType)}`,
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

async function deleteRegistryEntityInOrbit(entityType: 'student', identifier: string, organizationId: string, identifierType: 'orbitId' | 'externalId' = 'orbitId') {
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

function orbitStudentsToProfiles(directory: OrbitSharedDirectory) {
  const parentsById = new Map(directory.parents.map((parent) => [parent.id, parent]))

  return directory.students.map((student) => {
    const studentName = splitName(student)
    const parent = student.parentId ? parentsById.get(student.parentId) : undefined
    const parentName = parent ? splitName(parent) : { firstName: '', lastName: '' }
    const classParts = splitClassName(student.className)
    const managingApp = orbitManagingApp(student)

    return {
      id: student.id,
      userId: student.id,
      studentNumber: orbitExternalId(student),
      grade: classParts.grade,
      section: classParts.section,
      status: (student.status ?? 'active').toLowerCase(),
      gpa: 0,
      attendanceRate: 100,
      enrollmentDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      user: {
        id: student.id,
        email: student.email ?? '',
        firstName: studentName.firstName,
        lastName: studentName.lastName,
        phone: student.phone ?? null,
        role: 'STUDENT',
      },
      parentLinks: parent ? [{
        id: `${student.id}:${parent.id}`,
        studentId: student.id,
        parentId: parent.id,
        relation: 'Parent',
        parent: {
          id: parent.id,
          email: parent.email ?? null,
          firstName: parentName.firstName,
          lastName: parentName.lastName,
          phone: parent.phone ?? null,
          role: 'PARENT',
        },
      }] : [],
      externalIds: student.externalIds ?? [],
      managingApp,
      syncSource: 'orbit',
      isEditable: managingApp === 'KCS_NEXUS',
      isDeletable: true,
    }
  })
}

const createStudentSchema = z.object({
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
    section: z.string().default(''),
  }),
})

const createFamilySchema = z.object({
  parent: createStudentSchema.shape.parent,
  students: z.array(createStudentSchema.shape.student).min(1),
})

function generateTemporaryPassword() {
  return `KCS-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

function normalizeCreateStudentPayload(payload: unknown) {
  const asFamily = createFamilySchema.safeParse(payload)
  if (asFamily.success) return asFamily.data

  const asSingleStudent = createStudentSchema.parse(payload)
  return {
    parent: asSingleStudent.parent,
    students: [asSingleStudent.student],
  }
}

studentsRouter.get('/', authenticate, requireRoles('admin', 'teacher', 'parent'), asyncHandler(async (_req, res) => {
  if (orbitRegistryIsEnabled()) {
    const directory = await getSharedDirectoryFromOrbit()
    return success(res, orbitStudentsToProfiles(directory), 'Students loaded from Orbit')
  }

  const students = await prisma.studentProfile.findMany({
    include: {
      user: true,
      parentLinks: { include: { parent: true } },
    },
    orderBy: { enrollmentDate: 'desc' },
  })
  return success(res, students)
}))

studentsRouter.post('/', authenticate, requireRoles('admin'), asyncHandler(async (req, res) => {
  const { parent, students } = normalizeCreateStudentPayload(req.body)

  const studentNumbers = students.map((student) => student.studentNumber)
  if (new Set(studentNumbers).size !== studentNumbers.length) {
    throw new ApiError(409, 'Duplicate student numbers in request')
  }

  const existingStudents = await prisma.studentProfile.findMany({
    where: { studentNumber: { in: studentNumbers } },
    select: { studentNumber: true },
  })
  if (existingStudents.length > 0) {
    throw new ApiError(409, `Student number already exists: ${existingStudents.map((student) => student.studentNumber).join(', ')}`)
  }

  const studentEmails = students.map((student) => student.email ?? `${student.studentNumber.toLowerCase()}@students.kcs.local`)
  if (new Set(studentEmails.map((email) => email.toLowerCase())).size !== studentEmails.length) {
    throw new ApiError(409, 'Duplicate student emails in request')
  }
  const existingStudentUsers = await prisma.user.findMany({
    where: { email: { in: studentEmails } },
    select: { email: true },
  })
  if (existingStudentUsers.length > 0) {
    throw new ApiError(409, `Student email already exists: ${existingStudentUsers.map((user) => user.email).join(', ')}`)
  }

  const temporaryCredentials: {
    parent: { username: string; temporaryPassword: string } | null
    students: Array<{ studentId: string; username: string; temporaryPassword: string }>
  } = {
    parent: null,
    students: [],
  }

  const family = await prisma.$transaction(async (tx) => {
    const existingParent = await tx.user.findUnique({ where: { email: parent.email } })
    const parentTemporaryPassword = existingParent?.passwordHash ? null : generateTemporaryPassword()
    const parentPasswordHash = parentTemporaryPassword ? await bcrypt.hash(parentTemporaryPassword, 10) : undefined
    const parentUser = await tx.user.upsert({
      where: { email: parent.email },
      update: {
        firstName: parent.firstName,
        lastName: parent.lastName,
        phone: parent.phone,
        passwordHash: parentPasswordHash,
        role: 'PARENT',
      },
      create: {
        email: parent.email,
        firstName: parent.firstName,
        lastName: parent.lastName,
        phone: parent.phone,
        passwordHash: parentPasswordHash,
        role: 'PARENT',
      },
    })

    if (parentTemporaryPassword) {
      temporaryCredentials.parent = {
        username: parentUser.email,
        temporaryPassword: parentTemporaryPassword,
      }
    }

    const createdStudents = []
    for (const [index, student] of students.entries()) {
      const studentEmail = studentEmails[index]
      const studentTemporaryPassword = generateTemporaryPassword()
      const studentUser = await tx.user.create({
        data: {
          email: studentEmail,
          firstName: student.firstName,
          lastName: student.lastName,
          passwordHash: await bcrypt.hash(studentTemporaryPassword, 10),
          role: 'STUDENT',
          studentProfile: {
            create: {
              studentNumber: student.studentNumber,
              grade: student.grade,
              section: student.section || '',
              status: 'active',
              gpa: 0,
              attendanceRate: 100,
              parentLinks: {
                create: {
                  parent: { connect: { id: parentUser.id } },
                  relation: parent.relationship,
                },
              },
            },
          },
        },
        include: {
          studentProfile: {
            include: {
              user: true,
              parentLinks: { include: { parent: true } },
            },
          },
        },
      })

      if (studentUser.studentProfile) {
        createdStudents.push(studentUser.studentProfile)
        temporaryCredentials.students.push({
          studentId: student.studentNumber,
          username: studentEmail,
          temporaryPassword: studentTemporaryPassword,
        })
      }
    }

    return {
      parent: parentUser,
      students: createdStudents,
      studentCount: createdStudents.length,
      temporaryCredentials,
    }
  })

  return success(res, {
    ...family,
    student: family.students[0] ?? null,
  }, family.studentCount === 1 ? 'Student created' : 'Family registered', 201)
}))

studentsRouter.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const studentId = getRouteParam(req.params.id)
  const student = await prisma.studentProfile.findUnique({
    where: { id: studentId },
    include: {
      user: true,
      parentLinks: { include: { parent: true } },
      enrollments: { include: { course: true } },
    },
  })
  if (!student) throw new ApiError(404, 'Student not found')
  return success(res, student)
}))

studentsRouter.get('/:id/grades', authenticate, asyncHandler(async (req, res) => {
  const studentId = getRouteParam(req.params.id)
  const grades = await prisma.grade.findMany({
    where: { studentId },
    include: { course: true },
    orderBy: { createdAt: 'desc' },
  })
  return success(res, grades)
}))

studentsRouter.get('/:id/assignments', authenticate, asyncHandler(async (req, res) => {
  const studentId = getRouteParam(req.params.id)
  const submissions = await prisma.assignmentSubmission.findMany({
    where: { studentId },
    include: { assignment: { include: { course: true } } },
    orderBy: { assignment: { dueDate: 'asc' } },
  })
  return success(res, submissions)
}))

studentsRouter.get('/:id/timetable', authenticate, asyncHandler(async (req, res) => {
  const studentId = getRouteParam(req.params.id)
  const student = await prisma.studentProfile.findUnique({
    where: { id: studentId },
    include: {
      enrollments: {
        include: {
          course: {
            include: { schedules: true },
          },
        },
      },
    },
  })
  if (!student) throw new ApiError(404, 'Student not found')
  const timetable = student.enrollments.flatMap((enrollment) => enrollment.course.schedules)
  return success(res, timetable)
}))

studentsRouter.get('/:id/analytics', authenticate, asyncHandler(async (req, res) => {
  const studentId = getRouteParam(req.params.id)
  const student = await prisma.studentProfile.findUnique({
    where: { id: studentId },
    include: { aiRecommendations: true, grades: true },
  })
  if (!student) throw new ApiError(404, 'Student not found')

  const overallPercentage = student.grades.length
    ? student.grades.reduce((sum, grade) => sum + grade.percentage, 0) / student.grades.length
    : 0

  return success(res, {
    studentId: student.id,
    overallGPA: student.gpa ?? Number((overallPercentage / 25).toFixed(2)),
    attendanceRate: student.attendanceRate ?? 0,
    assignmentCompletion: 91,
    riskLevel: overallPercentage < 70 ? 'high' : overallPercentage < 82 ? 'medium' : 'low',
    recommendations: student.aiRecommendations,
    performanceTrend: overallPercentage > 85 ? 'improving' : 'stable',
  })
}))

studentsRouter.put('/:id', authenticate, requireRoles('admin', 'teacher'), asyncHandler(async (req, res) => {
  const studentId = getRouteParam(req.params.id)
  const payload = studentUpdateSchema.parse(req.body)

  if (orbitRegistryIsEnabled()) {
    const directory = await getSharedDirectoryFromOrbit()
    const target = directory.students.find((student) => student.id === studentId)
    if (!target) throw new ApiError(404, 'Student not found')

    if (orbitManagingApp(target) !== 'KCS_NEXUS') {
      throw new ApiError(409, 'This student is managed by another application. Update it in its source system.')
    }

    const currentClass = splitClassName(target.className)
    const updated = await updateRegistryEntityInOrbit(studentId, env.KCS_ORBIT_ORGANIZATION_ID!, {
      ...(payload.firstName !== undefined ? { firstName: payload.firstName } : {}),
      ...(payload.lastName !== undefined ? { lastName: payload.lastName } : {}),
      ...(payload.email !== undefined ? { email: payload.email } : {}),
      ...(payload.studentNumber !== undefined ? { studentNumber: payload.studentNumber } : {}),
      ...(payload.status !== undefined ? { status: payload.status.toUpperCase() } : {}),
      ...(payload.grade !== undefined || payload.section !== undefined
        ? { className: `${payload.grade ?? currentClass.grade} ${payload.section ?? currentClass.section}`.trim() }
        : {}),
    })

    return success(res, updated, 'Student updated through Orbit')
  }

  const currentStudent = await prisma.studentProfile.findUnique({
    where: { id: studentId },
    include: {
      user: true,
      parentLinks: { include: { parent: true } },
    },
  })
  if (!currentStudent) throw new ApiError(404, 'Student not found')

  if (payload.studentNumber) {
    const duplicateStudentNumber = await prisma.studentProfile.findFirst({
      where: {
        id: { not: studentId },
        studentNumber: payload.studentNumber,
      },
      select: { studentNumber: true },
    })
    if (duplicateStudentNumber) {
      throw new ApiError(409, `Student number already exists: ${payload.studentNumber}`)
    }
  }

  if (payload.email) {
    const duplicateStudentEmail = await prisma.user.findFirst({
      where: {
        id: { not: currentStudent.userId },
        email: payload.email,
      },
      select: { email: true },
    })
    if (duplicateStudentEmail) {
      throw new ApiError(409, `Student email already exists: ${payload.email}`)
    }
  }

  const student = await prisma.$transaction(async (tx) => {
    if (payload.firstName !== undefined || payload.lastName !== undefined || payload.email !== undefined) {
      await tx.user.update({
        where: { id: currentStudent.userId },
        data: {
          ...(payload.firstName !== undefined ? { firstName: payload.firstName } : {}),
          ...(payload.lastName !== undefined ? { lastName: payload.lastName } : {}),
          ...(payload.email !== undefined ? { email: payload.email } : {}),
        },
      })
    }

    return tx.studentProfile.update({
      where: { id: studentId },
      data: {
        ...(payload.studentNumber !== undefined ? { studentNumber: payload.studentNumber } : {}),
        ...(payload.grade !== undefined ? { grade: payload.grade } : {}),
        ...(payload.section !== undefined ? { section: payload.section } : {}),
        ...(payload.status !== undefined ? { status: payload.status.toLowerCase() } : {}),
      },
      include: {
        user: true,
        parentLinks: { include: { parent: true } },
      },
    })
  })

  return success(res, student, 'Student updated successfully')
}))

studentsRouter.delete('/:id', authenticate, requireRoles('admin'), asyncHandler(async (req, res) => {
  const studentId = getRouteParam(req.params.id)

  if (orbitRegistryIsEnabled()) {
    const directory = await getSharedDirectoryFromOrbit()
    const target = directory.students.find((student) => student.id === studentId)
    if (!target) throw new ApiError(404, 'Student not found')

    await deleteRegistryEntityInOrbit('student', studentId, env.KCS_ORBIT_ORGANIZATION_ID!, 'orbitId')
    return success(res, { id: studentId }, 'Student deleted through Orbit')
  }

  const student = await prisma.studentProfile.findUnique({ where: { id: studentId } })
  if (!student) throw new ApiError(404, 'Student not found')

  await prisma.user.delete({ where: { id: student.userId } })
  return success(res, { id: studentId }, 'Student deleted')
}))
