import assert from 'node:assert/strict'
import test from 'node:test'
import { runWithTransactionRetry } from './transaction-retry.js'

test('retries transient serialization conflicts when consecutive orders contend', async () => {
  let attempts = 0
  const result = await runWithTransactionRetry(async () => {
    attempts += 1
    if (attempts < 3) throw Object.assign(new Error('write conflict'), { code: 'P2034' })
    return 'saved'
  }, { delay: async () => undefined })
  assert.equal(result, 'saved')
  assert.equal(attempts, 3)
})

test('does not retry a business validation error', async () => {
  let attempts = 0
  await assert.rejects(() => runWithTransactionRetry(async () => {
    attempts += 1
    throw Object.assign(new Error('insufficient stock'), { statusCode: 409 })
  }, { delay: async () => undefined }), /insufficient stock/)
  assert.equal(attempts, 1)
})

test('retries SQL serialization failures reported by a raw row lock', async () => {
  let attempts = 0
  const result = await runWithTransactionRetry(async () => {
    attempts++
    if (attempts === 1) throw Object.assign(new Error('serialization failure'), { code: 'P2010', meta: { code: '40001' } })
    return 'saved'
  }, { delay: async () => undefined })
  assert.equal(result, 'saved')
  assert.equal(attempts, 2)
})
test('does not retry unrelated SQL errors', async () => {
  let attempts = 0
  await assert.rejects(() => runWithTransactionRetry(async () => {
    attempts++
    throw Object.assign(new Error('invalid SQL'), { code: 'P2010', meta: { code: '42601' } })
  }, { delay: async () => undefined }), /invalid SQL/)
  assert.equal(attempts, 1)
})
