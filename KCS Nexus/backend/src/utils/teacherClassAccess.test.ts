import assert from 'node:assert/strict'
import test from 'node:test'
import { belongsToTeacherClasses, extractWorkspaceClasses, mergeTeacherClasses } from './teacherClassAccess.js'

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
