import { Router, type NextFunction, type Response } from 'express'
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
