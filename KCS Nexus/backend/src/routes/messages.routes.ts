import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../config/prisma.js'
import { authenticate, type AuthenticatedRequest } from '../middleware/auth.js'
import { ApiError, asyncHandler, success } from '../utils/api.js'
import { getRouteParam } from '../utils/request.js'
import { sendSchoolMail } from '../utils/mail.js'
import { sendSchoolSms } from '../utils/sms.js'

export const messagesRouter = Router()
messagesRouter.use(authenticate)

const messageSchema = z.object({ recipientId: z.string().min(1), subject: z.string().min(2).max(160), body: z.string().min(1).max(10000) })
const parentDeliverySchema = z.object({ recipientIds: z.array(z.string().min(1)).min(1).max(250), channels: z.array(z.enum(['email','sms'])).min(1), subject: z.string().min(2).max(160), body: z.string().min(1).max(10000) })
const broadcastSchema = z.object({ audience: z.enum(['ALL','PARENTS','STUDENTS','TEACHERS','STAFF','GRADE_9_12_FAMILIES']), subject: z.string().min(2).max(160), body: z.string().min(1).max(10000) })
const messageLink = (role: string) => role === 'PARENT' ? '/portal/parent/messages' : role === 'STUDENT' ? '/portal/student/messages' : role === 'TEACHER' ? '/portal/teacher/messages' : role === 'STAFF' ? '/portal/staff/messages' : '/admin/communications'

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
  const allowedRoles = req.user!.role === 'parent' || req.user!.role === 'student' ? ['ADMIN', 'STAFF', 'TEACHER'] as const : undefined
  const contacts = await prisma.user.findMany({ where: { id: { not: req.user!.sub }, ...(allowedRoles ? { role: { in: [...allowedRoles] } } : {}) }, select: { id: true, firstName: true, lastName: true, role: true }, orderBy: [{ role: 'asc' }, { firstName: 'asc' }] })
  return success(res, contacts)
}))

messagesRouter.get('/parent-contacts', asyncHandler(async (req: AuthenticatedRequest, res) => {
  if (req.user!.sub !== 'configured-superadmin') throw new ApiError(403, 'Super Administrator permissions required')
  const parents = await prisma.user.findMany({
    where: { role: 'PARENT', id: { not: req.user!.sub } },
    select: { id: true, firstName: true, middleName: true, lastName: true, email: true, phone: true, accessCode: true },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  })
  return success(res, parents)
}))

messagesRouter.post('/parent-delivery', asyncHandler(async (req: AuthenticatedRequest, res) => {
  if (req.user!.sub !== 'configured-superadmin') throw new ApiError(403, 'Super Administrator permissions required')
  const data = parentDeliverySchema.parse(req.body)
  const recipientIds = [...new Set(data.recipientIds)]
  const parents = await prisma.user.findMany({
    where: { id: { in: recipientIds }, role: 'PARENT' },
    select: { id: true, firstName: true, middleName: true, lastName: true, email: true, phone: true },
  })
  if (parents.length !== recipientIds.length) throw new ApiError(400, 'One or more selected recipients are not valid parent accounts.')

  await prisma.$transaction([
    prisma.internalMessage.createMany({ data: parents.map((parent) => ({ senderId: req.user!.sub, recipientId: parent.id, subject: data.subject, body: data.body })) }),
    prisma.notification.createMany({ data: parents.map((parent) => ({ userId: parent.id, title: data.subject, message: data.body, type: 'MESSAGE' as const, link: messageLink('PARENT') })) }),
  ])

  const delivery: Array<Record<string, unknown>> = []
  for (let index = 0; index < parents.length; index += 10) {
    const batch = parents.slice(index, index + 10)
    const results = await Promise.all(batch.map(async (parent) => {
      const row: Record<string, unknown> = { userId: parent.id, name: [parent.lastName, parent.middleName, parent.firstName].filter(Boolean).join(' ') }
      if (data.channels.includes('email')) row.email = await sendSchoolMail({ to: parent.email, subject: data.subject, text: data.body, branded: false }).catch(() => ({ sent: false as const, reason: 'SMTP_SEND_FAILED' as const }))
      if (data.channels.includes('sms')) row.sms = await sendSchoolSms(parent.phone, `${data.subject}\n\n${data.body}`, { brand: false }).catch(() => ({ sent: false as const, reason: 'SMS_SEND_FAILED' as const }))
      return row
    }))
    delivery.push(...results)
  }
  return success(res, { recipients: parents.length, channels: data.channels, delivery }, 'Parent communication recorded and delivered', 201)
}))

messagesRouter.post('/', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const data = messageSchema.parse(req.body)
  const recipient = await prisma.user.findUnique({ where: { id: data.recipientId }, select: { role: true, email: true, phone: true } })
  if (!recipient) throw new ApiError(404, 'Recipient not found')
  if ((req.user!.role === 'parent' || req.user!.role === 'student') && !['ADMIN', 'STAFF', 'TEACHER'].includes(recipient.role)) {
    throw new ApiError(403, 'Parents and students may only contact authorized school staff.')
  }
  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.internalMessage.create({ data: { ...data, senderId: req.user!.sub }, include: { sender: true, recipient: true } })
    await tx.notification.create({ data: { userId: data.recipientId, title: data.subject, message: data.body, type: 'MESSAGE', link: messageLink(recipient.role) } })
    return created
  })
  const delivery = req.user!.sub === 'configured-superadmin'
    ? await Promise.all([
        sendSchoolMail({ to: recipient.email, subject: data.subject, text: data.body, branded: false }).catch(() => ({ sent: false as const, reason: 'SMTP_SEND_FAILED' as const })),
        sendSchoolSms(recipient.phone, `${data.subject}\n\n${data.body}`, { brand: false }).catch(() => ({ sent: false as const, reason: 'SMS_SEND_FAILED' as const })),
      ])
    : []
  return success(res, { ...message, delivery }, 'Message sent', 201)
}))

messagesRouter.post('/broadcast', asyncHandler(async (req: AuthenticatedRequest, res) => {
  if (req.user!.sub !== 'configured-superadmin') throw new ApiError(403, 'Super Administrator permissions required')
  const data = broadcastSchema.parse(req.body)
  const roleMap = { PARENTS: ['PARENT'], STUDENTS: ['STUDENT'], TEACHERS: ['TEACHER'], STAFF: ['ADMIN','STAFF','TEACHER'], ALL: ['ADMIN','STAFF','TEACHER','STUDENT','PARENT'] } as const
  const users = await prisma.user.findMany({
    where: data.audience === 'GRADE_9_12_FAMILIES'
      ? { role: 'PARENT', parentLinks: { some: { student: { grade: { in: ['Grade 9','Grade 10','Grade 11','Grade 12'] } } } } }
      : { role: { in: [...roleMap[data.audience as keyof typeof roleMap]] }, id: { not: req.user!.sub } },
    select: { id: true, role: true },
  })
  await prisma.$transaction([
    prisma.internalMessage.createMany({ data: users.map((user) => ({ senderId: req.user!.sub, recipientId: user.id, subject: data.subject, body: data.body })) }),
    prisma.notification.createMany({ data: users.map((user) => ({ userId: user.id, title: data.subject, message: data.body, type: 'MESSAGE' as const, link: messageLink(user.role) })) }),
  ])
  return success(res, { recipients: users.length, audience: data.audience }, 'Communication delivered', 201)
}))

messagesRouter.patch('/:id/read', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const id = getRouteParam(req.params.id)
  const existing = await prisma.internalMessage.findFirst({ where: { id, recipientId: req.user!.sub } })
  if (!existing) throw new ApiError(404, 'Message not found')
  const message = await prisma.internalMessage.update({ where: { id }, data: { readAt: existing.readAt ?? new Date() }, include: { sender: true, recipient: true } })
  return success(res, message)
}))
