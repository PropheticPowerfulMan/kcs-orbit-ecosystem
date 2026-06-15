import { Router } from 'express'
import {
  DiagnosticDecision,
  DiagnosticDifficulty,
  DiagnosticQuestionType,
  DiagnosticSubject,
  DiagnosticTestStatus,
  Prisma,
} from '@prisma/client'
import { z } from 'zod'
import { prisma } from '../config/prisma.js'
import { authenticate, requireRoles } from '../middleware/auth.js'
import type { AuthenticatedRequest } from '../middleware/auth.js'
import { ApiError, asyncHandler, success } from '../utils/api.js'
import { getRouteParam } from '../utils/request.js'
import {
  buildDiagnosticAiRecommendation,
  buildDiagnosticReport,
  gradeDiagnosticSubmission,
} from '../services/diagnostic.service.js'

export const diagnosticRouter = Router()

const questionSchema = z.object({
  questionText: z.string().min(3),
  questionType: z.nativeEnum(DiagnosticQuestionType),
  options: z.any().optional(),
  correctAnswer: z.any().optional(),
  points: z.number().positive().default(1),
  difficulty: z.nativeEnum(DiagnosticDifficulty).default(DiagnosticDifficulty.MEDIUM),
  competencyTag: z.string().min(2),
  explanation: z.string().optional(),
  order: z.number().int().min(0).optional(),
})

const testSchema = z.object({
  title: z.string().min(3),
  subject: z.nativeEnum(DiagnosticSubject),
  gradeLevel: z.string().min(1),
  academicYear: z.string().min(4),
  durationMinutes: z.number().int().positive().optional(),
  passingScore: z.number().min(0).max(100).default(70),
  competencies: z.array(z.string()).default([]),
  questions: z.array(questionSchema).default([]),
})

const assignmentSchema = z.object({
  studentId: z.string().optional(),
  enrollmentApplicationId: z.string().optional(),
  applicantName: z.string().optional(),
  applicantEmail: z.string().email().optional(),
  dueAt: z.coerce.date().optional(),
}).refine((value) => value.studentId || value.enrollmentApplicationId || value.applicantName, {
  message: 'studentId, enrollmentApplicationId, or applicantName is required',
})

const startSchema = z.object({
  testId: z.string().min(1),
  assignmentId: z.string().optional(),
  studentId: z.string().optional(),
  enrollmentApplicationId: z.string().optional(),
  applicantName: z.string().optional(),
})

const submitSchema = z.object({
  answers: z.array(z.object({ questionId: z.string().min(1), answer: z.any() })),
})

const approvalSchema = z.object({
  decision: z.nativeEnum(DiagnosticDecision).optional(),
  comment: z.string().optional(),
})

diagnosticRouter.use(authenticate)

diagnosticRouter.get('/diagnostic-tests', requireRoles('teacher', 'staff', 'admin'), asyncHandler(async (req, res) => {
  const tests = await prisma.diagnosticTest.findMany({
    where: {
      ...(typeof req.query.gradeLevel === 'string' ? { gradeLevel: req.query.gradeLevel } : {}),
      ...(typeof req.query.subject === 'string' && req.query.subject in DiagnosticSubject ? { subject: req.query.subject as DiagnosticSubject } : {}),
      ...(typeof req.query.status === 'string' && req.query.status in DiagnosticTestStatus ? { status: req.query.status as DiagnosticTestStatus } : {}),
    },
    include: { questions: { orderBy: { order: 'asc' } }, assignments: true, submissions: true },
    orderBy: { updatedAt: 'desc' },
  })
  return success(res, tests)
}))

diagnosticRouter.post('/diagnostic-tests', requireRoles('teacher', 'staff', 'admin'), asyncHandler(async (req, res) => {
  const payload = testSchema.parse(req.body)
  const user = (req as AuthenticatedRequest).user
  const teacher = user?.role === 'teacher'
    ? await prisma.teacherProfile.findFirst({ where: { userId: user.sub } })
    : null
  const test = await prisma.diagnosticTest.create({
    data: {
      title: payload.title,
      subject: payload.subject,
      gradeLevel: payload.gradeLevel,
      academicYear: payload.academicYear,
      durationMinutes: payload.durationMinutes,
      passingScore: payload.passingScore,
      competencies: payload.competencies,
      createdByTeacherId: teacher?.id,
      createdByUserId: user?.sub,
      questions: { create: payload.questions.map((question, index) => ({ ...question, order: question.order ?? index + 1 })) },
    },
    include: { questions: { orderBy: { order: 'asc' } } },
  })
  return success(res, test, 'Diagnostic test created', 201)
}))

diagnosticRouter.get('/diagnostic-tests/:id', requireRoles('teacher', 'staff', 'admin', 'student'), asyncHandler(async (req, res) => {
  const id = getRouteParam(req.params.id)
  const test = await prisma.diagnosticTest.findUnique({
    where: { id },
    include: { questions: { orderBy: { order: 'asc' } }, assignments: true, submissions: true },
  })
  if (!test) throw new ApiError(404, 'Diagnostic test not found')
  return success(res, test)
}))

diagnosticRouter.put('/diagnostic-tests/:id', requireRoles('teacher', 'staff', 'admin'), asyncHandler(async (req, res) => {
  const id = getRouteParam(req.params.id)
  const payload = testSchema.partial().parse(req.body)
  const test = await prisma.diagnosticTest.update({
    where: { id },
    data: {
      title: payload.title,
      subject: payload.subject,
      gradeLevel: payload.gradeLevel,
      academicYear: payload.academicYear,
      durationMinutes: payload.durationMinutes,
      passingScore: payload.passingScore,
      competencies: payload.competencies,
    },
    include: { questions: { orderBy: { order: 'asc' } } },
  })
  return success(res, test, 'Diagnostic test updated')
}))

diagnosticRouter.delete('/diagnostic-tests/:id', requireRoles('teacher', 'staff', 'admin'), asyncHandler(async (req, res) => {
  await prisma.diagnosticTest.delete({ where: { id: getRouteParam(req.params.id) } })
  return success(res, { deleted: true }, 'Diagnostic test deleted')
}))

diagnosticRouter.post('/diagnostic-tests/:id/publish', requireRoles('teacher', 'staff', 'admin'), asyncHandler(async (req, res) => {
  const test = await prisma.diagnosticTest.update({
    where: { id: getRouteParam(req.params.id) },
    data: { status: DiagnosticTestStatus.PUBLISHED },
    include: { questions: true },
  })
  return success(res, test, 'Diagnostic test published')
}))

diagnosticRouter.post('/diagnostic-tests/:id/assign', requireRoles('teacher', 'staff', 'admin'), asyncHandler(async (req, res) => {
  const testId = getRouteParam(req.params.id)
  const payload = assignmentSchema.parse(req.body)
  const application = payload.enrollmentApplicationId
    ? await prisma.admissionApplication.findUnique({ where: { id: payload.enrollmentApplicationId } })
    : null
  const assignment = await prisma.diagnosticAssignment.create({
    data: {
      testId,
      studentId: payload.studentId,
      enrollmentApplicationId: payload.enrollmentApplicationId,
      applicantName: payload.applicantName ?? (application ? `${application.firstName} ${application.lastName}` : undefined),
      applicantEmail: payload.applicantEmail ?? application?.parentEmail,
      assignedById: (req as AuthenticatedRequest).user?.sub,
      dueAt: payload.dueAt,
    },
    include: { test: true, student: { include: { user: true } }, enrollmentApplication: true },
  })
  await prisma.diagnosticTest.update({ where: { id: testId }, data: { status: DiagnosticTestStatus.ASSIGNED } })
  return success(res, assignment, 'Diagnostic test assigned', 201)
}))

diagnosticRouter.get('/diagnostic-submissions', requireRoles('teacher', 'staff', 'admin', 'student'), asyncHandler(async (req, res) => {
  const user = (req as AuthenticatedRequest).user
  const submissions = await prisma.diagnosticSubmission.findMany({
    where: {
      ...(user?.role === 'student' ? { student: { userId: user.sub } } : {}),
      ...(typeof req.query.status === 'string' && req.query.status in DiagnosticTestStatus ? { status: req.query.status as DiagnosticTestStatus } : {}),
    },
    include: { test: true, student: { include: { user: true } }, enrollmentApplication: true, approvals: true },
    orderBy: { updatedAt: 'desc' },
  })
  return success(res, submissions)
}))

diagnosticRouter.post('/diagnostic-submissions/start', requireRoles('student', 'staff', 'admin'), asyncHandler(async (req, res) => {
  const payload = startSchema.parse(req.body)
  const submission = await prisma.diagnosticSubmission.create({
    data: {
      testId: payload.testId,
      assignmentId: payload.assignmentId,
      studentId: payload.studentId,
      enrollmentApplicationId: payload.enrollmentApplicationId,
      applicantName: payload.applicantName,
      status: DiagnosticTestStatus.IN_PROGRESS,
    },
    include: { test: { include: { questions: { orderBy: { order: 'asc' } } } } },
  })
  if (payload.assignmentId) {
    await prisma.diagnosticAssignment.update({ where: { id: payload.assignmentId }, data: { status: DiagnosticTestStatus.IN_PROGRESS } })
  }
  return success(res, submission, 'Diagnostic submission started', 201)
}))

diagnosticRouter.post('/diagnostic-submissions/:id/submit', requireRoles('student', 'staff', 'admin'), asyncHandler(async (req, res) => {
  const id = getRouteParam(req.params.id)
  const payload = submitSchema.parse(req.body)
  const submission = await prisma.diagnosticSubmission.findUnique({
    where: { id },
    include: { test: { include: { questions: { orderBy: { order: 'asc' } } } } },
  })
  if (!submission) throw new ApiError(404, 'Diagnostic submission not found')
  const cohortRows = await prisma.diagnosticSubmission.findMany({
    where: { testId: submission.testId, status: { in: [DiagnosticTestStatus.AUTO_GRADED, DiagnosticTestStatus.PENDING_SUPER_ADMIN_APPROVAL, DiagnosticTestStatus.APPROVED] } },
    select: { percentage: true },
  })
  const submittedAt = new Date()
  const result = gradeDiagnosticSubmission({
    questions: submission.test.questions,
    answers: payload.answers.map((answer) => ({ questionId: answer.questionId, answer: answer.answer })),
    startedAt: submission.startedAt,
    submittedAt,
    cohortPercentages: cohortRows.map((row) => row.percentage),
  })
  const aiRecommendation = buildDiagnosticAiRecommendation({
    subject: submission.test.subject,
    gradeLevel: submission.test.gradeLevel,
    percentage: result.percentage,
    masteryLevel: result.masteryLevel,
    strengths: result.strengths,
    weaknesses: result.weaknesses,
  })
  await prisma.diagnosticAnswer.deleteMany({ where: { submissionId: id } })
  const updated = await prisma.diagnosticSubmission.update({
    where: { id },
    data: {
      submittedAt,
      answersJson: payload.answers,
      autoScore: result.score,
      percentage: result.percentage,
      status: DiagnosticTestStatus.PENDING_SUPER_ADMIN_APPROVAL,
      statistics: result as unknown as Prisma.InputJsonValue,
      aiRecommendation: aiRecommendation as unknown as Prisma.InputJsonValue,
      superAdminDecision: result.suggestedAcademicDecision,
      answers: {
        create: result.gradedAnswers.map((answer) => ({
          questionId: answer.questionId,
          answer: answer.answer as Prisma.InputJsonValue,
          isCorrect: answer.isCorrect,
          pointsAwarded: answer.pointsAwarded,
          feedback: answer.feedback,
        })),
      },
    },
    include: { test: true, answers: true, enrollmentApplication: true },
  })
  await prisma.diagnosticAnalyticsSnapshot.create({
    data: {
      submissionId: id,
      enrollmentApplicationId: updated.enrollmentApplicationId,
      summaryJson: { result, aiRecommendation } as Prisma.InputJsonValue,
    },
  })
  if (updated.assignmentId) {
    await prisma.diagnosticAssignment.update({ where: { id: updated.assignmentId }, data: { status: DiagnosticTestStatus.SUBMITTED } })
  }
  return success(res, updated, 'Diagnostic submission auto-graded')
}))

diagnosticRouter.get('/diagnostic-submissions/:id/report', requireRoles('teacher', 'staff', 'admin', 'student', 'parent'), asyncHandler(async (req, res) => {
  const report = await buildDiagnosticReport(getRouteParam(req.params.id))
  if (!report) throw new ApiError(404, 'Diagnostic report not found')
  return success(res, report)
}))

diagnosticRouter.post('/diagnostic-submissions/:id/approve', requireRoles('admin'), asyncHandler(async (req, res) => {
  const id = getRouteParam(req.params.id)
  const payload = approvalSchema.parse(req.body)
  const user = (req as AuthenticatedRequest).user
  const updated = await prisma.diagnosticSubmission.update({
    where: { id },
    data: {
      status: DiagnosticTestStatus.APPROVED,
      superAdminDecision: payload.decision ?? DiagnosticDecision.ACCEPT_WITH_REMEDIATION,
      finalComment: payload.comment,
      approvedById: user?.sub,
      approvedAt: new Date(),
      approvals: { create: { actorId: user?.sub, action: DiagnosticTestStatus.APPROVED, decision: payload.decision, comment: payload.comment } },
    },
  })
  return success(res, updated, 'Diagnostic report approved')
}))

diagnosticRouter.post('/diagnostic-submissions/:id/reject', requireRoles('admin'), asyncHandler(async (req, res) => {
  const id = getRouteParam(req.params.id)
  const payload = approvalSchema.parse(req.body)
  const user = (req as AuthenticatedRequest).user
  const updated = await prisma.diagnosticSubmission.update({
    where: { id },
    data: {
      status: DiagnosticTestStatus.REJECTED,
      finalComment: payload.comment,
      approvals: { create: { actorId: user?.sub, action: DiagnosticTestStatus.REJECTED, decision: payload.decision ?? DiagnosticDecision.REJECT, comment: payload.comment } },
    },
  })
  return success(res, updated, 'Diagnostic report rejected')
}))

diagnosticRouter.post('/diagnostic-submissions/:id/request-retake', requireRoles('admin'), asyncHandler(async (req, res) => {
  const id = getRouteParam(req.params.id)
  const payload = approvalSchema.parse(req.body)
  const user = (req as AuthenticatedRequest).user
  const updated = await prisma.diagnosticSubmission.update({
    where: { id },
    data: {
      status: DiagnosticTestStatus.RETAKE_REQUESTED,
      finalComment: payload.comment,
      approvals: { create: { actorId: user?.sub, action: DiagnosticTestStatus.RETAKE_REQUESTED, decision: DiagnosticDecision.RETAKE_TEST, comment: payload.comment } },
    },
  })
  return success(res, updated, 'Diagnostic retake requested')
}))

diagnosticRouter.get('/diagnostic-analytics', requireRoles('teacher', 'staff', 'admin'), asyncHandler(async (_req, res) => {
  const submissions = await prisma.diagnosticSubmission.findMany({ include: { test: true } })
  const bySubject = Object.values(DiagnosticSubject).map((subject) => {
    const rows = submissions.filter((submission) => submission.test.subject === subject)
    const average = rows.length ? rows.reduce((sum, row) => sum + row.percentage, 0) / rows.length : 0
    return { subject, count: rows.length, average: Math.round(average * 100) / 100 }
  })
  const pendingApproval = submissions.filter((row) => row.status === DiagnosticTestStatus.PENDING_SUPER_ADMIN_APPROVAL).length
  return success(res, { totalSubmissions: submissions.length, pendingApproval, bySubject })
}))

diagnosticRouter.get('/enrollment-applications/:id/diagnostic-report', requireRoles('staff', 'admin'), asyncHandler(async (req, res) => {
  const enrollmentApplicationId = getRouteParam(req.params.id)
  const reports = await prisma.diagnosticSubmission.findMany({
    where: { enrollmentApplicationId },
    include: { test: true, analyticsSnapshots: { orderBy: { generatedAt: 'desc' }, take: 1 }, approvals: true },
    orderBy: { updatedAt: 'desc' },
  })
  return success(res, reports)
}))
