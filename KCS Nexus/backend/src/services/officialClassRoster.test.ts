import test from 'node:test'
import assert from 'node:assert/strict'
import { planOfficialClassCourseChanges } from './officialClassRoster.js'

test('moving a learner from section A to B removes A and enrolls B courses', () => {
  const changes = planOfficialClassCourseChanges([
    { id: 'math-a', grade: 'Grade 9 A', enrolled: true },
    { id: 'math-b', grade: 'Grade 9 B', enrolled: false },
    { id: 'whole-grade', grade: 'Grade 9', enrolled: true },
    { id: 'other-grade', grade: 'Grade 10 A', enrolled: true },
  ], { grade: 'Grade 9', section: 'B' })
  assert.deepEqual(changes, [
    { courseId: 'math-a', action: 'REMOVE' },
    { courseId: 'math-b', action: 'ENROLL' },
  ])
})

test('whole-class assignment removes stale section courses without touching general courses', () => {
  const changes = planOfficialClassCourseChanges([
    { id: 'section-a', grade: 'Grade 8 A', enrolled: true },
    { id: 'general', grade: 'Grade 8', enrolled: true },
    { id: 'mixed', grade: 'Mixed choir', enrolled: true },
  ], { grade: 'Grade 8', section: '' })
  assert.deepEqual(changes, [{ courseId: 'section-a', action: 'REMOVE' }])
})
