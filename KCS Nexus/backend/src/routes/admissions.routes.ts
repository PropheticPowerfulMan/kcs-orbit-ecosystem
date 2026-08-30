import { Router } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { prisma } from '../config/prisma.js'
import { authenticate, requireRoles } from '../middleware/auth.js'
import { ApiError, asyncHandler, success } from '../utils/api.js'
import { sendSchoolMail } from '../utils/mail.js'
import { getRouteParam } from '../utils/request.js'

const OFFICIAL_SCHOOL_EMAIL = 'kinshasachristianschool@gmail.com'
const PHOTO_FIELDS = new Set(['parentPhoto'])
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 25 } })

const childSchema = z.object({
  firstName: z.string().min(2),
  middleName: z.string().optional().default(''),
  lastName: z.string().min(2),
  dateOfBirth: z.coerce.date(),
  gender: z.string().default('Not specified'),
  nationality: z.string().min(2),
  gradeApplying: z.string().min(1),
  previousSchool: z.string().optional().default(''),
  languages: z.string().optional().default(''),
})

const admissionSchema = z.object({
  firstName: z.string().min(2),
  middleName: z.string().optional(),
  lastName: z.string().min(2),
  dateOfBirth: z.coerce.date(),
  gender: z.string().default('Not specified'),
  nationality: z.string().min(2),
  gradeApplying: z.string().min(1),
  previousSchool: z.string().optional(),
  languages: z.string().optional(),
  parentFirstName: z.string().optional(),
  parentMiddleName: z.string().optional(),
  parentLastName: z.string().optional(),
  parentName: z.string().min(2),
  parentEmail: z.string().email(),
  parentPhone: z.string().min(6),
  relationship: z.string().min(2),
  address: z.string().min(5),
  occupation: z.string().optional(),
  notes: z.string().optional(),
  children: z.string().optional(),
})

type ChildPayload = z.infer<typeof childSchema>
type AdmissionPayload = z.infer<typeof admissionSchema>
type ParentDetails = { firstName: string; middleName?: string; lastName: string; occupation?: string }

const escapeHtml = (value?: unknown) => String(value ?? 'Not provided').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')
const dataUrl = (file?: Express.Multer.File) => file ? `data:${file.mimetype};base64,${file.buffer.toString('base64')}` : undefined
const isStudentPhoto = (field: string) => /^studentPhoto_\d+$/.test(field)
const studentPhotoIndex = (field: string) => Number(field.replace('studentPhoto_', ''))

function parseChildren(payload: AdmissionPayload) {
  if (!payload.children) return [childSchema.parse(payload)]
  const parsed = JSON.parse(payload.children) as unknown
  return z.array(childSchema).min(1).max(12).parse(parsed)
}

function parentDetails(payload: AdmissionPayload): ParentDetails {
  if (payload.parentFirstName?.trim() && payload.parentLastName?.trim()) {
    return { firstName: payload.parentFirstName.trim(), middleName: payload.parentMiddleName?.trim() || undefined, lastName: payload.parentLastName.trim(), occupation: payload.occupation }
  }
  const parts = payload.parentName.trim().split(/\s+/)
  return { firstName: parts[0] || 'Parent', lastName: parts.slice(1).join(' ') || 'KCS', occupation: payload.occupation }
}

function buildAdmissionEmail(applicationNumber: string, children: ChildPayload[], payload: AdmissionPayload, documents: Express.Multer.File[]) {
  const childText = children.map((child, index) => [
    `CHILD ${index + 1}`,
    `Name: ${[child.lastName, child.middleName, child.firstName].filter(Boolean).join(' ')}`,
    `Date of birth: ${child.dateOfBirth.toISOString().slice(0, 10)}`,
    `Gender: ${child.gender}`,
    `Nationality: ${child.nationality}`,
    `Grade applying: ${child.gradeApplying}`,
    `Previous school: ${child.previousSchool || 'Not provided'}`,
  ].join('\n')).join('\n\n')
  const text = [
    `New KCS family admission: ${applicationNumber}`, '', childText, '',
    'PARENT / GUARDIAN',
    `Name: ${payload.parentName}`, `Relationship: ${payload.relationship}`,
    `Email: ${payload.parentEmail}`, `Phone: ${payload.parentPhone}`,
    `Address: ${payload.address}`, '', 'NOTES', payload.notes || 'Not provided', '',
    'FILES', ...(documents.length ? documents.map(file => `- ${file.originalname}`) : ['- No supporting files']),
  ].join('\n')
  const childrenHtml = children.map((child, index) => `<section style="margin:14px 0;padding:14px;border:1px solid #d9e2ef;border-radius:8px"><h3 style="color:#0b3b73">Child ${index + 1}</h3><p><b>Name:</b> ${escapeHtml([child.lastName, child.middleName, child.firstName].filter(Boolean).join(' '))}</p><p><b>Date of birth:</b> ${escapeHtml(child.dateOfBirth.toISOString().slice(0,10))}</p><p><b>Grade:</b> ${escapeHtml(child.gradeApplying)}</p><p><b>Previous school:</b> ${escapeHtml(child.previousSchool)}</p></section>`).join('')
  const html = `<div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5"><h1 style="color:#0b3b73">New KCS Family Admission</h1><p>Application <strong>${escapeHtml(applicationNumber)}</strong> - ${children.length} child(ren)</p>${childrenHtml}<h2 style="color:#0b3b73">Parent / Guardian</h2><p><b>Name:</b> ${escapeHtml(payload.parentName)}</p><p><b>Email:</b> ${escapeHtml(payload.parentEmail)}</p><p><b>Phone:</b> ${escapeHtml(payload.parentPhone)}</p><p><b>Address:</b> ${escapeHtml(payload.address)}</p></div>`
  return { text, html }
}

const includeApplication = { documents: true } as const
export const admissionsRouter = Router()

admissionsRouter.get('/', authenticate, requireRoles('admin'), asyncHandler(async (_req, res) => {
  return success(res, await prisma.admissionApplication.findMany({ include: includeApplication, orderBy: { submittedAt: 'desc' } }))
}))

admissionsRouter.get('/track/:number', asyncHandler(async (req, res) => {
  const application = await prisma.admissionApplication.findUnique({ where: { applicationNumber: getRouteParam(req.params.number) }, include: includeApplication })
  if (!application) throw new ApiError(404, 'Application not found')
  return success(res, application)
}))

admissionsRouter.get('/:id', authenticate, requireRoles('admin'), asyncHandler(async (req, res) => {
  const application = await prisma.admissionApplication.findUnique({ where: { id: getRouteParam(req.params.id) }, include: includeApplication })
  if (!application) throw new ApiError(404, 'Application not found')
  return success(res, application)
}))

admissionsRouter.post('/', upload.any(), asyncHandler(async (req, res) => {
  const payload = admissionSchema.parse(req.body)
  const files = (req.files ?? []) as Express.Multer.File[]
  const children = parseChildren(payload)
  const parent = parentDetails(payload)
  const applicationNumber = `KCS-${Date.now().toString().slice(-6)}`
  const parentPhoto = files.find(file => file.fieldname === 'parentPhoto')
  const childrenWithPhotos = children.map((child, index) => {
    const photo = files.find(file => isStudentPhoto(file.fieldname) && studentPhotoIndex(file.fieldname) === index)
    return { ...child, dateOfBirth: child.dateOfBirth.toISOString(), photoData: dataUrl(photo) }
  })
  const documents = files.filter(file => !PHOTO_FIELDS.has(file.fieldname) && !isStudentPhoto(file.fieldname))
  for (const photo of files.filter(file => PHOTO_FIELDS.has(file.fieldname) || isStudentPhoto(file.fieldname))) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(photo.mimetype)) throw new ApiError(400, 'Photos must be JPG, PNG, or WEBP')
  }
  const first = children[0]
  const application = await prisma.admissionApplication.create({
    data: {
      applicationNumber,
      firstName: first.firstName, middleName: first.middleName || null, lastName: first.lastName,
      dateOfBirth: first.dateOfBirth, gender: first.gender, nationality: first.nationality,
      gradeApplying: first.gradeApplying, previousSchool: first.previousSchool || null,
      parentName: payload.parentName, parentEmail: payload.parentEmail, parentPhone: payload.parentPhone,
      relationship: payload.relationship, address: payload.address,
      notes: [payload.notes, payload.languages ? `Languages: ${payload.languages}` : null, payload.occupation ? `Parent occupation: ${payload.occupation}` : null].filter(Boolean).join('\n\n') || undefined,
      children: childrenWithPhotos,
      parentDetails: parent,
      parentPhotoData: dataUrl(parentPhoto),
      documents: { create: documents.map(file => ({ name: file.originalname, type: file.mimetype, url: `email-attachment://${applicationNumber}/${file.originalname}` })) },
    },
    include: includeApplication,
  })
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } })
  await prisma.notification.createMany({ data: admins.map(admin => ({ userId: admin.id, title: 'Nouvelle candidature familiale', message: `${payload.parentName} - ${children.length} enfant(s) - ${applicationNumber}`, type: 'INFO' as const, link: '/admin/admissions' })) }).catch(error => console.error('[admissions] admin notification failed', error))
  const mail = buildAdmissionEmail(applicationNumber, children, payload, files)
  const emailDelivery = await sendSchoolMail({
    to: OFFICIAL_SCHOOL_EMAIL, replyTo: payload.parentEmail,
    subject: `New KCS family admission - ${applicationNumber} - ${children.length} child(ren)`,
    text: mail.text, html: mail.html,
    attachments: files.map(file => ({ filename: file.originalname, content: file.buffer, contentType: file.mimetype })),
  }).catch(() => ({ sent: false as const, reason: 'SMTP_SEND_FAILED' as const }))
  return success(res, { ...application, childCount: children.length, emailDelivery, schoolEmail: OFFICIAL_SCHOOL_EMAIL }, emailDelivery.sent ? 'Family application submitted and emailed' : 'Family application submitted; email delivery needs attention', 201)
}))

admissionsRouter.post('/:id/approve', authenticate, requireRoles('admin'), asyncHandler(async (req, res) => {
  const id = getRouteParam(req.params.id)
  const application = await prisma.admissionApplication.findUnique({ where: { id } })
  if (!application) throw new ApiError(404, 'Application not found')
  if (application.provisionedAt) throw new ApiError(409, 'This family application has already been provisioned')
  if (!['SUBMITTED', 'UNDER_REVIEW', 'INTERVIEW_SCHEDULED', 'ACCEPTED'].includes(application.status)) throw new ApiError(409, 'This application cannot be approved from its current status')
  const storedChildren = Array.isArray(application.children) ? application.children : []
  const children = storedChildren.length ? storedChildren : [{
    firstName: application.firstName, middleName: application.middleName || '', lastName: application.lastName,
    dateOfBirth: application.dateOfBirth.toISOString(), gender: application.gender, nationality: application.nationality,
    gradeApplying: application.gradeApplying, previousSchool: application.previousSchool || '',
  }]
  const storedParent = application.parentDetails && typeof application.parentDetails === 'object' && !Array.isArray(application.parentDetails) ? application.parentDetails as Record<string, unknown> : {}
  const parentNameParts = application.parentName.trim().split(/\s+/)
  const familyPayload = {
    parent: {
      firstName: String(storedParent.firstName || parentNameParts[0] || 'Parent'),
      middleName: String(storedParent.middleName || ''),
      lastName: String(storedParent.lastName || parentNameParts.slice(1).join(' ') || 'KCS'),
      email: application.parentEmail, phone: application.parentPhone,
      relationship: application.relationship, physicalAddress: application.address,
      photoData: application.parentPhotoData || undefined,
    },
    students: children.map((child: any) => ({
      firstName: String(child.firstName), middleName: String(child.middleName || ''), lastName: String(child.lastName),
      grade: String(child.gradeApplying), section: '', dateOfBirth: String(child.dateOfBirth),
      photoData: child.photoData || undefined,
    })),
  }
  const provision = await fetch(`http://127.0.0.1:${process.env.PORT || 5000}/api/students`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: String(req.headers.authorization || '') },
    body: JSON.stringify(familyPayload),
    signal: AbortSignal.timeout(120_000),
  })
  const result = await provision.json().catch(() => ({})) as any
  if (!provision.ok) throw new ApiError(provision.status, result?.message || 'Family provisioning failed')
  const data = result?.data || result
  const updated = await prisma.admissionApplication.update({
    where: { id },
    data: { status: 'ACCEPTED', provisionedAt: new Date(), provisionedParentId: String(data?.parent?.id || '') || null },
    include: includeApplication,
  })
  return success(res, { application: updated, family: { parent: data.parent, students: data.students, studentCount: data.studentCount }, temporaryCredentials: data.temporaryCredentials, credentialDelivery: data.credentialDelivery }, 'Family approved and provisioned')
}))

admissionsRouter.patch('/:id/status', authenticate, requireRoles('admin'), asyncHandler(async (req, res) => {
  const id = getRouteParam(req.params.id)
  const payload = z.object({ status: z.enum(['DRAFT','SUBMITTED','UNDER_REVIEW','INTERVIEW_SCHEDULED','WAITLISTED','REJECTED']), notes: z.string().optional() }).parse({ status: String(req.body.status || '').toUpperCase(), notes: req.body.notes })
  return success(res, await prisma.admissionApplication.update({ where: { id }, data: { status: payload.status, notes: payload.notes } }), 'Application status updated')
}))

admissionsRouter.post('/:id/documents', authenticate, requireRoles('admin'), upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'No file uploaded')
  const document = await prisma.admissionDocument.create({ data: { applicationId: getRouteParam(req.params.id), name: req.file.originalname, type: req.file.mimetype, url: `uploads/admissions/${req.file.originalname}` } })
  return success(res, document, 'Document uploaded', 201)
}))
