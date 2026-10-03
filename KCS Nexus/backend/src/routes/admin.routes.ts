import { Router } from 'express'
import { prisma } from '../config/prisma.js'
import { authenticate, requireRoles, type AuthenticatedRequest } from '../middleware/auth.js'
import { ApiError, asyncHandler, success } from '../utils/api.js'
import * as XLSX from 'xlsx'

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
    workflow: {
      admissions: { submitted: applications.filter((item) => item.status === 'SUBMITTED').length, underReview: applications.filter((item) => item.status === 'UNDER_REVIEW').length, interviews: applications.filter((item) => item.status === 'INTERVIEW_SCHEDULED').length, actionable: applications.filter((item) => ['SUBMITTED','UNDER_REVIEW','INTERVIEW_SCHEDULED'].includes(item.status)).length },
      reports: { pending: reportCards.filter((item) => item.principalStatus !== 'APPROVED').length, approved: reportCards.filter((item) => item.principalStatus === 'APPROVED').length, published: reportCards.filter((item) => ['EMAILED','POSTED_TO_PORTAL'].includes(item.publicationStatus)).length },
      attendance: { totalClasses: attendanceByClass.length, classesWithEvidence: attendanceByClass.filter((item) => item.evidence > 0).length, records: attendanceByClass.reduce((sum,item) => sum + item.evidence, 0) },
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
    prisma.teacherProfile.findMany({ where: { user: { role: 'TEACHER' } }, select: { id: true, department: true, user: { select: { firstName: true, lastName: true } }, courses: { select: { id: true } } } }),
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

adminRouter.get('/analytics', asyncHandler(async (req, res) => {
  const period = String(req.query.period || '30d')
  const days = period === '7d' ? 7 : period === '90d' ? 90 : period === '365d' ? 365 : 30
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const [
    students, parents, teachers, staff, administrators, courses, grades, attendance, applications,
    forumPosts, forumComments, studentForumPosts, messages, notifications,
    correspondence, recommendations, incidents, audits,
  ] = await Promise.all([
    prisma.studentProfile.count(),
    prisma.user.count({ where: { role: 'PARENT' } }),
    prisma.user.count({ where: { role: 'TEACHER' } }),
    prisma.user.count({ where: { role: 'STAFF' } }),
    prisma.user.count({ where: { role: 'ADMIN' } }),
    prisma.course.count(),
    prisma.grade.aggregate({ where: { createdAt: { gte: since } }, _count: true, _avg: { percentage: true } }),
    prisma.attendanceRecord.groupBy({ by: ['status'], where: { date: { gte: since } }, _count: true }),
    prisma.admissionApplication.groupBy({ by: ['status'], where: { submittedAt: { gte: since } }, _count: true }),
    prisma.parentForumPost.count({ where: { createdAt: { gte: since } } }),
    prisma.parentForumComment.count({ where: { createdAt: { gte: since } } }),
    prisma.studentForumPost.count({ where: { createdAt: { gte: since } } }),
    prisma.internalMessage.count({ where: { createdAt: { gte: since } } }),
    prisma.notification.count({ where: { createdAt: { gte: since } } }),
    prisma.correspondenceLog.groupBy({ by: ['channel', 'status'], where: { createdAt: { gte: since } }, _count: true }),
    prisma.aIRecommendation.findMany({ where: { createdAt: { gte: since } }, orderBy: { createdAt: 'desc' }, take: 8, select: { id: true, title: true, description: true, riskLevel: true, createdAt: true, student: { select: { studentNumber: true, user: { select: { firstName: true, middleName: true, lastName: true } } } } } }),
    prisma.incidentReport.count({ where: { createdAt: { gte: since }, status: { not: 'CLOSED' } } }),
    prisma.auditLog.count({ where: { createdAt: { gte: since } } }),
  ])
  const attendanceMap = Object.fromEntries(attendance.map((row) => [row.status, row._count]))
  const attendanceTotal = attendance.reduce((sum, row) => sum + row._count, 0)
  const present = (attendanceMap.PRESENT || 0) + (attendanceMap.LATE || 0) + (attendanceMap.EXCUSED || 0)
  const delivery = correspondence.map((row) => ({ channel: row.channel, status: row.status, count: row._count }))
  const emailQueued = delivery.filter((row) => row.channel === 'EMAIL' && row.status === 'QUEUED').reduce((sum, row) => sum + row.count, 0)
  const emailSent = delivery.filter((row) => row.channel === 'EMAIL' && ['SENT','DELIVERED'].includes(row.status)).reduce((sum, row) => sum + row.count, 0)
  const emailFailed = delivery.filter((row) => row.channel === 'EMAIL' && row.status === 'FAILED').reduce((sum, row) => sum + row.count, 0)
  const risks = [
    ...(attendanceTotal && present / attendanceTotal < 0.85 ? [{ level: 'high', title: 'Attendance below target', detail: Math.round(present / attendanceTotal * 100) + '% attendance over the selected period.' }] : []),
    ...(emailFailed ? [{ level: 'medium', title: 'Email delivery failures', detail: emailFailed + ' email delivery failure(s) require review.' }] : []),
    ...(incidents ? [{ level: 'medium', title: 'Open incidents', detail: incidents + ' open incident(s) in the selected period.' }] : []),
    ...recommendations.slice(0, 5).map((item) => ({ level: item.riskLevel, title: item.title, detail: item.description })),
  ]
  return success(res, {
    period: { key: period, days, from: since.toISOString(), to: new Date().toISOString() },
    population: { students, parents, teachers, staff, administrators, courses },
    academics: { gradedItems: grades._count, averagePercentage: grades._avg.percentage == null ? null : Number(grades._avg.percentage.toFixed(1)) },
    attendance: { total: attendanceTotal, present: attendanceMap.PRESENT || 0, absent: attendanceMap.ABSENT || 0, late: attendanceMap.LATE || 0, excused: attendanceMap.EXCUSED || 0, rate: attendanceTotal ? Number((present / attendanceTotal * 100).toFixed(1)) : null },
    engagement: { parentForumPosts: forumPosts, parentForumComments: forumComments, studentForumPosts, internalMessages: messages, notifications },
    communications: { delivery, emailQueued, emailSent, emailFailed, workerCapacityPerHour: 180 },
    admissions: applications.map((row) => ({ status: row.status, count: row._count })),
    risks,
    evidence: { auditEvents: audits, openIncidents: incidents, recommendations: recommendations.length },
    generatedAt: new Date().toISOString(),
  })
}))

const safeSpreadsheetValue = (value: unknown) => {
  if (value == null) return ''
  const text = value instanceof Date ? value.toISOString() : String(value)
  return /^[=+\-@]/.test(text) ? "'" + text : text
}

const exportRows = (rows: Record<string, unknown>[]) => rows.map((row) =>
  Object.fromEntries(Object.entries(row).map(([key, value]) => [key, safeSpreadsheetValue(value)])),
)

const xmlEscape = (value: unknown) => String(value ?? '').replace(/[<>&"']/g, (character) => ({
  '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;',
})[character] || character)

adminRouter.get('/export/:type', authenticate, requireRoles('admin'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const type = String(req.params.type || '').toLowerCase()
  if (!['xlsx', 'xml'].includes(type)) throw new ApiError(400, 'Supported export formats are xlsx and xml.')

  const [users, students, teachers, courses, enrollments, attendance, grades, reportCards, admissions, messages, audits] = await Promise.all([
    prisma.user.findMany({ select: { id: true, email: true, accessCode: true, firstName: true, middleName: true, lastName: true, role: true, staffFunction: true, phone: true, accountBlockedAt: true, createdAt: true }, orderBy: [{ role: 'asc' }, { lastName: 'asc' }] }),
    prisma.studentProfile.findMany({ select: { id: true, studentNumber: true, grade: true, section: true, status: true, enrollmentDate: true, gpa: true, attendanceRate: true, user: { select: { firstName: true, middleName: true, lastName: true, email: true, phone: true } } }, orderBy: [{ grade: 'asc' }, { studentNumber: 'asc' }] }),
    prisma.teacherProfile.findMany({ select: { id: true, employeeNumber: true, department: true, qualification: true, user: { select: { firstName: true, middleName: true, lastName: true, email: true, phone: true } } } }),
    prisma.course.findMany({ select: { id: true, code: true, name: true, grade: true, credits: true, teacher: { select: { employeeNumber: true, user: { select: { firstName: true, middleName: true, lastName: true } } } } } }),
    prisma.enrollment.findMany({ select: { createdAt: true, course: { select: { code: true, name: true, grade: true } }, student: { select: { studentNumber: true, grade: true, section: true, user: { select: { firstName: true, middleName: true, lastName: true } } } } } }),
    prisma.attendanceRecord.findMany({ select: { date: true, className: true, period: true, subject: true, status: true, student: { select: { studentNumber: true, user: { select: { firstName: true, middleName: true, lastName: true } } } }, recordedBy: { select: { firstName: true, lastName: true } } }, orderBy: { date: 'desc' } }),
    prisma.grade.findMany({ select: { score: true, maxScore: true, percentage: true, letterGrade: true, period: true, createdAt: true, student: { select: { studentNumber: true, user: { select: { firstName: true, middleName: true, lastName: true } } } }, course: { select: { code: true, name: true } } }, orderBy: { createdAt: 'desc' } }),
    prisma.reportCard.findMany({ select: { term: true, average: true, conduct: true, teacherComment: true, principalStatus: true, publicationStatus: true, approvedAt: true, updatedAt: true, student: { select: { studentNumber: true, grade: true, section: true, user: { select: { firstName: true, middleName: true, lastName: true } } } } }, orderBy: { updatedAt: 'desc' } }),
    prisma.admissionApplication.findMany({ select: { applicationNumber: true, firstName: true, middleName: true, lastName: true, gradeApplying: true, parentName: true, parentEmail: true, parentPhone: true, status: true, submittedAt: true, updatedAt: true }, orderBy: { submittedAt: 'desc' } }),
    prisma.internalMessage.findMany({ select: { id: true, subject: true, attachmentName: true, attachmentMime: true, attachmentSize: true, targetRole: true, readAt: true, priority: true, channel: true, createdAt: true, sender: { select: { firstName: true, lastName: true, email: true } }, recipient: { select: { firstName: true, lastName: true, email: true } } }, orderBy: { createdAt: 'desc' } }),
    prisma.auditLog.findMany({ select: { action: true, targetType: true, targetId: true, createdAt: true, actor: { select: { firstName: true, lastName: true, email: true } } }, orderBy: { createdAt: 'desc' }, take: 10000 }),
  ])

  const name = (person: { firstName?: string | null; middleName?: string | null; lastName?: string | null } | null | undefined) =>
    [person?.lastName, person?.middleName, person?.firstName].filter(Boolean).join(' ')

  const sheets: Record<string, Record<string, unknown>[]> = {
    Summary: [
      { Indicator: 'Generated at', Value: new Date().toISOString() },
      { Indicator: 'People', Value: users.length },
      { Indicator: 'Students', Value: students.length },
      { Indicator: 'Teachers', Value: teachers.length },
      { Indicator: 'Courses', Value: courses.length },
      { Indicator: 'Enrollments', Value: enrollments.length },
      { Indicator: 'Attendance records', Value: attendance.length },
      { Indicator: 'Grades', Value: grades.length },
      { Indicator: 'Report cards', Value: reportCards.length },
      { Indicator: 'Admissions', Value: admissions.length },
      { Indicator: 'Message metadata', Value: messages.length },
    ],
    People: users.map((item) => ({ ID: item.id, Role: item.role, Name: name(item), Email: item.email, AccessCode: item.accessCode, Phone: item.phone, Function: item.staffFunction, BlockedAt: item.accountBlockedAt, CreatedAt: item.createdAt })),
    Students: students.map((item) => ({ ID: item.id, StudentNumber: item.studentNumber, Name: name(item.user), Grade: item.grade, Section: item.section, Status: item.status, Email: item.user.email, Phone: item.user.phone, EnrolledAt: item.enrollmentDate, GPA: item.gpa, AttendanceRate: item.attendanceRate })),
    Teachers: teachers.map((item) => ({ ID: item.id, EmployeeNumber: item.employeeNumber, Name: name(item.user), Department: item.department, Qualification: item.qualification, Email: item.user.email, Phone: item.user.phone })),
    Courses: courses.map((item) => ({ ID: item.id, Code: item.code, Course: item.name, Grade: item.grade, Credits: item.credits, Teacher: name(item.teacher.user), TeacherNumber: item.teacher.employeeNumber })),
    Enrollments: enrollments.map((item) => ({ StudentNumber: item.student.studentNumber, Student: name(item.student.user), StudentGrade: item.student.grade, Section: item.student.section, CourseCode: item.course.code, Course: item.course.name, CourseGrade: item.course.grade, EnrolledAt: item.createdAt })),
    Attendance: attendance.map((item) => ({ Date: item.date, StudentNumber: item.student.studentNumber, Student: name(item.student.user), Class: item.className, Period: item.period, Subject: item.subject, Status: item.status, RecordedBy: name(item.recordedBy) })),
    Grades: grades.map((item) => ({ CreatedAt: item.createdAt, Period: item.period, StudentNumber: item.student.studentNumber, Student: name(item.student.user), CourseCode: item.course.code, Course: item.course.name, Score: item.score, Maximum: item.maxScore, Percentage: item.percentage, LetterGrade: item.letterGrade })),
    ReportCards: reportCards.map((item) => ({ UpdatedAt: item.updatedAt, StudentNumber: item.student.studentNumber, Student: name(item.student.user), Grade: item.student.grade, Section: item.student.section, Term: item.term, Average: item.average, Conduct: item.conduct, MainTeacherComment: item.teacherComment, PrincipalStatus: item.principalStatus, PublicationStatus: item.publicationStatus, ApprovedAt: item.approvedAt })),
    Admissions: admissions.map((item) => ({ ApplicationNumber: item.applicationNumber, Student: name(item), GradeApplying: item.gradeApplying, Parent: item.parentName, ParentEmail: item.parentEmail, ParentPhone: item.parentPhone, Status: item.status, SubmittedAt: item.submittedAt, UpdatedAt: item.updatedAt })),
    Communications: messages.map((item) => ({ ID: item.id, CreatedAt: item.createdAt, Subject: item.subject, Sender: name(item.sender), SenderEmail: item.sender?.email, Recipient: name(item.recipient), RecipientEmail: item.recipient?.email, TargetRole: item.targetRole, Channel: item.channel, Priority: item.priority, ReadAt: item.readAt, AttachmentName: item.attachmentName, AttachmentType: item.attachmentMime, AttachmentSize: item.attachmentSize })),
    AuditTrail: audits.map((item) => ({ CreatedAt: item.createdAt, Actor: name(item.actor), ActorEmail: item.actor?.email, Action: item.action, TargetType: item.targetType, TargetID: item.targetId })),
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const actorId = req.user?.sub === 'configured-superadmin' ? null : req.user?.sub
  await prisma.auditLog.create({ data: { actorId, action: 'admin.live_export_generated', targetType: 'school-data-export', targetId: type, metadata: { format: type, sheets: Object.keys(sheets), generatedAt: new Date().toISOString() } } })

  res.setHeader('Cache-Control', 'no-store, private')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  if (type === 'xlsx') {
    const workbook = XLSX.utils.book_new()
    for (const [sheetName, rows] of Object.entries(sheets)) {
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(exportRows(rows)), sheetName.slice(0, 31))
    }
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx', compression: true })
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', 'attachment; filename="kcs-live-school-data-' + timestamp + '.xlsx"')
    return res.send(buffer)
  }

  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<kcsSchoolData generatedAt="' + xmlEscape(new Date().toISOString()) + '">' +
    Object.entries(sheets).map(([sheetName, rows]) =>
      '<dataset name="' + xmlEscape(sheetName) + '">' + rows.map((row) =>
        '<record>' + Object.entries(row).map(([key, value]) => '<field name="' + xmlEscape(key) + '">' + xmlEscape(value instanceof Date ? value.toISOString() : value) + '</field>').join('') + '</record>'
      ).join('') + '</dataset>'
    ).join('') + '</kcsSchoolData>'
  res.setHeader('Content-Type', 'application/xml; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename="kcs-live-school-data-' + timestamp + '.xml"')
  return res.send(xml)
}))
