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

test('ordinary workspace saves cannot revert server-managed per-course weighting',()=>{
 const weights={'course::2026-2027':{categories:[{id:'quiz',weight:100}],updatedAt:'new'}}
 const result=mergeTeacherWorkspaceState({gradebookCategoryWeightsByCycle:weights},{gradebookCategoryWeightsByCycle:{'course::2026-2027':{categories:[],updatedAt:'old'}}})
 assert.deepEqual(result.state.gradebookCategoryWeightsByCycle,weights)
})

test('a stale workspace cannot undo protected quarter corrections', () => {
 const cycle = 'course::2026-2027'
 const previous = { gradebookPeriodCorrectionsByCycle: { [cycle]: { from: 'Semester 1 · Quarter 2', to: 'Semester 1 · Quarter 1', assessmentIds: ['old'] } } }
 const incoming = { gradebookPeriodCorrectionsByCycle: {}, advancedGradebookByCycle: { [cycle]: { assignments: [{ id: 'old', term: 'Semester 1 · Quarter 2' }, { id: 'new', term: 'Semester 1 · Quarter 2', confirmedCycle: '2026-2027::Semester 1 · Quarter 2' }], scores: { 'old:s1': '80' } } } }
 const { state } = mergeTeacherWorkspaceState(previous, incoming)
 assert.deepEqual(state.gradebookPeriodCorrectionsByCycle, previous.gradebookPeriodCorrectionsByCycle)
 const snapshot = (state.advancedGradebookByCycle as any)[cycle]
 assert.equal(snapshot.assignments[0].term, 'Semester 1 · Quarter 1')
 assert.equal(snapshot.assignments[1].term, 'Semester 1 · Quarter 2')
 assert.equal(snapshot.scores['old:s1'], '80')
})

test('new later-quarter assessments require an explicit matching cycle', () => {
  const state: any = { advancedGradebookByCycle: { 'course::2026-2027': { assignments: [{ id: 'new', term: 'Semester 1 · Quarter 2' }], scores: {} } } }
  assert.throws(() => mergeTeacherWorkspaceState({}, state), /confirm the academic year and quarter/)
  state.advancedGradebookByCycle['course::2026-2027'].assignments[0].confirmedCycle = '2026-2027::Semester 1 · Quarter 2'
  assert.doesNotThrow(() => mergeTeacherWorkspaceState({}, state))
})

test('legacy later-quarter assessments remain saveable when first mirrored to the year-scoped format', () => {
  const task = { id: 'existing', term: 'Semester 1 · Quarter 2' }
  const previous = { gradebookColumnsByCourse: { course: [task] } }
  const incoming = { advancedGradebookByCycle: { 'course::2026-2027': { assignments: [task], scores: { 'existing:s1': '75' } } } }
  assert.doesNotThrow(() => mergeTeacherWorkspaceState(previous, incoming))
})
