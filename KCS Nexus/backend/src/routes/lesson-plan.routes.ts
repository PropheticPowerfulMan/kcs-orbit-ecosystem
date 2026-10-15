import { createHash, randomBytes } from 'node:crypto'
import { Router } from 'express'
import { prisma } from '../config/prisma.js'
import { authenticate, requireRoles, type AuthenticatedRequest } from '../middleware/auth.js'
import { ApiError, asyncHandler, success } from '../utils/api.js'

type LaunchIdentity = { userId: string; email: string; firstName: string; middleName: string | null; lastName: string; role: string; accessRoles: string[] }
type LaunchTicket = { identity: LaunchIdentity; expiresAt: number }
const launchTickets = new Map<string, LaunchTicket>()
const hashTicket = (ticket: string) => createHash('sha256').update(ticket).digest('hex')
const pruneExpiredTickets = () => { const now = Date.now(); for (const [key, record] of launchTickets) if (record.expiresAt <= now) launchTickets.delete(key) }

export const lessonPlanRouter = Router()
lessonPlanRouter.post('/launch', authenticate, requireRoles('teacher', 'staff', 'admin'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  pruneExpiredTickets()
  const user = req.user!.sub === 'configured-superadmin'
    ? await prisma.user.findUnique({ where: { email: (process.env.SUPERADMIN_EMAIL || '').trim().toLowerCase() }, include: { teacherProfile: true } })
    : await prisma.user.findUnique({ where: { id: req.user!.sub }, include: { teacherProfile: true } })
  const accessRoles = Array.from(new Set([user?.role?.toLowerCase(), user?.teacherProfile ? 'teacher' : null].filter(Boolean))) as string[]
  const isTeacher = user?.role === 'TEACHER' || Boolean(user?.teacherProfile) || accessRoles.includes('teacher')
  if (!user || (!isTeacher && user.role !== 'ADMIN')) throw new ApiError(403, 'EduPlanner access is not enabled for this identity')
  if (!user.email) throw new ApiError(409, 'This institutional identity does not have an email address')
  const ticket = randomBytes(32).toString('base64url')
  launchTickets.set(hashTicket(ticket), { identity: { userId: user.id, email: user.email, firstName: user.firstName, middleName: user.middleName, lastName: user.lastName, role: user.role, accessRoles }, expiresAt: Date.now() + 60_000 })
  return success(res, { url: `/lesson-plan/#/sso?ticket=${encodeURIComponent(ticket)}` })
}))
lessonPlanRouter.post('/exchange', asyncHandler(async (req, res) => {
  pruneExpiredTickets()
  const ticket = typeof req.body?.ticket === 'string' ? req.body.ticket.trim() : ''
  if (!/^[A-Za-z0-9_-]{40,128}$/.test(ticket)) throw new ApiError(400, 'Invalid EduPlanner launch ticket')
  const key = hashTicket(ticket)
  const record = launchTickets.get(key)
  launchTickets.delete(key)
  if (!record || record.expiresAt <= Date.now()) throw new ApiError(401, 'EduPlanner launch ticket expired or already used')
  return success(res, record.identity)
}))
