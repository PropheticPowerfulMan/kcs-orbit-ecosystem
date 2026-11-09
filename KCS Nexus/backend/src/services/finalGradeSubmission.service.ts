import { academicPeriodAccess, protectAcademicPeriod } from './academicPeriodAccess.service.js'
import { Prisma } from '@prisma/client'
import { prisma } from '../config/prisma.js'
import { ApiError } from '../utils/api.js'
import { academicPeriodKey, academicTermAliases } from '../utils/academicCycle.js'
import { aggregateReportCardResults, reportCardSourceTerms } from './annualReportCard.service.js'
import { attendanceWindow, attendanceWithSuspensions } from './reportAttendance.service.js'
import { summarizeAttendanceStatuses } from '../utils/attendancePolicy.js'
import { synchronizeStudentAcademicMetrics } from './academicSync.js'

type Submission = { courseId: string; academicYear: string; term: string; ungradedStudentIds?: string[]; results: Array<{ studentId: string; studentNumber?: string; percentage: number; comment?: string }> }
const letter = (value: number) => value >= 97 ? 'A+' : value >= 93 ? 'A' : value >= 90 ? 'A-' : value >= 87 ? 'B+' : value >= 83 ? 'B' : value >= 80 ? 'B-' : value >= 77 ? 'C+' : value >= 73 ? 'C' : value >= 70 ? 'C-' : value >= 67 ? 'D+' : value >= 63 ? 'D' : value >= 60 ? 'D-' : 'F'

export async function submitCourseFinalGrades(actorId: string, payload: Submission) {
  if (reportCardSourceTerms(payload.term).length > 1) throw new ApiError(400, 'Submit each quarter separately. Semester and annual report cards are calculated from those quarter submissions.')
  const window = await attendanceWindow(payload.academicYear, payload.term)
  await academicPeriodAccess()
  return prisma.$transaction(async tx => {
    await protectAcademicPeriod(tx, payload.academicYear, payload.term)
    await tx.$queryRaw(Prisma.sql`SELECT id FROM "Course" WHERE id = ${payload.courseId} FOR UPDATE`)
    const course = await tx.course.findUnique({ where: { id: payload.courseId }, include: { teacher: true, enrollments: { select: { studentId: true, student: { select: { studentNumber: true, user: { select: { orbitUserId: true } } } } } } } })
    if (!course) throw new ApiError(404, 'Course not found')
    if (course.teacher.userId !== actorId) throw new ApiError(403, 'Only the assigned teacher may submit these grades')
    const lookup = new Map<string, string>()
    for (const row of course.enrollments) for (const key of [row.studentId, row.student.studentNumber, row.student.user.orbitUserId]) if (key) lookup.set(key.trim().toLowerCase(), row.studentId)
    const results = payload.results.map(row => ({ ...row, studentId: [row.studentId, row.studentNumber].map(key => key ? lookup.get(key.trim().toLowerCase()) : undefined).find(Boolean) ?? row.studentId }))
    if (results.some(row => !course.enrollments.some(e => e.studentId === row.studentId))) throw new ApiError(400, 'A submitted student could not be matched to the official Nexus course enrollment')
    const ids = [...new Set(results.map(row => row.studentId))].sort()
    if (ids.length !== results.length) throw new ApiError(400, 'Duplicate student in submission after identity reconciliation')
    const ungradedIds = (payload.ungradedStudentIds ?? []).map(id => lookup.get(id.trim().toLowerCase()) ?? id)
    const covered = new Set([...ids, ...ungradedIds])
    if (new Set(ungradedIds).size !== ungradedIds.length || ungradedIds.some(id => ids.includes(id) || !course.enrollments.some(enrollment => enrollment.studentId === id))) throw new ApiError(400, 'Invalid or overlapping ungraded learner list')
    if (covered.size !== course.enrollments.length) throw new ApiError(409, 'The submission must account for every enrolled learner, with a result or an explicit ungraded status. Refresh the roster before submitting.')
    // Student locks also serialize simultaneous submissions for different courses.
    await tx.$queryRaw(Prisma.sql`SELECT id FROM "StudentProfile" WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`)
    const periods = academicTermAliases(payload.term).map(term => academicPeriodKey(payload.academicYear, term as Parameters<typeof academicPeriodKey>[1], 'SUBMITTED'))
    const previous = await tx.grade.findMany({ where: { courseId: course.id, studentId: { in: ids }, assignmentId: null, period: { in: periods } }, select: { studentId: true, percentage: true, period: true } })
    await tx.grade.deleteMany({ where: { courseId: course.id, studentId: { in: ids }, assignmentId: null, period: { in: periods } } })
    const period = academicPeriodKey(payload.academicYear, payload.term as Parameters<typeof academicPeriodKey>[1], 'SUBMITTED')
    const created = await tx.grade.createMany({ data: results.map(row => ({ courseId: course.id, studentId: row.studentId, assignmentId: null, score: row.percentage, maxScore: 100, percentage: row.percentage, letterGrade: letter(row.percentage), period })) })
    if (created.count !== results.length) throw new ApiError(500, 'The complete grade submission was not saved')
    const termLabel = payload.academicYear + ' · ' + payload.term
    const derivedTerms = ['Semester 1', 'Semester 2', 'Annual final'].filter(term => reportCardSourceTerms(term).includes(payload.term))
    const [grades, currentCards, attendance, suspensions, recipients] = await Promise.all([
      tx.grade.findMany({ where: { studentId: { in: ids }, assignmentId: null, period: { startsWith: payload.academicYear + '::', endsWith: '::SUBMITTED' } }, include: { course: { select: { credits: true } } }, orderBy: { createdAt: 'desc' } }),
      tx.reportCard.findMany({ where: { studentId: { in: ids }, term: { in: [termLabel, ...derivedTerms.map(term => payload.academicYear + ' · ' + term)] } } }),
      tx.attendanceRecord.findMany({ where: { studentId: { in: ids }, date: window }, select: { studentId: true, date: true, status: true } }),
      tx.disciplineCase.findMany({ where: { studentId: { in: ids }, suspensionStart: { lte: window.lte }, suspensionEnd: { gte: window.gte }, status: { not: 'RESOLVED' } }, select: { studentId: true, suspensionStart: true, suspensionEnd: true } }),
      tx.user.findMany({ where: { OR: [{ role: 'ADMIN' }, { email: process.env.SUPERADMIN_EMAIL || 'superadmin@kcsnexus.com' }] }, select: { id: true } }),
    ])
    const aggregate = aggregateReportCardResults(grades, payload.academicYear, payload.term)
    const cards = []
    for (const studentId of ids) {
      const current = currentCards.find(card => card.studentId === studentId && card.term === termLabel)
      const corrections = (current?.academicCorrections ?? {}) as { subjects?: Array<{ courseId: string; percentage: number }>; hiddenCourseIds?: string[] }
      const nextCorrections = { ...corrections, subjects: (corrections.subjects ?? []).filter(row => row.courseId !== course.id) }
      const visible = [...aggregate.values()].filter(row => row.studentId === studentId && row.percentage !== null && !(nextCorrections.hiddenCourseIds ?? []).includes(row.courseId))
      const overrides = new Map(nextCorrections.subjects.map(row => [row.courseId, row.percentage]))
      const weighted = visible.map(row => ({ percentage: overrides.get(row.courseId) ?? row.percentage!, credits: Math.max(1, grades.find(g => g.courseId === row.courseId)?.course.credits || 1) }))
      const total = weighted.reduce((sum, row) => sum + row.credits, 0)
      const average = total ? Number((weighted.reduce((sum, row) => sum + row.percentage * row.credits, 0) / total).toFixed(2)) : 0
      const attendanceSummary = summarizeAttendanceStatuses(attendanceWithSuspensions(attendance.filter(row => row.studentId === studentId), suspensions.filter(row => row.studentId === studentId), window).map(row => row.status))
      const card = await tx.reportCard.upsert({
        where: { studentId_term: { studentId, term: termLabel } },
        create: { studentId, term: termLabel, average, attendanceSummary, academicCorrections: nextCorrections, principalStatus: 'DRAFT', publicationStatus: 'DRAFT' },
        update: { average, attendanceSummary, academicCorrections: nextCorrections, principalStatus: 'DRAFT', publicationStatus: 'DRAFT', approvedById: null, approvedAt: null, portalPostedAt: null, emailedAt: null },
      })
      cards.push(card.id)
    }
    // Published aggregate results must return to review when a source quarter changes.
    for (const derivedTerm of derivedTerms) {
      const aggregateResults = aggregateReportCardResults(grades, payload.academicYear, derivedTerm)
      const derivedCards = currentCards.filter(card => card.term === payload.academicYear + ' · ' + derivedTerm)
      for (const card of derivedCards) {
        const corrections = (card.academicCorrections ?? {}) as { subjects?: Array<{ courseId: string; percentage: number }>; hiddenCourseIds?: string[] }
        const subjects = (corrections.subjects ?? []).filter(subject => subject.courseId !== course.id)
        const overrides = new Map(subjects.map(subject => [subject.courseId, subject.percentage]))
        const visible = [...aggregateResults.values()].filter(result => result.studentId === card.studentId && result.percentage !== null && !(corrections.hiddenCourseIds ?? []).includes(result.courseId))
        const weighted = visible.map(result => ({ percentage: overrides.get(result.courseId) ?? result.percentage!, credits: Math.max(1, grades.find(grade => grade.courseId === result.courseId)?.course.credits || 1) }))
        const credits = weighted.reduce((sum, result) => sum + result.credits, 0)
        const average = credits ? Number((weighted.reduce((sum, result) => sum + result.percentage * result.credits, 0) / credits).toFixed(2)) : 0
        await tx.reportCard.update({ where: { id: card.id }, data: { average, academicCorrections: { ...corrections, subjects }, principalStatus: 'DRAFT', publicationStatus: 'DRAFT', approvedById: null, approvedAt: null, portalPostedAt: null, emailedAt: null } })
      }
    }
    const approvedPeriods = [payload.term, ...derivedTerms].flatMap(academicTermAliases).map(term => academicPeriodKey(payload.academicYear, term as Parameters<typeof academicPeriodKey>[1], 'APPROVED'))
    await tx.grade.deleteMany({ where: { studentId: { in: ids }, assignmentId: null, period: { in: approvedPeriods } } })
    await tx.auditLog.create({ data: { actorId, action: 'FINAL_GRADES_SUBMITTED', targetType: 'Course', targetId: course.id, metadata: JSON.parse(JSON.stringify({ academicYear: payload.academicYear, term: payload.term, count: created.count, results, ungradedStudentIds: ungradedIds, missingResultPolicy: 'Preserve previous submissions for ungraded learners', replacesPreviousSubmission: previous.length > 0, previousGrades: previous, previousCards: currentCards, reportCardDraftsUpdated: cards.length })) } })
    if (recipients.length) await tx.notification.createMany({ data: recipients.map(({ id: userId }) => ({ userId, title: previous.length ? 'Updated final course grades ready for review' : 'Final course grades ready for review', message: course.name + ': ' + created.count + ' final grade(s), ' + termLabel, type: 'INFO', link: '/admin/report-cards' })) })
    await synchronizeStudentAcademicMetrics(tx, ids)
    return { course: { id: course.id, name: course.name, code: course.code }, academicYear: payload.academicYear, term: payload.term, count: created.count, ungradedCount: ungradedIds.length, officialEnrollmentCount: course.enrollments.length, reportCardDraftsUpdated: cards.length, superAdministrationQueued: true, superAdministrationNotified: recipients.length, propagationVerified: true, replacesPreviousSubmission: previous.length > 0 }
  }, { maxWait: 10_000, timeout: 60_000 })
}
