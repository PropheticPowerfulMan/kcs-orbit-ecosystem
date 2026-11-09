import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'
const compile = (name) => ts.transpileModule(readFileSync(new URL(name, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText
const uri = (source) => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64')
const { recoverGradebook, stableGradebookValue } = await import(uri(compile('./gradebookRecovery.ts').replace("'./gradebookPeriods'", JSON.stringify(uri(compile('./gradebookPeriods.ts'))))))
const task = (id) => ({ id, title: id, type: 'quiz', category: 'quiz', maxPoints: 100, date: '2026-10-01', term: 'Semester 1 · Quarter 1', description: '' })
const recover = (state, extra = {}) => recoverGradebook({ courseId: 'math-course', academicYear: '2026-2027', state, students: [], ...extra })

test('legacy-only marks load without waiting for the course roster', () => {
 const state = { gradebookColumnsByCourse: { 'math-course': [task('quiz-one')] }, gradebookScores: { 'math-course-quiz-one-student-id-with-dashes': 0 } }
 const result = recover(state)
 assert.equal(result.snapshot.scores['quiz-one:student-id-with-dashes'], '0')
 assert.equal(result.recoveredCells, 1)
})
test('Fanny-shaped Math and Reading gradebooks recover every legacy cell independently', () => {
 const state = { gradebookColumnsByCourse: {}, gradebookScores: {} }
 for (const [course, count] of [['math-course', 33], ['reading', 41]]) {
  state.gradebookColumnsByCourse[course] = Array.from({length: 4}, (_, i) => task('q'+i))
  for (let i=0; i<count; i++) state.gradebookScores[course+'-q'+Math.floor(i/11)+'-student-'+i%11] = String(50+i%50)
  const result = recover(state, {courseId: course})
  assert.equal(Object.values(result.snapshot.scores).filter(v=>v!=='').length, count)
 }
})
test('a partial modern snapshot keeps its newer values while recovering missing legacy marks and columns', () => {
 const state = { gradebookColumnsByCourse: { 'math-course': [task('one'),task('two')] }, gradebookScores: { 'math-course-one-s1':'70','math-course-one-s2':'80','math-course-two-s1':'60' }, advancedGradebookByCycle: { 'math-course::2026-2027': { assignments:[task('one')], scores:{'one:s1':'95'},savedAt:'2026-11-01' } } }
 const result = recover(state)
 assert.equal(result.snapshot.scores['one:s1'],'95')
 assert.equal(result.snapshot.scores['one:s2'],'80')
 assert.equal(result.snapshot.scores['two:s1'],'60')
 assert.equal(result.recoveredCells,2)
 assert.equal(result.snapshot.assignments.length,2)
})
test('intentional archived tasks are preserved without resurrecting deleted columns', () => {
 const state = {gradebookColumnsByCourse:{'math-course':[task('one')]},gradebookScores:{'math-course-one-s1':'70'},advancedGradebookByCycle:{'math-course::2026-2027':{assignments:[],scores:{},archivedAssignments:[{assignment:task('one'),scores:{'one:s1':'70'},comments:{},deletedAt:'2026-11-01'}],savedAt:'2026-11-01'}}}
 assert.equal(recover(state).snapshot.assignments.length,0)
 assert.equal(recover(state).snapshot.archivedAssignments.length,1)
})
test('school years and courses never borrow each other’s marks', () => {
 const state = {gradebookColumnsByCourse:{'math-course':[task('one')]},gradebookScores:{'math-course-one-s1':'70'},advancedGradebookByCycle:{'math-course::2026-2027':{assignments:[task('one')],scores:{'one:s1':'70'}}}}
 assert.equal(recover(state,{academicYear:'2027-2028'}).snapshot.assignments.length,0)
 assert.equal(recover(state,{courseId:'other-course'}).snapshot.assignments.length,0)
})
test('old student identifiers map using the stable student number', () => {
 const state = {teacherStudents:[{id:'old',studentNumber:'KCS-STU-001'}],gradebookColumnsByCourse:{'math-course':[task('one')]},gradebookScores:{'math-course-one-old':'70'}}
 assert.equal(recover(state,{students:[{id:'new',studentNumber:'KCS-STU-001'}]}).snapshot.scores['one:new'],'70')
})
test('a stale or empty browser copy does not erase server marks', () => {
 const state={advancedGradebookByCycle:{'math-course::2026-2027':{assignments:[task('one')],scores:{'one:s1':'90'},savedAt:'2026-11-01'}}}
 assert.equal(recover(state,{browserSnapshots:[{assignments:[task('one')],scores:{'one:s1':''},savedAt:'2026-11-02'}]}).snapshot.scores['one:s1'],'90')
})
test('server readback comparison ignores JSON object ordering', () => {
 assert.equal(stableGradebookValue({a:1,b:{x:2,y:3}}),stableGradebookValue({b:{y:3,x:2},a:1}))
})
