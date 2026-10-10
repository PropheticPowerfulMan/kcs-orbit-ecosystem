import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateSchoolSubsidy } from './staff-subsidy.js'

test('KCS staff and teacher subsidy uses official brackets', () => {
  const cases: Array<[number, number]> = [[0, 0], [4999, 0], [5000, 2000], [9999, 2000], [10000, 4000], [19999, 4000], [20000, 8000], [50000, 8000]]
  for (const [subtotal, expected] of cases) {
    assert.equal(calculateSchoolSubsidy(subtotal, 'TEACHER'), expected)
    assert.equal(calculateSchoolSubsidy(subtotal, 'STAFF'), expected)
  }
})
test('KCS subsidy excludes students and other roles', () => assert.equal(calculateSchoolSubsidy(20000, 'STUDENT'), 0))
