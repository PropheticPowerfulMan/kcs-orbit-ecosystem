import { Router } from 'express'
import multer from 'multer'
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
const jsonArray = (value: unknown) => typeof value === 'string' ? JSON.parse(value) : value
const parentDeliverySchema = z.object({ recipientIds: z.preprocess(jsonArray, z.array(z.string().min(1)).min(1).max(250)), channels: z.preprocess(jsonArray, z.array(z.enum(['email','sms'])).min(1)), subject: z.string().min(2).max(160), body: z.string().min(1).max(10000) })
const attachmentTypes = new Set(['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/plain','text/csv','image/jpeg','image/png','image/webp'])
const attachmentUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10485760, files: 1 }, fileFilter: (_req, file, cb) => attachmentTypes.has(file.mimetype) ? cb(null, true) : cb(new ApiError(400, 'Unsupported attachment type')) })
const broadcastSchema = z.object({ audience: z.enum(['ALL','PARENTS','STUDENTS','TEACHERS','STAFF','GRADE_9_12_FAMILIES']), subject: z.string().min(2).max(160), body: z.string().min(1).max(10000) })
const messageLink = (role: string) => role === 'PARENT' ? '/portal/parent/messages' : role === 'STUDENT' ? '/portal/student/messages' : role === 'TEACHER' ? '/portal/teacher/messages' : role === 'STAFF' ? '/portal/staff/messages' : '/admin/communications'

const resolveMessageActorId = async (req: AuthenticatedRequest) => {
  if (req.user!.sub !== 'configured-superadmin') return req.user!.sub
  const superAdmin = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { equals: process.env.SUPERADMIN_EMAIL || 'superadmin@kcsnexus.com', mode: 'insensitive' } },
        { accessCode: 'ACC-ADM-SUPER1' },
      ],
      role: 'ADMIN',
    },
    select: { id: true },
  })
  if (!superAdmin) throw new ApiError(500, 'The configured superadministrator account is not synchronized with the Nexus user registry.')
  return superAdmin.id
}

messagesRouter.get('/', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const query = String(req.query.q ?? '').trim()
  const box = String(req.query.box ?? 'all')
  const userId = await resolveMessageActorId(req)
  const targetRole = req.user!.role.toUpperCase() as 'ADMIN' | 'STAFF' | 'TEACHER' | 'STUDENT' | 'PARENT'
  const direction = box === 'sent' ? { senderId: userId } : box === 'inbox' ? { recipientId: userId } : { OR: [{ senderId: userId }, { recipientId: userId }, { targetRole }] }
  const search = query ? { OR: [{ subject: { contains: query, mode: 'insensitive' as const } }, { body: { contains: query, mode: 'insensitive' as const } }] } : {}
  const messages = await prisma.internalMessage.findMany({
    where: { AND: [direction, search] },
    include: { sender: { select: { id: true, firstName: true, middleName: true, lastName: true, role: true, email: true, phone: true } }, recipient: { select: { id: true, firstName: true, middleName: true, lastName: true, role: true, email: true, phone: true } } },
    orderBy: { createdAt: 'desc' }, take: 250,
  })
  const correspondence = messages.length ? await prisma.correspondenceLog.findMany({
    where: { senderId: userId },
    select: { channel: true, status: true, failureReason: true, sentAt: true, deliveredAt: true, metadata: true },
    orderBy: { createdAt: 'desc' },
    take: 1000,
  }) : []
  const deliveryByMessage = new Map<string, typeof correspondence>()
  correspondence.forEach((entry) => {
    const messageId = String((entry.metadata as Record<string, unknown> | null)?.internalMessageId || '')
    if (!messageId) return
    deliveryByMessage.set(messageId, [...(deliveryByMessage.get(messageId) || []), entry])
  })
  return success(res, messages.map(({ attachmentData: _data, ...message }) => ({ ...message, hasAttachment: Boolean(message.attachmentName), deliveries: deliveryByMessage.get(message.id) || [] })))
}))

messagesRouter.get('/contacts', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const allowedRoles = req.user!.role === 'parent' || req.user!.role === 'student' ? ['ADMIN', 'STAFF', 'TEACHER'] as const : undefined
  const actorId = await resolveMessageActorId(req)
  const contacts = await prisma.user.findMany({ where: { id: { not: actorId }, ...(allowedRoles ? { role: { in: [...allowedRoles] } } : {}) }, select: { id: true, firstName: true, lastName: true, role: true }, orderBy: [{ role: 'asc' }, { firstName: 'asc' }] })
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

messagesRouter.post('/parent-delivery', attachmentUpload.single('attachment'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  if (req.user!.sub !== 'configured-superadmin') throw new ApiError(403, 'Super Administrator permissions required')
  const data = parentDeliverySchema.parse(req.body)
  const senderId = await resolveMessageActorId(req)
  const recipientIds = [...new Set(data.recipientIds)]
  const parents = await prisma.user.findMany({
    where: { id: { in: recipientIds }, role: 'PARENT' },
    select: { id: true, firstName: true, middleName: true, lastName: true, email: true, phone: true },
  })
  if (parents.length !== recipientIds.length) throw new ApiError(400, 'One or more selected recipients are not valid parent accounts.')

  const createdMessages = await prisma.$transaction(async (tx) => {
    const rows = []
    for (const parent of parents) {
      rows.push(await tx.internalMessage.create({ data: { senderId, recipientId: parent.id, subject: data.subject, body: data.body, attachmentName: req.file?.originalname, attachmentMime: req.file?.mimetype, attachmentSize: req.file?.size, attachmentData: req.file?.buffer }, select: { id: true, recipientId: true } }))
    }
    await tx.notification.createMany({ data: parents.map((parent) => ({ userId: parent.id, title: data.subject, message: data.body, type: 'MESSAGE' as const, link: messageLink('PARENT') })) })
    return rows
  })
  const messageIdByRecipient = new Map(createdMessages.map((message) => [message.recipientId, message.id]))

  const delivery: Array<Record<string, unknown>> = []
  for (let index = 0; index < parents.length; index += 10) {
    const batch = parents.slice(index, index + 10)
    const results = await Promise.all(batch.map(async (parent) => {
      const row: Record<string, unknown> = { userId: parent.id, name: [parent.lastName, parent.middleName, parent.firstName].filter(Boolean).join(' ') }
      const attachmentNote = req.file ? `\n\nDocument joint : ${req.file.originalname}. Disponible aussi dans votre boîte Nexus.` : ''
      if (data.channels.includes('email')) row.email = await sendSchoolMail({ to: parent.email, subject: data.subject, text: data.body + attachmentNote, attachments: req.file ? [{ filename: req.file.originalname, content: req.file.buffer, contentType: req.file.mimetype }] : undefined, branded: true })
      if (data.channels.includes('sms')) row.sms = await sendSchoolSms(parent.phone, `${data.subject}\n\n${data.body}${attachmentNote}`, { brand: false })
      const internalMessageId = messageIdByRecipient.get(parent.id)
      const deliveryRows = data.channels.map((channel) => {
        const result = row[channel] as { sent: boolean; reason?: string }
        return {
          channel: channel === 'email' ? 'EMAIL' as const : 'TEXT' as const,
          status: result.sent ? 'SENT' as const : 'FAILED' as const,
          subject: data.subject,
          body: data.body,
          senderId,
          recipientName: String(row.name),
          recipientEmail: parent.email,
          recipientPhone: parent.phone,
          sentAt: result.sent ? new Date() : null,
          failureReason: result.sent ? null : (result.reason || 'DELIVERY_FAILED'),
          metadata: { internalMessageId, recipientId: parent.id },
        }
      })
      await prisma.correspondenceLog.createMany({ data: deliveryRows })
      return row
    }))
    delivery.push(...results)
  }
  const externalDeliverySucceeded = delivery.some((row) => data.channels.some((channel) => Boolean((row[channel] as { sent?: boolean } | undefined)?.sent)))
  return success(res, { recipients: parents.length, channels: data.channels, delivery, externalDeliverySucceeded }, externalDeliverySucceeded ? 'Parent communication recorded and delivered' : 'Parent communication recorded, but external delivery failed', 201)
}))

messagesRouter.post('/', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const data = messageSchema.parse(req.body)
  const senderId = await resolveMessageActorId(req)
  const recipient = await prisma.user.findUnique({ where: { id: data.recipientId }, select: { role: true, email: true, phone: true } })
  if (!recipient) throw new ApiError(404, 'Recipient not found')
  if ((req.user!.role === 'parent' || req.user!.role === 'student') && !['ADMIN', 'STAFF', 'TEACHER'].includes(recipient.role)) {
    throw new ApiError(403, 'Parents and students may only contact authorized school staff.')
  }
  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.internalMessage.create({ data: { ...data, senderId }, include: { sender: true, recipient: true } })
    await tx.notification.create({ data: { userId: data.recipientId, title: data.subject, message: data.body, type: 'MESSAGE', link: messageLink(recipient.role) } })
    return created
  })
  const delivery = req.user!.sub === 'configured-superadmin'
    ? await Promise.all([
        sendSchoolMail({ to: recipient.email, subject: data.subject, text: data.body, branded: true }).catch(() => ({ sent: false as const, reason: 'SMTP_SEND_FAILED' as const })),
        sendSchoolSms(recipient.phone, `${data.subject}\n\n${data.body}`, { brand: false }).catch(() => ({ sent: false as const, reason: 'SMS_SEND_FAILED' as const })),
      ])
    : []
  return success(res, { ...message, delivery }, 'Message sent', 201)
}))

messagesRouter.post('/broadcast', asyncHandler(async (req: AuthenticatedRequest, res) => {
  if (req.user!.sub !== 'configured-superadmin') throw new ApiError(403, 'Super Administrator permissions required')
  const data = broadcastSchema.parse(req.body)
  const senderId = await resolveMessageActorId(req)
  const roleMap = { PARENTS: ['PARENT'], STUDENTS: ['STUDENT'], TEACHERS: ['TEACHER'], STAFF: ['ADMIN','STAFF','TEACHER'], ALL: ['ADMIN','STAFF','TEACHER','STUDENT','PARENT'] } as const
  const users = await prisma.user.findMany({
    where: data.audience === 'GRADE_9_12_FAMILIES'
      ? { role: 'PARENT', parentLinks: { some: { student: { grade: { in: ['Grade 9','Grade 10','Grade 11','Grade 12'] } } } } }
      : { role: { in: [...roleMap[data.audience as keyof typeof roleMap]] }, id: { not: req.user!.sub } },
    select: { id: true, role: true },
  })
  await prisma.$transaction([
    prisma.internalMessage.createMany({ data: users.map((user) => ({ senderId, recipientId: user.id, subject: data.subject, body: data.body })) }),
    prisma.notification.createMany({ data: users.map((user) => ({ userId: user.id, title: data.subject, message: data.body, type: 'MESSAGE' as const, link: messageLink(user.role) })) }),
  ])
  return success(res, { recipients: users.length, audience: data.audience }, 'Communication delivered', 201)
}))

messagesRouter.post('/bulk-delete', asyncHandler(async (req: AuthenticatedRequest, res) => {
  if (req.user!.sub !== 'configured-superadmin') throw new ApiError(403, 'Super Administrator permissions required')
  const ids = z.array(z.string().min(1)).min(1).max(250).parse(req.body?.ids)
  const actorId = await resolveMessageActorId(req)
  const owned = await prisma.internalMessage.findMany({
    where: { id: { in: [...new Set(ids)] }, senderId: actorId },
    select: { id: true },
  })
  if (!owned.length) return success(res, { deletedCount: 0 })
  const ownedIds = owned.map((message) => message.id)
  const correspondence = await prisma.correspondenceLog.findMany({
    where: { senderId: actorId },
    select: { id: true, metadata: true },
  })
  const correspondenceIds = correspondence
    .filter((row) => ownedIds.includes(String((row.metadata as any)?.internalMessageId || '')))
    .map((row) => row.id)
  await prisma.$transaction([
    prisma.internalMessage.deleteMany({ where: { id: { in: ownedIds }, senderId: actorId } }),
    prisma.correspondenceLog.deleteMany({ where: { id: { in: correspondenceIds }, senderId: actorId } }),
  ])
  return success(res, { deletedCount: ownedIds.length })
}))

messagesRouter.patch('/:id/read', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const id = getRouteParam(req.params.id)
  const existing = await prisma.internalMessage.findFirst({ where: { id, recipientId: req.user!.sub } })
  if (!existing) throw new ApiError(404, 'Message not found')
  const message = await prisma.internalMessage.update({ where: { id }, data: { readAt: existing.readAt ?? new Date() }, include: { sender: true, recipient: true } })
  return success(res, message)
}))
messagesRouter.get('/:id/attachment', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const actorId = await resolveMessageActorId(req)
  const message = await prisma.internalMessage.findUnique({ where: { id: getRouteParam(req.params.id) } })
  if (!message) throw new ApiError(404, 'Message not found')
  if (message.senderId !== actorId && message.recipientId !== actorId) throw new ApiError(403, 'Access denied')
  if (!message.attachmentData || !message.attachmentName || !message.attachmentMime) throw new ApiError(404, 'No attachment')
  res.type(message.attachmentMime).set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(message.attachmentName)}`).set('X-Content-Type-Options', 'nosniff')
  return res.send(Buffer.from(message.attachmentData))
}))
