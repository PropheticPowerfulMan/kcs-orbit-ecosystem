import { Router, type NextFunction, type Response } from 'express'
import { z } from 'zod'
import { prisma } from '../config/prisma.js'
import { env } from '../config/env.js'
import { authenticate, requireRoles, requireSuperAdmin, type AuthenticatedRequest } from '../middleware/auth.js'
import { ApiError, asyncHandler, success } from '../utils/api.js'
import { getRouteParam } from '../utils/request.js'
import { sendSchoolSms } from '../utils/sms.js'
import { classAssignmentsOverlap, normalizeClassParts } from '../utils/className.js'
import { updateOrbitStudentClassAssignment, updateOrbitStudentStatus } from '../services/orbitStudentMaterialization.js'
import { reconcileOfficialClassCourseEnrollments } from '../services/officialClassRoster.js'

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
}).superRefine((value, context) => {
  if (['HOMEROOM_TEACHER', 'ASSISTANT_TEACHER'].includes(value.status) && !value.homeroomGrade?.trim()) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['homeroomGrade'], message: 'Select the assigned class.' })
  }
})
const studentClassSectionSchema = z.object({
  section: z.string().trim().max(40).transform((value) => value.replace(/\s+/g, ' ')),
})
const studentClassSectionBulkSchema = z.object({
  studentIds: z.array(z.string().min(1)).min(1).max(200),
  section: z.string().trim().max(40).transform((value) => value.replace(/\s+/g, ' ')),
}).superRefine((value, context) => {
  if (new Set(value.studentIds).size !== value.studentIds.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['studentIds'], message: 'A learner can only be selected once.' })
  }
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
  suspensionStart: z.coerce.date().optional(),
  suspensionEnd: z.coerce.date().optional(),
})

const requireOperationalAdministrator = (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== 'admin' || req.user.sub === 'configured-superadmin') {
    return next(new ApiError(403, 'Operational Administrator permissions required'))
  }
  next()
}

const getActorId = (req: AuthenticatedRequest) => req.user?.sub
const resolveActorId = async (req: AuthenticatedRequest) => {
  if (req.user?.sub !== 'configured-superadmin') return req.user?.sub
  const account = await prisma.user.findUnique({ where: { email: process.env.SUPERADMIN_EMAIL || 'superadmin@kcsnexus.com' }, select: { id: true } })
  if (!account) throw new ApiError(409, 'The Super Administrator database account is not synchronized')
  return account.id
}

type OrbitTeacher = { id: string; fullName?: string; firstName?: string; middleName?: string | null; lastName?: string; email?: string | null; phone?: string | null; employeeId?: string | null; department?: string | null; jobTitle?: string | null; employeeType?: string | null }

async function getOrbitTeachers(): Promise<OrbitTeacher[]> {
  if (!env.KCS_ORBIT_API_URL || !env.KCS_ORBIT_API_KEY || !env.KCS_ORBIT_ORGANIZATION_ID) return []
  const baseUrl = env.KCS_ORBIT_API_URL.replace(/\/$/, '')
  const response = await fetch(baseUrl + '/api/integration/read/shared-directory?organizationId=' + encodeURIComponent(env.KCS_ORBIT_ORGANIZATION_ID), {
    headers: { 'x-api-key': env.KCS_ORBIT_API_KEY, 'x-app-slug': 'KCS_NEXUS' }, signal: AbortSignal.timeout(3_000),
  })
  if (!response.ok) throw new ApiError(response.status, 'Orbit shared directory request failed with status ' + response.status)
  const directory = await response.json() as { teachers?: OrbitTeacher[] }
  return (directory.teachers ?? []).filter((teacher) => !teacher.employeeType || teacher.employeeType.toLowerCase() === 'teacher')
}

function splitOrbitTeacherName(teacher: OrbitTeacher) {
  if (teacher.firstName || teacher.lastName) return { firstName: teacher.firstName || 'Teacher', middleName: teacher.middleName || null, lastName: teacher.lastName || 'KCS' }
  const parts = (teacher.fullName || 'KCS Teacher').trim().split(/\s+/)
  return { firstName: parts.at(-1) || 'Teacher', middleName: parts.length > 2 ? parts.slice(1, -1).join(' ') : null, lastName: parts[0] || 'KCS' }
}

async function materializeOrbitTeacher(orbitId: string) {
  const teacher = (await getOrbitTeachers()).find((item) => item.id === orbitId)
  if (!teacher) throw new ApiError(404, 'Teacher not found in the official Orbit directory')
  const identity = splitOrbitTeacherName(teacher)
  const email = teacher.email?.trim().toLowerCase() || orbitId.toLowerCase() + '@ourkcs.org'
  let user = await prisma.user.findFirst({ where: { OR: [{ orbitUserId: orbitId }, { email: { equals: email, mode: 'insensitive' } }] } })
  if (!user) {
    const accessCode = 'ACC-TCH-' + orbitId.replace(/[^a-z0-9]/gi, '').slice(-8).toUpperCase()
    user = await prisma.user.create({ data: { email, accessCode, firstName: identity.firstName, middleName: identity.middleName, lastName: identity.lastName, role: 'TEACHER', phone: teacher.phone || null, orbitUserId: orbitId, orbitOrganizationId: env.KCS_ORBIT_ORGANIZATION_ID } })
  } else if (user.role !== 'TEACHER' || user.orbitUserId !== orbitId) {
    user = await prisma.user.update({ where: { id: user.id }, data: { role: 'TEACHER', orbitUserId: orbitId, orbitOrganizationId: env.KCS_ORBIT_ORGANIZATION_ID, firstName: identity.firstName, middleName: identity.middleName, lastName: identity.lastName } })
  }
  return prisma.teacherProfile.upsert({
    where: { userId: user.id }, update: {},
    create: { userId: user.id, employeeNumber: teacher.employeeId || 'TCH-' + orbitId.slice(-10).toUpperCase(), department: teacher.department || 'Academics', qualification: teacher.jobTitle || 'Teacher', yearsOfExperience: 0 },
  })
}
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

schoolManagementRouter.get('/teachers/main-assignments', requireOperationalAdministrator, asyncHandler(async (_req, res) => {
  res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate')
  const [profiles, orbitTeachers] = await Promise.all([
    prisma.teacherProfile.findMany({
      where: { user: { role: 'TEACHER' } },
      orderBy: { user: { lastName: 'asc' } },
      select: { id: true, status: true, homeroomGrade: true, homeroomSection: true, user: { select: { firstName: true, middleName: true, lastName: true, email: true, orbitUserId: true } }, _count: { select: { courses: true } } },
    }),
    getOrbitTeachers(),
  ])
  const byOrbitId = new Map(profiles.filter((item) => item.user.orbitUserId).map((item) => [item.user.orbitUserId!, item]))
  const byEmail = new Map(profiles.map((item) => [item.user.email.toLowerCase(), item]))
  const merged: any[] = [...profiles]
  for (const orbitTeacher of orbitTeachers) {
    const local = byOrbitId.get(orbitTeacher.id) || (orbitTeacher.email ? byEmail.get(orbitTeacher.email.toLowerCase()) : undefined)
    if (local) continue
    const identity = splitOrbitTeacherName(orbitTeacher)
    merged.push({ id: 'orbit:' + orbitTeacher.id, status: 'TEACHER', homeroomGrade: null, homeroomSection: null, user: { ...identity, email: orbitTeacher.email || '', orbitUserId: orbitTeacher.id }, _count: { courses: 0 }, source: 'orbit' })
  }
  merged.sort((left, right) => [left.user.lastName, left.user.middleName, left.user.firstName].filter(Boolean).join(' ').localeCompare([right.user.lastName, right.user.middleName, right.user.firstName].filter(Boolean).join(' ')))
  return success(res, merged, 'Main teacher assignments loaded from Nexus and Orbit')
}))

schoolManagementRouter.get('/teachers/class-rosters', requireOperationalAdministrator, asyncHandler(async (_req, res) => {
  res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate')
  const [students, assignedTeachers] = await Promise.all([
    prisma.studentProfile.findMany({
      where: { status: { equals: 'active', mode: 'insensitive' } },
      select: {
        id: true,
        studentNumber: true,
        grade: true,
        section: true,
        user: { select: { firstName: true, middleName: true, lastName: true } },
      },
      orderBy: [{ grade: 'asc' }, { user: { lastName: 'asc' } }],
    }),
    prisma.teacherProfile.findMany({
      where: { status: { in: ['HOMEROOM_TEACHER', 'ASSISTANT_TEACHER'] }, user: { role: 'TEACHER' } },
      select: {
        id: true,
        status: true,
        homeroomGrade: true,
        homeroomSection: true,
        user: { select: { firstName: true, middleName: true, lastName: true } },
      },
    }),
  ])
  return success(res, {
    students,
    classes: assignedTeachers
      .filter((teacher) => Boolean(teacher.homeroomGrade))
      .map((teacher) => ({
        teacherId: teacher.id,
        role: teacher.status,
        teacherName: [teacher.user.lastName, teacher.user.middleName, teacher.user.firstName].filter(Boolean).join(' '),
        ...normalizeClassParts(teacher.homeroomGrade, teacher.homeroomSection),
      })),
  }, 'Official class-section roster loaded')
}))

schoolManagementRouter.patch('/teachers/class-rosters', requireOperationalAdministrator, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const payload = studentClassSectionBulkSchema.parse(req.body)
  const students = await prisma.studentProfile.findMany({
    where: { id: { in: payload.studentIds } },
    select: { id: true, grade: true, section: true, studentNumber: true, user: { select: { orbitUserId: true } } },
  })
  if (students.length !== payload.studentIds.length) throw new ApiError(404, 'One or more learners no longer exist in the official Nexus register')

  const assignments = students.map((student) => ({
    student,
    normalized: normalizeClassParts(student.grade, payload.section),
    orbitReference: { orbitUserId: student.user.orbitUserId, studentNumber: student.studentNumber, grade: student.grade, section: student.section },
  }))
  const grades = new Set(assignments.map((entry) => entry.normalized.grade.toLowerCase()))
  if (grades.size !== 1) throw new ApiError(400, 'Bulk section assignment is limited to learners from one grade')

  const orbitUpdates: typeof assignments = []
  try {
    for (const assignment of assignments) {
      const orbitSync = await updateOrbitStudentClassAssignment(
        assignment.orbitReference,
        assignment.normalized.grade,
        assignment.normalized.section,
      )
      if (orbitSync.synchronized) orbitUpdates.push(assignment)
    }

    const updated = await prisma.$transaction(async (tx) => {
      const rows = []
      for (const assignment of assignments) {
        rows.push(await tx.studentProfile.update({
          where: { id: assignment.student.id },
          data: { grade: assignment.normalized.grade, section: assignment.normalized.section },
          select: { id: true, studentNumber: true, grade: true, section: true },
        }))
      }
      const courseRoster = await reconcileOfficialClassCourseEnrollments(tx, rows.map((row) => row.id), assignments[0].normalized)
      await tx.auditLog.create({
        data: {
          actorId: getActorId(req),
          action: 'STUDENT_CLASS_SECTION_BULK_ASSIGNED',
          targetType: 'ClassRoster',
          targetId: [assignments[0].normalized.grade, assignments[0].normalized.section || 'WHOLE_CLASS'].join(':'),
          metadata: {
            grade: assignments[0].normalized.grade,
            section: assignments[0].normalized.section,
            count: rows.length,
            studentIds: rows.map((row) => row.id),
            orbitSynchronized: orbitUpdates.length,
            courseRoster,
          },
        },
      })
      return rows
    })
    return success(res, updated, `${updated.length} learners assigned to the official class section`)
  } catch (error) {
    for (const assignment of [...orbitUpdates].reverse()) {
      try {
        await updateOrbitStudentClassAssignment(
          assignment.orbitReference,
          assignment.student.grade,
          assignment.student.section,
        )
      } catch (rollbackError) {
        console.error('[class-roster] Orbit bulk rollback failed.', rollbackError)
      }
    }
    throw error
  }
}))

schoolManagementRouter.patch('/teachers/class-rosters/:studentId', requireOperationalAdministrator, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const studentId = getRouteParam(req.params.studentId)
  const payload = studentClassSectionSchema.parse(req.body)
  const student = await prisma.studentProfile.findUnique({
    where: { id: studentId },
    select: { id: true, grade: true, section: true, studentNumber: true, user: { select: { orbitUserId: true } } },
  })
  if (!student) throw new ApiError(404, 'Student not found in the official Nexus register')
  const normalized = normalizeClassParts(student.grade, payload.section)
  const orbitReference = { orbitUserId: student.user.orbitUserId, studentNumber: student.studentNumber, grade: student.grade, section: student.section }
  const orbitSync = await updateOrbitStudentClassAssignment(orbitReference, normalized.grade, normalized.section)
  let updated
  try {
    updated = await prisma.$transaction(async (tx) => {
      const saved = await tx.studentProfile.update({
        where: { id: studentId },
        data: { grade: normalized.grade, section: normalized.section },
        select: { id: true, studentNumber: true, grade: true, section: true },
      })
      const courseRoster = await reconcileOfficialClassCourseEnrollments(tx, [studentId], normalized)
      await tx.auditLog.create({
        data: {
          actorId: getActorId(req),
          action: 'STUDENT_CLASS_SECTION_ASSIGNED',
          targetType: 'StudentProfile',
          targetId: studentId,
          metadata: { grade: normalized.grade, previousSection: student.section, section: normalized.section, orbitSynchronized: orbitSync.synchronized, courseRoster },
        },
      })
      return saved
    })
  } catch (error) {
    if (orbitSync.synchronized) {
      try {
        await updateOrbitStudentClassAssignment(orbitReference, student.grade, student.section)
      } catch (rollbackError) {
        console.error('[class-roster] Orbit rollback failed after the Nexus transaction failed.', rollbackError)
      }
    }
    throw error
  }
  return success(res, updated, normalized.section ? 'Student assigned to the official class section' : 'Student assigned to the whole class without a section')
}))
schoolManagementRouter.patch('/teachers/:id/status', requireOperationalAdministrator, asyncHandler(async (req, res) => {
  let teacherId = getRouteParam(req.params.id)
  const payload = teacherStatusSchema.parse(req.body)
  if (teacherId.startsWith('orbit:')) {
    const profile = await materializeOrbitTeacher(teacherId.slice(6))
    teacherId = profile.id
  }

  const requestedClass = payload.status === 'TEACHER'
    ? null
    : normalizeClassParts(payload.homeroomGrade, payload.homeroomSection)
  if (['HOMEROOM_TEACHER', 'ASSISTANT_TEACHER'].includes(payload.status)) {
    if (!requestedClass!.section) {
      const activeRoster = await prisma.studentProfile.findMany({
        where: { status: { equals: 'active', mode: 'insensitive' } },
        select: { grade: true, section: true },
      })
      const existingSections = Array.from(new Set(activeRoster
        .map((student) => normalizeClassParts(student.grade, student.section))
        .filter((studentClass) => studentClass.grade.toLowerCase() === requestedClass!.grade.toLowerCase() && Boolean(studentClass.section))
        .map((studentClass) => studentClass.section)))
      if (existingSections.length) {
        throw new ApiError(409, `${requestedClass!.grade} is already divided into sections (${existingSections.join(', ')}). Choose the correct section instead of Whole class.`)
      }
    }
    const sameRole = await prisma.teacherProfile.findMany({
      where: {
        id: { not: teacherId },
        status: payload.status as 'HOMEROOM_TEACHER' | 'ASSISTANT_TEACHER',
        user: { role: 'TEACHER' },
      },
      select: {
        homeroomGrade: true,
        homeroomSection: true,
        user: { select: { firstName: true, lastName: true } },
      },
    })
    const conflict = sameRole.find((entry) => classAssignmentsOverlap(
      { grade: entry.homeroomGrade, section: entry.homeroomSection },
      requestedClass!,
    ))
    if (conflict) {
      const conflictName = [conflict.user.lastName, conflict.user.firstName].filter(Boolean).join(' ')
      const assignmentLabel = payload.status === 'HOMEROOM_TEACHER' ? 'main teacher' : 'assistant teacher'
      throw new ApiError(409, [requestedClass!.grade, requestedClass!.section].filter(Boolean).join(' ') + ' already has a ' + assignmentLabel + ': ' + conflictName)
    }
  }

  const teacher = await prisma.teacherProfile.update({
    where: { id: teacherId },
    data: asPrismaData({
      ...payload,
      homeroomGrade: requestedClass?.grade ?? null,
      homeroomSection: requestedClass?.section || null,
    }),
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

schoolManagementRouter.get('/discipline-suspensions', requireSuperAdmin(), asyncHandler(async (_req, res) => {
  const suspensions = await prisma.disciplineCase.findMany({
    where: { suspensionStart: { not: null }, suspensionEnd: { not: null } },
    include: { student: { include: { user: { select: { firstName: true, middleName: true, lastName: true } } } }, reportedBy: { select: { firstName: true, middleName: true, lastName: true } } },
    orderBy: [{ suspensionStart: 'desc' }, { createdAt: 'desc' }],
  })
  return success(res, suspensions, 'Official student suspension register loaded')
}))

schoolManagementRouter.post('/discipline-suspensions', requireSuperAdmin(), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const payload = z.object({
    studentId: z.string().min(1), reason: z.string().trim().min(5).max(2000),
    startDate: z.coerce.date(), endDate: z.coerce.date(), notifyParent: z.boolean().default(true), notifyStudent: z.boolean().default(true),
  }).superRefine((value, context) => { if (value.endDate < value.startDate) context.addIssue({ code: z.ZodIssueCode.custom, path: ['endDate'], message: 'Suspension end date must be on or after its start date.' }) }).parse(req.body)
  const start = new Date(payload.startDate); start.setUTCHours(0,0,0,0)
  const end = new Date(payload.endDate); end.setUTCHours(23,59,59,999)
  const actorId = await resolveActorId(req)
  const student = await prisma.studentProfile.findUnique({ where: { id: payload.studentId }, include: { user: true, parentLinks: { include: { parent: true } } } })
  if (!student) throw new ApiError(404, 'Student not found')
  const disciplineCase = await prisma.$transaction(async (tx) => {
    const created = await tx.disciplineCase.create({ data: { studentId: student.id, reportedById: actorId, category: 'Suspension', severity: 'HIGH', incident: payload.reason, actionTaken: `Official suspension from ${start.toISOString().slice(0,10)} to ${end.toISOString().slice(0,10)}`, status: 'OPEN', suspensionStart: start, suspensionEnd: end } })
    await tx.auditLog.create({ data: { actorId, action: 'STUDENT_SUSPENSION_SCHEDULED', targetType: 'DisciplineCase', targetId: created.id, metadata: { studentId: student.id, startDate: start.toISOString(), endDate: end.toISOString(), reason: payload.reason } } })
    const notifications = [] as Array<{userId:string;title:string;message:string;type:'WARNING';link:string}>
    const learner = [student.user.lastName, student.user.middleName, student.user.firstName].filter(Boolean).join(' ')
    const message = `${learner}: suspension officielle du ${start.toISOString().slice(0,10)} au ${end.toISOString().slice(0,10)}. ${payload.reason}`
    if (payload.notifyStudent) notifications.push({ userId: student.user.id, title: 'Official suspension', message, type: 'WARNING', link: '/portal/student/attendance' })
    if (payload.notifyParent) notifications.push(...student.parentLinks.map(link => ({ userId: link.parent.id, title: 'Student suspension notice', message, type: 'WARNING' as const, link: '/portal/parent/notifications' })))
    if (notifications.length) await tx.notification.createMany({ data: notifications })
    return created
  })
  return success(res, disciplineCase, 'Official suspension scheduled and synchronized with attendance', 201)
}))

schoolManagementRouter.patch('/discipline-suspensions/:id/cancel', requireSuperAdmin(), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const id = getRouteParam(req.params.id), actorId = await resolveActorId(req)
  const suspension = await prisma.disciplineCase.findUnique({ where: { id } })
  if (!suspension?.suspensionStart) throw new ApiError(404, 'Suspension not found')
  const updated = await prisma.$transaction(async tx => {
    const record = await tx.disciplineCase.update({ where: { id }, data: { status: 'RESOLVED', resolution: 'Suspension cancelled by Super Administration', resolvedById: actorId } })
    await tx.auditLog.create({ data: { actorId, action: 'STUDENT_SUSPENSION_CANCELLED', targetType: 'DisciplineCase', targetId: id } })
    return record
  })
  return success(res, updated, 'Suspension cancelled')
}))

schoolManagementRouter.get('/discipline-dismissals', requireSuperAdmin(), asyncHandler(async (_req, res) => {
  const archives = await prisma.studentArchive.findMany({ orderBy: [{ effectiveDate: 'desc' }, { createdAt: 'desc' }] })
  return success(res, archives, 'Permanently dismissed student archive loaded')
}))

schoolManagementRouter.get('/student-archives/:id/backup', requireSuperAdmin(), asyncHandler(async (req, res) => {
  const id = getRouteParam(req.params.id)
  const archive = await prisma.studentArchive.findUnique({ where: { id } })
  if (!archive) throw new ApiError(404, 'Archived learner record not found')
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="KCS-ARCHIVE-${archive.studentNumber}-${archive.id}.json"`)
  return res.status(200).send(JSON.stringify({ schema: 'KCS_STUDENT_ARCHIVE_BACKUP_V1', exportedAt: new Date().toISOString(), archive }, null, 2))
}))

schoolManagementRouter.delete('/student-archives/:id', requireSuperAdmin(), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const id = getRouteParam(req.params.id)
  const payload = z.object({ confirmation: z.literal('SUPPRIMER ARCHIVE'), studentNumber: z.string().min(2) }).parse(req.body)
  const actorId = await resolveActorId(req)
  if (!actorId) throw new ApiError(409, 'The Super Administrator audit identity is unavailable')
  const archive = await prisma.studentArchive.findUnique({ where: { id } })
  if (!archive) throw new ApiError(404, 'Archived learner record not found')
  if (archive.studentNumber !== payload.studentNumber) throw new ApiError(422, 'Student number confirmation does not match the archived record')
  await prisma.$transaction(async (tx) => {
    await tx.auditLog.create({ data: { actorId, action: 'STUDENT_ARCHIVE_RECORD_PERMANENTLY_REMOVED', targetType: 'StudentArchive', targetId: archive.id, metadata: { mandatoryBackupNotice: true, removedAt: new Date().toISOString(), archiveSnapshot: archive } as any } })
    await tx.studentArchive.delete({ where: { id } })
  })
  return success(res, { id, deleted: true }, 'Archived learner record removed; academic evidence remains preserved')
}))

schoolManagementRouter.post('/discipline-dismissals', requireSuperAdmin(), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const payload = z.object({
    studentIds: z.array(z.string().min(1)).min(1).max(100).transform((ids) => [...new Set(ids)]),
    reason: z.string().trim().min(10).max(3000),
    effectiveDate: z.coerce.date(),
    notifyParents: z.boolean().default(true),
  }).parse(req.body)
  const actorId = await resolveActorId(req)
  if (!actorId) throw new ApiError(409, 'The Super Administrator audit identity is unavailable')
  const students = await prisma.studentProfile.findMany({
    where: { id: { in: payload.studentIds }, status: { equals: 'active', mode: 'insensitive' } },
    include: {
      user: true,
      parentLinks: { include: { parent: { select: { id: true, phone: true } } } },
      enrollments: { select: { id: true, courseId: true } },
      _count: { select: { grades: true, submissions: true, attendanceRecords: true, reportCards: true, transcripts: true, disciplineCases: true } },
    },
  })
  if (students.length !== payload.studentIds.length) throw new ApiError(409, 'One or more selected learners are missing, already archived, or no longer active.')

  // The Orbit registry is the ecosystem identity authority. Refuse the local
  // dismissal if the central status cannot be secured first, preventing split state.
  await Promise.all(students.map((student) => updateOrbitStudentStatus({ orbitUserId: student.user.orbitUserId, studentNumber: student.studentNumber }, 'dismissed')))

  const effectiveDate = new Date(payload.effectiveDate); effectiveDate.setUTCHours(0, 0, 0, 0)
  const archived = await prisma.$transaction(async (tx) => {
    const results = []
    for (const student of students) {
      const fullName = [student.user.lastName, student.user.middleName, student.user.firstName].filter(Boolean).join(' ')
      const snapshot = {
        identity: { userId: student.userId, orbitUserId: student.user.orbitUserId, studentNumber: student.studentNumber, fullName, email: student.user.email, accessCode: student.user.accessCode },
        academicPlacement: { grade: student.grade, section: student.section, enrollmentDate: student.enrollmentDate },
        parentUserIds: student.parentLinks.map((link) => link.parentId),
        courseEnrollments: student.enrollments,
        recordCounts: student._count,
        statusBeforeDismissal: student.status,
      }
      const archive = await tx.studentArchive.create({ data: { studentId: student.id, userId: student.userId, studentNumber: student.studentNumber, orbitUserId: student.user.orbitUserId, fullName, grade: student.grade, section: student.section, reason: payload.reason, effectiveDate, archivedSnapshot: snapshot, archivedById: actorId } })
      await tx.enrollment.deleteMany({ where: { studentId: student.id } })
      await tx.refreshToken.deleteMany({ where: { userId: student.userId } })
      await tx.studentProfile.update({ where: { id: student.id }, data: { status: 'dismissed' } })
      await tx.user.update({ where: { id: student.userId }, data: { accountBlockedAt: new Date(), accountBlockedReason: `Permanent school dismissal: ${payload.reason}`, accountBlockedBy: actorId, loginLockedUntil: null } })
      if (payload.notifyParents && student.parentLinks.length) {
        await tx.notification.createMany({ data: student.parentLinks.map((link) => ({ userId: link.parentId, title: 'Décision administrative officielle / Official administrative decision', message: `${fullName}: renvoi définitif effectif le ${effectiveDate.toISOString().slice(0, 10)}. ${payload.reason}`, type: 'WARNING' as const, link: '/portal/parent/notifications' })) })
      }
      await tx.auditLog.create({ data: { actorId, action: 'STUDENT_PERMANENTLY_DISMISSED_AND_ARCHIVED', targetType: 'StudentArchive', targetId: archive.id, metadata: { studentId: student.id, studentNumber: student.studentNumber, orbitUserId: student.user.orbitUserId, effectiveDate: effectiveDate.toISOString(), reason: payload.reason, removedCourseEnrollments: student.enrollments.length } } })
      results.push(archive)
    }
    return results
  })

  return success(res, { archived, count: archived.length }, 'Learners permanently dismissed, removed from active rosters, and archived', 201)
}))


  schoolManagementRouter.post("/discipline-cases", requireRoles("admin", "staff", "teacher"), asyncHandler(async (req: AuthenticatedRequest, res) => {
    const payload = disciplineSchema.parse(req.body)
    const now = new Date()
  const actorId = await resolveActorId(req)
  const disciplineCase = await prisma.disciplineCase.create({
    data: asPrismaData({
      studentId: payload.studentId,
      reportedById: actorId,
      incidentDate: payload.incidentDate,
      category: payload.category,
      severity: payload.severity,
      gradeImpact: payload.gradeImpact,
      incident: payload.incident,
      actionTaken: payload.actionTaken,
      resolution: payload.resolution,
      suspensionStart: payload.suspensionStart,
      suspensionEnd: payload.suspensionEnd,
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
            senderId: actorId,
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
            senderId: actorId,
            recipientName: `${disciplineCase.student.user.firstName} ${disciplineCase.student.user.lastName}`,
            recipientEmail: disciplineCase.student.user.email,
            studentId: disciplineCase.studentId,
            disciplineCaseId: disciplineCase.id,
            sentAt: now,
          }),
        })]
      : []),
  ])
  const administrators = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } })
  const learnerName = [disciplineCase.student.user.lastName, disciplineCase.student.user.middleName, disciplineCase.student.user.firstName].filter(Boolean).join(' ')
  const notificationMessage = `A discipline report has been recorded for ${learnerName}: ${disciplineCase.category}.`
  const notificationRows = administrators.map((administrator) => ({
    userId: administrator.id, title: 'New discipline report', message: notificationMessage, type: 'WARNING' as const, link: '/admin/discipline',
  }))
  if (payload.notifyParent) {
    notificationRows.push(...disciplineCase.student.parentLinks.map((link: any) => ({
      userId: link.parent.id, title: 'Student discipline update', message: payload.parentMessage ?? notificationMessage, type: 'WARNING' as const, link: '/portal/parent/notifications',
    })))
  }
  if (payload.notifyStudent) {
    notificationRows.push({
      userId: disciplineCase.student.user.id, title: 'Discipline follow-up', message: payload.studentMessage ?? notificationMessage, type: 'WARNING' as const, link: '/portal/student/dashboard',
    })
  }
  if (notificationRows.length) await prisma.notification.createMany({ data: notificationRows })
  if (payload.notifyParent) {
    const subject = `KCS discipline update - ${disciplineCase.category}`
    const body = payload.parentMessage ?? notificationMessage
    for (const link of disciplineCase.student.parentLinks as any[]) {
      const linkedParent = link.parent
      const recipientName = [linkedParent.lastName, linkedParent.middleName, linkedParent.firstName].filter(Boolean).join(' ')
      await prisma.correspondenceLog.create({
        data: asPrismaData({
          channel: 'EMAIL', status: linkedParent.email ? 'QUEUED' : 'FAILED', subject, body,
          senderId: actorId, recipientName, recipientEmail: linkedParent.email,
          recipientPhone: linkedParent.phone ?? undefined, studentId: disciplineCase.studentId,
          disciplineCaseId: disciplineCase.id,
          failureReason: linkedParent.email ? undefined : 'RECIPIENT_EMAIL_MISSING',
          metadata: linkedParent.email ? { mailQueueVersion: 1, attempts: 0, nextAttemptAt: now.toISOString(), recipientId: linkedParent.id } : undefined,
        }),
      })
      const sms = await sendSchoolSms(linkedParent.phone, `${subject}\n\n${body}`, { brand: false })
      await prisma.correspondenceLog.create({
        data: asPrismaData({
          channel: 'TEXT', status: sms.sent ? 'SENT' : 'FAILED', subject, body,
          senderId: actorId, recipientName, recipientEmail: linkedParent.email,
          recipientPhone: linkedParent.phone ?? undefined, studentId: disciplineCase.studentId,
          disciplineCaseId: disciplineCase.id, sentAt: sms.sent ? now : undefined,
          failureReason: sms.sent ? undefined : (sms.reason ?? 'SMS_DELIVERY_FAILED'),
        }),
      })
    }
  }


  return success(res, { disciplineCase, correspondenceLogs: logs }, 'Discipline case recorded', 201)
}))

schoolManagementRouter.patch('/discipline-cases/:id/resolution', requireRoles('admin', 'staff', 'teacher'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const disciplineCaseId = getRouteParam(req.params.id)
  const payload = disciplineSchema.partial().extend({
    status: enumValue(['OPEN', 'INVESTIGATING', 'PARENT_CONTACTED', 'RESOLVED', 'ESCALATED']),
  }).parse(req.body)
  const actorId = await resolveActorId(req)

  const disciplineCase = await prisma.disciplineCase.update({
    where: { id: disciplineCaseId },
    data: asPrismaData({
      resolvedById: payload.status === 'RESOLVED' ? actorId : undefined,
      resolution: payload.resolution,
      actionTaken: payload.actionTaken,
      gradeImpact: payload.gradeImpact,
      status: payload.status,
    }),
  })

  return success(res, disciplineCase, 'Discipline resolution updated')
}))
