import assert from 'node:assert/strict'
import test from 'node:test'
import { assertPasswordDoesNotContainIdentity, passwordPolicyIssues } from './passwordPolicy.js'

test('accepts a long unpredictable password', () => {
  assert.deepEqual(passwordPolicyIssues('T7!vQ2#nL9@xR4$z'), [])
})

test('rejects weak and personally identifiable passwords', () => {
  assert.ok(passwordPolicyIssues('Password123!').length > 0)
  assert.ok(assertPasswordDoesNotContainIdentity('Jonathan!Secure2026', { firstName: 'Jonathan' }).length > 0)
})
