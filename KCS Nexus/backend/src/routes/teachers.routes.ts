import { Router } from 'express'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '../config/prisma.js'
import { authenticate, requireRoles, type AuthenticatedRequest } from '../middleware/auth.js'
import { ApiError, asyncHandler, success } from '../utils/api.js'
import { getRouteParam } from '../utils/request.js'

export const teachersRouter = Router()

const workspaceSchema = z.object({
  state: z.record(z.unknown()),
  revision: z.number().int().nonnegative().optional(),
})

teachersRouter.get('/me/workspace', authenticate, requireRoles('teacher'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const workspace = await prisma.teacherWorkspace.findUnique({ where: { userId: req.user!.sub } })
  return success(res, workspace)
}))

teachersRouter.put('/me/workspace', authenticate, requireRoles('teacher'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const payload = workspaceSchema.parse(req.body)
  const user = await prisma.user.findUnique({ where: { id: req.user!.sub }, select: { id: true, role: true } })
  if (!user) throw new ApiError(404, 'Authenticated user not found')
  if (user.role !== 'TEACHER' && user.role !== 'ADMIN') throw new ApiError(403, 'Teacher workspace access required')

  const workspace = await prisma.$transaction(async (tx) => {
    const existing = await tx.teacherWorkspace.findUnique({ where: { userId: user.id } })
    if (existing && payload.revision !== undefined && payload.revision !== existing.revision) {
      throw new ApiError(409, 'This teacher workspace was updated in another session. Reload it before saving again.')
    }
    if (!existing) {
      return tx.teacherWorkspace.create({ data: { userId: user.id, state: payload.state as Prisma.InputJsonValue } })
    }
    return tx.teacherWorkspace.update({
      where: { userId: user.id },
      data: { state: payload.state as Prisma.InputJsonValue, revision: { increment: 1 } },
    })
  })

  await prisma.auditLog.create({
    data: { actorId: user.id, action: 'TEACHER_WORKSPACE_SAVED', targetType: 'TeacherWorkspace', targetId: workspace.id, metadata: { revision: workspace.revision } },
  })
  return success(res, workspace, 'Teacher workspace saved')
}))

teachersRouter.get('/me/overview', authenticate, requireRoles('teacher'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const teacher = await prisma.teacherProfile.findUnique({
    where: { userId: req.user!.sub },
    select: {
      id: true, employeeNumber: true, department: true, qualification: true, homeroomGrade: true, homeroomSection: true,
      user: { select: { id: true, firstName: true, lastName: true } },
      courses: {
        select: {
          id: true, name: true, code: true, description: true, grade: true, credits: true,
          schedules: { select: { id: true, day: true, startTime: true, endTime: true, room: true } },
          enrollments: { select: { studentId: true, student: { select: { id: true, studentNumber: true, grade: true, section: true, status: true, gpa: true, attendanceRate: true, user: { select: { id: true, firstName: true, lastName: true } } } } } },
          assignments: { select: { id: true, title: true, description: true, dueDate: true, maxScore: true, type: true, submissions: { select: { id: true, studentId: true, submittedAt: true, score: true, status: true } } }, orderBy: { dueDate: 'asc' } },
          grades: { select: { id: true, studentId: true, assignmentId: true, score: true, maxScore: true, percentage: true, letterGrade: true, period: true, createdAt: true }, orderBy: { createdAt: 'desc' } },
        },
      },
    },
  })
  if (!teacher) return success(res, { profile: null, courses: [], students: [], assignments: [], grades: [], timetable: [] }, 'Teacher profile synchronization pending')
  const students = new Map<string, unknown>()
  teacher.courses.forEach((course) => course.enrollments.forEach(({ student }) => students.set(student.id, student)))
  return success(res, {
    profile: { id: teacher.id, employeeNumber: teacher.employeeNumber, department: teacher.department, qualification: teacher.qualification, homeroomGrade: teacher.homeroomGrade, homeroomSection: teacher.homeroomSection, user: teacher.user },
    courses: teacher.courses,
    students: [...students.values()],
    assignments: teacher.courses.flatMap((course) => course.assignments.map((assignment) => ({ ...assignment, courseId: course.id, courseName: course.name }))),
    grades: teacher.courses.flatMap((course) => course.grades.map((grade) => ({ ...grade, courseId: course.id, courseName: course.name }))),
    timetable: teacher.courses.flatMap((course) => course.schedules.map((schedule) => ({ ...schedule, courseId: course.id, courseName: course.name, studentCount: course.enrollments.length }))),
  }, 'Teacher dashboard loaded')
}))
teachersRouter.get('/workspaces', authenticate, requireRoles('staff'), asyncHandler(async (_req, res) => {
  const workspaces = await prisma.teacherWorkspace.findMany({
    include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
    orderBy: { updatedAt: 'desc' },
  })
  return success(res, workspaces)
}))

teachersRouter.get('/', authenticate, requireRoles('admin', 'staff'), asyncHandler(async (_req, res) => {
  const teachers = await prisma.teacherProfile.findMany({ include: { user: true, courses: true } })
  return success(res, teachers)
}))

teachersRouter.get('/:id', authenticate, asyncHandler(async (req: AuthenticatedRequest, res) => {
  if (req.user!.role === 'teacher') {
    const ownProfile = await prisma.teacherProfile.findUnique({ where: { userId: req.user!.sub }, select: { id: true } })
    if (!ownProfile || ownProfile.id !== getRouteParam(req.params.id)) throw new ApiError(403, 'You may only access your own teacher profile')
  } else if (!['admin', 'staff'].includes(req.user!.role)) {
    throw new ApiError(403, 'Teacher profile access denied')
  }
  const teacherId = getRouteParam(req.params.id)
  const teacher = await prisma.teacherProfile.findUnique({
    where: { id: teacherId },
    include: { user: true, courses: { include: { schedules: true } } },
  })
  if (!teacher) throw new ApiError(404, 'Teacher not found')
  return success(res, teacher)
}))

teachersRouter.post('/', authenticate, requireRoles('admin'), asyncHandler(async (req, res) => {
  const teacher = await prisma.teacherProfile.create({ data: req.body, include: { user: true } })
  return success(res, teacher, 'Teacher created', 201)
}))

teachersRouter.put('/:id', authenticate, requireRoles('admin'), asyncHandler(async (req, res) => {
  const teacherId = getRouteParam(req.params.id)
  const teacher = await prisma.teacherProfile.update({ where: { id: teacherId }, data: req.body, include: { user: true } })
  return success(res, teacher, 'Teacher updated')
}))
