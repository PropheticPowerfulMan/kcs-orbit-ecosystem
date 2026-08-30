import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../config/prisma.js'
import { authenticate, type AuthenticatedRequest } from '../middleware/auth.js'
import { ApiError, asyncHandler, success } from '../utils/api.js'
import { getRouteParam } from '../utils/request.js'

export const messagesRouter = Router()
messagesRouter.use(authenticate)

const messageSchema = z.object({ recipientId: z.string().min(1), subject: z.string().min(2).max(160), body: z.string().min(1).max(10000) })

messagesRouter.get('/', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const query = String(req.query.q ?? '').trim()
  const box = String(req.query.box ?? 'all')
  const userId = req.user!.sub
  const targetRole = req.user!.role.toUpperCase() as 'ADMIN' | 'STAFF' | 'TEACHER' | 'STUDENT' | 'PARENT'
  const direction = box === 'sent' ? { senderId: userId } : box === 'inbox' ? { recipientId: userId } : { OR: [{ senderId: userId }, { recipientId: userId }, { targetRole }] }
  const search = query ? { OR: [{ subject: { contains: query, mode: 'insensitive' as const } }, { body: { contains: query, mode: 'insensitive' as const } }] } : {}
  const messages = await prisma.internalMessage.findMany({
    where: { AND: [direction, search] },
    include: { sender: { select: { id: true, firstName: true, lastName: true, role: true } }, recipient: { select: { id: true, firstName: true, lastName: true, role: true } } },
    orderBy: { createdAt: 'desc' }, take: 250,
  })
  return success(res, messages)
}))

messagesRouter.get('/contacts', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const allowedRoles = req.user!.role === 'parent' ? ['ADMIN', 'STAFF', 'TEACHER'] as const : undefined
  const contacts = await prisma.user.findMany({ where: { id: { not: req.user!.sub }, ...(allowedRoles ? { role: { in: [...allowedRoles] } } : {}) }, select: { id: true, firstName: true, lastName: true, role: true }, orderBy: [{ role: 'asc' }, { firstName: 'asc' }] })
  return success(res, contacts)
}))

messagesRouter.post('/', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const data = messageSchema.parse(req.body)
  const recipient = await prisma.user.findUnique({ where: { id: data.recipientId }, select: { role: true } })
  if (!recipient) throw new ApiError(404, 'Recipient not found')
  if (req.user!.role === 'parent' && !['ADMIN', 'STAFF', 'TEACHER'].includes(recipient.role)) {
    throw new ApiError(403, 'Parents may only contact authorized school staff.')
  }
  const message = await prisma.internalMessage.create({ data: { ...data, senderId: req.user!.sub }, include: { sender: true, recipient: true } })
  return success(res, message, 'Message sent', 201)
}))

messagesRouter.patch('/:id/read', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const id = getRouteParam(req.params.id)
  const existing = await prisma.internalMessage.findFirst({ where: { id, recipientId: req.user!.sub } })
  if (!existing) throw new ApiError(404, 'Message not found')
  const message = await prisma.internalMessage.update({ where: { id }, data: { readAt: existing.readAt ?? new Date() }, include: { sender: true, recipient: true } })
  return success(res, message)
}))
