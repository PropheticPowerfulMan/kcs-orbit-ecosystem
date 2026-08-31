import { Router } from 'express'
import { env } from '../config/env.js'
import { authenticate, requireSuperAdmin } from '../middleware/auth.js'
import { ApiError, asyncHandler } from '../utils/api.js'

export const academicCalendarRouter = Router()
academicCalendarRouter.use(authenticate, requireSuperAdmin())

function orbitUrl(path: string) {
  if (!env.ACADEMIC_CALENDAR_ORBIT_API_URL || !env.ACADEMIC_CALENDAR_ORBIT_API_KEY || !env.ACADEMIC_CALENDAR_ORBIT_ORGANIZATION_ID) {
    throw new ApiError(503, 'Central academic calendar is not configured.')
  }
  return `${env.ACADEMIC_CALENDAR_ORBIT_API_URL.replace(/\/$/, '')}/api/integration/academic-year${path}`
}

function headers(json = false) {
  return {
    ...(json ? { 'content-type': 'application/json' } : {}),
    'x-api-key': env.ACADEMIC_CALENDAR_ORBIT_API_KEY!,
    'x-app-slug': 'KCS_NEXUS',
  }
}

academicCalendarRouter.get('/', asyncHandler(async (_req, res) => {
  const query = `?organizationId=${encodeURIComponent(env.ACADEMIC_CALENDAR_ORBIT_ORGANIZATION_ID!)}`
  const response = await fetch(orbitUrl('/calendar' + query), { headers: headers() })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new ApiError(response.status, data.message || 'Academic calendar request failed.')
  res.json(data)
}))

academicCalendarRouter.get('/current', asyncHandler(async (_req, res) => {
  const query = `?organizationId=${encodeURIComponent(env.ACADEMIC_CALENDAR_ORBIT_ORGANIZATION_ID!)}`
  const response = await fetch(orbitUrl('/calendar/current' + query), { headers: headers() })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new ApiError(response.status, data.message || 'Current academic calendar request failed.')
  res.json(data)
}))

academicCalendarRouter.put('/', asyncHandler(async (req, res) => {
  const response = await fetch(orbitUrl('/calendar'), {
    method: 'PUT',
    headers: headers(true),
    body: JSON.stringify({ ...req.body, organizationId: env.ACADEMIC_CALENDAR_ORBIT_ORGANIZATION_ID }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new ApiError(response.status, data.message || 'Academic calendar update failed.')
  res.json(data)
}))
