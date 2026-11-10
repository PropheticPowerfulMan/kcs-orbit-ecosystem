import assert from 'node:assert/strict'
import test from 'node:test'
import { academicPeriodIsReadOnly, closedGradebookChanged, academicEntryPeriod, futureGradebookPeriods, futureGradebookChanged } from './academicPeriodPolicy.js'
const year = '2026-2027'
const q1 = 'Semester 1 · Quarter 1'
const q2 = 'Semester 1 · Quarter 2'
const open = { activeAcademicYear: year, closedPeriods: [] }
const closed = { ...open, closedPeriods: [{ academicYear: year, term: q1 }] }
const state = () => ({ advancedGradebookByCycle: { ['course::' + year]: { assignments: [{ id: 'task:old', term: q1, maxPoints: 100 }, { id: 'task:new', term: q2, maxPoints: 100 }], scores: { 'task:old:learner': '80', 'task:new:learner': '90' }, comments: { 'task:old:learner': 'Checked' }, categories: [{ id: 'quiz', weight: 100 }], savedAt: 'old' } } })
test('the current quarter stays open until explicit SuperAdmin closure', () => {
  assert.equal(academicPeriodIsReadOnly(open, year, q1), false)
  assert.equal(academicPeriodIsReadOnly(closed, year, q1), true)
  assert.equal(academicPeriodIsReadOnly(closed, year, q2), false)
})
test('a past year remains open until confirmed closure and semester closure covers its quarters', () => {
  assert.equal(academicPeriodIsReadOnly(open, '2025-2026', q1), false)
  assert.equal(academicPeriodIsReadOnly({ ...open, closedPeriods: [{ academicYear: year, term: 'Semester 1' }] }, year, q2), true)
})
test('a stale browser cannot edit a closed score or a cell comment', () => {
  for (const field of ['scores', 'comments'] as const) {
    const before = state(), after = structuredClone(before)
    after.advancedGradebookByCycle['course::' + year][field]['task:old:learner'] = 'changed'
    assert.equal(closedGradebookChanged(before, after, closed), true)
  }
})
test('open-quarter edits remain saveable while the first quarter is closed', () => {
  const before = state(), after = structuredClone(before)
  after.advancedGradebookByCycle['course::' + year].scores['task:new:learner'] = '99'
  after.advancedGradebookByCycle['course::' + year].savedAt = 'new'
  assert.equal(closedGradebookChanged(before, after, closed), false)
})
test('deleting a closed column or moving it into an open quarter is rejected', () => {
  const before = state(), removed = structuredClone(before), moved = structuredClone(before)
  removed.advancedGradebookByCycle['course::' + year].assignments.shift()
  moved.advancedGradebookByCycle['course::' + year].assignments[0].term = q2
  assert.equal(closedGradebookChanged(before, removed, closed), true)
  assert.equal(closedGradebookChanged(before, moved, closed), true)
})
test('legacy score keys and intentional zero scores remain protected', () => {
  const before = { advancedGradebookByCourse: { course: { assignments: [{ id: 'task', term: q1 }] } }, gradebookScores: { 'course-task-learner': '0' } }
  const after = structuredClone(before)
  after.gradebookScores['course-task-learner'] = '100'
  assert.equal(closedGradebookChanged(before, after, closed), true)
})
test('category changes in an open quarter do not rewrite the frozen closed-quarter record', () => {
  const before = state(), after = structuredClone(before)
  after.advancedGradebookByCycle['course::' + year].categories[0].weight = 50
  assert.equal(closedGradebookChanged(before, after, closed), false)
  assert.equal(closedGradebookChanged(before, after, { ...open, closedPeriods: [{ academicYear: year, term: 'Annual final' }] }), true)
})


test('open-quarter saves can initialize identical legacy mirrors of closed records', () => {
  const before: Record<string, any> = state(), after: Record<string, any> = structuredClone(before)
  const snapshot = after.advancedGradebookByCycle['course::' + year]
  snapshot.scores['task:new:learner'] = '99'
  after.advancedGradebookByCourse = { course: structuredClone(snapshot) }
  after.gradebookColumnsByCourse = { course: snapshot.assignments.map(({ id, term, maxPoints }: any) => ({ id, term, maxPoints })) }
  after.gradebookScores = { 'course-task:old-learner': '80', 'course-task:new-learner': '99' }
  assert.equal(closedGradebookChanged(before, after, closed), false)
  after.gradebookScores['course-task:old-learner'] = '20'
  assert.equal(closedGradebookChanged(before, after, closed), true)
})

test('initializing a legacy mirror cannot create a new closed assessment', () => {
  const before = state(), after: Record<string, any> = structuredClone(before)
  after.gradebookColumnsByCourse = { course: [{ id: 'invented', term: q1, maxPoints: 100 }] }
  assert.equal(closedGradebookChanged(before, after, closed), true)
})

test('calendar dates and a newer active year cannot silently close an older year', () => {
 const access = { activeAcademicYear: '2027-2028', closedPeriods: [], calendars: [{name: year, startDate:'2026-09-01', endDate:'2027-06-30'}] }
 assert.equal(academicPeriodIsReadOnly(access,year,q1),false)
 assert.equal(academicPeriodIsReadOnly({...access,closedPeriods:[{academicYear:year,term:'Annual final'}]},year,q1),true)
})
test('entry defaults advance only after quarter and semester confirmations', () => {
 let access={...open,closedPeriods:[] as Array<{academicYear:string;term:string}>}
 assert.equal(academicEntryPeriod(access,year).activeEntryTerm,q1)
 access.closedPeriods.push({academicYear:year,term:q1})
 assert.equal(academicEntryPeriod(access,year).activeEntryTerm,q2)
 access.closedPeriods.push({academicYear:year,term:q2})
 assert.deepEqual(academicEntryPeriod(access,year),{pendingClosureTerm:'Semester 1',activeEntryTerm:q2})
 access.closedPeriods.push({academicYear:year,term:'Semester 1'})
 assert.equal(academicEntryPeriod(access,year).activeEntryTerm,'Semester 2 · Quarter 3')
 access.closedPeriods.push({academicYear:year,term:'Semester 2 · Quarter 3'},{academicYear:year,term:'Semester 2 · Quarter 4'},{academicYear:year,term:'Semester 2'})
 assert.equal(academicEntryPeriod(access,year).activeEntryTerm,'Annual final')
 access.closedPeriods.push({academicYear:year,term:'Annual final'})
 assert.equal(academicEntryPeriod(access,year).activeEntryTerm,null)
})


test('future quarters reject task and score edits while existing records remain intact', () => {
 const before=state(), after=structuredClone(before)
 assert.equal(futureGradebookChanged(before,before,open),false)
 after.advancedGradebookByCycle['course::'+year].scores['task:new:learner']='91'
 assert.equal(futureGradebookChanged(before,after,open),true)
 assert.equal(futureGradebookChanged(before,after,closed),false)
 const current=structuredClone(before)
 current.advancedGradebookByCycle['course::'+year].scores['task:old:learner']='95'
 assert.equal(futureGradebookChanged(before,current,open),false)
 assert.deepEqual(futureGradebookPeriods(open,'2025-2026'),[])
 assert.equal(futureGradebookChanged(before,after,{...open,activeAcademicYear:'2027-2028'}),false)
})
test('confirmed future-quarter task creation is still rejected until explicit advancement',()=>{
 const next={advancedGradebookByCycle:{['course::'+year]:{assignments:[{id:'new',term:q2,confirmedCycle:year+'::'+q2}],scores:{'new:learner':'0'}}}}
 assert.equal(futureGradebookChanged({},next,open),true)
 assert.equal(futureGradebookChanged({},next,closed),false)
})
