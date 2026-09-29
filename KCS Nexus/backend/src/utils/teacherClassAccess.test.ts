import assert from 'node:assert/strict'
import test from 'node:test'
import { belongsToTeacherClasses, extractWorkspaceClasses, isTeacherHomeroomForStudent, mergeTeacherClasses, studentBelongsToAssignedClass } from './teacherClassAccess.js'

test('extracts and canonicalizes assigned classes from a teacher workspace', () => {
  const classes = extractWorkspaceClasses({
    courses: [
      { className: '7th Grade', gradeLevels: ['Grade 7'] },
      { className: 'Kindergarten Grade 3' },
      { className: '12th Grade' },
    ],
  })
  assert.deepEqual(classes, [
    { grade: 'Grade 7', section: '' },
    { grade: 'K3', section: '' },
    { grade: 'Grade 12', section: '' },
  ])
})

test('matches imported student class names against canonical teacher classes', () => {
  const classes = mergeTeacherClasses(
    [{ grade: '7th Grade', section: '' }],
    [{ grade: 'Grade 7', section: 'Grade 7' }],
  )
  assert.equal(classes.length, 1)
  assert.equal(belongsToTeacherClasses({ grade: 'Grade 7', section: 'Grade 7' }, classes), true)
  assert.equal(belongsToTeacherClasses({ grade: 'Grade 8', section: '' }, classes), false)
})

test('allows the registry fallback when assignments have not been synchronized yet', () => {
  assert.equal(belongsToTeacherClasses({ grade: 'K3', section: '' }, []), true)
})

test('keeps a sectioned main teacher inside the exact assigned class roster', () => {
  const teacher = { status: 'HOMEROOM_TEACHER', homeroomGrade: 'Grade 9', homeroomSection: 'A' }
  assert.equal(isTeacherHomeroomForStudent(teacher, { grade: 'Grade 9', section: 'A' }), true)
  assert.equal(isTeacherHomeroomForStudent(teacher, { grade: 'Grade 9', section: 'B' }), false)
  assert.equal(isTeacherHomeroomForStudent(teacher, { grade: 'Grade 10', section: 'A' }), false)
})

test('allows a whole-class main teacher assignment when no section exists', () => {
  const teacher = { status: 'HOMEROOM_TEACHER', homeroomGrade: 'Grade 8', homeroomSection: '' }
  assert.equal(isTeacherHomeroomForStudent(teacher, { grade: 'Grade 8', section: 'A' }), true)
  assert.equal(isTeacherHomeroomForStudent({ ...teacher, status: 'TEACHER' }, { grade: 'Grade 8', section: 'A' }), false)
})

test('matches attendance rosters to the exact assigned section in every supported class format', () => {
  const gradeNineA = { grade: 'Grade 9', section: 'A' }
  assert.equal(studentBelongsToAssignedClass({ grade: 'Grade 9', section: 'A' }, gradeNineA), true)
  assert.equal(studentBelongsToAssignedClass({ grade: 'Grade 9A', section: '' }, gradeNineA), true)
  assert.equal(studentBelongsToAssignedClass({ grade: 'Grade 9', section: 'B' }, gradeNineA), false)
  assert.equal(studentBelongsToAssignedClass({ grade: 'Grade 10', section: 'A' }, gradeNineA), false)
})
