import assert from 'node:assert/strict'
import test from 'node:test'
import { createCorsOptions } from '../src/cors'

function checkOrigin(origin: string | undefined) {
  return new Promise<{ error: (Error & { status?: number }) | null; allowed?: boolean }>((resolve) => {
    const option = createCorsOptions(new Set(['https://edupay.example.test'])).origin
    if (typeof option !== 'function') throw new Error('CORS origin validator is unavailable')
    option(origin, (error, allowed) => resolve({ error, allowed }))
  })
}

test('allows the configured frontend origin', async () => {
  const result = await checkOrigin('https://edupay.example.test')
  assert.equal(result.error, null)
  assert.equal(result.allowed, true)
})

test('rejects a forbidden origin with status 403', async () => {
  const result = await checkOrigin('https://hostile.example.test')
  assert.equal(result.error?.status, 403)
  assert.equal(result.error?.message, 'CORS origin not allowed')
})