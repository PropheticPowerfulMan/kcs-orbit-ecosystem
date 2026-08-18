import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../config/prisma.js'
import { authenticate, requireRoles, type AuthenticatedRequest } from '../middleware/auth.js'
import { ApiError, asyncHandler, success } from '../utils/api.js'
import { getRouteParam } from '../utils/request.js'

const enumValue = <T extends readonly [string, ...string[]]>(values: T) => z.enum(values)

const inquirySchema = z.object({
  parentName: z.string().min(2),
  parentEmail: z.string().email(),
  parentPhone: z.string().optional(),
  studentName: z.string().optional(),
  gradeInterest: z.string().min(1),
  source: z.string().optional(),
  message: z.string().optional(),
  nextFollowUpAt: z.coerce.date().optional(),
})

const inquiryStatusSchema = z.object({
  status: enumValue(['NEW', 'CONTACTED', 'TOUR_SCHEDULED', 'APPLICATION_INVITED', 'CLOSED']),
  nextFollowUpAt: z.coerce.date().optional(),
  convertedApplicationId: z.string().optional(),
})

const chargeSchema = z.object({
  invoiceId: z.string().min(1),
  kind: enumValue(['STANDARD_FEE', 'DISCOUNT', 'SCHOLARSHIP', 'FAMILY_PAYMENT', 'ADJUSTMENT']),
  label: z.string().min(2),
  amount: z.coerce.number(),
  notes: z.string().optional(),
})

const teacherStatusSchema = z.object({
  status: enumValue(['HOMEROOM_TEACHER', 'TEACHER', 'ASSISTANT_TEACHER']),
  homeroomGrade: z.string().optional(),
  homeroomSection: z.string().optional(),
})

const teacherReviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  summary: z.string().min(3),
  goals: z.string().optional(),
})

const reportPublicationSchema = z.object({
  publicationStatus: enumValue(['DRAFT', 'READY_FOR_REVIEW', 'APPROVED', 'EMAILED', 'POSTED_TO_PORTAL']),
  paymentCondition: z.string().optional(),
  feeSummary: z.record(z.unknown()).optional(),
  notify: z.boolean().optional(),
  channel: enumValue(['EMAIL', 'TEXT', 'LETTER', 'CALL', 'PORTAL']).optional(),
  recipientName: z.string().optional(),
  recipientEmail: z.string().email().optional(),
  recipientPhone: z.string().optional(),
  message: z.string().optional(),
})

const correspondenceSchema = z.object({
  channel: enumValue(['EMAIL', 'TEXT', 'LETTER', 'CALL', 'PORTAL']),
  status: enumValue(['DRAFT', 'QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'LOGGED']).default('LOGGED'),
  subject: z.string().min(2),
  body: z.string().min(2),
  recipientName: z.string().optional(),
  recipientEmail: z.string().email().optional(),
  recipientPhone: z.string().optional(),
  studentId: z.string().optional(),
  reportCardId: z.string().optional(),
  disciplineCaseId: z.string().optional(),
  failureReason: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
})

const disciplineSchema = z.object({
  studentId: z.string().min(1),
  incidentDate: z.coerce.date().optional(),
  category: z.string().min(2),
  severity: enumValue(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  gradeImpact: z.string().optional(),
  incident: z.string().min(3),
  actionTaken: z.string().optional(),
  resolution: z.string().optional(),
  status: enumValue(['OPEN', 'INVESTIGATING', 'PARENT_CONTACTED', 'RESOLVED', 'ESCALATED']).default('OPEN'),
  notifyParent: z.boolean().optional(),
  notifyStudent: z.boolean().optional(),
  parentMessage: z.string().optional(),
  studentMessage: z.string().optional(),
})

const getActorId = (req: AuthenticatedRequest) => req.user?.sub

const buildInquiryNumber = () => `INQ-${Date.now().toString().slice(-7)}`
const asPrismaData = <T extends object>(value: T) => value as any

export const schoolManagementRouter = Router()

schoolManagementRouter.use(authenticate)

schoolManagementRouter.get('/overview', requireRoles('admin', 'staff'), asyncHandler(async (_req, res) => {
  const [inquiries, applications, openDiscipline, reportCards, charges, correspondences] = await Promise.all([
    prisma.admissionInquiry.count({ where: { status: { not: 'CLOSED' } } }),
    prisma.admissionApplication.count({ where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'INTERVIEW_SCHEDULED'] } } }),
    prisma.disciplineCase.count({ where: { status: { not: 'RESOLVED' } } }),
    prisma.reportCard.count({ where: { publicationStatus: { not: 'POSTED_TO_PORTAL' } } }),
    prisma.feeCharge.count(),
    prisma.correspondenceLog.count({ where: { status: { in: ['QUEUED', 'FAILED'] } } }),
  ])

  return success(res, { inquiries, applications, openDiscipline, pendingReportCards: reportCards, charges, correspondences })
}))

schoolManagementRouter.get('/admission-inquiries', requireRoles('admin', 'staff'), asyncHandler(async (_req, res) => {
  const inquiries = await prisma.admissionInquiry.findMany({ orderBy: { createdAt: 'desc' } })
  return success(res, inquiries)
}))

schoolManagementRouter.post('/admission-inquiries', asyncHandler(async (req, res) => {
  const payload = inquirySchema.parse(req.body)
  const inquiry = await prisma.admissionInquiry.create({
    data: { ...payload, inquiryNumber: buildInquiryNumber() },
  })
  return success(res, inquiry, 'Admission inquiry recorded', 201)
}))

schoolManagementRouter.patch('/admission-inquiries/:id/status', requireRoles('admin', 'staff'), asyncHandler(async (req, res) => {
  const inquiryId = getRouteParam(req.params.id)
  const payload = inquiryStatusSchema.parse(req.body)
  const inquiry = await prisma.admissionInquiry.update({ where: { id: inquiryId }, data: asPrismaData(payload) })
  return success(res, inquiry, 'Admission inquiry status updated')
}))

schoolManagementRouter.patch('/teachers/:id/status', requireRoles('admin'), asyncHandler(async (req, res) => {
  const teacherId = getRouteParam(req.params.id)
  const payload = teacherStatusSchema.parse(req.body)
  const teacher = await prisma.teacherProfile.update({
    where: { id: teacherId },
    data: asPrismaData(payload),
    include: { user: true, courses: true, reviews: true },
  })
  return success(res, teacher, 'Teacher status updated')
}))

schoolManagementRouter.post('/teachers/:id/reviews', requireRoles('admin', 'staff'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const teacherId = getRouteParam(req.params.id)
  const payload = teacherReviewSchema.parse(req.body)
  const review = await prisma.teacherReview.create({
    data: { ...payload, teacherId, reviewerId: getActorId(req) },
  })
  return success(res, review, 'Teacher review recorded', 201)
}))

schoolManagementRouter.post('/fee-charges', requireRoles('admin', 'staff'), asyncHandler(async (req, res) => {
  const payload = chargeSchema.parse(req.body)
  const charge = await prisma.feeCharge.create({ data: asPrismaData(payload), include: { invoice: true } })
  return success(res, charge, 'Fee charge recorded', 201)
}))

schoolManagementRouter.get('/fee-charges', requireRoles('admin', 'staff'), asyncHandler(async (_req, res) => {
  const charges = await prisma.feeCharge.findMany({
    include: { invoice: { include: { student: { include: { user: true } } } } },
    orderBy: { createdAt: 'desc' },
  })
  return success(res, charges)
}))

schoolManagementRouter.patch('/report-cards/:id/publication', requireRoles('admin', 'staff', 'teacher'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const reportCardId = getRouteParam(req.params.id)
  const payload = reportPublicationSchema.parse(req.body)
  const now = new Date()

  const reportCard = await prisma.reportCard.update({
    where: { id: reportCardId },
    data: asPrismaData({
      publicationStatus: payload.publicationStatus,
      paymentCondition: payload.paymentCondition,
      feeSummary: payload.feeSummary,
      emailedAt: payload.publicationStatus === 'EMAILED' ? now : undefined,
      portalPostedAt: payload.publicationStatus === 'POSTED_TO_PORTAL' ? now : undefined,
    }),
    include: { student: { include: { user: true, parentLinks: { include: { parent: true } } } } },
  }) as any

  let correspondence = null
  if (payload.notify) {
    const parent = reportCard.student.parentLinks[0]?.parent
    correspondence = await prisma.correspondenceLog.create({
      data: asPrismaData({
        channel: payload.channel ?? (payload.publicationStatus === 'EMAILED' ? 'EMAIL' : 'PORTAL'),
        status: payload.publicationStatus === 'EMAILED' || payload.publicationStatus === 'POSTED_TO_PORTAL' ? 'SENT' : 'QUEUED',
        subject: `Report card ${reportCard.term} - ${reportCard.student.user.firstName} ${reportCard.student.user.lastName}`,
        body: payload.message ?? 'A report card update is available.',
        senderId: getActorId(req),
        recipientName: payload.recipientName ?? (parent ? `${parent.firstName} ${parent.lastName}` : undefined),
        recipientEmail: payload.recipientEmail ?? parent?.email,
        recipientPhone: payload.recipientPhone ?? parent?.phone ?? undefined,
        studentId: reportCard.studentId,
        reportCardId: reportCard.id,
        sentAt: now,
      }),
    })
  }

  return success(res, { reportCard, correspondence }, 'Report card publication workflow updated')
}))

schoolManagementRouter.get('/correspondence', requireRoles('admin', 'staff', 'teacher'), asyncHandler(async (_req, res) => {
  const logs = await prisma.correspondenceLog.findMany({
    include: { sender: true, reportCard: true, disciplineCase: true },
    orderBy: { createdAt: 'desc' },
  })
  return success(res, logs)
}))

schoolManagementRouter.post('/correspondence', requireRoles('admin', 'staff', 'teacher'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const payload = correspondenceSchema.parse(req.body)
  const log = await prisma.correspondenceLog.create({
    data: asPrismaData({
      ...payload,
      senderId: getActorId(req),
      sentAt: ['SENT', 'DELIVERED', 'LOGGED'].includes(payload.status) ? new Date() : undefined,
      deliveredAt: payload.status === 'DELIVERED' ? new Date() : undefined,
    }),
  })
  return success(res, log, 'Correspondence logged', 201)
}))

schoolManagementRouter.get('/discipline-cases', requireRoles('admin', 'staff', 'teacher'), asyncHandler(async (_req, res) => {
  const cases = await prisma.disciplineCase.findMany({
    include: {
      student: { include: { user: true, parentLinks: { include: { parent: true } } } },
      reportedBy: true,
      resolvedBy: true,
      correspondenceLogs: true,
    },
    orderBy: { incidentDate: 'desc' },
  })
  return success(res, cases)
}))

schoolManagementRouter.post('/discipline-cases', requireRoles('admin', 'staff', 'teacher'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const payload = disciplineSchema.parse(req.body)
  const now = new Date()
  const disciplineCase = await prisma.disciplineCase.create({
    data: asPrismaData({
      studentId: payload.studentId,
      reportedById: getActorId(req),
      incidentDate: payload.incidentDate,
      category: payload.category,
      severity: payload.severity,
      gradeImpact: payload.gradeImpact,
      incident: payload.incident,
      actionTaken: payload.actionTaken,
      resolution: payload.resolution,
      status: payload.status,
      parentNotifiedAt: payload.notifyParent ? now : undefined,
      studentNotifiedAt: payload.notifyStudent ? now : undefined,
    }),
    include: { student: { include: { user: true, parentLinks: { include: { parent: true } } } } },
  }) as any

  const parent = disciplineCase.student.parentLinks[0]?.parent
  const logs = await prisma.$transaction([
    ...(payload.notifyParent
      ? [prisma.correspondenceLog.create({
          data: asPrismaData({
            channel: 'PORTAL',
            status: 'SENT',
            subject: `Discipline update - ${disciplineCase.category}`,
            body: payload.parentMessage ?? disciplineCase.incident,
            senderId: getActorId(req),
            recipientName: parent ? `${parent.firstName} ${parent.lastName}` : undefined,
            recipientEmail: parent?.email,
            recipientPhone: parent?.phone ?? undefined,
            studentId: disciplineCase.studentId,
            disciplineCaseId: disciplineCase.id,
            sentAt: now,
          }),
        })]
      : []),
    ...(payload.notifyStudent
      ? [prisma.correspondenceLog.create({
          data: asPrismaData({
            channel: 'PORTAL',
            status: 'SENT',
            subject: `Discipline update - ${disciplineCase.category}`,
            body: payload.studentMessage ?? disciplineCase.incident,
            senderId: getActorId(req),
            recipientName: `${disciplineCase.student.user.firstName} ${disciplineCase.student.user.lastName}`,
            recipientEmail: disciplineCase.student.user.email,
            studentId: disciplineCase.studentId,
            disciplineCaseId: disciplineCase.id,
            sentAt: now,
          }),
        })]
      : []),
  ])

  return success(res, { disciplineCase, correspondenceLogs: logs }, 'Discipline case recorded', 201)
}))

schoolManagementRouter.patch('/discipline-cases/:id/resolution', requireRoles('admin', 'staff', 'teacher'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const disciplineCaseId = getRouteParam(req.params.id)
  const payload = disciplineSchema.partial().extend({
    status: enumValue(['OPEN', 'INVESTIGATING', 'PARENT_CONTACTED', 'RESOLVED', 'ESCALATED']),
  }).parse(req.body)

  const disciplineCase = await prisma.disciplineCase.update({
    where: { id: disciplineCaseId },
    data: asPrismaData({
      resolvedById: payload.status === 'RESOLVED' ? getActorId(req) : undefined,
      resolution: payload.resolution,
      actionTaken: payload.actionTaken,
      gradeImpact: payload.gradeImpact,
      status: payload.status,
    }),
  })

  return success(res, disciplineCase, 'Discipline resolution updated')
}))
