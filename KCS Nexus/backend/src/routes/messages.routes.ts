import { Router } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { prisma } from '../config/prisma.js'
import { env } from '../config/env.js'
import { authenticate, type AuthenticatedRequest } from '../middleware/auth.js'
import { ApiError, asyncHandler, success } from '../utils/api.js'
import { getRouteParam } from '../utils/request.js'
import { sendSchoolMail } from '../utils/mail.js'
import { sendSchoolSms } from '../utils/sms.js'

export const messagesRouter = Router()
const trackingPixel = Buffer.from('R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=', 'base64')
messagesRouter.get('/tracking/email/:id.gif', asyncHandler(async (req, res) => {
  const id = getRouteParam(req.params.id)
  await prisma.correspondenceLog.updateMany({ where: { id, channel: 'EMAIL', status: { in: ['SENT', 'DELIVERED'] } }, data: { status: 'DELIVERED', deliveredAt: new Date() } })
  res.setHeader('Content-Type', 'image/gif')
  res.setHeader('Content-Length', String(trackingPixel.length))
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  res.status(200).send(trackingPixel)
}))
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
const canManageParentCommunications = (req: AuthenticatedRequest) =>
  req.user!.sub === 'configured-superadmin' || req.user!.role === 'teacher'

type OrbitContact = { id: string; fullName?: string; firstName?: string; middleName?: string | null; lastName?: string; email?: string | null; phone?: string | null; accessCode?: string | null; familyContacts?: Array<{ kind?: string; firstName?: string; middleName?: string; lastName?: string; email?: string | null; phone?: string | null }> }
type OrbitDirectory = { parents?: OrbitContact[]; students?: OrbitContact[]; teachers?: OrbitContact[] }
let orbitDirectoryCache: { expiresAt: number; value: OrbitDirectory } | null = null
const identityKey = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).sort().join('|')
const contactName = (person: Partial<OrbitContact>) => [person.lastName, person.middleName, person.firstName].filter(Boolean).join(' ').trim() || String(person.fullName || '').trim()
const getOrbitDirectory = async () => {
  if (orbitDirectoryCache && orbitDirectoryCache.expiresAt > Date.now()) return orbitDirectoryCache.value
  if (!env.KCS_ORBIT_API_URL || !env.KCS_ORBIT_API_KEY || !env.KCS_ORBIT_ORGANIZATION_ID) return {} as OrbitDirectory
  try {
    const response = await fetch(`${env.KCS_ORBIT_API_URL.replace(/\/$/, '')}/api/integration/read/shared-directory?organizationId=${encodeURIComponent(env.KCS_ORBIT_ORGANIZATION_ID)}`, { headers: { 'x-api-key': env.KCS_ORBIT_API_KEY, 'x-app-slug': 'KCS_NEXUS' }, signal: AbortSignal.timeout(8_000) })
    if (!response.ok) throw new Error(`status ${response.status}`)
    const value = await response.json() as OrbitDirectory
    orbitDirectoryCache = { expiresAt: Date.now() + 5 * 60_000, value }
    return value
  } catch (error) {
    console.warn('Orbit shared directory unavailable; using Nexus recipient fallback', error)
    return orbitDirectoryCache?.value ?? ({} as OrbitDirectory)
  }
}
const findOfficialContact = (directory: OrbitDirectory, person: { firstName?: string | null; middleName?: string | null; lastName?: string | null; email?: string | null }) => {
  const entries = [...(directory.parents || []), ...(directory.teachers || []), ...(directory.students || [])]
  const email = person.email?.trim().toLowerCase()
  const name = identityKey([person.lastName, person.middleName, person.firstName].filter(Boolean).join(' '))
  return entries.find((entry) => email && entry.email?.trim().toLowerCase() === email) || entries.find((entry) => name && identityKey(contactName(entry)) === name)
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
  const contacts = await prisma.user.findMany({ where: { id: { not: actorId }, ...(allowedRoles ? { role: { in: [...allowedRoles] } } : {}) }, select: { id: true, firstName: true, middleName: true, lastName: true, role: true }, orderBy: [{ role: 'asc' }, { firstName: 'asc' }] })
  return success(res, contacts)
}))

messagesRouter.get('/parent-contacts', asyncHandler(async (req: AuthenticatedRequest, res) => {
  if (!canManageParentCommunications(req)) throw new ApiError(403, 'Super Administrator or Teacher permissions required')
  const actorId = await resolveMessageActorId(req)
  const superAdmin = req.user!.sub === 'configured-superadmin'
  const [recipients, directory] = await Promise.all([
    prisma.user.findMany({
    where: { id: { not: actorId }, ...(superAdmin ? {} : { role: 'PARENT' as const }) },
    select: {
      id: true, firstName: true, middleName: true, lastName: true, email: true, phone: true, accessCode: true, role: true,
      studentProfile: { select: { grade: true, section: true } },
      parentLinks: { select: { student: { select: { grade: true, section: true, studentNumber: true } } } },
      teacherProfile: { select: { employeeNumber: true, department: true, courses: { select: { grade: true } } } },
      staffProfile: { select: { employeeNumber: true, department: true, function: true } },
    },
    orderBy: [{ role: 'asc' }, { lastName: 'asc' }, { firstName: 'asc' }],
    }),
    superAdmin ? getOrbitDirectory() : Promise.resolve({} as OrbitDirectory),
  ])
  const seenIdentities = new Set<string>()
  const canonicalRecipients = recipients.flatMap((person) => {
    const official = superAdmin && person.role !== 'ADMIN' && person.role !== 'STAFF'
      ? findOfficialContact(directory, person)
      : undefined
    const source = official || person
    const key = source.email?.trim().toLowerCase() || identityKey(contactName(source))
    if (key && seenIdentities.has(key)) return []
    if (key) seenIdentities.add(key)
    // Nexus remains a valid source when an Orbit record has not been linked yet.
    // Matched Orbit data stays authoritative for the displayed identity and contacts.
    if (!official) return [person]
    return [{ ...person, firstName: official.firstName || person.firstName, middleName: official.middleName || null, lastName: official.lastName || person.lastName, email: official.email || person.email, phone: official.phone || person.phone, accessCode: official.accessCode || person.accessCode }]
  })
  return success(res, canonicalRecipients.map((person) => {
    const gradeValues = [
      person.studentProfile?.grade,
      ...person.parentLinks.map((link) => link.student.grade),
      ...(person.teacherProfile?.courses.map((course) => course.grade) ?? []),
    ].filter((value): value is string => Boolean(value))
    const sectionValues = [
      person.studentProfile ? [person.studentProfile.grade, person.studentProfile.section].filter(Boolean).join(' ') : null,
      ...person.parentLinks.map((link) => [link.student.grade, link.student.section].filter(Boolean).join(' ')),
    ].filter((value): value is string => Boolean(value))
    return {
      id: person.id, firstName: person.firstName, middleName: person.middleName, lastName: person.lastName,
      email: person.email, phone: person.phone, accessCode: person.accessCode, role: person.role,
      grades: [...new Set(gradeValues)], classes: [...new Set(sectionValues)],
      department: person.teacherProfile?.department || person.staffProfile?.department || null,
      function: person.staffProfile?.function || null,
      employeeNumber: person.teacherProfile?.employeeNumber || person.staffProfile?.employeeNumber || null,
    }
  }), superAdmin ? 'All communication recipients loaded' : 'Parent communication recipients loaded')
}))

messagesRouter.post('/parent-delivery', attachmentUpload.single('attachment'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  if (!canManageParentCommunications(req)) throw new ApiError(403, 'Super Administrator or Teacher permissions required')
  const data = parentDeliverySchema.parse(req.body)
  const senderId = await resolveMessageActorId(req)
  const recipientIds = [...new Set(data.recipientIds)]
  const [parents, directory] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: recipientIds }, ...(req.user!.sub === 'configured-superadmin' ? {} : { role: 'PARENT' as const }) },
      select: { id: true, firstName: true, middleName: true, lastName: true, email: true, phone: true, role: true },
    }),
    getOrbitDirectory(),
  ])
  if (parents.length !== recipientIds.length) throw new ApiError(400, 'One or more selected recipients are not valid communication accounts.')
  const deliveryParents = parents.map((parent) => {
    const official = findOfficialContact(directory, parent)
    const officialEmail = official?.email?.trim()
    const nexusEmail = parent.email?.trim()
    return {
      ...parent,
      firstName: official?.firstName || parent.firstName,
      middleName: official?.middleName || parent.middleName,
      lastName: official?.lastName || parent.lastName,
      email: officialEmail && !officialEmail.toLowerCase().endsWith('.local') ? officialEmail : nexusEmail && !nexusEmail.toLowerCase().endsWith('.local') ? nexusEmail : null,
      phone: official?.phone || parent.phone,
    }
  })

  const createdMessages = await prisma.$transaction(async (tx) => {
    const rows = []
    for (const parent of deliveryParents) {
      rows.push(await tx.internalMessage.create({ data: { senderId, recipientId: parent.id, subject: data.subject, body: data.body, attachmentName: req.file?.originalname, attachmentMime: req.file?.mimetype, attachmentSize: req.file?.size, attachmentData: req.file?.buffer }, select: { id: true, recipientId: true } }))
    }
    await tx.notification.createMany({ data: deliveryParents.map((parent) => ({ userId: parent.id, title: data.subject, message: data.body, type: 'MESSAGE' as const, link: messageLink(parent.role) })) })
    return rows
  })
  const messageIdByRecipient = new Map(createdMessages.map((message) => [message.recipientId, message.id]))

  const delivery: Array<Record<string, unknown>> = []
  for (let index = 0; index < deliveryParents.length; index += 10) {
    const batch = deliveryParents.slice(index, index + 10)
    const results = await Promise.all(batch.map(async (parent) => {
      const row: Record<string, unknown> = { userId: parent.id, name: [parent.lastName, parent.middleName, parent.firstName].filter(Boolean).join(' ') }
      const attachmentNote = req.file ? `\n\nDocument joint : ${req.file.originalname}. Disponible aussi dans votre boîte Nexus.` : ''
      if (data.channels.includes('email')) row.email = parent.email ? { sent: true, queued: true, reason: 'QUEUED' } : { sent: false, reason: 'MISSING_OFFICIAL_EMAIL' }
      if (data.channels.includes('sms')) row.sms = await sendSchoolSms(parent.phone, `${data.subject}\n\n${data.body}${attachmentNote}`, { brand: false })
      const internalMessageId = messageIdByRecipient.get(parent.id)
      const deliveryRows = data.channels.map((channel) => {
        const result = row[channel] as { sent: boolean; queued?: boolean; reason?: string }
        const queued = channel === 'email' && Boolean(result.queued)
        return {
          channel: channel === 'email' ? 'EMAIL' as const : 'TEXT' as const,
          status: queued ? 'QUEUED' as const : result.sent ? 'SENT' as const : 'FAILED' as const,
          subject: data.subject,
          body: data.body,
          senderId,
          recipientName: String(row.name),
          recipientEmail: parent.email,
          recipientPhone: parent.phone,
          sentAt: queued ? null : result.sent ? new Date() : null,
          failureReason: queued || result.sent ? null : (result.reason || 'DELIVERY_FAILED'),
          metadata: { internalMessageId, recipientId: parent.id, ...(queued ? { mailQueueVersion: 1, attempts: 0, nextAttemptAt: new Date().toISOString(), priority: deliveryParents.length <= 10 ? 'HIGH' : 'NORMAL' } : {}) },
        }
      })
      await prisma.correspondenceLog.createMany({ data: deliveryRows })
      return row
    }))
    delivery.push(...results)
  }

  for (const parent of deliveryParents.filter((person) => person.role === 'PARENT')) {
    const officialParent = findOfficialContact(directory, parent)
    const mothers = (officialParent?.familyContacts || []).filter((contact) => contact.kind === 'MOTHER' && (contact.email || contact.phone))
    for (const mother of mothers) {
      if (mother.email?.trim().toLowerCase() === parent.email?.trim().toLowerCase() && mother.phone?.trim() === parent.phone?.trim()) continue
      const motherName = [mother.lastName, mother.middleName, mother.firstName].filter(Boolean).join(' ') || 'Mère de l’élève'
      const row: Record<string, unknown> = { userId: parent.id, relationship: 'MOTHER', name: motherName }
      if (data.channels.includes('email')) row.email = mother.email ? { sent: true, queued: true, reason: 'QUEUED' } : { sent: false, reason: 'MISSING_EMAIL' }
      if (data.channels.includes('sms')) row.sms = await sendSchoolSms(mother.phone, `${data.subject}\n\n${data.body}`, { brand: false })
      await prisma.correspondenceLog.createMany({ data: data.channels.map((channel) => {
        const result = row[channel] as { sent: boolean; queued?: boolean; reason?: string }
        const queued = channel === 'email' && Boolean(result.queued)
        return { channel: channel === 'email' ? 'EMAIL' as const : 'TEXT' as const, status: queued ? 'QUEUED' as const : result.sent ? 'SENT' as const : 'FAILED' as const, subject: data.subject, body: data.body, senderId, recipientName: motherName, recipientEmail: mother.email || null, recipientPhone: mother.phone || null, sentAt: queued ? null : result.sent ? new Date() : null, failureReason: queued || result.sent ? null : (result.reason || 'DELIVERY_FAILED'), metadata: { recipientId: parent.id, relationship: 'MOTHER', ...(queued ? { mailQueueVersion: 1, attempts: 0, nextAttemptAt: new Date().toISOString(), priority: deliveryParents.length <= 10 ? 'HIGH' : 'NORMAL' } : {}) } }
      }) })
      delivery.push(row)
    }
  }
  const externalDeliverySucceeded = delivery.some((row) => data.channels.some((channel) => { const result = row[channel] as { sent?: boolean; queued?: boolean } | undefined; return Boolean(result?.sent || result?.queued) }))
  return success(res, { recipients: delivery.length, primaryRecipients: deliveryParents.length, channels: data.channels, delivery, externalDeliverySucceeded }, externalDeliverySucceeded ? 'Parent communication recorded; email delivery is safely queued' : 'Parent communication recorded, but external delivery failed', 201)
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
    select: { id: true, role: true, email: true, firstName: true, middleName: true, lastName: true },
  })
  const now = new Date()
  const emailRecipients = users.filter((user) => Boolean(user.email?.trim()))
  await prisma.$transaction(async (tx) => {
    const messages = await Promise.all(users.map((user) => tx.internalMessage.create({
      data: { senderId, recipientId: user.id, subject: data.subject, body: data.body },
      select: { id: true, recipientId: true },
    })))
    const messageIds = new Map(messages.map((message) => [message.recipientId, message.id]))
    await tx.notification.createMany({ data: users.map((user) => ({ userId: user.id, title: data.subject, message: data.body, type: 'MESSAGE' as const, link: messageLink(user.role) })) })
    if (emailRecipients.length) {
      await tx.correspondenceLog.createMany({
        data: emailRecipients.map((user) => ({
          channel: 'EMAIL' as const,
          status: 'QUEUED' as const,
          subject: data.subject,
          body: data.body,
          senderId,
          recipientName: [user.lastName, user.middleName, user.firstName].filter(Boolean).join(' '),
          recipientEmail: user.email,
          sentAt: null,
          failureReason: null,
          metadata: { internalMessageId: messageIds.get(user.id), recipientId: user.id, mailQueueVersion: 1, attempts: 0, nextAttemptAt: now.toISOString(), audience: data.audience, priority: 'BULK' },
        })),
      })
    }
  })
  return success(res, {
    recipients: users.length,
    audience: data.audience,
    emailQueued: emailRecipients.length,
    emailMissing: users.length - emailRecipients.length,
    estimatedMinutes: Math.ceil(emailRecipients.length * 20 / 60),
  }, 'Communication recorded and email delivery safely queued', 201)
}))

messagesRouter.post('/bulk-delete', asyncHandler(async (req: AuthenticatedRequest, res) => {
  if (!canManageParentCommunications(req)) throw new ApiError(403, 'Super Administrator or Teacher permissions required')
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
