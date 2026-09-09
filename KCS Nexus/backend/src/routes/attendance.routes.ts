import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../config/prisma.js'
import { authenticate, requireRoles, type AuthenticatedRequest } from '../middleware/auth.js'
import { ApiError, asyncHandler, success } from '../utils/api.js'
import { compareClassParts, normalizeClassParts } from '../utils/className.js'
import { belongsToTeacherClasses, extractWorkspaceClasses, mergeTeacherClasses, teacherClassKey } from '../utils/teacherClassAccess.js'
import { synchronizeStudentAcademicMetrics } from '../services/academicSync.js'

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

async function resolveAttendanceRecorderId(userId: string) {
  if (userId !== 'configured-superadmin') return userId
  const account = await prisma.user.findUnique({ where: { email: process.env.SUPERADMIN_EMAIL || 'superadmin@kcsnexus.com' }, select: { id: true } })
  if (!account) throw new ApiError(409, 'The Super Administrator database account is not synchronized')
  return account.id
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
    return success(res, { date: date.toISOString().slice(0, 10), class: null, classes: [], students: [], summary: summarize([]) }, 'No students are currently available in the teacher registry')
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
    summary: summarize(students.flatMap((student) => student.attendanceRecords.slice(0, 1))),
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
  const recorderId = await resolveAttendanceRecorderId(req.user!.sub)
  await prisma.$transaction(async (tx) => {
    for (const entry of payload.entries) {
      await tx.attendanceRecord.upsert({
        where: { studentId_date_className_period: { studentId: entry.studentId, date, className, period: payload.period ?? 'Daily' } },
        create: { studentId: entry.studentId, recordedById: recorderId, date, className, period: payload.period ?? 'Daily', status: entry.status, note: entry.note },
        update: { recordedById: recorderId, status: entry.status, note: entry.note },
      })
    }
    await tx.auditLog.create({ data: { actorId: recorderId, action: 'MAIN_TEACHER_ATTENDANCE_RECORDED', targetType: 'Class', targetId: className, metadata: { date: date.toISOString(), period: payload.period, count: payload.entries.length } } })
    await synchronizeStudentAcademicMetrics(tx, ids)
  })
  return success(res, { date: date.toISOString().slice(0, 10), className, saved: payload.entries.length, summary: summarize(payload.entries) }, 'Official class attendance saved')
}))

attendanceRouter.get('/history', requireRoles('admin', 'teacher'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const today = normalizedDay(new Date())
  const defaultFrom = new Date(today)
  defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 29)
  const from = normalizedDay(z.coerce.date().parse(String(req.query.from ?? defaultFrom.toISOString().slice(0, 10))))
  const to = normalizedDay(z.coerce.date().parse(String(req.query.to ?? today.toISOString().slice(0, 10))))
  if (from > to) throw new ApiError(400, 'The history start date must be before the end date')
  const maximumTo = new Date(from)
  maximumTo.setUTCDate(maximumTo.getUTCDate() + 366)
  if (to > maximumTo) throw new ApiError(400, 'Attendance history is limited to 366 days per request')

  const records = await prisma.attendanceRecord.findMany({
    where: {
      date: { gte: from, lte: to },
      ...(req.user!.role === 'teacher' ? { recordedById: await resolveAttendanceRecorderId(req.user!.sub) } : {}),
    },
    include: {
      student: { include: { user: { select: { firstName: true, middleName: true, lastName: true } } } },
      recordedBy: { select: { firstName: true, middleName: true, lastName: true } },
    },
    orderBy: [{ date: 'desc' }, { className: 'asc' }, { student: { user: { lastName: 'asc' } } }],
    take: 10000,
  })
  const grouped = new Map<string, { date: string; className: string; period: string | null; recordedBy: string | null; records: typeof records }>()
  for (const record of records) {
    const recordDate = record.date.toISOString().slice(0, 10)
    const key = `${recordDate}::${record.className}::${record.period ?? ''}::${record.recordedById ?? ''}`
    const recorderName = record.recordedBy
      ? [record.recordedBy.lastName, record.recordedBy.middleName, record.recordedBy.firstName].filter(Boolean).join(' ')
      : null
    const group = grouped.get(key) ?? { date: recordDate, className: record.className, period: record.period, recordedBy: recorderName, records: [] }
    group.records.push(record)
    grouped.set(key, group)
  }
  const registers = [...grouped.values()].map((group) => ({
    date: group.date,
    className: group.className,
    period: group.period,
    recordedBy: group.recordedBy,
    summary: summarize(group.records),
    students: group.records.map((record) => ({
      id: record.student.id,
      studentNumber: record.student.studentNumber,
      name: [record.student.user.lastName, record.student.user.middleName, record.student.user.firstName].filter(Boolean).join(' '),
      status: record.status,
      note: record.note,
    })),
  }))
  return success(res, { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10), registers }, 'Official attendance history loaded')
}))

attendanceRouter.get('/students/:studentId/analytics', requireRoles('admin'), asyncHandler(async (req, res) => {
  const student = await prisma.studentProfile.findUnique({ where: { id: String(req.params.studentId) }, include: { user: { select: { firstName: true, middleName: true, lastName: true } } } })
  if (!student) throw new ApiError(404, 'Student not found')
  const records = await prisma.attendanceRecord.findMany({ where: { studentId: student.id }, include: { recordedBy: { select: { firstName: true, middleName: true, lastName: true, role: true } } }, orderBy: { date: 'desc' }, take: 730 })
  const summary = summarize(records)
  const punctual = records.filter(record => ['PRESENT','EXCUSED'].includes(record.status)).length
  const unexcusedAbsences = records.filter(record => record.status === 'ABSENT' && !record.note?.trim()).length
  const sample = records.length
  const proportion = sample ? (summary.attendanceRate ?? 0) / 100 : 0
  const zScore = 1.96
  const denominator = sample ? 1 + zScore * zScore / sample : 1
  const centre = sample ? proportion + zScore * zScore / (2 * sample) : 0
  const margin = sample ? zScore * Math.sqrt((proportion * (1 - proportion) + zScore * zScore / (4 * sample)) / sample) : 0
  const confidence95 = sample ? { low: Number((100 * (centre - margin) / denominator).toFixed(1)), high: Number((100 * (centre + margin) / denominator).toFixed(1)) } : null
  const riskScore = sample ? Number(Math.min(100, ((summary.absent + summary.sick + summary.suspended) * 100 + summary.late * 35) / sample).toFixed(1)) : 0
  return success(res, { student: { id: student.id, name: [student.user.lastName, student.user.middleName, student.user.firstName].filter(Boolean).join(' '), studentNumber: student.studentNumber, grade: student.grade, section: student.section }, summary, indicators: { punctualityRate: sample ? Number((punctual / sample * 100).toFixed(1)) : null, latenessRate: sample ? Number((summary.late / sample * 100).toFixed(1)) : null, absenceRate: sample ? Number((summary.absent / sample * 100).toFixed(1)) : null, unexcusedAbsences, riskScore, confidence95 }, records: records.map(record => ({ id: record.id, date: record.date, status: record.status, note: record.note, className: record.className, recordedBy: record.recordedBy ? [record.recordedBy.lastName, record.recordedBy.middleName, record.recordedBy.firstName].filter(Boolean).join(' ') : null })) }, 'Student attendance analytics loaded')
}))

attendanceRouter.get('/students', requireRoles('admin'), asyncHandler(async (req, res) => {
  const date = normalizedDay(z.coerce.date().parse(String(req.query.date ?? new Date().toISOString().slice(0, 10))))
  const students = await prisma.studentProfile.findMany({
    include: {
      user: { select: { firstName: true, middleName: true, lastName: true } },
      attendanceRecords: { where: { date }, orderBy: { createdAt: 'desc' }, include: { recordedBy: { select: { id: true, firstName: true, middleName: true, lastName: true, role: true } } } },
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
      recordedBy: student.attendanceRecords[0]?.recordedBy ? { id: student.attendanceRecords[0].recordedBy!.id, name: [student.attendanceRecords[0].recordedBy!.lastName, student.attendanceRecords[0].recordedBy!.middleName, student.attendanceRecords[0].recordedBy!.firstName].filter(Boolean).join(' '), role: student.attendanceRecords[0].recordedBy!.role } : null,
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
  const recorderId = await resolveAttendanceRecorderId(req.user!.sub)
  await prisma.$transaction(async (tx) => {
    for (const entry of payload.entries) {
      await tx.attendanceRecord.upsert({
        where: { studentId_date_className_period: { studentId: entry.studentId, date, className, period: payload.period ?? 'Daily' } },
        create: { studentId: entry.studentId, recordedById: recorderId, date, className, period: payload.period ?? 'Daily', status: entry.status, note: entry.note },
        update: { recordedById: recorderId, status: entry.status, note: entry.note },
      })
    }
    await tx.auditLog.create({ data: { actorId: recorderId, action: 'ADMIN_STUDENT_ATTENDANCE_RECORDED', targetType: 'Class', targetId: className, metadata: { date: date.toISOString(), period: payload.period, count: payload.entries.length } } })
    await synchronizeStudentAcademicMetrics(tx, ids)
  })
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
  const recorderId = await resolveAttendanceRecorderId(req.user!.sub)
  const saved = await prisma.$transaction(async (tx) => {
    const rows = []
    for (const entry of payload.entries) {
      rows.push(await tx.staffAttendanceRecord.upsert({
        where: { staffOrbitId_date: { staffOrbitId: entry.staffOrbitId, date } },
        create: { ...entry, date, recordedById: recorderId },
        update: { employeeNumber: entry.employeeNumber, staffName: entry.staffName, staffEmail: entry.staffEmail, department: entry.department, status: entry.status, arrivalTime: entry.arrivalTime, departureTime: entry.departureTime, note: entry.note, recordedById: recorderId },
      }))
    }
    await tx.auditLog.create({ data: { actorId: recorderId, action: 'ADMIN_STAFF_ATTENDANCE_RECORDED', targetType: 'StaffRegister', targetId: date.toISOString().slice(0, 10), metadata: { count: rows.length } } })
    return rows
  })
  return success(res, { date: date.toISOString().slice(0, 10), saved: saved.length, summary: summarize(saved) }, 'Official staff attendance saved')
}))
