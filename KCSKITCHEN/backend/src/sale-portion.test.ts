import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveSalePortion } from './sale-portion.js'
import { calculateSchoolSubsidy } from './staff-subsidy.js'

test('an amount buys the corresponding portion without changing the menu reference price', () => {
  assert.deepEqual(resolveSalePortion({ amount: 6000, amountCurrency: 'CDF' }, 10000), { quantity: 0.6, unitPriceCdf: 10000, subtotal: 6000, amountBased: true })
})
test('USD budgets use the reliable exchange rate and retain exact monetary totals', () => {
  const portion = resolveSalePortion({ amount: 1.25, amountCurrency: 'USD' }, 10000, 2800)
  assert.equal(portion.subtotal, 3500)
  assert.equal(portion.quantity, 0.35)
  assert.equal(resolveSalePortion({ amount: 3333.33 }, 10000).subtotal, 3333.33)
})
test('normal quantity sales retain their existing semantics', () => {
  assert.deepEqual(resolveSalePortion({ quantity: 2 }, 5000), { quantity: 2, unitPriceCdf: 5000, subtotal: 10000, amountBased: false })
})
test('subsidy thresholds use the real food purchase amount', () => {
  for (const [amount, expected] of [[4999, 0], [5000, 2000], [9999, 2000], [10000, 4000], [19999, 4000], [20000, 8000]]) {
    assert.equal(calculateSchoolSubsidy(resolveSalePortion({ amount }, 10000).subtotal, 'TEACHER'), expected)
  }
})
test('ambiguous, unpriced, undersized and unsupported-precision portions fail safely', () => {
  assert.throws(() => resolveSalePortion({ amount: 1000, quantity: 1 }, 5000))
  assert.throws(() => resolveSalePortion({ amount: 10 }, 0))
  assert.throws(() => resolveSalePortion({ amount: 0.01 }, 10000))
  assert.throws(() => resolveSalePortion({ amount: 2, amountCurrency: 'USD' }, 5000))
  assert.throws(() => resolveSalePortion({ quantity: 1.0001 }, 5000))
})
