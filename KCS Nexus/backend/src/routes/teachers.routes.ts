import { Router } from 'express'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { env } from '../config/env.js'
import { prisma } from '../config/prisma.js'
import { authenticate, requireRoles, type AuthenticatedRequest } from '../middleware/auth.js'
import { ApiError, asyncHandler, success } from '../utils/api.js'
import { getRouteParam } from '../utils/request.js'
import { belongsToTeacherClasses, extractWorkspaceClasses } from '../utils/teacherClassAccess.js'
import { ensureTeacherProfile } from '../utils/teacherProfile.js'

export const teachersRouter = Router()

type OrbitDirectoryStudent = {
  id: string
  fullName?: string | null
  firstName?: string | null
  middleName?: string | null
  lastName?: string | null
  studentNumber?: string | null
  className?: string | null
  status?: string | null
  externalIds?: Array<{ appSlug: string; externalId: string }>
}

type OrbitSharedDirectory = {
  students?: OrbitDirectoryStudent[]
}

const orbitRegistryIsEnabled = () => Boolean(
  env.KCS_ORBIT_API_URL && env.KCS_ORBIT_API_KEY && env.KCS_ORBIT_ORGANIZATION_ID,
)

const orbitStudentName = (student: OrbitDirectoryStudent) => {
  const parts = (student.fullName ?? '').trim().split(/\s+/).filter(Boolean)
  return {
    firstName: student.firstName?.trim() || parts.at(-1) || '',
    middleName: student.middleName?.trim() || (parts.length > 2 ? parts.slice(1, -1).join(' ') : null),
    lastName: student.lastName?.trim() || parts[0] || '',
  }
}

const getOrbitStudentDirectory = async () => {
  if (!orbitRegistryIsEnabled()) return null

  const response = await fetch(
    `${env.KCS_ORBIT_API_URL!.replace(/\/$/, '')}/api/integration/read/shared-directory?organizationId=${encodeURIComponent(env.KCS_ORBIT_ORGANIZATION_ID!)}`,
    {
      headers: {
        'x-api-key': env.KCS_ORBIT_API_KEY!,
        'x-app-slug': 'KCS_NEXUS',
      },
      signal: AbortSignal.timeout(10_000),
    },
  )
  if (!response.ok) {
    throw new Error(`Orbit shared directory request failed with status ${response.status}`)
  }

  const directory = await response.json() as OrbitSharedDirectory
  return (directory.students ?? [])
    .filter((student) => (student.status ?? 'active').toLowerCase() === 'active')
    .map((student) => {
      const name = orbitStudentName(student)
      const studentNumber = student.studentNumber
        || student.externalIds?.find((item) => item.appSlug === 'SAVANEX')?.externalId
        || student.id
      return {
        id: student.id,
        studentNumber,
        grade: student.className?.trim() || 'Unassigned',
        section: '',
        status: 'active',
        user: {
          id: student.id,
          firstName: name.firstName,
          middleName: name.middleName,
          lastName: name.lastName,
        },
      }
    })
}

const workspaceSchema = z.object({
  state: z.record(z.unknown()),
  revision: z.number().int().nonnegative().optional(),
})

const attendanceBulkSchema = z.object({
  courseId: z.string().min(1),
  date: z.coerce.date(),
  period: z.string().max(80).optional(),
  entries: z.array(z.object({
    studentId: z.string().min(1),
    status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED', 'SICK', 'SUSPENDED']),
    note: z.string().max(500).optional(),
  })).min(1).max(500),
})

const assignmentCreateSchema = z.object({
  courseId: z.string().min(1),
  title: z.string().min(2).max(180),
  description: z.string().min(2).max(5000),
  dueDate: z.coerce.date(),
  maxScore: z.coerce.number().positive().max(10000),
  type: z.enum(['HOMEWORK', 'QUIZ', 'EXAM', 'PROJECT', 'LAB']),
})

const teacherCourseSyncSchema = z.object({
  id: z.string().min(3).max(120),
  name: z.string().trim().min(2).max(180),
  abbreviation: z.string().trim().max(30).optional().default(''),
  description: z.string().trim().max(5000).optional().default('Managed from Teacher My Courses'),
  grade: z.string().trim().min(1).max(80),
  credits: z.coerce.number().int().min(1).max(20).default(1),
  room: z.string().trim().max(80).optional().default(''),
  studentIds: z.array(z.string().min(1)).max(1000).default([]),
  studentNumbers: z.array(z.string().min(1).max(100)).max(1000).default([]),
})

const submissionGradeSchema = z.object({
  score: z.coerce.number().min(0),
  feedback: z.string().max(5000).optional(),
})

const ownedCourse = async (userId: string, courseId: string) => {
  const course = await prisma.course.findFirst({
    where: { id: courseId, teacher: { userId } },
    include: {
      enrollments: { include: { student: { include: { user: true } } } },
      assignments: {
        include: { submissions: { include: { student: { include: { user: true } } } } },
        orderBy: { dueDate: 'desc' },
      },
    },
  })
  if (!course) throw new ApiError(403, 'This course is not assigned to the authenticated teacher')
  return course
}

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

teachersRouter.put('/me/courses/sync', authenticate, requireRoles('teacher'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const payload = teacherCourseSyncSchema.parse(req.body)
  if (new Set(payload.studentIds).size !== payload.studentIds.length) throw new ApiError(400, 'Duplicate learner in course enrollment')
  const teacher = await ensureTeacherProfile(req.user!.sub)
  const existing = await prisma.course.findUnique({ where: { id: payload.id }, select: { id: true, teacherId: true, code: true } })
  if (existing && existing.teacherId !== teacher.id) throw new ApiError(403, 'This official course belongs to another teacher')
  const normalizedStudentNumbers = [...new Set(payload.studentNumbers.map((value) => value.trim().toLowerCase()).filter(Boolean))]
  const uniqueStudentIds = [...new Set(payload.studentIds)]
  // Orbit rows can carry external ids. The student number is the stable key
  // shared with the local Nexus registry, so prefer it whenever available.
  const requestedCount = normalizedStudentNumbers.length || uniqueStudentIds.length
  const students = requestedCount
    ? await prisma.studentProfile.findMany({
        where: {
          status: { equals: 'active', mode: 'insensitive' },
          ...(normalizedStudentNumbers.length
            ? { studentNumber: { in: normalizedStudentNumbers, mode: 'insensitive' } }
            : { id: { in: uniqueStudentIds } }),
        },
        select: { id: true },
      })
    : []
  const resolvedStudentIds = [...new Set(students.map((student) => student.id))]
  if (resolvedStudentIds.length !== requestedCount) throw new ApiError(400, 'One or more selected learners are not active in the official Nexus registry')
  const codeBase = (payload.abbreviation || payload.name)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toUpperCase().slice(0, 18) || 'COURSE'
  const classCode = payload.grade.replace(/[^a-z0-9]+/gi, '').toUpperCase().slice(0, 10)
  let code = existing?.code ?? `${codeBase}-${classCode}`
  const collision = await prisma.course.findFirst({ where: { code, id: { not: payload.id } }, select: { id: true } })
  if (collision) code = `${codeBase}-${classCode}-${payload.id.slice(-6).toUpperCase()}`
  const course = await prisma.$transaction(async (tx) => {
    const saved = existing
      ? await tx.course.update({ where: { id: payload.id }, data: { name: payload.name, description: payload.description, grade: payload.grade, credits: payload.credits, code } })
      : await tx.course.create({ data: { id: payload.id, teacherId: teacher.id, name: payload.name, description: payload.description, grade: payload.grade, credits: payload.credits, code } })
    await tx.enrollment.deleteMany({ where: { courseId: saved.id, studentId: { notIn: resolvedStudentIds } } })
    if (resolvedStudentIds.length) await tx.enrollment.createMany({ data: resolvedStudentIds.map((studentId) => ({ courseId: saved.id, studentId })), skipDuplicates: true })
    await tx.auditLog.create({ data: { actorId: req.user!.sub, action: 'TEACHER_COURSE_SYNCHRONIZED', targetType: 'Course', targetId: saved.id, metadata: { grade: payload.grade, credits: payload.credits, room: payload.room, enrolledStudents: resolvedStudentIds.length } } })
    return tx.course.findUnique({ where: { id: saved.id }, include: { enrollments: { select: { studentId: true } } } })
  })
  return success(res, course, 'My Courses synchronized with the official academic registry')
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
          enrollments: { select: { studentId: true, student: { select: { id: true, studentNumber: true, grade: true, section: true, status: true, gpa: true, attendanceRate: true, user: { select: { id: true, firstName: true, middleName: true, lastName: true } } } } } },
          assignments: { select: { id: true, title: true, description: true, dueDate: true, maxScore: true, type: true, submissions: { select: { id: true, studentId: true, submittedAt: true, score: true, status: true } } }, orderBy: { dueDate: 'asc' } },
          grades: { select: { id: true, studentId: true, assignmentId: true, score: true, maxScore: true, percentage: true, letterGrade: true, period: true, createdAt: true }, orderBy: { createdAt: 'desc' } },
        },
      },
    },
  })
  const localStudentDirectory = await prisma.studentProfile.findMany({
    where: { status: { equals: 'active', mode: 'insensitive' } },
    select: {
      id: true, studentNumber: true, grade: true, section: true, status: true,
      user: { select: { id: true, firstName: true, middleName: true, lastName: true } },
    },
    orderBy: [{ grade: 'asc' }, { section: 'asc' }, { user: { lastName: 'asc' } }],
  })
  let studentDirectory = localStudentDirectory
  try {
    studentDirectory = await getOrbitStudentDirectory() ?? localStudentDirectory
  } catch (error) {
    console.warn('[teacher-overview] Orbit student directory unavailable; using local Nexus registry.', error)
  }
  if (!teacher || !teacher.courses.length) {
    const workspace = await prisma.teacherWorkspace.findUnique({ where: { userId: req.user!.sub }, select: { state: true } })
    const assignedClasses = extractWorkspaceClasses(workspace?.state)
    const registry = await prisma.studentProfile.findMany({
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        parentLinks: { select: { parentId: true } },
      },
      orderBy: [{ grade: 'asc' }, { section: 'asc' }, { user: { lastName: 'asc' } }],
    })
    const students = registry.filter((student) => belongsToTeacherClasses(student, assignedClasses)).map((student) => ({
      ...student,
      analytics: {
        average: student.gpa ?? null,
        attendanceRate: student.attendanceRate ?? null,
        rank: null,
        risk: 'unassessed',
        strengths: [],
        weaknesses: [],
        gradedItems: 0,
        attendanceRecords: 0,
        missingAssignments: 0,
      },
    }))
    return success(res, {
      profile: teacher ? {
        id: teacher.id,
        employeeNumber: teacher.employeeNumber,
        department: teacher.department,
        qualification: teacher.qualification,
        homeroomGrade: teacher.homeroomGrade,
        homeroomSection: teacher.homeroomSection,
        user: teacher.user,
      } : null,
      courses: [], students, studentDirectory, assignments: [], grades: [], timetable: [],
    }, teacher ? 'Teacher roster loaded while official courses synchronize' : 'Teacher roster loaded while profile synchronization is pending')
  }
  const students = new Map<string, any>()
  teacher.courses.forEach((course) => course.enrollments.forEach(({ student }) => students.set(student.id, student)))
  const studentIds = [...students.keys()]
  const attendance = studentIds.length ? await prisma.attendanceRecord.findMany({
    where: { studentId: { in: studentIds }, recordedById: req.user!.sub },
    select: { studentId: true, status: true },
  }) : []
  const now = new Date()
  const analyticsStudents = [...students.values()].map((student) => {
    const grades = teacher.courses.flatMap((course) => course.grades.filter((grade) => grade.studentId === student.id).map((grade) => ({ ...grade, courseName: course.name })))
    const attendanceRows = attendance.filter((record) => record.studentId === student.id)
    const submissions = teacher.courses.flatMap((course) => course.assignments.flatMap((assignment) => assignment.submissions.filter((submission) => submission.studentId === student.id).map((submission) => ({ ...submission, dueDate: assignment.dueDate }))))
    const average = grades.length ? Number((grades.reduce((sum, grade) => sum + grade.percentage, 0) / grades.length).toFixed(1)) : null
    const present = attendanceRows.filter((record) => ['PRESENT', 'LATE', 'EXCUSED'].includes(record.status)).length
    const attendanceRate = attendanceRows.length ? Number(((present / attendanceRows.length) * 100).toFixed(1)) : null
    const attendanceSummary = {
      total: attendanceRows.length,
      present: attendanceRows.filter((record) => record.status === 'PRESENT').length,
      absent: attendanceRows.filter((record) => record.status === 'ABSENT').length,
      late: attendanceRows.filter((record) => record.status === 'LATE').length,
      excused: attendanceRows.filter((record) => record.status === 'EXCUSED').length,
      sick: attendanceRows.filter((record) => record.status === 'SICK').length,
      suspended: attendanceRows.filter((record) => record.status === 'SUSPENDED').length,
      attendanceRate,
    }
    const missingAssignments = submissions.filter((submission) => submission.status === 'PENDING' && submission.dueDate < now).length
    const courseAverages = teacher.courses.map((course) => {
      const values = course.grades.filter((grade) => grade.studentId === student.id)
      return { name: course.name, average: values.length ? values.reduce((sum, grade) => sum + grade.percentage, 0) / values.length : null }
    }).filter((item) => item.average !== null)
    const risk = average === null && attendanceRate === null && !missingAssignments ? 'unassessed' : average !== null && average < 60 || attendanceRate !== null && attendanceRate < 80 || missingAssignments >= 2 ? 'high' : average !== null && average < 70 || attendanceRate !== null && attendanceRate < 90 || missingAssignments ? 'medium' : 'low'
    return {
      ...student,
      analytics: {
        average,
        attendanceRate,
        attendanceSummary,
        gradedItems: grades.length,
        attendanceRecords: attendanceRows.length,
        missingAssignments,
        risk,
        strengths: courseAverages.filter((item) => item.average! >= 80).map((item) => item.name),
        weaknesses: courseAverages.filter((item) => item.average! < 60).map((item) => item.name),
        rank: null as number | null,
      },
    }
  })
  analyticsStudents.filter((student) => student.analytics.average !== null).sort((a, b) => b.analytics.average! - a.analytics.average!).forEach((student, index) => { student.analytics.rank = index + 1 })
  return success(res, {
    profile: { id: teacher.id, employeeNumber: teacher.employeeNumber, department: teacher.department, qualification: teacher.qualification, homeroomGrade: teacher.homeroomGrade, homeroomSection: teacher.homeroomSection, user: teacher.user },
    courses: teacher.courses,
    students: analyticsStudents,
    studentDirectory,
    assignments: teacher.courses.flatMap((course) => course.assignments.map((assignment) => ({ ...assignment, courseId: course.id, courseName: course.name }))),
    grades: teacher.courses.flatMap((course) => course.grades.map((grade) => ({ ...grade, courseId: course.id, courseName: course.name }))),
    timetable: teacher.courses.flatMap((course) => course.schedules.map((schedule) => ({ ...schedule, courseId: course.id, courseName: course.name, studentCount: course.enrollments.length }))),
  }, 'Teacher dashboard loaded')
}))

teachersRouter.get('/me/attendance', authenticate, requireRoles('teacher'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const courseId = String(req.query.courseId ?? '')
  if (!courseId) throw new ApiError(400, 'courseId is required')
  const course = await ownedCourse(req.user!.sub, courseId)
  const date = req.query.date ? new Date(String(req.query.date)) : undefined
  const records = await prisma.attendanceRecord.findMany({
    where: {
      studentId: { in: course.enrollments.map((item) => item.studentId) },
      className: course.grade,
      ...(date && !Number.isNaN(date.getTime()) ? { date } : {}),
    },
    include: { student: { include: { user: true } } },
    orderBy: [{ date: 'desc' }, { student: { user: { lastName: 'asc' } } }],
  })
  return success(res, { course: { id: course.id, name: course.name, grade: course.grade }, records })
}))

teachersRouter.post('/me/attendance/bulk', authenticate, requireRoles('teacher'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const payload = attendanceBulkSchema.parse(req.body)
  const course = await ownedCourse(req.user!.sub, payload.courseId)
  const enrolled = new Set(course.enrollments.map((item) => item.studentId))
  if (payload.entries.some((entry) => !enrolled.has(entry.studentId))) throw new ApiError(403, 'Attendance contains a student who is not enrolled in this course')
  const date = new Date(payload.date)
  date.setUTCHours(0, 0, 0, 0)
  const records = await prisma.$transaction(async (tx) => {
    const saved = []
    for (const entry of payload.entries) {
      await tx.attendanceRecord.deleteMany({ where: { studentId: entry.studentId, date, className: course.grade, period: payload.period ?? null } })
      saved.push(await tx.attendanceRecord.create({ data: { studentId: entry.studentId, recordedById: req.user!.sub, date, className: course.grade, period: payload.period, subject: course.name, status: entry.status, note: entry.note } }))
    }
    await tx.auditLog.create({ data: { actorId: req.user!.sub, action: 'TEACHER_ATTENDANCE_RECORDED', targetType: 'Course', targetId: course.id, metadata: { date: date.toISOString(), period: payload.period, count: saved.length } } })
    return saved
  })
  return success(res, records, 'Official attendance saved')
}))

teachersRouter.post('/me/assignments', authenticate, requireRoles('teacher'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const payload = assignmentCreateSchema.parse(req.body)
  const course = await ownedCourse(req.user!.sub, payload.courseId)
  const assignment = await prisma.$transaction(async (tx) => {
    const created = await tx.assignment.create({ data: { courseId: course.id, title: payload.title, description: payload.description, dueDate: payload.dueDate, maxScore: payload.maxScore, type: payload.type } })
    if (course.enrollments.length) await tx.assignmentSubmission.createMany({ data: course.enrollments.map(({ studentId }) => ({ assignmentId: created.id, studentId })), skipDuplicates: true })
    await tx.auditLog.create({ data: { actorId: req.user!.sub, action: 'TEACHER_ASSIGNMENT_CREATED', targetType: 'Assignment', targetId: created.id, metadata: { courseId: course.id, recipients: course.enrollments.length } } })
    return tx.assignment.findUnique({ where: { id: created.id }, include: { submissions: { include: { student: { include: { user: true } } } } } })
  })
  return success(res, assignment, 'Assignment published to enrolled students', 201)
}))

teachersRouter.patch('/me/assignments/:assignmentId/submissions/:studentId', authenticate, requireRoles('teacher'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const assignmentId = getRouteParam(req.params.assignmentId)
  const studentId = getRouteParam(req.params.studentId)
  const payload = submissionGradeSchema.parse(req.body)
  const assignment = await prisma.assignment.findFirst({ where: { id: assignmentId, course: { teacher: { userId: req.user!.sub } } }, include: { course: true } })
  if (!assignment) throw new ApiError(403, 'This assignment is not assigned to the authenticated teacher')
  if (payload.score > assignment.maxScore) throw new ApiError(400, 'Score cannot exceed the assignment maximum')
  const percentage = Number(((payload.score / assignment.maxScore) * 100).toFixed(2))
  const letterGrade = percentage >= 90 ? 'A' : percentage >= 80 ? 'B' : percentage >= 70 ? 'C' : percentage >= 60 ? 'D' : 'F'
  const result = await prisma.$transaction(async (tx) => {
    const submission = await tx.assignmentSubmission.update({ where: { assignmentId_studentId: { assignmentId, studentId } }, data: { score: payload.score, feedback: payload.feedback, status: 'GRADED' } })
    await tx.grade.deleteMany({ where: { assignmentId, studentId, courseId: assignment.courseId } })
    const grade = await tx.grade.create({ data: { assignmentId, studentId, courseId: assignment.courseId, score: payload.score, maxScore: assignment.maxScore, percentage, letterGrade, period: 'CURRENT' } })
    await tx.auditLog.create({ data: { actorId: req.user!.sub, action: 'TEACHER_SUBMISSION_GRADED', targetType: 'AssignmentSubmission', targetId: submission.id, metadata: { assignmentId, studentId, percentage } } })
    return { submission, grade }
  })
  return success(res, result, 'Submission graded and synchronized with the gradebook')
}))

teachersRouter.delete('/me/assignments/:assignmentId', authenticate, requireRoles('teacher'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const assignmentId = getRouteParam(req.params.assignmentId)
  const assignment = await prisma.assignment.findFirst({ where: { id: assignmentId, course: { teacher: { userId: req.user!.sub } } } })
  if (!assignment) throw new ApiError(403, 'This assignment is not assigned to the authenticated teacher')
  await prisma.$transaction(async (tx) => {
    await tx.grade.deleteMany({ where: { assignmentId } })
    await tx.assignment.delete({ where: { id: assignmentId } })
    await tx.auditLog.create({ data: { actorId: req.user!.sub, action: 'TEACHER_ASSIGNMENT_DELETED', targetType: 'Assignment', targetId: assignmentId, metadata: { courseId: assignment.courseId, title: assignment.title } } })
  })
  return success(res, null, 'Assignment deleted')
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
