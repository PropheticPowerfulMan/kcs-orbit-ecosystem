import assert from 'node:assert/strict'
import test from 'node:test'
import { isRetryableMailFailure, mailRetryDelayMs } from './outboundMailQueue.js'

test('retries temporary LWS SMTP connection and hourly rate limits', () => {
  assert.equal(isRetryableMailFailure('SMTP_SEND_FAILED', '421 4.7.0 too many connections'), true)
  assert.equal(isRetryableMailFailure('SMTP_SEND_FAILED', '450 4.7.1 max 120 mails per sender 1h'), true)
  assert.equal(mailRetryDelayMs('421 4.7.0 too many connections', 1), 5 * 60_000)
  assert.equal(mailRetryDelayMs('450 4.7.1 max 120 mails per sender 1h', 1), 66 * 60_000)
})

test('retries network failures with bounded exponential backoff', () => {
  assert.equal(isRetryableMailFailure('SMTP_SEND_FAILED', 'Connection timeout'), true)
  assert.equal(mailRetryDelayMs('Connection timeout', 1), 5 * 60_000)
  assert.equal(mailRetryDelayMs('Connection timeout', 4), 40 * 60_000)
  assert.equal(mailRetryDelayMs('Connection timeout', 20), 60 * 60_000)
})

test('does not retry permanent SMTP rejection', () => {
  assert.equal(isRetryableMailFailure('SMTP_SEND_FAILED', '550 5.1.1 mailbox unavailable'), false)
})

test('keeps messages queued while SMTP configuration is temporarily unavailable', () => {
  assert.equal(isRetryableMailFailure('SMTP_NOT_CONFIGURED'), true)
})
