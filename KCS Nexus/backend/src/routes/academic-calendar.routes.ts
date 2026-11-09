import { Prisma } from '@prisma/client'
import { createHash } from 'node:crypto'
import { academicPeriodAccess, lockAcademicYears } from '../services/academicPeriodAccess.service.js'
import { academicPeriodIsReadOnly, quarterTerms } from '../utils/academicPeriodPolicy.js'
import { academicCalendars, invalidateAcademicCalendarCache } from '../services/reportAttendance.service.js'
import { databaseActorId } from '../utils/databaseActor.js'
import { success } from '../utils/api.js'
import { Router, type NextFunction, type Response } from 'express'
import { z } from 'zod'
import { env } from '../config/env.js'
import { prisma } from '../config/prisma.js'
import { authenticate, requireSuperAdmin, type AuthenticatedRequest } from '../middleware/auth.js'
import { ApiError, asyncHandler } from '../utils/api.js'

const calendarApiUrl = env.ACADEMIC_CALENDAR_ORBIT_API_URL || env.KCS_ORBIT_API_URL
const calendarApiKey = env.ACADEMIC_CALENDAR_ORBIT_API_KEY || env.KCS_ORBIT_API_KEY
const calendarOrganizationId = env.ACADEMIC_CALENDAR_ORBIT_ORGANIZATION_ID || env.KCS_ORBIT_ORGANIZATION_ID

export const academicCalendarRouter = Router()
academicCalendarRouter.use(authenticate)

const normalized = (value: unknown) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const requireCalendarManager = async (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
  try {
    if (req.user?.sub === 'configured-superadmin') return next()
    if (!req.user) return next(new ApiError(403, 'Academic calendar management permission required.'))
    const user = await prisma.user.findUnique({
      where: { id: req.user.sub },
      select: { role: true, staffFunction: true, permissions: true, staffProfile: { select: { function: true, permissions: true } } },
    })
    const titles = normalized([user?.staffFunction, user?.staffProfile?.function].filter(Boolean).join(' '))
    const permissions = [...(user?.permissions ?? []), ...(user?.staffProfile?.permissions ?? [])].map(normalized)
    if ((user?.role === 'ADMIN' || user?.role === 'STAFF') && (titles.includes('principal') || titles.includes('prefet') || permissions.includes('academic_calendar_manage'))) return next()
    return next(new ApiError(403, 'Only the Super Administrator or Principal can update the academic calendar.'))
  } catch (error) { return next(error) }
}

function orbitUrl(path: string) {
  if (!calendarApiUrl || !calendarApiKey || !calendarOrganizationId) {
    throw new ApiError(503, 'Central academic calendar is not configured.')
  }
  return `${calendarApiUrl.replace(/\/$/, '')}/api/integration/academic-year${path}`
}

function headers(json = false) {
  return {
    ...(json ? { 'content-type': 'application/json' } : {}),
    'x-api-key': calendarApiKey!,
    'x-app-slug': 'KCS_NEXUS',
  }
}

const scheduleEntrySchema = z.object({
  grade: z.string().trim().min(2).max(40),
  classGroup: z.string().trim().max(30).nullable().optional(),
  day: z.enum(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']),
  period: z.coerce.number().int().min(1).max(20),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  subject: z.string().trim().min(2).max(160),
  teacherName: z.string().trim().max(180).nullable().optional(),
  room: z.string().trim().max(80).nullable().optional(),
})
const semesterScheduleSchema = z.object({
  academicYear: z.string().regex(/^\d{4}-\d{4}$/),
  semester: z.coerce.number().int().min(1).max(2),
  entries: z.array(scheduleEntrySchema).max(1500),
})
const scheduleKey = (academicYear: string, semester: number, entry: z.infer<typeof scheduleEntrySchema>) =>
  [academicYear, `S${semester}`, entry.grade, entry.classGroup || 'ALL', entry.day, `P${entry.period}`]
    .join('-').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9-]+/g, '-').toUpperCase()

academicCalendarRouter.get('/', asyncHandler(async (_req, res) => {
  const query = `?organizationId=${encodeURIComponent(calendarOrganizationId!)}`
  const response = await fetch(orbitUrl('/calendar' + query), { headers: headers() })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new ApiError(response.status, data.message || 'Academic calendar request failed.')
  res.json(data)
}))

academicCalendarRouter.get('/period-access', asyncHandler(async (_req, res) => {
  res.setHeader('Cache-Control', 'private, no-store')
  return success(res, await academicPeriodAccess(), 'Academic period access loaded')
}))

academicCalendarRouter.post('/close-period', requireSuperAdmin(), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const input = z.object({ academicYear: z.string().regex(/^\d{4}-\d{4}$/), term: z.enum(['Semester 1 · Quarter 1','Semester 1 · Quarter 2','Semester 2 · Quarter 3','Semester 2 · Quarter 4','Semester 1','Semester 2','Annual final']), confirmation: z.string() }).parse(req.body)
  if (input.confirmation !== input.academicYear + ' · ' + input.term) throw new ApiError(400, 'Confirm the exact academic year and period before closing it')
  const calendars = await academicCalendars()
  const calendar = calendars.find(item => item.name === input.academicYear)
  if (!calendar) throw new ApiError(409, 'Publish this academic year in the central school calendar before closing it')
  const actorId = await databaseActorId(req.user!.sub)
  const id = 'academic-period-closed-' + createHash('sha256').update(input.academicYear + '::' + input.term).digest('hex')
  const result = await prisma.$transaction(async tx => {
    await lockAcademicYears(tx, [input.academicYear], true)
    const previous = await tx.auditLog.findUnique({ where: { id } })
    if (previous) return { alreadyClosed: true, closedAt: previous.createdAt }
    const access = await academicPeriodAccess(tx)
    const quarterIndex = quarterTerms.indexOf(input.term)
    const required = quarterIndex > 0 ? quarterTerms.slice(0, quarterIndex)
      : input.term === 'Semester 1' ? quarterTerms.slice(0, 2)
      : input.term === 'Semester 2' ? quarterTerms : input.term === 'Annual final' ? quarterTerms : []
    if (required.some(term => !academicPeriodIsReadOnly(access, input.academicYear, term))) throw new ApiError(409, 'Close the preceding quarters after their grades are finalized before closing this period')
    const period = calendar.periods?.find(item => quarterIndex >= 0 ? item.type === 'QUARTER' && item.sequence === quarterIndex + 1 : item.type === 'SEMESTER' && input.term === 'Semester ' + item.sequence)
    if (new Date(period?.startDate ?? calendar.startDate) > new Date()) throw new ApiError(409, 'A future academic period cannot be closed before it starts')
    const workspaces = await tx.teacherWorkspace.findMany({ select: { id: true, state: true }, orderBy: { id: 'asc' } })
    let frozenCourseWeights = 0
    for (const workspace of workspaces) {
      const state = workspace.state as Record<string, any>
      const frozen = { ...(state.gradebookClosedCategoryWeightsByCycle || {}) }
      const snapshots = new Map<string, any>(Object.entries(state.advancedGradebookByCycle || {}).filter(([key]) => key.endsWith('::' + input.academicYear)))
      if (input.academicYear === '2026-2027') for (const [courseId, snapshot] of Object.entries(state.advancedGradebookByCourse || {})) {
        if (!snapshots.has(courseId + '::' + input.academicYear)) snapshots.set(courseId + '::' + input.academicYear, snapshot)
      }
      for (const [cycle, weights] of Object.entries(state.gradebookCategoryWeightsByCycle || {})) {
        if (cycle.endsWith('::' + input.academicYear) && !snapshots.has(cycle)) snapshots.set(cycle, weights)
      }
      for (const [cycle, snapshot] of snapshots) {
        frozen[cycle + '::' + input.term] = { categories: state.gradebookCategoryWeightsByCycle?.[cycle]?.categories ?? snapshot.categories ?? [], closedAt: new Date().toISOString() }
        frozenCourseWeights++
      }
      if (snapshots.size) await tx.teacherWorkspace.update({ where: { id: workspace.id }, data: { state: { ...state, gradebookClosedCategoryWeightsByCycle: frozen } as Prisma.InputJsonValue, revision: { increment: 1 } } })
    }
    const audit = await tx.auditLog.create({ data: { id, actorId, action: 'ACADEMIC_PERIOD_CLOSED', targetType: 'AcademicPeriodClosure', targetId: input.academicYear + '::' + input.term, metadata: { academicYear: input.academicYear, term: input.term, frozenCourseWeights, closureMode: 'EXPLICIT_SUPERADMIN_AFTER_GRADE_FINALIZATION' } } })
    return { alreadyClosed: false, closedAt: audit.createdAt, frozenCourseWeights }
  }, { maxWait: 10000, timeout: 60000 })
  return success(res, result, 'The academic period is closed and its academic records are read-only')
}))

academicCalendarRouter.get('/current', asyncHandler(async (_req, res) => {
  const query = `?organizationId=${encodeURIComponent(calendarOrganizationId!)}`
  const response = await fetch(orbitUrl('/calendar/current' + query), { headers: headers() })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new ApiError(response.status, data.message || 'Current academic calendar request failed.')
  res.json(data)
}))

academicCalendarRouter.put('/', requireCalendarManager, asyncHandler(async (req, res) => {
  const response = await fetch(orbitUrl('/calendar'), {
    method: 'PUT',
    headers: headers(true),
    body: JSON.stringify({ ...req.body, organizationId: calendarOrganizationId }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new ApiError(response.status, data.message || 'Academic calendar update failed.')
  invalidateAcademicCalendarCache()
  res.json(data)
}))

academicCalendarRouter.get('/schedule', requireCalendarManager, asyncHandler(async (req, res) => {
  const academicYear = String(req.query.academicYear || '')
  const semester = Number(req.query.semester || 0)
  const entries = await prisma.academicScheduleEntry.findMany({
    where: {
      ...(academicYear ? { academicYear } : {}),
      ...(semester ? { semester } : {}),
      active: true,
    },
    orderBy: [{ grade: 'asc' }, { day: 'asc' }, { period: 'asc' }],
  })
  res.json({ data: entries })
}))

academicCalendarRouter.put('/schedule', requireCalendarManager, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const payload = semesterScheduleSchema.parse(req.body)
  const entries = await prisma.$transaction(async (tx) => {
    await tx.academicScheduleEntry.updateMany({
      where: { academicYear: payload.academicYear, semester: payload.semester, active: true },
      data: { active: false },
    })
    const saved = []
    for (const entry of payload.entries) {
      if (entry.endTime <= entry.startTime) throw new ApiError(422, `Invalid time range for ${entry.subject}.`)
      saved.push(await tx.academicScheduleEntry.upsert({
        where: { sourceKey: scheduleKey(payload.academicYear, payload.semester, entry) },
        create: {
          ...entry,
          classGroup: entry.classGroup || null,
          teacherName: entry.teacherName || null,
          room: entry.room || null,
          academicYear: payload.academicYear,
          semester: payload.semester,
          sourceKey: scheduleKey(payload.academicYear, payload.semester, entry),
          sourceDocument: `Principal semester timetable · ${payload.academicYear} · S${payload.semester}`,
          active: true,
        },
        update: {
          ...entry,
          classGroup: entry.classGroup || null,
          teacherName: entry.teacherName || null,
          room: entry.room || null,
          sourceDocument: `Principal semester timetable · ${payload.academicYear} · S${payload.semester}`,
          active: true,
        },
      }))
    }
    await tx.auditLog.create({ data: { actorId: req.user!.sub === 'configured-superadmin' ? null : req.user!.sub, action: 'SEMESTER_TIMETABLE_PUBLISHED', targetType: 'AcademicSchedule', targetId: `${payload.academicYear}-S${payload.semester}`, metadata: { entries: saved.length } } })
    return saved
  })
  res.json({ data: entries, message: 'Semester timetable published to teacher and student dashboards.' })
}))

academicCalendarRouter.post('/rollover/preview', requireCalendarManager, asyncHandler(async (req, res) => {
  const response = await fetch(orbitUrl('/rollover/preview'), {
    method: 'POST', headers: headers(true),
    body: JSON.stringify({ ...req.body, organizationId: calendarOrganizationId }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new ApiError(response.status, data.message || 'Academic promotion preview failed.')
  res.json(data)
}))

academicCalendarRouter.post('/rollover/run', requireCalendarManager, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const response = await fetch(orbitUrl('/rollover/run'), {
    method: 'POST', headers: headers(true),
    body: JSON.stringify({ ...req.body, organizationId: calendarOrganizationId, passThreshold: 70 }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new ApiError(response.status, data.message || 'Academic promotion run failed.')
  const planItems = (data as any)?.plan?.items ?? (data as any)?.data?.plan?.items ?? (data as any)?.data?.items ?? []
  const graduates = Array.isArray(planItems) ? planItems.filter((item: any) => String(item?.action || item?.decision || '').toUpperCase() === 'GRADUATE') : []
  if (graduates.length) {
    const studentIds = graduates.map((item: any) => String(item.studentId || '')).filter(Boolean)
    const studentNumbers = graduates.map((item: any) => String(item.studentNumber || '')).filter(Boolean)
    const profiles = await prisma.studentProfile.findMany({
      where: { grade: 'Grade 12', status: { equals: 'active', mode: 'insensitive' }, OR: [{ id: { in: studentIds } }, { studentNumber: { in: studentNumbers } }, { user: { orbitUserId: { in: studentIds } } }] },
      include: { archive: true, user: true, parentLinks: true, enrollments: { select: { id: true, courseId: true } }, _count: { select: { grades: true, submissions: true, attendanceRecords: true, reportCards: true, transcripts: true, disciplineCases: true } } },
    })
    const actorId = req.user?.sub === 'configured-superadmin'
      ? (await prisma.user.findUnique({ where: { email: process.env.SUPERADMIN_EMAIL || 'superadmin@kcsnexus.com' }, select: { id: true } }))?.id
      : req.user?.sub
    if (!actorId) throw new ApiError(409, 'The academic rollover audit identity is unavailable')
    for (const student of profiles.filter((profile) => !profile.archive)) {
      const fullName = [student.user.lastName, student.user.middleName, student.user.firstName].filter(Boolean).join(' ')
      const snapshot = { archiveType: 'GRADUATION', identity: { userId: student.userId, orbitUserId: student.user.orbitUserId, studentNumber: student.studentNumber, fullName, email: student.user.email }, academicPlacement: { grade: student.grade, section: student.section, enrollmentDate: student.enrollmentDate }, parentUserIds: student.parentLinks.map((link) => link.parentId), courseEnrollments: student.enrollments, recordCounts: student._count, statusBeforeArchive: student.status, passingRule: 'Grade 12 final average >= 70%' }
      await prisma.$transaction(async (tx) => {
        const archive = await tx.studentArchive.create({ data: { studentId: student.id, userId: student.userId, studentNumber: student.studentNumber, orbitUserId: student.user.orbitUserId, fullName, grade: student.grade, section: student.section, reason: 'GRADUATION · Grade 12 successfully completed under the KCS ≥ 70% passing rule', effectiveDate: new Date(), archivedSnapshot: snapshot, archivedById: actorId } })
        await tx.enrollment.deleteMany({ where: { studentId: student.id } })
        await tx.refreshToken.deleteMany({ where: { userId: student.userId } })
        await tx.studentProfile.update({ where: { id: student.id }, data: { status: 'graduated' } })
        await tx.user.update({ where: { id: student.userId }, data: { accountBlockedAt: new Date(), accountBlockedReason: 'Grade 12 graduation archive', accountBlockedBy: actorId, loginLockedUntil: null } })
        await tx.auditLog.create({ data: { actorId, action: 'GRADE_12_GRADUATE_REMOVED_FROM_ACTIVE_ROSTERS_AND_ARCHIVED', targetType: 'StudentArchive', targetId: archive.id, metadata: { studentId: student.id, studentNumber: student.studentNumber, passingRule: '>=70%' } } })
      })
    }
    ;(data as any).nexusGraduationArchive = { requested: graduates.length, archived: profiles.filter((profile) => !profile.archive).length }
  }
  res.json(data)
}))
