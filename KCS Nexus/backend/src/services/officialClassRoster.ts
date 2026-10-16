import type { Prisma } from '@prisma/client'
import { normalizeClassParts } from '../utils/className.js'

type OfficialClass = { grade: string; section: string }
export type CourseRosterChange = { courseId: string; action: 'ENROLL' | 'REMOVE' }

/** Official whole-grade/section courses follow the canonical roster; custom multi-class groups remain teacher-managed. */
export function planOfficialClassCourseChanges(
  courses: Array<{ id: string; grade: string; description?: string | null; enrolled: boolean }>,
  assignedClass: OfficialClass,
): CourseRosterChange[] {
  const official = normalizeClassParts(assignedClass.grade, assignedClass.section)
  const changes: CourseRosterChange[] = []
  for (const course of courses) {
    // A deliberately selected multi-class roster is teacher-managed. Moving a
    // learner to another official class must not silently remove an elective,
    // club or other custom group.
    if (course.grade.trim().toLowerCase() === 'multi-class' || course.description?.includes('[KCS_SCOPE:CUSTOM]')) continue
    const courseClass = normalizeClassParts(course.grade)
    const isOfficialGrade = /^(?:K[3-5]|Grade\s(?:[1-9]|1[0-2]))$/i.test(courseClass.grade)
    if (!isOfficialGrade) continue
    const sameGrade = courseClass.grade.toLowerCase() === official.grade.toLowerCase()
    const belongs = sameGrade && (!courseClass.section || (
      Boolean(official.section) && courseClass.section.toLowerCase() === official.section.toLowerCase()
    ))
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
    select: { id: true, grade: true, description: true, assignments: { select: { id: true } }, enrollments: { where: { studentId: { in: studentIds } }, select: { studentId: true } } },
  })
  let enrolled = 0
  let removed = 0
  let submissionsCreated = 0
  let pendingSubmissionsRemoved = 0
  for (const studentId of studentIds) {
    const changes = planOfficialClassCourseChanges(
      courses.map((course) => ({ id: course.id, grade: course.grade, description: course.description, enrolled: course.enrollments.some((row) => row.studentId === studentId) })),
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
