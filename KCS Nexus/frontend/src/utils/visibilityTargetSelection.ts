export type TargetOption = { id: string; label: string; description: string; searchText: string }
type Person = { firstName?: string | null; middleName?: string | null; lastName?: string | null }
export type VisibilityStudent = { studentNumber: string; grade: string; section?: string | null; user?: Person }
export type VisibilityParent = Person & { id: string; email?: string | null; parentLinks: Array<{student: {studentNumber: string; grade?: string; section?: string | null}}> }
export type VisibilityCourse = { id: string; name: string; code?: string; grade?: string; teacherName?: string; studentNumbers?: string[] }
export type VisibilityTargetScope = { grade: string; section: string; studentNumbers: string[]; parentIds: string[] }
export const visibilityPersonName = (person?: Person) => [person?.lastName, person?.middleName, person?.firstName].filter(Boolean).join(' ')
const fold = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/\s+/g, ' ').trim()
export const filterVisibilityOptions = (items: TargetOption[], query: string) => {
 const tokens = fold(query).split(' ').filter(Boolean)
 return items.filter(item => tokens.every(token => fold(item.searchText).includes(token)))
}
export function updateVisibilitySelection(current: string[], matches: string[], select: boolean) {
 const ids = new Set(matches)
 return select ? [...new Set([...current, ...matches])] : current.filter(id => !ids.has(id))
}
export function visibilityTargetOptions(students: VisibilityStudent[], parents: VisibilityParent[], courses: VisibilityCourse[], scope: VisibilityTargetScope) {
 const selectedStudents = new Set(scope.studentNumbers.map(fold)), selectedParents = new Set(scope.parentIds)
 const childrenOfSelectedParents = new Set(parents.filter(parent => selectedParents.has(parent.id)).flatMap(parent => parent.parentLinks.map(link => fold(link.student.studentNumber))))
 const classStudents = students.filter(student => (!scope.grade || student.grade === scope.grade) && (!scope.section || student.section === scope.section))
 const courseStudents = classStudents.filter(student => (!selectedStudents.size || selectedStudents.has(fold(student.studentNumber))) && (!selectedParents.size || childrenOfSelectedParents.has(fold(student.studentNumber))))
 const courseNumbers = new Set(courseStudents.map(student => fold(student.studentNumber)))
 const parentNumbers = new Set(classStudents.filter(student => !selectedStudents.size || selectedStudents.has(fold(student.studentNumber))).map(student => fold(student.studentNumber)))
 const hasLearnerScope = Boolean(scope.grade || scope.section || selectedStudents.size)
 const hasCourseScope = hasLearnerScope || selectedParents.size > 0
 const allStudents = new Map(students.map(student => [fold(student.studentNumber), student]))
 const sort = (items: TargetOption[]) => items.sort((left,right) => left.label.localeCompare(right.label, 'en', {sensitivity:'base',numeric:true}) || left.id.localeCompare(right.id))
 const parentSearchByStudent = new Map<string,string[]>()
 for(const parent of parents)for(const link of parent.parentLinks){const key=fold(link.student.studentNumber);parentSearchByStudent.set(key,[...(parentSearchByStudent.get(key)??[]),[visibilityPersonName(parent),parent.email].filter(Boolean).join(' ')])}
 const studentOptions = sort(students.map(student => {
  const label = visibilityPersonName(student.user) || student.studentNumber
  const description = [student.studentNumber, student.grade, student.section].filter(Boolean).join(' · ')
  return {id:student.studentNumber,label,description,searchText:[label,description,...(parentSearchByStudent.get(fold(student.studentNumber))??[])].join(' ')}
 }))
 const parentOptions = sort(parents.map(parent => {
  const children = parent.parentLinks.map(link => {
   const student = allStudents.get(fold(link.student.studentNumber))
   return [visibilityPersonName(student?.user),link.student.studentNumber,student?.grade ?? link.student.grade,student?.section ?? link.student.section].filter(Boolean).join(' · ')
  }).join(' ; ')
  const label = visibilityPersonName(parent) || parent.email || '—'
  return {id:parent.id,label,description:[parent.email,children].filter(Boolean).join(' · '),searchText:[label,parent.email,children].filter(Boolean).join(' ')}
 }))
 const courseOptions = sort(courses.map(course => ({id:course.id,label:course.name,description:[course.code,course.grade,course.teacherName].filter(Boolean).join(' · '),searchText:[course.name,course.code,course.grade,course.teacherName].filter(Boolean).join(' ')})))
 const studentIds = new Set(classStudents.filter(student => !selectedParents.size || childrenOfSelectedParents.has(fold(student.studentNumber))).map(student => student.studentNumber))
 const parentIds = new Set(parents.filter(parent => !hasLearnerScope || parent.parentLinks.some(link => parentNumbers.has(fold(link.student.studentNumber)))).map(parent => parent.id))
 const courseIds = new Set(courses.filter(course => !hasCourseScope || course.studentNumbers?.some(number => courseNumbers.has(fold(number)))).map(course => course.id))
 return { allStudents:studentOptions, allParents:parentOptions, allCourses:courseOptions,
  students:studentOptions.filter(item => studentIds.has(item.id)), parents:parentOptions.filter(item => parentIds.has(item.id)), courses:courseOptions.filter(item => courseIds.has(item.id)), courseLearners:courseStudents.length, hasCourseScope }
}
