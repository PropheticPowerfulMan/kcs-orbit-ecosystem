import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../config/prisma.js'
import { authenticate, requireRoles, type AuthenticatedRequest } from '../middleware/auth.js'
import { ApiError, asyncHandler, success } from '../utils/api.js'
import { compareClassParts, normalizeClassParts } from '../utils/className.js'
import { belongsToTeacherClasses, extractWorkspaceClasses, mergeTeacherClasses, teacherClassKey } from '../utils/teacherClassAccess.js'

export const attendanceRouter = Router()

const attendanceStatusSchema = z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED', 'SICK', 'SUSPENDED'])
const studentAttendanceSchema = z.object({
  grade: z.string().min(1).max(80),
  section: z.string().max(40).default(''),
  date: z.coerce.date(),
  period: z.string().max(80).optional(),
  entries: z.array(z.object({
    studentId: z.string().min(1),
    status: attendanceStatusSchema,
    note: z.string().max(500).optional(),
  })).min(1).max(1000),
})
const staffAttendanceSchema = z.object({
  date: z.coerce.date(),
  entries: z.array(z.object({
    staffOrbitId: z.string().min(1),
    employeeNumber: z.string().max(100).optional(),
    staffName: z.string().min(1).max(200),
    staffEmail: z.string().email().optional(),
    department: z.string().max(160).optional(),
    status: attendanceStatusSchema,
    arrivalTime: z.string().max(20).optional(),
    departureTime: z.string().max(20).optional(),
    note: z.string().max(500).optional(),
  })).min(1).max(1000),
})

const normalizedDay = (value: Date) => {
  const date = new Date(value)
  date.setUTCHours(0, 0, 0, 0)
  return date
}

const summarize = (records: Array<{ status: string }>) => {
  const count = (status: string) => records.filter((record) => record.status === status).length
  const attended = records.filter((record) => ['PRESENT', 'LATE', 'EXCUSED'].includes(record.status)).length
  return {
    total: records.length,
    present: count('PRESENT'),
    absent: count('ABSENT'),
    late: count('LATE'),
    excused: count('EXCUSED'),
    sick: count('SICK'),
    suspended: count('SUSPENDED'),
    attendanceRate: records.length ? Number(((attended / records.length) * 100).toFixed(1)) : null,
  }
}

async function assignedTeacherClasses(userId: string) {
  const [teacher, workspace] = await Promise.all([
    prisma.teacherProfile.findUnique({
      where: { userId },
      select: {
        status: true,
        homeroomGrade: true,
        homeroomSection: true,
        courses: { select: { grade: true } },
      },
    }),
    prisma.teacherWorkspace.findUnique({ where: { userId }, select: { state: true } }),
  ])
  const profileClasses = teacher?.courses.map((course) => normalizeClassParts(course.grade, '')) ?? []
  if (teacher?.status === 'HOMEROOM_TEACHER' && teacher.homeroomGrade) {
    profileClasses.push(normalizeClassParts(teacher.homeroomGrade, teacher.homeroomSection))
  }
  return mergeTeacherClasses(profileClasses, extractWorkspaceClasses(workspace?.state))
}

async function updateStudentRates(studentIds: string[]) {
  const records = await prisma.attendanceRecord.findMany({
    where: { studentId: { in: studentIds } },
    select: { studentId: true, status: true },
  })
  await prisma.$transaction(studentIds.map((studentId) => prisma.studentProfile.update({
    where: { id: studentId },
    data: { attendanceRate: summarize(records.filter((record) => record.studentId === studentId)).attendanceRate },
  })))
}

attendanceRouter.use(authenticate)

attendanceRouter.get('/staff/me', requireRoles('admin', 'staff', 'teacher'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.sub },
    select: { email: true, accessCode: true, orbitUserId: true },
  })
  if (!user) throw new ApiError(404, 'Staff account not found')
  const keys = [user.orbitUserId, user.accessCode].filter((value): value is string => Boolean(value))
  const records = await prisma.staffAttendanceRecord.findMany({
    where: { OR: [{ staffEmail: { equals: user.email, mode: 'insensitive' } }, ...keys.map((key) => ({ staffOrbitId: key }))] },
    orderBy: { date: 'desc' },
    take: 180,
  })
  return success(res, { records, summary: summarize(records) }, 'Staff attendance loaded')
}))

attendanceRouter.get('/teacher/homeroom', requireRoles('teacher'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const date = normalizedDay(z.coerce.date().parse(String(req.query.date ?? new Date().toISOString().slice(0, 10))))
  const assignedClasses = await assignedTeacherClasses(req.user!.sub)
  const registryStudents = await prisma.studentProfile.findMany({
    include: {
      user: { select: { firstName: true, middleName: true, lastName: true } },
      attendanceRecords: { where: { date }, orderBy: { createdAt: 'desc' } },
    },
    orderBy: { user: { lastName: 'asc' } },
  })
  const visibleStudents = registryStudents.filter((student) => belongsToTeacherClasses(student, assignedClasses))
  const classesByKey = new Map<string, { grade: string; section: string; studentCount: number }>()
  for (const student of visibleStudents) {
    const value = normalizeClassParts(student.grade, student.section)
    const key = teacherClassKey(value)
    const existing = classesByKey.get(key)
    classesByKey.set(key, { ...value, studentCount: (existing?.studentCount ?? 0) + 1 })
  }
  const classes = [...classesByKey.values()].sort(compareClassParts)
  if (!classes.length) {
    return success(res, { date: date.toISOString().slice(0, 10), class: null, classes: [], students: [] }, 'No students are currently available in the teacher registry')
  }
  const requestedClass = req.query.grade
    ? normalizeClassParts(String(req.query.grade), String(req.query.section ?? ''))
    : classes[0]
  if (!classesByKey.has(teacherClassKey(requestedClass))) {
    throw new ApiError(403, 'The selected class is not assigned to this teacher')
  }
  const students = visibleStudents.filter((student) => {
    const value = normalizeClassParts(student.grade, student.section)
    return teacherClassKey(value) === teacherClassKey(requestedClass)
  })
  return success(res, {
    date: date.toISOString().slice(0, 10),
    class: { grade: requestedClass.grade, section: requestedClass.section },
    classes,
    students: students.map((student) => ({
      id: student.id,
      studentNumber: student.studentNumber,
      name: [student.user.lastName, student.user.middleName, student.user.firstName].filter(Boolean).join(' '),
      status: student.attendanceRecords[0]?.status ?? null,
      note: student.attendanceRecords[0]?.note ?? '',
    })),
  }, 'Main-teacher attendance register loaded')
}))

attendanceRouter.post('/teacher/homeroom', requireRoles('teacher'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const payload = studentAttendanceSchema.parse(req.body)
  const selectedClass = normalizeClassParts(payload.grade, payload.section)
  const assignedClasses = await assignedTeacherClasses(req.user!.sub)
  if (assignedClasses.length && !assignedClasses.some((value) => teacherClassKey(value) === teacherClassKey(selectedClass))) {
    throw new ApiError(403, 'Attendance is limited to a class assigned to this teacher')
  }
  const date = normalizedDay(payload.date)
  const ids = payload.entries.map((entry) => entry.studentId)
  if (new Set(ids).size !== ids.length) throw new ApiError(400, 'Duplicate student in attendance register')
  const students = await prisma.studentProfile.findMany({
    where: { id: { in: ids } },
    select: { id: true, grade: true, section: true },
  })
  if (students.length !== ids.length || students.some((student) => {
    const value = normalizeClassParts(student.grade, student.section)
    return teacherClassKey(value) !== teacherClassKey(selectedClass)
  })) {
    throw new ApiError(400, 'Every student must belong to the selected teacher class')
  }
  const className = [selectedClass.grade, selectedClass.section].filter(Boolean).join(' ')
  await prisma.$transaction(async (tx) => {
    for (const entry of payload.entries) {
      await tx.attendanceRecord.deleteMany({ where: { studentId: entry.studentId, date, className, period: payload.period ?? null } })
      await tx.attendanceRecord.create({ data: { studentId: entry.studentId, recordedById: req.user!.sub, date, className, period: payload.period, status: entry.status, note: entry.note } })
    }
    await tx.auditLog.create({ data: { actorId: req.user!.sub, action: 'MAIN_TEACHER_ATTENDANCE_RECORDED', targetType: 'Class', targetId: className, metadata: { date: date.toISOString(), period: payload.period, count: payload.entries.length } } })
  })
  await updateStudentRates(ids)
  return success(res, { date: date.toISOString().slice(0, 10), className, saved: payload.entries.length }, 'Official class attendance saved')
}))

attendanceRouter.get('/students', requireRoles('admin'), asyncHandler(async (req, res) => {
  const date = normalizedDay(z.coerce.date().parse(String(req.query.date ?? new Date().toISOString().slice(0, 10))))
  const students = await prisma.studentProfile.findMany({
    include: {
      user: { select: { firstName: true, middleName: true, lastName: true } },
      attendanceRecords: { where: { date }, orderBy: { createdAt: 'desc' } },
    },
    orderBy: [{ grade: 'asc' }, { section: 'asc' }, { user: { lastName: 'asc' } }],
  })
  const classes = new Map<string, { grade: string; section: string; students: unknown[] }>()
  for (const student of students) {
    const normalizedClass = normalizeClassParts(student.grade, student.section)
    const key = `${normalizedClass.grade}::${normalizedClass.section}`
    const group = classes.get(key) ?? { ...normalizedClass, students: [] }
    group.students.push({
      id: student.id,
      studentNumber: student.studentNumber,
      name: [student.user.lastName, student.user.middleName, student.user.firstName].filter(Boolean).join(' '),
      status: student.attendanceRecords[0]?.status ?? null,
      note: student.attendanceRecords[0]?.note ?? '',
    })
    classes.set(key, group)
  }
  const orderedClasses = [...classes.values()].sort(compareClassParts)
  return success(res, { date: date.toISOString().slice(0, 10), classes: orderedClasses }, 'Student attendance register loaded')
}))

attendanceRouter.post('/students', requireRoles('admin'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const payload = studentAttendanceSchema.parse(req.body)
  const date = normalizedDay(payload.date)
  const ids = payload.entries.map((entry) => entry.studentId)
  if (new Set(ids).size !== ids.length) throw new ApiError(400, 'Duplicate student in attendance register')
  const students = await prisma.studentProfile.findMany({ where: { id: { in: ids } }, select: { id: true, grade: true, section: true } })
  if (students.length !== ids.length) throw new ApiError(404, 'One or more students were not found')
  const selectedClass = normalizeClassParts(payload.grade, payload.section)
  if (students.some((student) => {
    const studentClass = normalizeClassParts(student.grade, student.section)
    return studentClass.grade !== selectedClass.grade || studentClass.section !== selectedClass.section
  })) {
    throw new ApiError(400, 'Every student must belong to the selected class')
  }
  const className = [selectedClass.grade, selectedClass.section].filter(Boolean).join(' ')
  await prisma.$transaction(async (tx) => {
    for (const entry of payload.entries) {
      await tx.attendanceRecord.deleteMany({ where: { studentId: entry.studentId, date, className, period: payload.period ?? null } })
      await tx.attendanceRecord.create({ data: { studentId: entry.studentId, recordedById: req.user!.sub, date, className, period: payload.period, status: entry.status, note: entry.note } })
    }
    await tx.auditLog.create({ data: { actorId: req.user!.sub, action: 'ADMIN_STUDENT_ATTENDANCE_RECORDED', targetType: 'Class', targetId: className, metadata: { date: date.toISOString(), period: payload.period, count: payload.entries.length } } })
  })
  await updateStudentRates(ids)
  return success(res, { date: date.toISOString().slice(0, 10), className, saved: payload.entries.length }, 'Official student attendance saved')
}))

attendanceRouter.get('/staff', requireRoles('admin'), asyncHandler(async (req, res) => {
  const date = req.query.date ? normalizedDay(z.coerce.date().parse(String(req.query.date))) : null
  const records = await prisma.staffAttendanceRecord.findMany({
    where: date ? { date } : {},
    orderBy: [{ date: 'desc' }, { staffName: 'asc' }],
    take: date ? 1000 : 500,
  })
  return success(res, { records, summary: summarize(records) }, 'Staff attendance register loaded')
}))

attendanceRouter.post('/staff', requireRoles('admin'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const payload = staffAttendanceSchema.parse(req.body)
  const date = normalizedDay(payload.date)
  const ids = payload.entries.map((entry) => entry.staffOrbitId)
  if (new Set(ids).size !== ids.length) throw new ApiError(400, 'Duplicate staff member in attendance register')
  const saved = await prisma.$transaction(async (tx) => {
    const rows = []
    for (const entry of payload.entries) {
      rows.push(await tx.staffAttendanceRecord.upsert({
        where: { staffOrbitId_date: { staffOrbitId: entry.staffOrbitId, date } },
        create: { ...entry, date, recordedById: req.user!.sub },
        update: { employeeNumber: entry.employeeNumber, staffName: entry.staffName, staffEmail: entry.staffEmail, department: entry.department, status: entry.status, arrivalTime: entry.arrivalTime, departureTime: entry.departureTime, note: entry.note, recordedById: req.user!.sub },
      }))
    }
    await tx.auditLog.create({ data: { actorId: req.user!.sub, action: 'ADMIN_STAFF_ATTENDANCE_RECORDED', targetType: 'StaffRegister', targetId: date.toISOString().slice(0, 10), metadata: { count: rows.length } } })
    return rows
  })
  return success(res, { date: date.toISOString().slice(0, 10), saved: saved.length, summary: summarize(saved) }, 'Official staff attendance saved')
}))
