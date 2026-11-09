import test from 'node:test'
import assert from 'node:assert/strict'
import { aggregateReportCardResults, KCS_QUARTER_TERMS } from './annualReportCard.service.js'

const grade = (term: string, percentage: number, createdAt = '2027-01-01T00:00:00Z') => ({
  studentId: 'student-1', courseId: 'math', period: `2026-2027::${term}::SUBMITTED`, percentage, createdAt,
})

test('annual result is the mean of the four official quarter results', () => {
  const result = aggregateReportCardResults([
    grade(KCS_QUARTER_TERMS[0], 70),
    grade(KCS_QUARTER_TERMS[1], 80),
    grade(KCS_QUARTER_TERMS[2], 90),
    grade(KCS_QUARTER_TERMS[3], 100),
  ], '2026-2027', 'Annual final').get('student-1:math')
  assert.equal(result?.complete, true)
  assert.equal(result?.percentage, 85)
})

test('annual result uses only available quarters when one is missing', () => {
  const result = aggregateReportCardResults([
    grade(KCS_QUARTER_TERMS[0], 70),
    grade(KCS_QUARTER_TERMS[1], 80),
    grade(KCS_QUARTER_TERMS[2], 90),
  ], '2026-2027', 'Annual final').get('student-1:math')
  assert.equal(result?.complete, false)
  assert.equal(result?.percentage, 80)
  assert.equal(result?.sourceCount, 3)
})

test('a later submission replaces the earlier value for the same quarter', () => {
  const result = aggregateReportCardResults([
    grade(KCS_QUARTER_TERMS[0], 50, '2026-10-01T00:00:00Z'),
    grade(KCS_QUARTER_TERMS[0], 80, '2026-10-02T00:00:00Z'),
  ], '2026-2027', KCS_QUARTER_TERMS[0]).get('student-1:math')
  assert.equal(result?.percentage, 80)
})


test('a single attended quarter is sufficient without substituting missing quarters with zero', () => {
  const result = aggregateReportCardResults([grade(KCS_QUARTER_TERMS[2], 0)], '2026-2027', 'Annual final').get('student-1:math')
  assert.equal(result?.percentage, 0)
  assert.equal(result?.sourceTermCount, 1)
  assert.equal(result?.complete, false)
})
test('semester-only history is supported and quarter details take precedence without double counting', () => {
  const fallback = aggregateReportCardResults([grade('Semester 1',80),grade('Semester 2',90)],'2026-2027','Annual final').get('student-1:math')
  assert.equal(fallback?.percentage,85)
  assert.equal(fallback?.complete,true)
  const mixed = aggregateReportCardResults([grade('Semester 1',20),grade(KCS_QUARTER_TERMS[0],100),grade('Semester 2',70)],'2026-2027','Annual final').get('student-1:math')
  assert.equal(mixed?.percentage,80)
  assert.equal(mixed?.termResults['Semester 1'],undefined)
})
