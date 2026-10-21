import test from 'node:test'
import assert from 'node:assert/strict'
import { aggregateReportCardResults, KCS_TRIMESTER_TERMS } from './annualReportCard.service.js'

const grade = (term: string, percentage: number, createdAt = '2027-01-01T00:00:00Z') => ({
  studentId: 'student-1', courseId: 'math', period: `2026-2027::${term}::SUBMITTED`, percentage, createdAt,
})

test('annual result is the mean of the three official trimester results', () => {
  const result = aggregateReportCardResults([
    grade(KCS_TRIMESTER_TERMS[0], 70),
    grade(KCS_TRIMESTER_TERMS[1], 80),
    grade(KCS_TRIMESTER_TERMS[2], 90),
  ], '2026-2027', 'Annual final').get('student-1:math')
  assert.equal(result?.complete, true)
  assert.equal(result?.percentage, 80)
})

test('annual result remains incomplete when one trimester is missing', () => {
  const result = aggregateReportCardResults([
    grade(KCS_TRIMESTER_TERMS[0], 70),
    grade(KCS_TRIMESTER_TERMS[2], 90),
  ], '2026-2027', 'Annual final').get('student-1:math')
  assert.equal(result?.complete, false)
  assert.equal(result?.percentage, null)
  assert.equal(result?.sourceCount, 2)
})

test('a later submission replaces the earlier value for the same trimester', () => {
  const result = aggregateReportCardResults([
    grade(KCS_TRIMESTER_TERMS[0], 50, '2026-10-01T00:00:00Z'),
    grade(KCS_TRIMESTER_TERMS[0], 80, '2026-10-02T00:00:00Z'),
  ], '2026-2027', KCS_TRIMESTER_TERMS[0]).get('student-1:math')
  assert.equal(result?.percentage, 80)
})
