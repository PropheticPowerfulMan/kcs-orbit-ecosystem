import type { Prisma } from '@prisma/client'
import { normalizeClassParts } from '../utils/className.js'

type OfficialClass = { grade: string; section: string }
export type CourseRosterChange = { courseId: string; action: 'ENROLL' | 'REMOVE' }

/** Section courses follow the official roster. Whole-grade and custom courses stay teacher-managed. */
export function planOfficialClassCourseChanges(
  courses: Array<{ id: string; grade: string; enrolled: boolean }>,
  assignedClass: OfficialClass,
): CourseRosterChange[] {
  const official = normalizeClassParts(assignedClass.grade, assignedClass.section)
  const changes: CourseRosterChange[] = []
  for (const course of courses) {
    const courseClass = normalizeClassParts(course.grade)
    if (courseClass.grade.toLowerCase() !== official.grade.toLowerCase() || !courseClass.section) continue
    const belongs = Boolean(official.section) && courseClass.section.toLowerCase() === official.section.toLowerCase()
    if (belongs && !course.enrolled) changes.push({ courseId: course.id, action: 'ENROLL' })
    if (!belongs && course.enrolled) changes.push({ courseId: course.id, action: 'REMOVE' })
  }
  return changes
}

export async function reconcileOfficialClassCourseEnrollments(
  tx: Prisma.TransactionClient,
  studentIds: string[],
  assignedClass: OfficialClass,
) {
  if (!studentIds.length) return { enrolled: 0, removed: 0 }
  const courses = await tx.course.findMany({
    select: { id: true, grade: true, assignments: { select: { id: true } }, enrollments: { where: { studentId: { in: studentIds } }, select: { studentId: true } } },
  })
  let enrolled = 0
  let removed = 0
  let submissionsCreated = 0
  let pendingSubmissionsRemoved = 0
  for (const studentId of studentIds) {
    const changes = planOfficialClassCourseChanges(
      courses.map((course) => ({ id: course.id, grade: course.grade, enrolled: course.enrollments.some((row) => row.studentId === studentId) })),
      assignedClass,
    )
    const enrollIds = changes.filter((change) => change.action === 'ENROLL').map((change) => change.courseId)
    const removeIds = changes.filter((change) => change.action === 'REMOVE').map((change) => change.courseId)
    if (removeIds.length) {
      removed += (await tx.enrollment.deleteMany({ where: { studentId, courseId: { in: removeIds } } })).count
      pendingSubmissionsRemoved += (await tx.assignmentSubmission.deleteMany({ where: { studentId, status: 'PENDING', assignment: { courseId: { in: removeIds } } } })).count
    }
    if (enrollIds.length) {
      enrolled += (await tx.enrollment.createMany({ data: enrollIds.map((courseId) => ({ courseId, studentId })), skipDuplicates: true })).count
      const assignmentIds = courses.filter((course) => enrollIds.includes(course.id)).flatMap((course) => course.assignments.map((assignment) => assignment.id))
      if (assignmentIds.length) submissionsCreated += (await tx.assignmentSubmission.createMany({ data: assignmentIds.map((assignmentId) => ({ assignmentId, studentId })), skipDuplicates: true })).count
    }
  }
  return { enrolled, removed, submissionsCreated, pendingSubmissionsRemoved }
}
