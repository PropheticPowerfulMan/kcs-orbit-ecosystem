import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../config/prisma.js'
import { authenticate, requireRoles, type AuthenticatedRequest } from '../middleware/auth.js'
import { ApiError, asyncHandler, success } from '../utils/api.js'
import { getRouteParam } from '../utils/request.js'
import { processEventReminders } from '../services/eventReminder.service.js'

const eventSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  location: z.string().min(2),
  type: z.enum(['ACADEMIC', 'SPIRITUAL', 'SPORTS', 'CULTURAL', 'ADMINISTRATIVE']),
  coverImage: z.string().trim().refine((value) => /^https?:\/\//i.test(value) || /\/uploads\/media\//i.test(value), 'Cover image must be an HTTPS URL or an uploaded KCS media path').optional(),
  registrationRequired: z.boolean().default(false),
  maxAttendees: z.number().optional(),
  liveStreamEnabled: z.boolean().default(false),
  liveStreamUrl: z.string().url().optional(),
  liveStreamPlatform: z.string().min(2).optional(),
  liveStreamStatus: z.enum(['scheduled', 'live', 'ended', 'cancelled']).default('scheduled'),
  liveStreamStartsAt: z.coerce.date().optional(),
  replayUrl: z.string().url().optional(),
  audienceRoles: z.array(z.enum(['ADMIN', 'STAFF', 'TEACHER', 'STUDENT', 'PARENT'])).min(1).max(5).default(['ADMIN', 'STAFF', 'TEACHER', 'STUDENT', 'PARENT']),
  audienceGrades: z.array(z.string().trim().min(2).max(40)).max(20).default([]),
  reminderEnabled: z.boolean().default(true),
  reminderDaysBefore: z.coerce.number().int().min(1).max(30).default(7),
  reminderChannels: z.array(z.enum(['IN_APP', 'EMAIL', 'SMS'])).min(1).max(3).default(['IN_APP', 'EMAIL', 'SMS']),
})

export const eventsRouter = Router()

eventsRouter.get('/', asyncHandler(async (_req, res) => {
  const events = await prisma.event.findMany({ orderBy: { startDate: 'asc' } })
  return success(res, events)
}))

eventsRouter.get('/:id', asyncHandler(async (req, res) => {
  const eventId = getRouteParam(req.params.id)
  const event = await prisma.event.findUnique({ where: { id: eventId } })
  if (!event) throw new ApiError(404, 'Event not found')
  return success(res, event)
}))

eventsRouter.post('/', authenticate, requireRoles('admin'), asyncHandler(async (req, res) => {
  const payload = eventSchema.parse(req.body)
  const event = await prisma.event.create({ data: payload })
  return success(res, event, 'Event created', 201)
}))

eventsRouter.put('/:id', authenticate, requireRoles('admin'), asyncHandler(async (req, res) => {
  const payload = eventSchema.partial().parse(req.body)
  const eventId = getRouteParam(req.params.id)
  const event = await prisma.event.update({ where: { id: eventId }, data: { ...payload, reminderRevision: { increment: 1 } } })
  return success(res, event, 'Event updated')
}))

eventsRouter.post('/reminders/process', authenticate, requireRoles('admin'), asyncHandler(async (_req, res) => {
  const result = await processEventReminders()
  return success(res, result, 'Calendar reminder processing completed')
}))

eventsRouter.patch('/:id/live-stream', authenticate, requireRoles('admin'), asyncHandler(async (req, res) => {
  const payload = eventSchema.pick({
    liveStreamEnabled: true,
    liveStreamUrl: true,
    liveStreamPlatform: true,
    liveStreamStatus: true,
    liveStreamStartsAt: true,
    replayUrl: true,
  }).partial().parse(req.body)
  const eventId = getRouteParam(req.params.id)
  const event = await prisma.event.update({ where: { id: eventId }, data: payload })
  return success(res, event, 'Live stream settings updated')
}))

eventsRouter.delete('/:id', authenticate, requireRoles('admin'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const eventId = getRouteParam(req.params.id)
  const event = await prisma.event.delete({ where: { id: eventId } })
  await prisma.auditLog.create({ data: { actorId: req.user!.sub, action: 'SCHOOL_EVENT_DELETED', targetType: 'Event', targetId: eventId, metadata: { title: event.title, startDate: event.startDate } } })
  return success(res, null, 'Event deleted')
}))
