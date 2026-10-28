import test from 'node:test'
import assert from 'node:assert/strict'
import { academicPeriodKey, isKcsAcademicTerm, isSequentialAcademicYear, KCS_ACADEMIC_TERMS } from './academicCycle.js'

test('accepts only a sequential KCS academic year', () => {
  assert.equal(isSequentialAcademicYear('2026-2027'), true)
  assert.equal(isSequentialAcademicYear('2026-2028'), false)
  assert.equal(isSequentialAcademicYear('2026/2027'), false)
})
test('recognizes every official semester and quarter choice', () => {
  KCS_ACADEMIC_TERMS.forEach((term) => assert.equal(isKcsAcademicTerm(term), true))
  assert.equal(isKcsAcademicTerm('Quarter 1'), false)
  assert.equal(isKcsAcademicTerm('Semester 2 · Quarter 2'), false)
})

test('builds a stable course-grade period key', () => {
  assert.equal(
    academicPeriodKey('2026-2027', 'Semester 1 · Quarter 1', 'SUBMITTED'),
    '2026-2027::Semester 1 · Quarter 1::SUBMITTED',
  )
})

