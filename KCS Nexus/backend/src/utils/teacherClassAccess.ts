import { normalizeClassParts } from './className.js'

export type TeacherClassParts = { grade: string; section: string }

export const teacherClassKey = (value: TeacherClassParts) => `${value.grade.trim().toLowerCase()}::${value.section.trim().toLowerCase()}`

const addClass = (classes: Map<string, TeacherClassParts>, grade?: unknown, section?: unknown) => {
  if (typeof grade !== 'string' || !grade.trim()) return
  const normalized = normalizeClassParts(grade, typeof section === 'string' ? section : '')
  if (normalized.grade) classes.set(teacherClassKey(normalized), normalized)
}

export function extractWorkspaceClasses(state: unknown): TeacherClassParts[] {
  const classes = new Map<string, TeacherClassParts>()
  if (!state || typeof state !== 'object' || Array.isArray(state)) return []
  const courses = (state as Record<string, unknown>).courses
  if (!Array.isArray(courses)) return []

  for (const value of courses) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue
    const course = value as Record<string, unknown>
    addClass(classes, course.className)
    if (Array.isArray(course.gradeLevels)) {
      for (const grade of course.gradeLevels) addClass(classes, grade)
    }
  }
  return [...classes.values()]
}

export function mergeTeacherClasses(...groups: TeacherClassParts[][]): TeacherClassParts[] {
  const classes = new Map<string, TeacherClassParts>()
  for (const group of groups) {
    for (const value of group) addClass(classes, value.grade, value.section)
  }
  return [...classes.values()]
}

export function belongsToTeacherClasses(
  student: { grade: string; section?: string | null },
  classes: TeacherClassParts[],
) {
  if (!classes.length) return true
  const normalized = normalizeClassParts(student.grade, student.section)
  return classes.some((value) => teacherClassKey(value) === teacherClassKey(normalized))
}

export function studentBelongsToAssignedClass(
  student: { grade: string; section?: string | null },
  assignedClass: TeacherClassParts,
) {
  const learner = normalizeClassParts(student.grade, student.section)
  const assignment = normalizeClassParts(assignedClass.grade, assignedClass.section)
  return learner.grade.toLowerCase() === assignment.grade.toLowerCase()
    && (!assignment.section || teacherClassKey(learner) === teacherClassKey(assignment))
}

export function isTeacherHomeroomForStudent(
  teacher: { status?: string; homeroomGrade: string | null; homeroomSection: string | null },
  student: { grade: string; section: string },
) {
  if (teacher.status !== undefined && teacher.status !== 'HOMEROOM_TEACHER') return false
  if (!teacher.homeroomGrade) return false
  const homeroom = normalizeClassParts(teacher.homeroomGrade, teacher.homeroomSection ?? '')
  return studentBelongsToAssignedClass(student, homeroom)
}
