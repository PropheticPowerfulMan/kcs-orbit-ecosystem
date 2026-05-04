import { Router } from 'express'
import { z } from 'zod'
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

studentsRouter.get('/', authenticate, requireRoles('admin', 'teacher', 'parent'), asyncHandler(async (_req, res) => {
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
  const { parent, student } = createStudentSchema.parse(req.body)

  const exists = await prisma.studentProfile.findUnique({ where: { studentNumber: student.studentNumber } })
  if (exists) throw new ApiError(409, 'Student number already exists')

  const createdStudent = await prisma.$transaction(async (tx) => {
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

    return studentUser.studentProfile
  })

  return success(res, createdStudent, 'Student created', 201)
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
  const student = await prisma.studentProfile.update({
    where: { id: studentId },
    data: req.body,
    include: { user: true },
  })
  return success(res, student, 'Student updated')
}))

studentsRouter.delete('/:id', authenticate, requireRoles('admin'), asyncHandler(async (req, res) => {
  const studentId = getRouteParam(req.params.id)
  const student = await prisma.studentProfile.findUnique({ where: { id: studentId } })
  if (!student) throw new ApiError(404, 'Student not found')

  await prisma.user.delete({ where: { id: student.userId } })
  return success(res, { id: studentId }, 'Student deleted')
}))
