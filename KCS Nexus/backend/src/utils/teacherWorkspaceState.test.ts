import assert from 'node:assert/strict'
import test from 'node:test'
import { mergeTeacherWorkspaceState } from './teacherWorkspaceState.js'

const snapshot = { assignments: [{ id: 'quiz', term: 'Semester 1 · Quarter 1' }], scores: { 'quiz:student': '90' } }
const existing = { courses: [], advancedGradebookByCourse: { algebra: snapshot }, advancedGradebookByCycle: { 'algebra::2026-2027': snapshot } }

test('ordinary workspace updates preserve saved gradebook maps', () => {
  assert.deepEqual(mergeTeacherWorkspaceState(existing, { courses: [{ id: 'algebra' }] }).state.advancedGradebookByCourse, existing.advancedGradebookByCourse)
})
test('saving a different course preserves every existing course and school year', () => {
  const next = mergeTeacherWorkspaceState(existing, { advancedGradebookByCycle: { 'biology::2027-2028': snapshot } })
  assert.equal(Object.keys(next.state.advancedGradebookByCycle as object).length, 2)
  assert.ok(next.previousGradebook)
})
test('an unloaded empty gradebook cannot replace saved marks', () => {
  assert.throws(() => mergeTeacherWorkspaceState(existing, { advancedGradebookByCourse: { algebra: { assignments: [], scores: {} } } }), /empty gradebook/)
})
test('intentional assessment deletion remains available through its archive', () => {
  const next = mergeTeacherWorkspaceState(existing, { advancedGradebookByCourse: { algebra: { assignments: [], scores: {}, archivedAssignments: [{ assignment: snapshot.assignments[0], scores: snapshot.scores }] } } })
  assert.ok(next.previousGradebook)
})

test('blank score maps cannot erase previously saved grades', () => {
  assert.throws(() => mergeTeacherWorkspaceState(existing, { advancedGradebookByCourse: { algebra: { assignments: snapshot.assignments, scores: {} } } }), /empty gradebook/)
})
