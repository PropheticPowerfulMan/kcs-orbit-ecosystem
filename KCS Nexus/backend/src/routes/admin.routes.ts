import { Router } from 'express'
import { prisma } from '../config/prisma.js'
import { authenticate, requireRoles, type AuthenticatedRequest } from '../middleware/auth.js'
import { asyncHandler, success } from '../utils/api.js'

export const adminRouter = Router()

adminRouter.get('/staff-overview', authenticate, requireRoles('admin', 'staff'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const [students, applications, unreadMessages, reportCards, recentActivity, announcements, incidents] = await Promise.all([
    prisma.studentProfile.findMany({ select: { id: true, grade: true, section: true, status: true, attendanceRecords: { select: { status: true } } } }),
    prisma.admissionApplication.findMany({ orderBy: { submittedAt: 'desc' }, take: 25, select: { id: true, applicationNumber: true, firstName: true, middleName: true, lastName: true, gradeApplying: true, parentName: true, status: true, submittedAt: true } }),
    prisma.internalMessage.count({ where: { readAt: null, OR: [{ recipientId: req.user!.sub }, { targetRole: 'STAFF' }] } }),
    prisma.reportCard.findMany({ orderBy: { updatedAt: 'desc' }, take: 20, select: { id: true, term: true, average: true, principalStatus: true, publicationStatus: true, updatedAt: true, student: { select: { studentNumber: true, user: { select: { firstName: true, lastName: true } } } } } }),
    prisma.auditLog.findMany({ where: { actorId: req.user!.sub }, orderBy: { createdAt: 'desc' }, take: 20, select: { id: true, action: true, targetType: true, targetId: true, createdAt: true } }),
    prisma.newsPost.findMany({ orderBy: { publishedAt: 'desc' }, take: 12, select: { id: true, title: true, excerpt: true, category: true, publishedAt: true } }),
    prisma.incidentReport.count({ where: { status: { not: 'CLOSED' } } }),
  ])
  const attendanceByClass = [...new Set(students.map((student) => student.grade))].map((grade) => {
    const records = students.filter((student) => student.grade === grade).flatMap((student) => student.attendanceRecords)
    const present = records.filter((record) => ['PRESENT', 'LATE', 'EXCUSED'].includes(record.status)).length
    return { label: grade, attendance: records.length ? Math.round((present / records.length) * 100) : null, evidence: records.length }
  })
  return success(res, {
    stats: {
      localStudents: students.length,
      pendingMessages: unreadMessages,
      admissionTasks: applications.filter((item) => ['SUBMITTED', 'UNDER_REVIEW', 'INTERVIEW_SCHEDULED'].includes(item.status)).length,
      pendingReports: reportCards.filter((item) => item.principalStatus !== 'APPROVED').length,
      openIncidents: incidents,
    },
    attendanceByClass,
    applications,
    reportCards,
    announcements,
    recentActivity,
    generatedAt: new Date().toISOString(),
  }, 'Administrator overview loaded')
}))
adminRouter.use(authenticate, requireRoles('admin'))

adminRouter.get('/overview', asyncHandler(async (_req, res) => {
  const now = new Date()
  const eightMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 7, 1)
  const [students, teachers, courses, applications, events, incidents, audits] = await Promise.all([
    prisma.studentProfile.findMany({ select: { id: true, grade: true, section: true, gpa: true, attendanceRate: true, enrollmentDate: true } }),
    prisma.teacherProfile.findMany({ select: { id: true, department: true, user: { select: { firstName: true, lastName: true } }, courses: { select: { id: true } } } }),
    prisma.course.findMany({ select: { id: true, name: true, grade: true, grades: { select: { percentage: true } } } }),
    prisma.admissionApplication.findMany({ where: { submittedAt: { gte: eightMonthsAgo } }, select: { status: true, submittedAt: true } }),
    prisma.event.findMany({ where: { endDate: { gte: now } }, orderBy: { startDate: 'asc' }, take: 8 }),
    prisma.incidentReport.findMany({ where: { status: { not: 'CLOSED' } }, select: { id: true, status: true } }),
    prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 8, select: { id: true, action: true, targetType: true, createdAt: true, actor: { select: { firstName: true, lastName: true } } } }),
  ])
  const monthKeys = Array.from({ length: 8 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 7 + index, 1)
    return { key: String(date.getFullYear()) + '-' + String(date.getMonth()), month: date.toLocaleString('en-US', { month: 'short' }) }
  })
  const enrollmentTrend = monthKeys.map(({ key, month }) => ({
    month,
    students: students.filter((student) => String(student.enrollmentDate.getFullYear()) + '-' + String(student.enrollmentDate.getMonth()) === key).length,
    applications: applications.filter((application) => String(application.submittedAt.getFullYear()) + '-' + String(application.submittedAt.getMonth()) === key).length,
  }))
  const atRisk = students.filter((student) => (student.attendanceRate != null && student.attendanceRate < 85) || (student.gpa != null && student.gpa < 2))
  const departmentMap = new Map<string, number[]>()
  courses.forEach((course) => {
    const values = departmentMap.get(course.grade) ?? []
    values.push(...course.grades.map((grade) => grade.percentage))
    departmentMap.set(course.grade, values)
  })
  return success(res, {
    stats: {
      localStudents: students.length,
      teachers: teachers.length,
      courses: courses.length,
      classes: new Set(students.map((student) => (student.grade + ' ' + student.section).trim())).size,
      openApplications: applications.filter((application) => ['SUBMITTED', 'UNDER_REVIEW'].includes(application.status)).length,
      riskAlerts: atRisk.length,
      liveEvents: events.filter((event) => event.liveStreamEnabled && event.liveStreamStatus === 'live').length,
      openIncidents: incidents.length,
    },
    enrollmentTrend,
    departmentPerformance: [...departmentMap.entries()].map(([name, values]) => ({ name, score: values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0 })),
    events: events.map((event) => ({ id: event.id, title: event.title, status: event.liveStreamStatus, platform: event.liveStreamPlatform, startsAt: event.liveStreamStartsAt ?? event.startDate, location: event.location })),
    risks: [
      ...(atRisk.length ? [{ title: 'Academic follow-up', description: String(atRisk.length) + ' student(s) are below the GPA or attendance threshold.', level: 'high' }] : []),
      ...(incidents.length ? [{ title: 'Open incident reports', description: String(incidents.length) + ' incident report(s) require administrative follow-up.', level: 'medium' }] : []),
    ],
    teacherLoad: teachers.map((teacher) => ({ id: teacher.id, teacher: (teacher.user.firstName + ' ' + teacher.user.lastName).trim(), department: teacher.department, courses: teacher.courses.length })),
    recentActivity: audits.map((audit) => ({ id: audit.id, action: audit.action, targetType: audit.targetType, actor: audit.actor ? (audit.actor.firstName + ' ' + audit.actor.lastName).trim() : 'System', createdAt: audit.createdAt })),
    generatedAt: now.toISOString(),
  }, 'Super Admin overview loaded')
}))
adminRouter.get('/stats', asyncHandler(async (_req, res) => {
  const [students, teachers, applications, media, news, events, liveEvents] = await Promise.all([
    prisma.studentProfile.count(),
    prisma.teacherProfile.count(),
    prisma.admissionApplication.count({ where: { status: 'SUBMITTED' } }),
    prisma.mediaItem.count(),
    prisma.newsPost.count(),
    prisma.event.count(),
    prisma.event.count({ where: { liveStreamEnabled: true } }),
  ])

  return success(res, {
    students,
    teachers,
    openApplications: applications,
    mediaItems: media,
    publishedNews: news,
    scheduledEvents: events,
    liveEvents,
  })
}))

adminRouter.get('/analytics', asyncHandler(async (_req, res) => {
  const [recentApplications, recentNews, riskRecommendations] = await Promise.all([
    prisma.admissionApplication.findMany({ take: 5, orderBy: { submittedAt: 'desc' } }),
    prisma.newsPost.findMany({ take: 5, orderBy: { publishedAt: 'desc' } }),
    prisma.aIRecommendation.findMany({ take: 5, orderBy: { createdAt: 'desc' } }),
  ])

  return success(res, {
    recentApplications,
    recentNews,
    riskRecommendations,
    generatedAt: new Date().toISOString(),
  })
}))

adminRouter.get('/export/:type', asyncHandler(async (req, res) => {
  const content = `KCS Nexus export generated for ${req.params.type} at ${new Date().toISOString()}`
  res.setHeader('Content-Type', 'text/plain')
  res.setHeader('Content-Disposition', `attachment; filename=${req.params.type}-export.txt`)
  res.send(content)
}))
