import { Router } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { prisma } from '../config/prisma.js'
import { authenticate, requireRoles, requireSuperAdmin, type AuthenticatedRequest } from '../middleware/auth.js'
import { ApiError, asyncHandler, success } from '../utils/api.js'
import { sendSchoolMail } from '../utils/mail.js'
import { getRouteParam } from '../utils/request.js'
import { admissionCertificatePdf } from '../utils/admissionCertificatePdf.js'

const OFFICIAL_SCHOOL_EMAIL = 'kinshasachristianschool@gmail.com'
const MAX_CHILDREN = 12
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 25 } })

const childSchema = z.object({
  firstName: z.string().trim().min(2), middleName: z.string().trim().optional(), lastName: z.string().trim().min(2),
  dateOfBirth: z.coerce.date(), gender: z.string().default('Not specified'), nationality: z.string().trim().min(2),
  gradeApplying: z.string().trim().min(1), section: z.string().trim().max(40).optional(), previousSchool: z.string().trim().optional(), languages: z.string().trim().optional(),
})
const familyContactSchema = z.object({
  kind: z.enum(['MOTHER', 'FATHER', 'GUARDIAN', 'RELATIVE', 'HOUSEHOLD_AGENT', 'OTHER']).default('OTHER'),
  relationshipLabel: z.string().trim().max(100).optional(),
  firstName: z.string().trim().max(100).default(''),
  middleName: z.string().trim().max(100).optional(),
  lastName: z.string().trim().max(100).default(''),
  email: z.string().trim().email().optional().or(z.literal('')),
  phone: z.string().trim().max(40).optional(),
  physicalAddress: z.string().trim().max(500).optional(),
  authorizedPickup: z.boolean().default(false),
  emergencyContact: z.boolean().default(false),
}).refine((contact) => !contact.firstName && !contact.lastName && !contact.email && !contact.phone ? true : Boolean(contact.firstName && contact.lastName && (contact.email || contact.phone)), {
  message: 'Each complementary family contact requires a first name, last name, and an email or phone number',
})
const parentSchema = z.object({
  firstName: z.string().trim().min(1), middleName: z.string().trim().optional(), lastName: z.string().trim().min(1),
  email: z.string().email(), phone: z.string().trim().min(6), relationship: z.string().trim().min(2),
  address: z.string().trim().min(5), occupation: z.string().trim().optional(),
})
type Child = z.infer<typeof childSchema> & { photoData?: string }
type Parent = z.infer<typeof parentSchema>

const escapeHtml = (value: unknown) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')
const fileDataUrl = (file?: Express.Multer.File) => file ? `data:${file.mimetype};base64,${file.buffer.toString('base64')}` : undefined
const photoFile = (files: Express.Multer.File[], field: string) => {
  const file = files.find((item) => item.fieldname === field)
  if (!file) return undefined
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) throw new ApiError(400, `${field} must be a JPG, PNG or WEBP image`)
  return fileDataUrl(file)
}
const parseChildren = (body: Record<string, unknown>, files: Express.Multer.File[]): Child[] => {
  let raw: unknown
  try { raw = body.children ? JSON.parse(String(body.children)) : null } catch { throw new ApiError(400, 'Invalid children payload') }
  const legacy = [{ firstName: body.firstName, middleName: body.middleName, lastName: body.lastName, dateOfBirth: body.dateOfBirth, gender: body.gender, nationality: body.nationality, gradeApplying: body.gradeApplying, previousSchool: body.previousSchool, languages: body.languages }]
  const parsed = z.array(childSchema).min(1).max(MAX_CHILDREN).parse(Array.isArray(raw) ? raw : legacy)
  return parsed.map((child, index) => ({ ...child, photoData: photoFile(files, `studentPhoto_${index}`) }))
}
const parseParent = (body: Record<string, unknown>): Parent => parentSchema.parse({
  firstName: body.parentFirstName || String(body.parentName || '').trim().split(/\s+/).slice(-1)[0],
  middleName: body.parentMiddleName, lastName: body.parentLastName || String(body.parentName || '').trim().split(/\s+/).slice(0, -1).join(' ') || body.parentName,
  email: body.parentEmail, phone: body.parentPhone, relationship: body.relationship, address: body.address, occupation: body.occupation,
})
const parseFamilyContacts = (body: Record<string, unknown>) => {
  if (!body.familyContacts) return []
  try { return z.array(familyContactSchema).max(20).parse(JSON.parse(String(body.familyContacts))) }
  catch (error) { if (error instanceof z.ZodError) throw error; throw new ApiError(400, 'Invalid complementary family contacts payload') }
}
const publicApplication = (application: any) => ({ ...application, parentPhotoData: application.parentPhotoData ? 'stored' : null, children: Array.isArray(application.children) ? application.children.map(({ photoData, ...child }: any) => ({ ...child, photoData: photoData ? 'stored' : null })) : application.children })

export const admissionsRouter = Router()

admissionsRouter.get('/', authenticate, requireRoles('admin', 'staff'), asyncHandler(async (_req, res) => {
  const applications = await prisma.admissionApplication.findMany({ include: { documents: true }, orderBy: { submittedAt: 'desc' } })
  return success(res, applications.map(publicApplication))
}))
admissionsRouter.get('/track/:number', asyncHandler(async (req, res) => {
  const application = await prisma.admissionApplication.findUnique({ where: { applicationNumber: getRouteParam(req.params.number) }, include: { documents: true } })
  if (!application) throw new ApiError(404, 'Application not found')
  return success(res, publicApplication(application))
}))
admissionsRouter.get('/:id', authenticate, requireRoles('admin'), asyncHandler(async (req, res) => {
  const application = await prisma.admissionApplication.findUnique({ where: { id: getRouteParam(req.params.id) }, include: { documents: true } })
  if (!application) throw new ApiError(404, 'Application not found')
  return success(res, application)
}))

admissionsRouter.post('/', upload.any(), asyncHandler(async (req, res) => {
  const files = (req.files || []) as Express.Multer.File[]
  const children = parseChildren(req.body, files)
  const parent = parseParent(req.body)
  const familyContacts = parseFamilyContacts(req.body)
  const parentPhotoData = photoFile(files, 'parentPhoto')
  const documents = files.filter((file) => file.fieldname === 'documents')
  const applicationNumber = `KCS-${Date.now().toString().slice(-6)}`
  const first = children[0]
  const storedChildren = children.map((child) => ({ ...child, dateOfBirth: child.dateOfBirth.toISOString() }))
  const notes = String(req.body.notes || '').trim() || undefined
  const application = await prisma.admissionApplication.create({
    data: {
      applicationNumber, firstName: first.firstName, middleName: first.middleName || null, lastName: first.lastName,
      dateOfBirth: first.dateOfBirth, gender: first.gender, nationality: first.nationality, gradeApplying: first.gradeApplying,
      previousSchool: first.previousSchool, parentName: [parent.lastName, parent.middleName, parent.firstName].filter(Boolean).join(' '),
      parentEmail: parent.email, parentPhone: parent.phone, relationship: parent.relationship, address: parent.address, notes,
      children: storedChildren as any, parentDetails: { ...parent, familyContacts } as any, parentPhotoData,
      documents: { create: documents.map((file) => ({ name: file.originalname, type: file.mimetype, url: `email-attachment://${applicationNumber}/${file.originalname}` })) },
    }, include: { documents: true },
  })
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } })
  await prisma.notification.createMany({ data: admins.map((admin) => ({ userId: admin.id, title: 'Nouvelle candidature familiale', message: `${applicationNumber} · ${children.length} enfant(s) · ${application.parentName}`, type: 'INFO' as const, link: '/admin/admissions' })) }).catch((error) => console.error('[admissions] admin notification failed', error))
  const childLines = children.map((child, index) => `${index + 1}. ${child.lastName} ${child.middleName || ''} ${child.firstName} — ${child.gradeApplying}`).join('\n')
  const text = `Nouvelle candidature KCS ${applicationNumber}\n\nParent: ${application.parentName}\nEmail: ${parent.email}\nTéléphone: ${parent.phone}\nAdresse: ${parent.address}\n\nEnfants (${children.length}):\n${childLines}\n\nNotes: ${notes || 'Aucune'}`
  const mail = await sendSchoolMail({ to: OFFICIAL_SCHOOL_EMAIL, replyTo: parent.email, subject: `Candidature KCS - ${applicationNumber} - ${children.length} enfant(s)`, text, html: `<h1>Candidature ${escapeHtml(applicationNumber)}</h1><p><strong>Parent :</strong> ${escapeHtml(application.parentName)}</p><p>${escapeHtml(parent.email)} · ${escapeHtml(parent.phone)}</p><h2>Enfants (${children.length})</h2><ol>${children.map((child) => `<li>${escapeHtml(child.lastName)} ${escapeHtml(child.middleName)} ${escapeHtml(child.firstName)} — ${escapeHtml(child.gradeApplying)}</li>`).join('')}</ol>`, attachments: documents.map((file) => ({ filename: file.originalname, content: file.buffer, contentType: file.mimetype })) }).catch(() => ({ sent: false as const, reason: 'SMTP_SEND_FAILED' as const }))
  return success(res, { ...publicApplication(application), emailDelivery: mail, schoolEmail: OFFICIAL_SCHOOL_EMAIL }, 'Family application submitted', 201)
}))

admissionsRouter.post('/:id/approve', authenticate, requireSuperAdmin(), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const certificateOptions = z.object({ language: z.enum(['fr', 'en']).default('fr'), includeAuthentication: z.boolean().default(true), academicYear: z.string().trim().regex(/^\d{4}-\d{4}$/).default('2026-2027') }).parse(req.body || {})
  const id = getRouteParam(req.params.id)
  const application = await prisma.admissionApplication.findUnique({ where: { id }, include: { documents: true } })
  if (!application) throw new ApiError(404, 'Application not found')
  if (application.provisionedAt) throw new ApiError(409, 'This application has already been provisioned')
  const children = (Array.isArray(application.children) ? application.children : []) as unknown as Child[]
  const parentDetails = (application.parentDetails || {}) as unknown as Partial<Parent>
  const submittedChildren = children.length ? children : [{ firstName: application.firstName, middleName: application.middleName || undefined, lastName: application.lastName, dateOfBirth: application.dateOfBirth, gender: application.gender, nationality: application.nationality, gradeApplying: application.gradeApplying, previousSchool: application.previousSchool || undefined }]
  const familyPayload = {
    parent: { firstName: parentDetails.firstName || application.parentName.split(/\s+/).slice(-1)[0], middleName: parentDetails.middleName, lastName: parentDetails.lastName || application.parentName.split(/\s+/).slice(0, -1).join(' ') || application.parentName, email: application.parentEmail, phone: application.parentPhone, relationship: application.relationship, physicalAddress: application.address, photoData: application.parentPhotoData || undefined, familyContacts: (parentDetails as any).familyContacts || [] },
    students: submittedChildren.map((child, index) => ({ firstName: child.firstName, middleName: child.middleName, lastName: child.lastName, grade: child.gradeApplying, section: child.section || '', dateOfBirth: child.dateOfBirth, studentNumber: `${application.applicationNumber}-STU-${String(index + 1).padStart(2, '0')}`, photoData: child.photoData })),
  }
  const authorization = req.headers.authorization
  const response = await fetch(`http://127.0.0.1:${process.env.PORT || 5000}/api/students`, { method: 'POST', headers: { 'content-type': 'application/json', ...(authorization ? { authorization } : {}) }, body: JSON.stringify(familyPayload) })
  const result = await response.json() as any
  if (!response.ok) throw new ApiError(response.status, result?.message || result?.error || 'Family provisioning failed')
  const family = result.data || result
  const updated = await prisma.admissionApplication.update({ where: { id }, data: { status: 'ACCEPTED', provisionedAt: new Date(), provisionedParentId: String(family.parent?.id || family.parent?.orbitId || '') || null } })
  let admissionCertificateDelivery: unknown = { sent: false, reason: 'NOT_ATTEMPTED' }
  try {
    const officials = await prisma.user.findMany({ where: { signatureImage: { not: null }, OR: [{ staffProfile: { is: { function: { contains: 'principal', mode: 'insensitive' } } } }, { staffProfile: { is: { function: { contains: 'head', mode: 'insensitive' } } } }] }, include: { staffProfile: true } })
    const principalUser = officials.find((user) => /principal|préfet|prefet/i.test(user.staffProfile?.function || ''))
    const headUser = officials.find((user) => /head/i.test(user.staffProfile?.function || ''))
    const display = (user: typeof officials[number] | undefined) => user ? { name: [user.lastName, user.middleName, user.firstName].filter(Boolean).join(' '), image: user.signatureImage } : null
    const attachments: Array<{ filename: string; content: Buffer; contentType: string }> = []
    for (const [index, child] of submittedChildren.entries()) {
      const certificate = await admissionCertificatePdf({ applicationNumber: application.applicationNumber, academicYear: certificateOptions.academicYear, language: certificateOptions.language, includeAuthentication: certificateOptions.includeAuthentication, child: { ...child, studentNumber: `${application.applicationNumber}-STU-${String(index + 1).padStart(2, '0')}` }, principal: display(principalUser), headOfSchool: display(headUser) })
      attachments.push({ filename: `${certificate.documentId}.pdf`, content: certificate.buffer, contentType: 'application/pdf' })
    }
    const fr = certificateOptions.language === 'fr'
    admissionCertificateDelivery = await sendSchoolMail({ to: application.parentEmail, replyTo: OFFICIAL_SCHOOL_EMAIL, subject: fr ? `Admission officielle KCS · ${application.applicationNumber}` : `Official KCS admission · ${application.applicationNumber}`, text: fr ? `Bonjour ${application.parentName},\n\nL’admission de votre/vos enfant(s) à Kinshasa Christian School est confirmée. Vous trouverez le(s) certificat(s) officiel(s) en pièce jointe.\n\nDossier : ${application.applicationNumber}` : `Dear ${application.parentName},\n\nYour child/children's admission to Kinshasa Christian School is confirmed. The official certificate(s) are attached.\n\nApplication: ${application.applicationNumber}`, attachments })
  } catch (error) { console.error('[admissions] admission certificate delivery failed without rolling back provisioning', error); admissionCertificateDelivery = { sent: false, reason: 'CERTIFICATE_OR_SMTP_FAILED' } }
  await prisma.auditLog.create({ data: { actorId: req.user!.sub, action: 'admission.certificates_issued', targetType: 'AdmissionApplication', targetId: application.id, metadata: { language: certificateOptions.language, includeAuthentication: certificateOptions.includeAuthentication, delivery: admissionCertificateDelivery } as any } }).catch(() => undefined)
  return success(res, { application: publicApplication(updated), family, temporaryCredentials: family.temporaryCredentials, credentialDelivery: family.credentialDelivery, admissionCertificateDelivery }, 'Application approved, family provisioned and admission certificate processed')
}))

admissionsRouter.patch('/:id/status', authenticate, requireRoles('admin', 'staff'), asyncHandler(async (req: import('../middleware/auth.js').AuthenticatedRequest, res) => {
  const payload = z.object({ status: z.enum(['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'INTERVIEW_SCHEDULED', 'WAITLISTED', 'REJECTED']), notes: z.string().optional() }).parse({ status: String(req.body.status || '').toUpperCase(), notes: req.body.notes })
  if (req.user!.role === 'staff' && !['UNDER_REVIEW', 'INTERVIEW_SCHEDULED'].includes(payload.status)) throw new ApiError(403, 'Final admission decisions require Super Admin approval')
  const application = await prisma.admissionApplication.update({ where: { id: getRouteParam(req.params.id) }, data: { status: payload.status, notes: payload.notes } })
  return success(res, application, 'Application status updated')
}))

admissionsRouter.post('/:id/documents', authenticate, requireRoles('admin'), upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'No file uploaded')
  const document = await prisma.admissionDocument.create({ data: { applicationId: getRouteParam(req.params.id), name: req.file.originalname, type: req.file.mimetype, url: `uploads/admissions/${req.file.originalname}` } })
  return success(res, document, 'Document uploaded', 201)
}))
