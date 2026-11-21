import { normalizeClassParts } from './className.js'
export type ForumScope = { audience: string; classroomGrade: string | null; classroomSection: string | null }
export function forumClass(grade: string, section = '') {
  const normalized = normalizeClassParts(grade, section)
  return { grade: normalized.grade, section: normalized.section || '' }
}
export function sameForumClass(scope: ForumScope, classroom: { grade: string; section: string } | null) {
  if (scope.audience === 'SCHOOL') return true
  if (scope.audience !== 'CLASS' || !classroom || !scope.classroomGrade) return false
  const target = forumClass(scope.classroomGrade, scope.classroomSection || '')
  const actual = forumClass(classroom.grade, classroom.section)
  return target.grade === actual.grade && target.section.toLocaleLowerCase() === actual.section.toLocaleLowerCase()
}
