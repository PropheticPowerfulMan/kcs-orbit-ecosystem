import { mailboxDirection } from '../utils/messageMailbox.js'
import {hasDisciplineWorkspaceAccess,DISCIPLINE_WORKSPACE_PERMISSION} from '../utils/staffWorkspace.js'
import {Prisma} from '@prisma/client'
import {familyEmailRecipients} from '../services/familyEmailRecipients.js'
import { queueMessageBatch } from '../services/messageBatch.js'
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
  await prisma.correspondenceLog.updateMany({ where: { id, channel: 'EMAIL', reportCardId:null, status: { in: ['SENT', 'DELIVERED'] } }, data: { status: 'DELIVERED', deliveredAt: new Date() } })
  await prisma.$executeRaw(Prisma.sql`UPDATE "CorrespondenceLog" SET metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('reportCardEmailOpenedAt',coalesce(metadata->>'reportCardEmailOpenedAt',${new Date().toISOString()})) WHERE id=${id} AND channel='EMAIL' AND "reportCardId" IS NOT NULL AND status IN ('SENT','DELIVERED')`)
  res.setHeader('Content-Type', 'image/gif')
  res.setHeader('Content-Length', String(trackingPixel.length))
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  res.status(200).send(trackingPixel)
}))
messagesRouter.use(authenticate)

const messageSchema = z.object({ recipientId: z.string().min(1), subject: z.string().min(2).max(160), body: z.string().min(1).max(10000), language: z.enum(['fr','en']).optional(), deliveryMode: z.enum(['NEXUS_ONLY','NEXUS_EMAIL']).optional(), requestId: z.string().min(8).max(128).optional() })
const jsonArray = (value: unknown) => typeof value === 'string' ? JSON.parse(value) : value
const parentDeliverySchema = z.object({ recipientIds: z.preprocess(jsonArray, z.array(z.string().min(1)).min(1).max(10000)), channels: z.preprocess(jsonArray, z.array(z.enum(['email','sms','nexus'])).min(1)), subject: z.string().min(2).max(160), body: z.string().min(1).max(10000), requestId: z.string().min(8).max(128).optional(), language: z.enum(['fr','en']).optional() })
const attachmentTypes = new Set(['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/plain','text/csv','image/jpeg','image/png','image/webp','audio/mpeg','audio/mp4','audio/ogg','audio/webm','audio/wav','audio/x-wav','video/mp4','video/webm','video/quicktime','video/ogg'])
const attachmentUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 26214400, files: 1 }, fileFilter: (_req, file, cb) => attachmentTypes.has(file.mimetype) ? cb(null, true) : cb(new ApiError(400, 'Unsupported attachment type')) })
const broadcastSchema = z.object({ requestId: z.string().min(8).max(128).optional(), audience: z.enum(['ALL','PARENTS','STUDENTS','TEACHERS','STAFF','GRADE_9_12_FAMILIES']), subject: z.string().min(2).max(160), body: z.string().min(1).max(10000), language: z.enum(['fr','en']).optional() })
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

/** Resolve a teacher's active learners by enrollment or explicit homeroom assignment. */
async function teacherCommunicationScope(userId:string):Promise<Prisma.UserWhereInput>{
 const teacher=await prisma.teacherProfile.findUnique({where:{userId},select:{id:true,status:true,homeroomGrade:true,homeroomSection:true}})
 if(!teacher)return{id:'not-authorized'}
 const learners=await prisma.studentProfile.findMany({where:{status:{equals:'active',mode:'insensitive'},OR:[{enrollments:{some:{course:{teacherId:teacher.id}}}},...(teacher.status==='HOMEROOM_TEACHER'&&teacher.homeroomGrade?[{grade:teacher.homeroomGrade,...(teacher.homeroomSection?{section:teacher.homeroomSection}:{})}]:[])]},select:{id:true,userId:true}})
 return{OR:[{role:{notIn:['STUDENT','PARENT']}},{role:'STUDENT',id:{in:learners.map(s=>s.userId)}},{role:'PARENT',parentLinks:{some:{studentId:{in:learners.map(s=>s.id)}}}}]}
}

type OrbitContact = { additionalEmails?: string[]; id: string; fullName?: string; firstName?: string; middleName?: string | null; lastName?: string; email?: string | null; phone?: string | null; accessCode?: string | null; studentIds?: string[]; parentId?: string | null; className?: string | null; familyContacts?: Array<{ kind?: string; firstName?: string; middleName?: string; lastName?: string; email?: string | null; phone?: string | null }> }
type OrbitDirectory = { parents?: OrbitContact[]; students?: OrbitContact[]; teachers?: OrbitContact[] }
let orbitDirectoryCache: { expiresAt: number; value: OrbitDirectory } | null = null
const identityKey = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).sort().join('|')
const contactName = (person: Partial<OrbitContact>) => [person.lastName, person.middleName, person.firstName].filter(Boolean).join(' ').trim() || String(person.fullName || '').trim()
const getOrbitDirectory = async () => {
  if (orbitDirectoryCache && orbitDirectoryCache.expiresAt > Date.now()) return orbitDirectoryCache.value
  if (!env.KCS_ORBIT_API_URL || !env.KCS_ORBIT_API_KEY || !env.KCS_ORBIT_ORGANIZATION_ID) return {} as OrbitDirectory
  try {
    const response = await fetch(`${env.KCS_ORBIT_API_URL.replace(/\/$/, '')}/api/integration/read/shared-directory?organizationId=${encodeURIComponent(env.KCS_ORBIT_ORGANIZATION_ID)}`, { headers: { 'x-api-key': env.KCS_ORBIT_API_KEY, 'x-app-slug': 'KCS_NEXUS' }, signal: AbortSignal.timeout(3_000) })
    if (!response.ok) throw new Error(`status ${response.status}`)
    const value = await response.json() as OrbitDirectory
    orbitDirectoryCache = { expiresAt: Date.now() + 15 * 60_000, value }
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
  const requestedLimit = Number(req.query.limit ?? 250)
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.trunc(requestedLimit), 20), 250) : 100
  const cursor = String(req.query.cursor ?? '').trim()
  const from = String(req.query.from ?? '').trim()
  const to = String(req.query.to ?? '').trim()
  const userId = await resolveMessageActorId(req)
  const targetRole = req.user!.role.toUpperCase() as 'ADMIN' | 'STAFF' | 'TEACHER' | 'STUDENT' | 'PARENT'
  const direction = mailboxDirection(userId, targetRole, box)
  const queryTokens = query.split(/\s+/).filter(Boolean)
  const search = queryTokens.length ? {
    AND: queryTokens.map((token) => {
      const identitySearch = {
        OR: [
          { firstName: { contains: token, mode: 'insensitive' as const } },
          { middleName: { contains: token, mode: 'insensitive' as const } },
          { lastName: { contains: token, mode: 'insensitive' as const } },
          { email: { contains: token, mode: 'insensitive' as const } },
          { phone: { contains: token, mode: 'insensitive' as const } },
        ],
      }
      return { OR: [
        { subject: { contains: token, mode: 'insensitive' as const } },
        { body: { contains: token, mode: 'insensitive' as const } },
        { sender: { is: identitySearch } },
        { recipient: { is: identitySearch } },
      ] }
    }),
  } : {}
  const createdAt = {
    ...(from && !Number.isNaN(Date.parse(from)) ? { gte: new Date(from + (from.length <= 10 ? 'T00:00:00.000Z' : '')) } : {}),
    ...(to && !Number.isNaN(Date.parse(to)) ? { lte: new Date(to + (to.length <= 10 ? 'T23:59:59.999Z' : '')) } : {}),
  }
  const where = { AND: [direction, search, Object.keys(createdAt).length ? { createdAt } : {}] }
  const [page, total] = await Promise.all([
    prisma.internalMessage.findMany({
      where,
      select: { id: true, senderId: true, recipientId: true, subject: true, body: true, attachmentName: true, attachmentMime: true, attachmentSize: true, targetRole: true, readAt: true, priority: true, channel: true, createdAt: true, sender: { select: { id: true, firstName: true, middleName: true, lastName: true, role: true, email: true, phone: true } }, recipient: { select: { id: true, firstName: true, middleName: true, lastName: true, role: true, email: true, phone: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    }),
    prisma.internalMessage.count({ where }),
  ])
  const hasMore = page.length > limit
  const messages = page.slice(0, limit)
  const nextCursor = hasMore ? messages.at(-1)?.id || '' : ''
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
  res.setHeader('X-Total-Count', String(total))
  res.setHeader('X-Has-More', hasMore ? 'true' : 'false')
  if (nextCursor) res.setHeader('X-Next-Cursor', nextCursor)
  res.setHeader('Cache-Control', 'private, no-store')
  return success(res, messages.map((message) => ({ ...message, hasAttachment: Boolean(message.attachmentName), deliveries: deliveryByMessage.get(message.id) || [] })))
}))

messagesRouter.get('/contacts', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const allowedRoles = req.user!.role === 'parent' || req.user!.role === 'student' ? ['ADMIN', 'STAFF', 'TEACHER'] as const : undefined
  const actorId = await resolveMessageActorId(req)
  const contacts = await prisma.user.findMany({ where: { accountBlockedAt: null, id: { not: actorId }, ...(allowedRoles ? { OR:[{role:{in:[...allowedRoles]}},{AND:[{permissions:{has:DISCIPLINE_WORKSPACE_PERMISSION}},{NOT:{permissions:{has:'nexus:media-only'}}}]}] } : {}) }, select: { id: true, firstName: true, middleName: true, lastName: true, role: true, accessCode: true, email: true, staffProfile: { select: { function: true, department: true } }, teacherProfile: { select: { department: true, courses: { select: { grade: true } } } }, studentProfile: { select: { grade: true, section: true } }, parentLinks: { select: { student: { select: { grade: true, section: true } } } } }, orderBy: [{ role: 'asc' }, { lastName: 'asc' }, { firstName: 'asc' }] })
  return success(res, contacts.map(({ email, studentProfile, parentLinks, teacherProfile, ...contact }) => ({ ...contact, teacherProfile:teacherProfile?{department:teacherProfile.department}:null, emailAvailable: Boolean(email && !/@(?:[^@]+\.)?invalid$/i.test(email)), ...(!['student','parent'].includes(req.user!.role)?{classes:[...new Set([...(studentProfile?[[studentProfile.grade,studentProfile.section].filter(Boolean).join(' ')]:[]),...parentLinks.map(l=>[l.student.grade,l.student.section].filter(Boolean).join(' ')),...(teacherProfile?.courses.map(c=>c.grade)||[])])]}:{}) })))
}))

messagesRouter.get('/parent-contacts', asyncHandler(async (req: AuthenticatedRequest, res) => {
  if (!canManageParentCommunications(req)) throw new ApiError(403, 'Super Administrator or Teacher permissions required')
  const actorId = await resolveMessageActorId(req)
  const superAdmin = req.user!.sub === 'configured-superadmin'
  const teacherScope=superAdmin?{}:await teacherCommunicationScope(actorId)
  const [recipients, directory] = await Promise.all([
    prisma.user.findMany({
    where: { accountBlockedAt: null, id: { not: actorId },...teacherScope },
    select: {
      id: true, firstName: true, middleName: true, lastName: true, email: true, phone: true, accessCode: true, role: true,
      studentProfile: { select: { grade: true, section: true } },
      parentLinks: { select: { student: { select: { id: true, grade: true, section: true, studentNumber: true, user: { select: { firstName: true, middleName: true, lastName: true } } } } } },
      teacherProfile: { select: { employeeNumber: true, department: true, courses: { select: { grade: true } } } },
      staffProfile: { select: { employeeNumber: true, department: true, function: true } },
    },
    orderBy: [{ role: 'asc' }, { lastName: 'asc' }, { firstName: 'asc' }],
    }),
    superAdmin ? getOrbitDirectory() : Promise.resolve({} as OrbitDirectory),
  ])
  const orbitStudentsById = new Map((directory.students || []).map((student) => [student.id, student]))
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
    if (!official) return [{ ...person, orbitStudentIds: [] as string[] }]
    return [{ ...person, firstName: official.firstName || person.firstName, middleName: official.middleName || null, lastName: official.lastName || person.lastName, email: official.email || person.email, phone: official.phone || person.phone, accessCode: official.accessCode || person.accessCode, orbitStudentIds: official.studentIds || [] }]
  })
  return success(res, canonicalRecipients.map((person) => {
    const gradeValues = [
      person.studentProfile?.grade,
      ...person.orbitStudentIds.map((studentId) => orbitStudentsById.get(studentId)?.className),
      ...person.parentLinks.map((link) => link.student.grade),
      ...(person.teacherProfile?.courses.map((course) => course.grade) ?? []),
    ].filter((value): value is string => Boolean(value))
    const sectionValues = [
      person.studentProfile ? [person.studentProfile.grade, person.studentProfile.section].filter(Boolean).join(' ') : null,
      ...person.parentLinks.map((link) => [link.student.grade, link.student.section].filter(Boolean).join(' ')),
    ].filter((value): value is string => Boolean(value))
    const nexusStudents = person.parentLinks.map((link) => ({ id: link.student.id, name: [link.student.user.lastName, link.student.user.middleName, link.student.user.firstName].filter(Boolean).join(' '), studentNumber: link.student.studentNumber, className: [link.student.grade, link.student.section].filter(Boolean).join(' ') }))
    const orbitStudents = person.orbitStudentIds.map((studentId) => orbitStudentsById.get(studentId)).filter(Boolean).map((student: any) => ({ id: student.id, name: [student.lastName, student.middleName, student.firstName].filter(Boolean).join(' '), studentNumber: student.accessCode || student.studentNumber || null, className: student.className || null }))
    const relatedStudents = [...new Map([...nexusStudents, ...orbitStudents].map((student) => [student.id || student.studentNumber || student.name, student])).values()]
    return {
      id: person.id, firstName: person.firstName, middleName: person.middleName, lastName: person.lastName,
      email: person.email, phone: person.phone, accessCode: person.accessCode, role: person.role, relatedStudents,
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
  const externalChannels=data.channels.filter((channel):channel is 'email'|'sms'=>channel!=='nexus')
  const nexusOnly=externalChannels.length===0
  const teacherScope=req.user!.sub==='configured-superadmin'?{}:await teacherCommunicationScope(senderId)
  const [parents, directory] = await Promise.all([
    prisma.user.findMany({
      where: { accountBlockedAt: null, id: { in: recipientIds }, ...teacherScope },
      select: { id: true, firstName: true, middleName: true, lastName: true, email: true, phone: true, role: true },
    }),
    nexusOnly?Promise.resolve({} as OrbitDirectory):getOrbitDirectory(),
  ])
  const skippedRecipientIds = recipientIds.filter((id) => !parents.some((parent) => parent.id === id))
  if (!parents.length) throw new ApiError(400, 'Aucun destinataire sélectionné n’est autorisé. Choisissez un élève inscrit à vos cours ou une famille liée. / No selected recipient is authorized. Choose an enrolled learner or linked family.')
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

  // Resolve families by their verified Nexus/Orbit linkage, never by name alone.
  // The shared resolver includes the primary, additional and family-contact emails.
  const families:Awaited<ReturnType<typeof familyEmailRecipients>> = nexusOnly?new Map():await familyEmailRecipients(parents.filter(parent => parent.role === 'PARENT'))
  const allTargets = nexusOnly?deliveryParents.map(person=>({userId:person.id,name:[person.lastName,person.middleName,person.firstName].filter(Boolean).join(' '),email:null,phone:null,relationship:'NEXUS_ACCOUNT'})):deliveryParents.flatMap(parent => parent.role === 'PARENT'
    ? (families.get(parent.id) ?? []).map(target => ({ userId: parent.id, name: target.name, email: target.email, phone: target.phone, relationship: target.relationship }))
    : [{ userId: parent.id, name: [parent.lastName, parent.middleName, parent.firstName].filter(Boolean).join(' '), email: parent.email, phone: parent.phone, relationship: 'PRIMARY' }])
  // Retain phone-only family contacts for SMS; email fan-out is validated above.
  for (const parent of (nexusOnly?[]:deliveryParents.filter(person => person.role === 'PARENT'))) {
    const official = findOfficialContact(directory, parent)
    if (parent.phone) allTargets.push({ userId: parent.id, name: contactName(parent), email: null, phone: parent.phone, relationship: 'PARENT' })
    for (const contact of official?.familyContacts ?? []) if (contact.phone) allTargets.push({ userId: parent.id, name: contactName(contact) || contactName(parent), email: null, phone: contact.phone, relationship: contact.kind || 'FAMILY_CONTACT' })
  }
  const result = await queueMessageBatch({ senderId, subject: data.subject, body: data.body, recipients: deliveryParents.map((parent) => ({ id: parent.id, role: parent.role, name: [parent.lastName, parent.middleName, parent.firstName].filter(Boolean).join(' ') })), targets: allTargets, channels: externalChannels, attachment: req.file, requestId: data.requestId, language: data.language, personalizeParents: false, intent: { recipientIds: [...recipientIds].sort() } })
  return success(res, { ...result, channels:data.channels, delivery:result.delivery.map(row=>({...row,...(data.channels.includes('nexus')?{nexus:{sent:true,reason:'NEXUS_INBOX_STORED'}}:{})})), requestedRecipients: recipientIds.length, skippedRecipients: skippedRecipientIds.length }, nexusOnly?'Message enregistré dans les comptes Nexus des destinataires ; aucun e-mail ni SMS envoyé. / Message stored in recipient Nexus accounts; no email or SMS sent.':'Communication recorded for every valid recipient; selected external delivery safely queued', 201)
}))

messagesRouter.post('/', attachmentUpload.single('attachment'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const data = messageSchema.parse(req.body)
  const senderId = await resolveMessageActorId(req)
  const recipient = await prisma.user.findUnique({ where: { id: data.recipientId }, select: { id: true, role: true, permissions: true, email: true, phone: true, firstName: true, middleName: true, lastName: true, accountBlockedAt: true } })
  if (!recipient || recipient.accountBlockedAt) throw new ApiError(404, 'Active recipient not found')
  if ((req.user!.role === 'parent' || req.user!.role === 'student') && !['ADMIN', 'STAFF', 'TEACHER'].includes(recipient.role)&&!hasDisciplineWorkspaceAccess(recipient)) {
    throw new ApiError(403, 'Parents and students may only contact authorized school staff.')
  }
  const { language = 'fr', deliveryMode, requestId, ...messageData } = data
  // A learner chooses external delivery explicitly; the durable outbox remains
  // separate from the private Nexus message and never expands to family contacts.
  if (req.user!.role === 'student') {
    const email = recipient.email?.trim() || ''
    if (deliveryMode === 'NEXUS_EMAIL' && (!email || /@(?:[^@]+\.)?invalid$/i.test(email)))
      throw new ApiError(409, language === 'fr' ? 'Ce contact ne possède pas d’adresse e-mail scolaire disponible. Choisissez Nexus uniquement.' : 'This contact has no available school email address. Choose Nexus only.')
    const result = await queueMessageBatch({ senderId, subject: data.subject, body: data.body,
      recipients: [{ id: recipient.id, role: recipient.role, name: contactName(recipient) }],
      targets: deliveryMode === 'NEXUS_EMAIL' ? [{ userId: recipient.id, name: contactName(recipient), email, phone: null }] : [],
      channels: deliveryMode === 'NEXUS_EMAIL' ? ['email'] : [], attachment: req.file, requestId, language,
      intent: { recipientIds: [recipient.id], deliveryMode: deliveryMode || 'NEXUS_ONLY' } })
    const messageIdLog = result.batchId
    const log = await prisma.auditLog.findUnique({where:{id:messageIdLog},select:{metadata:true}})
    // The batch is idempotent. Its message id is stored with the result, including
    // Nexus-only batches which do not have a correspondence row.
    const metadata = log?.metadata as Record<string,any>|null
    const storedId = metadata?.messageIds?.[recipient.id]
    const created = storedId ? await prisma.internalMessage.findUnique({where:{id:storedId},select:{id:true,senderId:true,recipientId:true,subject:true,body:true,createdAt:true,readAt:true,attachmentName:true,attachmentMime:true,attachmentSize:true,sender:{select:{id:true,firstName:true,middleName:true,lastName:true,role:true}},recipient:{select:{id:true,firstName:true,middleName:true,lastName:true,role:true}}}}) : null
    if(!created) throw new ApiError(500,'The saved message could not be loaded. Retry the same request.')
    return success(res,{...created,hasAttachment:Boolean(created.attachmentName),emailQueued:result.emailQueued,deliveryMode:deliveryMode||'NEXUS_ONLY'},language==='fr'?(result.emailQueued?'Message Nexus enregistré ; e-mail mis en file d’envoi.':'Message enregistré dans Nexus uniquement. Aucun e-mail envoyé.'):(result.emailQueued?'Nexus message saved; email queued for delivery.':'Message saved in Nexus only. No email sent.'),201)
  }
  const emailBody = data.body
  const familyTargets = req.user!.sub === 'configured-superadmin' && recipient.role === 'PARENT'
    ? (await familyEmailRecipients([recipient])).get(recipient.id) ?? []
    : null
  if (familyTargets && !familyTargets.length) throw new ApiError(409, 'No valid registered family email. Update the parent contacts before sending.')
  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.internalMessage.create({ data: { ...messageData, body: emailBody, senderId, attachmentName: req.file?.originalname, attachmentMime: req.file?.mimetype, attachmentSize: req.file?.size, attachmentData: req.file?.buffer }, include: { sender: true, recipient: true } })
    await tx.notification.create({ data: { userId: data.recipientId, title: data.subject, message: data.body, type: 'MESSAGE', link: messageLink(recipient.role) } })
    if (familyTargets) await tx.correspondenceLog.createMany({ data: familyTargets.map(target => ({
      channel: 'EMAIL', status: 'QUEUED', subject: data.subject, body: emailBody,
      senderId, recipientName: target.name, recipientEmail: target.email, recipientPhone: target.phone,
      metadata: { mailQueueVersion: 1, internalMessageId: created.id, recipientId: recipient.id,
        relationship: target.relationship, attempts: 0, nextAttemptAt: new Date().toISOString(), priority: 'HIGH', language },
    })) })
    return created
  })
  const delivery = req.user!.sub === 'configured-superadmin'
    ? await Promise.all([
        familyTargets ? Promise.resolve({ sent: false, queued: true, recipients: familyTargets.length, reason: 'QUEUED' }) : sendSchoolMail({ to: recipient.email, replyTo: env.SCHOOL_EMAIL, subject: data.subject, text: emailBody, language, attachments: req.file ? [{ filename: req.file.originalname, content: req.file.buffer, contentType: req.file.mimetype }] : undefined, branded: true }).catch(() => ({ sent: false as const, reason: 'SMTP_SEND_FAILED' as const })),
        sendSchoolSms(recipient.phone, `${data.subject}\n\n${data.body}`, { brand: false }).catch(() => ({ sent: false as const, reason: 'SMS_SEND_FAILED' as const })),
      ])
    : []
  const { attachmentData: _attachmentData, ...safeMessage } = message
  return success(res, { ...safeMessage, hasAttachment: Boolean(message.attachmentName), delivery, ...(familyTargets ? { emailQueued: familyTargets.length } : {}) }, familyTargets ? 'Message recorded; all registered family emails safely queued' : 'Message sent', 201)
}))

messagesRouter.post('/broadcast', attachmentUpload.single('attachment'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  if (req.user!.sub !== 'configured-superadmin') throw new ApiError(403, 'Super Administrator permissions required')
  const data = broadcastSchema.parse(req.body)
  const senderId = await resolveMessageActorId(req)
  const roleMap = { PARENTS: ['PARENT'], STUDENTS: ['STUDENT'], TEACHERS: ['TEACHER'], STAFF: ['ADMIN','STAFF','TEACHER'], ALL: ['ADMIN','STAFF','TEACHER','STUDENT','PARENT'] } as const
  const users = await prisma.user.findMany({
    where: data.audience === 'GRADE_9_12_FAMILIES'
      ? { accountBlockedAt: null, role: 'PARENT', parentLinks: { some: { student: { grade: { in: ['Grade 9','Grade 10','Grade 11','Grade 12'] } } } } }
      : { accountBlockedAt: null, role: { in: [...roleMap[data.audience as keyof typeof roleMap]] }, id: { not: senderId } },
    select: { id: true, role: true, email: true, phone: true, firstName: true, middleName: true, lastName: true },
  })
  if (!users.length) return success(res, { recipients: 0, audience: data.audience, emailQueued: 0, emailMissing: 0 }, 'No matching recipients')
  const recipients = users.map((user) => ({ id: user.id, role: user.role, name: [user.lastName, user.middleName, user.firstName].filter(Boolean).join(' ') }))
  const families=await familyEmailRecipients(users.filter(user=>user.role==='PARENT'),undefined,true)
  const emailTargets=users.flatMap((user,index)=>user.role==='PARENT'?(families.get(user.id)??[]).map(target=>({userId:user.id,name:target.name,email:target.email,phone:target.phone})): [{userId:user.id,name:recipients[index].name,email:user.email,phone:user.phone}])
  const result = await queueMessageBatch({ senderId, subject: data.subject, body: data.body, recipients, targets:emailTargets, channels: ['email'], attachment: req.file, requestId: data.requestId, language: data.language, personalizeParents: false, intent: { audience: data.audience } })
  return success(res, { ...result, recipients: users.length, audience: data.audience, emailMissing: users.filter(user=>user.role==='PARENT'?!(families.get(user.id)?.length):!user.email).length, estimatedMinutes: Math.ceil(result.emailQueued / 60) }, 'Communication recorded for every recipient and email delivery safely queued', 201)
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
  await prisma.internalMessage.updateMany({
    where: { id: { in: ownedIds }, senderId: actorId },
    data: { senderArchivedAt: new Date() },
  })
  return success(res, { deletedCount: ownedIds.length, archived: true }, 'Messages hidden from the active mailbox and retained in the immutable communication history')
}))

messagesRouter.patch('/:id/read', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const id = getRouteParam(req.params.id)
  const actorId = await resolveMessageActorId(req)
  const existing = await prisma.internalMessage.findFirst({ where: { id, recipientId: actorId } })
  if (!existing) throw new ApiError(404, 'Message not found')
  const message = await prisma.internalMessage.update({ where: { id }, data: { readAt: existing.readAt ?? new Date() }, include: { sender: true, recipient: true } })
  const { attachmentData: _attachmentData, ...safeMessage } = message
  return success(res, { ...safeMessage, hasAttachment: Boolean(message.attachmentName) })
}))
messagesRouter.get('/:id/attachment', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const actorId = await resolveMessageActorId(req)
  const message = await prisma.internalMessage.findUnique({ where: { id: getRouteParam(req.params.id) }, include: { sharedAttachment: true } })
  if (!message) throw new ApiError(404, 'Message not found')
  if (message.senderId !== actorId && message.recipientId !== actorId) throw new ApiError(403, 'Access denied')
  const attachmentData = message.attachmentData ?? message.sharedAttachment?.data
  if (!attachmentData || !message.attachmentName || !message.attachmentMime) throw new ApiError(404, 'No attachment')
  const disposition = message.attachmentMime.startsWith("audio/") || message.attachmentMime.startsWith("video/") || message.attachmentMime.startsWith("image/") ? "inline" : "attachment"
  res.type(message.attachmentMime).set("Content-Disposition", disposition + "; filename*=UTF-8''" + encodeURIComponent(message.attachmentName)).set("Content-Length", String(message.attachmentSize || attachmentData.length)).set("Cache-Control", "private, max-age=300").set("X-Content-Type-Options", "nosniff")
  return res.send(Buffer.from(attachmentData))
}))
