import assert from 'node:assert/strict'
import test from 'node:test'
import { academicCycleFromDate, mergeAssignmentIntoGradebookCycle } from './gradebookCycle.service.js'

test('academicCycleFromDate follows the August to July KCS school year', () => {
  assert.deepEqual(academicCycleFromDate(new Date('2027-01-15T00:00:00Z')), {
    academicYear: '2026-2027',
    term: 'Semester 1 · Quarter 2',
  })
  assert.deepEqual(academicCycleFromDate(new Date('2027-09-15T00:00:00Z')), {
    academicYear: '2027-2028',
    term: 'Semester 1 · Quarter 1',
  })
})

test('assignment results are isolated by academic year and are idempotent', () => {
  const first = mergeAssignmentIntoGradebookCycle({}, {
    courseId: 'course-1', assignmentId: 'a-1', title: 'Quiz', description: 'Verified', assignmentType: 'QUIZ',
    dueDate: new Date('2026-10-01T00:00:00Z'), maxScore: 20, academicYear: '2026-2027', term: 'Semester 1 · Quarter 1',
    scores: [{ studentId: 'student-1', score: 14 }], savedAt: '2026-10-01T12:00:00Z',
  })
  const second = mergeAssignmentIntoGradebookCycle(first, {
    courseId: 'course-1', assignmentId: 'a-1', title: 'Quiz updated', description: 'Verified', assignmentType: 'QUIZ',
    dueDate: new Date('2027-10-01T00:00:00Z'), maxScore: 20, academicYear: '2027-2028', term: 'Semester 1 · Quarter 1',
    scores: [{ studentId: 'student-1', score: 18 }], savedAt: '2027-10-01T12:00:00Z',
  }) as any
  assert.equal(second.advancedGradebookByCycle['course-1::2026-2027'].scores['assignment:a-1:student-1'], '14')
  assert.equal(second.advancedGradebookByCycle['course-1::2027-2028'].scores['assignment:a-1:student-1'], '18')
  assert.equal(second.advancedGradebookByCycle['course-1::2027-2028'].assignments.length, 1)
  assert.equal(second.advancedGradebookByCourse['course-1'].scores['assignment:a-1:student-1'], '14')
})

test('first assignment transfer retains legacy columns, grades, comments and other courses',()=>{
 const previous={advancedGradebookByCourse:{c:{assignments:[{id:'legacy',date:'2026-09-01'}],scores:{'legacy:student':'18'},comments:{'legacy:student':'Retain'},categories:[{id:'test',weight:100}]},other:{scores:{'x:s':'12'}}}};
 const input={courseId:'c',assignmentId:'online',title:'Online quiz',description:'Reviewed',assignmentType:'QUIZ',dueDate:new Date('2026-10-01'),maxScore:10,academicYear:'2026-2027',term:'Semester 1 · Quarter 1',scores:[{studentId:'student',score:9}],savedAt:'2026-10-02'};
 const result=mergeAssignmentIntoGradebookCycle(previous,input) as any;
 assert.equal(result.advancedGradebookByCycle['c::2026-2027'].scores['legacy:student'],'18');assert.equal(result.advancedGradebookByCycle['c::2026-2027'].comments['legacy:student'],'Retain');assert.deepEqual(result.advancedGradebookByCycle['c::2026-2027'].categories,[{id:'test',weight:100}]);assert.deepEqual(result.advancedGradebookByCourse.other,previous.advancedGradebookByCourse.other);
 const repeated=mergeAssignmentIntoGradebookCycle(result,{...input,scores:[{studentId:'student',score:8}]}) as any;assert.equal(repeated.advancedGradebookByCycle['c::2026-2027'].assignments.length,2);assert.equal(repeated.advancedGradebookByCycle['c::2026-2027'].scores['assignment:online:student'],'8');assert.equal(previous.advancedGradebookByCourse.c.assignments.length,1);
});
