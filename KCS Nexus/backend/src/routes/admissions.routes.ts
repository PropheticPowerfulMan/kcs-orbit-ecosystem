import { Router } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { prisma } from '../config/prisma.js'
import { authenticate, requireRoles } from '../middleware/auth.js'
import { ApiError, asyncHandler, success } from '../utils/api.js'
import { env } from '../config/env.js'
import { sendSchoolMail } from '../utils/mail.js'
import { getRouteParam } from '../utils/request.js'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 6,
  },
})

const admissionSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  dateOfBirth: z.coerce.date(),
  gender: z.string().default('Not specified'),
  nationality: z.string().min(2),
  gradeApplying: z.string().min(1),
  previousSchool: z.string().optional(),
  languages: z.string().optional(),
  parentName: z.string().min(2),
  parentEmail: z.string().email(),
  parentPhone: z.string().min(6),
  relationship: z.string().min(2),
  address: z.string().min(5),
  occupation: z.string().optional(),
  notes: z.string().optional(),
})

type AdmissionPayload = z.infer<typeof admissionSchema>

const escapeHtml = (value?: string | Date | null) =>
  String(value ?? 'Not provided')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')

const formatRows = (rows: Array<[string, string | Date | undefined | null]>) =>
  rows
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:8px 12px;border:1px solid #d9e2ef;font-weight:700;background:#f4f7fb;">${escapeHtml(label)}</td>
          <td style="padding:8px 12px;border:1px solid #d9e2ef;">${escapeHtml(value instanceof Date ? value.toISOString().slice(0, 10) : value)}</td>
        </tr>`,
    )
    .join('')

const buildAdmissionEmail = (
  applicationNumber: string,
  payload: AdmissionPayload,
  documents: Express.Multer.File[],
) => {
  const studentRows: Array<[string, string | Date | undefined]> = [
    ['Application number', applicationNumber],
    ['Student first name', payload.firstName],
    ['Student last name', payload.lastName],
    ['Date of birth', payload.dateOfBirth],
    ['Gender', payload.gender],
    ['Nationality', payload.nationality],
    ['Grade applying', payload.gradeApplying],
    ['Previous/current school', payload.previousSchool],
    ['Languages spoken', payload.languages],
  ]

  const parentRows: Array<[string, string | undefined]> = [
    ['Parent/guardian name', payload.parentName],
    ['Relationship', payload.relationship],
    ['Parent email', payload.parentEmail],
    ['Parent phone', payload.parentPhone],
    ['Address', payload.address],
    ['Occupation', payload.occupation],
  ]

  const documentList = documents.length
    ? documents.map((file) => `- ${file.originalname} (${file.mimetype}, ${Math.round(file.size / 1024)} KB)`).join('\n')
    : '- No documents attached'

  const text = [
    `New KCS online admission application: ${applicationNumber}`,
    '',
    'STUDENT INFORMATION',
    `First name: ${payload.firstName}`,
    `Last name: ${payload.lastName}`,
    `Date of birth: ${payload.dateOfBirth.toISOString().slice(0, 10)}`,
    `Gender: ${payload.gender}`,
    `Nationality: ${payload.nationality}`,
    `Grade applying: ${payload.gradeApplying}`,
    `Previous/current school: ${payload.previousSchool || 'Not provided'}`,
    `Languages spoken: ${payload.languages || 'Not provided'}`,
    '',
    'PARENT / GUARDIAN INFORMATION',
    `Name: ${payload.parentName}`,
    `Relationship: ${payload.relationship}`,
    `Email: ${payload.parentEmail}`,
    `Phone: ${payload.parentPhone}`,
    `Address: ${payload.address}`,
    `Occupation: ${payload.occupation || 'Not provided'}`,
    '',
    'NOTES',
    payload.notes || 'Not provided',
    '',
    'DOCUMENTS',
    documentList,
  ].join('\n')

  const html = `
    <div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.45;">
      <h1 style="margin:0 0 6px;color:#0b3b73;">New KCS Online Admission</h1>
      <p style="margin:0 0 18px;">Application number: <strong>${escapeHtml(applicationNumber)}</strong></p>

      <h2 style="color:#0b3b73;">Student Information</h2>
      <table style="border-collapse:collapse;width:100%;max-width:760px;">${formatRows(studentRows)}</table>

      <h2 style="margin-top:24px;color:#0b3b73;">Parent / Guardian Information</h2>
      <table style="border-collapse:collapse;width:100%;max-width:760px;">${formatRows(parentRows)}</table>

      <h2 style="margin-top:24px;color:#0b3b73;">Notes</h2>
      <p style="padding:12px;border:1px solid #d9e2ef;background:#f8fafc;">${escapeHtml(payload.notes)}</p>

      <h2 style="margin-top:24px;color:#0b3b73;">Documents</h2>
      <ul>
        ${
          documents.length
            ? documents
                .map((file) => `<li>${escapeHtml(file.originalname)} - ${escapeHtml(file.mimetype)} - ${Math.round(file.size / 1024)} KB</li>`)
                .join('')
            : '<li>No documents attached</li>'
        }
      </ul>
    </div>`

  return { text, html }
}

export const admissionsRouter = Router()

admissionsRouter.get('/', authenticate, requireRoles('admin'), asyncHandler(async (_req, res) => {
  const applications = await prisma.admissionApplication.findMany({
    include: { documents: true },
    orderBy: { submittedAt: 'desc' },
  })
  return success(res, applications)
}))

admissionsRouter.get('/track/:number', asyncHandler(async (req, res) => {
  const applicationNumber = getRouteParam(req.params.number)
  const application = await prisma.admissionApplication.findUnique({
    where: { applicationNumber },
    include: { documents: true },
  })
  if (!application) throw new ApiError(404, 'Application not found')
  return success(res, application)
}))

admissionsRouter.get('/:id', authenticate, requireRoles('admin'), asyncHandler(async (req, res) => {
  const applicationId = getRouteParam(req.params.id)
  const application = await prisma.admissionApplication.findUnique({
    where: { id: applicationId },
    include: { documents: true },
  })
  if (!application) throw new ApiError(404, 'Application not found')
  return success(res, application)
}))

admissionsRouter.post('/', upload.array('documents', 6), asyncHandler(async (req, res) => {
  const payload = admissionSchema.parse(req.body)
  const documents = (req.files ?? []) as Express.Multer.File[]
  const applicationNumber = `KCS-${Date.now().toString().slice(-6)}`

  const application = await prisma.admissionApplication.create({
    data: {
      firstName: payload.firstName,
      lastName: payload.lastName,
      dateOfBirth: payload.dateOfBirth,
      gender: payload.gender,
      nationality: payload.nationality,
      gradeApplying: payload.gradeApplying,
      previousSchool: payload.previousSchool,
      parentName: payload.parentName,
      parentEmail: payload.parentEmail,
      parentPhone: payload.parentPhone,
      relationship: payload.relationship,
      address: payload.address,
      notes: [
        payload.notes,
        payload.languages ? `Languages: ${payload.languages}` : null,
        payload.occupation ? `Parent occupation: ${payload.occupation}` : null,
      ]
        .filter(Boolean)
        .join('\n\n') || undefined,
      applicationNumber,
      documents: {
        create: documents.map((file) => ({
          name: file.originalname,
          type: file.mimetype,
          url: `email-attachment://${applicationNumber}/${file.originalname}`,
        })),
      },
    },
    include: { documents: true },
  })

  const email = buildAdmissionEmail(applicationNumber, payload, documents)
  let mailResult: Awaited<ReturnType<typeof sendSchoolMail>>

  try {
    mailResult = await sendSchoolMail({
      to: env.SCHOOL_EMAIL,
      replyTo: payload.parentEmail,
      subject: `New KCS admission application - ${applicationNumber} - ${payload.firstName} ${payload.lastName}`,
      text: email.text,
      html: email.html,
      attachments: documents.map((file) => ({
        filename: file.originalname,
        content: file.buffer,
        contentType: file.mimetype,
      })),
    })
  } catch (error) {
    console.error('[admissions] Application saved, but admission email failed:', error)
    mailResult = { sent: false, reason: 'SMTP_SEND_FAILED' as const }
  }

  return success(
    res,
    {
      ...application,
      emailDelivery: mailResult,
      schoolEmail: env.SCHOOL_EMAIL,
    },
    mailResult.sent ? 'Application submitted and emailed' : 'Application submitted; email delivery needs attention',
    201,
  )
}))

admissionsRouter.patch('/:id/status', authenticate, requireRoles('admin'), asyncHandler(async (req, res) => {
  const applicationId = getRouteParam(req.params.id)
  const schema = z.object({ status: z.enum(['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'INTERVIEW_SCHEDULED', 'ACCEPTED', 'WAITLISTED', 'REJECTED']), notes: z.string().optional() })
  const payload = schema.parse({
    status: String(req.body.status || '').toUpperCase(),
    notes: req.body.notes,
  })

  const application = await prisma.admissionApplication.update({
    where: { id: applicationId },
    data: { status: payload.status, notes: payload.notes },
  })
  return success(res, application, 'Application status updated')
}))

admissionsRouter.post('/:id/documents', authenticate, requireRoles('admin'), upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'No file uploaded')
  const applicationId = getRouteParam(req.params.id)

  const document = await prisma.admissionDocument.create({
    data: {
      applicationId,
      name: req.file.originalname,
      type: req.file.mimetype,
      url: `uploads/admissions/${req.file.originalname}`,
    },
  })
  return success(res, document, 'Document uploaded', 201)
}))
