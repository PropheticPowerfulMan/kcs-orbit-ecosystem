import assert from 'node:assert/strict'
import test from 'node:test'
import { academicCycleFromDate, mergeAssignmentIntoGradebookCycle } from './gradebookCycle.service.js'

test('academicCycleFromDate follows the August to July KCS school year', () => {
  assert.deepEqual(academicCycleFromDate(new Date('2027-01-15T00:00:00Z')), {
    academicYear: '2026-2027',
    term: 'Semester 1 · Trimester 2',
  })
  assert.deepEqual(academicCycleFromDate(new Date('2027-09-15T00:00:00Z')), {
    academicYear: '2027-2028',
    term: 'Semester 1 · Trimester 1',
  })
})

test('assignment results are isolated by academic year and are idempotent', () => {
  const first = mergeAssignmentIntoGradebookCycle({}, {
    courseId: 'course-1', assignmentId: 'a-1', title: 'Quiz', description: 'Verified', assignmentType: 'QUIZ',
    dueDate: new Date('2026-10-01T00:00:00Z'), maxScore: 20, academicYear: '2026-2027', term: 'Semester 1 · Trimester 1',
    scores: [{ studentId: 'student-1', score: 14 }], savedAt: '2026-10-01T12:00:00Z',
  })
  const second = mergeAssignmentIntoGradebookCycle(first, {
    courseId: 'course-1', assignmentId: 'a-1', title: 'Quiz updated', description: 'Verified', assignmentType: 'QUIZ',
    dueDate: new Date('2027-10-01T00:00:00Z'), maxScore: 20, academicYear: '2027-2028', term: 'Semester 1 · Trimester 1',
    scores: [{ studentId: 'student-1', score: 18 }], savedAt: '2027-10-01T12:00:00Z',
  }) as any
  assert.equal(second.advancedGradebookByCycle['course-1::2026-2027'].scores['assignment:a-1:student-1'], '14')
  assert.equal(second.advancedGradebookByCycle['course-1::2027-2028'].scores['assignment:a-1:student-1'], '18')
  assert.equal(second.advancedGradebookByCycle['course-1::2027-2028'].assignments.length, 1)
  assert.equal(second.advancedGradebookByCourse['course-1'].scores['assignment:a-1:student-1'], '14')
})
