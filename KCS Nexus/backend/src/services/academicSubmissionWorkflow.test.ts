import assert from 'node:assert/strict'
import test from 'node:test'
import { isVisibleInSuperAdministrationQueue, verifyFinalGradePropagation } from './academicSubmissionWorkflow.js'

test('accepts a complete final-grade propagation only when every register agrees', () => {
  assert.deepEqual(verifyFinalGradePropagation({ expected: 24, savedGrades: 24, officialEnrollments: 24, reportCardDrafts: 24 }), { ok: true, issues: [] })
})

test('rejects a partial grade or report-card propagation', () => {
  const result = verifyFinalGradePropagation({ expected: 24, savedGrades: 23, officialEnrollments: 24, reportCardDrafts: 22 })
  assert.equal(result.ok, false)
  assert.deepEqual(result.issues, ['GRADE_COUNT_MISMATCH', 'REPORT_CARD_COUNT_MISMATCH'])
})

test('recognizes only a fully queued main-teacher report card', () => {
  assert.equal(isVisibleInSuperAdministrationQueue('READY_FOR_REVIEW', 'READY_FOR_REVIEW'), true)
  assert.equal(isVisibleInSuperAdministrationQueue('DRAFT', 'DRAFT'), false)
  assert.equal(isVisibleInSuperAdministrationQueue('READY_FOR_REVIEW', 'DRAFT'), false)
})
