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
