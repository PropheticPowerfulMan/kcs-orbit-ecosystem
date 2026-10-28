import { Router, type NextFunction, type Response } from 'express'
import { z } from 'zod'
import { env } from '../config/env.js'
import { prisma } from '../config/prisma.js'
import { authenticate, type AuthenticatedRequest } from '../middleware/auth.js'
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

academicCalendarRouter.post('/rollover/run', requireCalendarManager, asyncHandler(async (req, res) => {
  const response = await fetch(orbitUrl('/rollover/run'), {
    method: 'POST', headers: headers(true),
    body: JSON.stringify({ ...req.body, organizationId: calendarOrganizationId, passThreshold: 70 }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new ApiError(response.status, data.message || 'Academic promotion run failed.')
  res.json(data)
}))
