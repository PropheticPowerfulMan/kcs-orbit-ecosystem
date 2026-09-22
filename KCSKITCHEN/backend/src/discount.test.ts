import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateDiscount } from './discount.js'

test('teacher threshold rule preserves the exact purchase price and computes a configurable target', () => {
  const result = calculateDiscount(10000, [{
    id: 'rule-1',
    name: 'Teacher threshold',
    type: 'THRESHOLD_FIXED_TOTAL',
    thresholdAmount: 10000,
    fixedAmount: null,
    targetAmount: 6000,
    percentage: null,
    requiresApproval: false
  }])
  assert.equal(result.discount, 4000)
  assert.equal(result.finalAmount, 6000)
})

test('a rule awaiting approval is never applied silently', () => {
  const result = calculateDiscount(10000, [{
    id: 'rule-1',
    name: 'Manual',
    type: 'FIXED_AMOUNT',
    thresholdAmount: 0,
    fixedAmount: 1000,
    targetAmount: null,
    percentage: null,
    requiresApproval: true
  }])
  assert.equal(result.discount, 0)
  assert.equal(result.finalAmount, 10000)
})
