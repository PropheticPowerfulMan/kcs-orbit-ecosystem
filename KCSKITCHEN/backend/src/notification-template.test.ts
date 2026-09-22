import assert from 'node:assert/strict'
import test from 'node:test'
import { buildKitchenNotification } from './notification-template.js'

test('transaction notification carries the immutable receipt reference and amount', () => {
  const result = buildKitchenNotification('KITCHEN_TRANSACTION_CREATED', {
    transactionNumber: 'KITCHEN-2026-000001',
    total: 6000,
    paymentMode: 'CREDIT'
  })
  assert.match(result.title, /KITCHEN-2026-000001/)
  assert.match(result.text, /6.?000 CDF/)
  assert.match(result.text, /CREDIT/)
})

test('unknown events remain safe and understandable', () => {
  assert.match(buildKitchenNotification('UNKNOWN', {}).text, /tableau de bord/)
})
