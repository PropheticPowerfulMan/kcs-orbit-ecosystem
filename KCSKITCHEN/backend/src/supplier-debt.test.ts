import assert from 'node:assert/strict'
import test from 'node:test'
import { summarizeSupplierDebt } from './supplier-debt.js'

test('keeps CDF and USD debt separate and converts with the supplied rate', () => {
  const result = summarizeSupplierDebt([
    { currency: 'CDF', balance: '5000' },
    { currency: 'USD', balance: '2' },
    { currency: 'CDF', balance: '1000' }
  ], 2800)
  assert.deepEqual(result.byCurrency, { CDF: 6000, USD: 2 })
  assert.deepEqual(result.convertedTotals, { CDF: 11600, USD: 2 + 6000 / 2800 })
})

test('never adds currencies raw when no exchange rate is available', () => {
  const result = summarizeSupplierDebt([{ currency: 'CDF', balance: 5000 }, { currency: 'USD', balance: 2 }], null)
  assert.deepEqual(result.byCurrency, { CDF: 5000, USD: 2 })
  assert.equal(result.convertedTotals, null)
  assert.equal(result.rateApplied, null)
})
