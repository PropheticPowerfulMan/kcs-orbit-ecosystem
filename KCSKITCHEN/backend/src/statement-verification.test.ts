import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildStatementArtifact,
  canIssueStatement,
  canonicalJson,
  createStatementDeduplicationKey,
  createStatementDocumentId,
  KITCHEN_STATEMENT_CURRENCY,
  KITCHEN_STATEMENT_MAX_ENTRIES,
  resolveStatementPeriod,
  verifyStoredStatement,
  type StatementEntrySnapshot
} from './statement-verification.js'

const secret = 'unit-test-statement-signing-secret-2026'
const key = { keyId: 'statement-test-v1', secret }
const issuedAt = new Date('2026-10-04T12:00:00.000Z')
const holder = {
  orbitPersonId: 'KCS-STU-001',
  displayId: 'STU-001',
  fullName: 'Student Example',
  email: 'student@example.org',
  kind: 'STUDENT' as const
}

const entries: StatementEntrySnapshot[] = [
  {
    id: 'entry-2',
    transactionId: null,
    paymentId: 'payment-1',
    type: 'PAYMENT',
    amount: '-1500.00',
    currency: 'CDF',
    description: 'Payment received',
    reason: null,
    performedBy: 'cashier-1',
    createdAt: '2026-10-04T10:00:00.000Z'
  },
  {
    id: 'entry-1',
    transactionId: 'transaction-1',
    paymentId: null,
    type: 'PURCHASE',
    amount: '3000.00',
    currency: 'CDF',
    description: 'Lunch',
    reason: null,
    performedBy: 'cashier-1',
    createdAt: '2026-10-03T10:00:00.000Z'
  }
]

function artifact(overrides: Partial<Parameters<typeof buildStatementArtifact>[0]> = {}) {
  return buildStatementArtifact({
    documentId: 'KCS-KIT-STMT-20261004-00112233445566778899AABB',
    holder,
    issuedBy: holder.orbitPersonId,
    issuedAt,
    periodFrom: new Date('2026-10-01T00:00:00.000Z'),
    periodToExclusive: new Date('2026-11-01T00:00:00.000Z'),
    expiresAt: null,
    currency: KITCHEN_STATEMENT_CURRENCY,
    openingBalance: '0.00',
    closingBalance: '1500.00',
    entries,
    ...overrides
  }, key)
}

function stored(result = artifact()) {
  return {
    documentId: result.payload.documentId,
    orbitPersonId: result.payload.holder.orbitPersonId,
    keyId: result.payload.keyId,
    version: result.payload.version,
    entriesHash: result.entriesHash,
    canonicalPayload: result.canonicalPayload,
    payloadHash: result.payloadHash,
    signature: result.signature,
    expiresAt: result.payload.expiresAt ? new Date(result.payload.expiresAt) : null,
    revokedAt: null
  }
}

test('canonical proof is stable regardless of object keys and ledger query order', () => {
  assert.equal(canonicalJson({ z: 1, a: { y: 2, b: true } }), canonicalJson({ a: { b: true, y: 2 }, z: 1 }))
  const first = artifact()
  const reordered = artifact({ entries: [...entries].reverse() })
  assert.equal(first.entriesHash, reordered.entriesHash)
  assert.equal(first.payloadHash, reordered.payloadHash)
  assert.equal(first.signature, reordered.signature)
})

test('payload hash and deduplication key ignore issue metadata but change with ledger content', () => {
  const first = artifact()
  const reissued = artifact({
    documentId: 'KCS-KIT-STMT-20261005-FFEEDDCCBBAA998877665544',
    issuedAt: new Date('2026-10-05T12:00:00.000Z'),
    issuedBy: 'KCS-ADMIN-1'
  })
  assert.equal(first.payloadHash, reissued.payloadHash)
  const firstKey = createStatementDeduplicationKey(holder.orbitPersonId, new Date(first.payload.periodFrom), new Date(first.payload.periodToExclusive), first.payloadHash)
  const secondKey = createStatementDeduplicationKey(holder.orbitPersonId, new Date(reissued.payload.periodFrom), new Date(reissued.payload.periodToExclusive), reissued.payloadHash)
  assert.equal(firstKey, secondKey)

  const changed = artifact({ entries: entries.map(entry => entry.id === 'entry-1' ? { ...entry, amount: '3000.01' } : entry) })
  assert.notEqual(changed.payloadHash, first.payloadHash)
})

test('current and legacy key ids verify only through their registered secret', () => {
  const current = artifact()
  assert.equal(verifyStoredStatement(stored(current), current.signature, { [key.keyId]: secret }).status, 'VALID')

  const legacyKey = { keyId: 'qr-v1', secret: 'legacy-qr-signing-secret-2026' }
  const legacy = buildStatementArtifact({
    documentId: 'KCS-KIT-STMT-20261004-AABBCCDDEEFF001122334455',
    holder,
    issuedBy: holder.orbitPersonId,
    issuedAt,
    periodFrom: new Date('2026-10-01T00:00:00.000Z'),
    periodToExclusive: new Date('2026-11-01T00:00:00.000Z'),
    expiresAt: null,
    currency: 'CDF',
    openingBalance: '0.00',
    closingBalance: '1500.00',
    entries
  }, legacyKey)
  assert.equal(verifyStoredStatement(stored(legacy), legacy.signature, { [legacyKey.keyId]: legacyKey.secret }).status, 'VALID')
  assert.equal(verifyStoredStatement(stored(legacy), legacy.signature, { [key.keyId]: secret }).status, 'UNKNOWN_KEY')
})

test('tampered proof, wrong presented signature and holder mismatch are rejected', () => {
  const result = artifact()
  const proof = stored(result)
  assert.equal(verifyStoredStatement({ ...proof, canonicalPayload: proof.canonicalPayload + ' ' }, result.signature, { [key.keyId]: secret }).status, 'CORRUPTED')
  assert.equal(verifyStoredStatement(proof, 'A'.repeat(43), { [key.keyId]: secret }).status, 'INVALID_SIGNATURE')
  assert.equal(verifyStoredStatement({ ...proof, orbitPersonId: 'KCS-STU-OTHER' }, result.signature, { [key.keyId]: secret }).status, 'CORRUPTED')
})

test('revoked and expired proofs never validate', () => {
  const result = artifact({ expiresAt: new Date('2026-10-04T11:59:59.000Z') })
  const proof = stored(result)
  assert.equal(verifyStoredStatement({ ...proof, revokedAt: new Date() }, result.signature, { [key.keyId]: secret }, issuedAt).status, 'REVOKED')
  assert.equal(verifyStoredStatement(proof, result.signature, { [key.keyId]: secret }, issuedAt).status, 'EXPIRED')
  assert.equal(verifyStoredStatement({ ...proof, expiresAt: null }, result.signature, { [key.keyId]: secret }, issuedAt).status, 'CORRUPTED')
})

test('only the account owner or a Kitchen administrator may issue a statement', () => {
  assert.equal(canIssueStatement({ orbitPersonId: 'person-1', role: 'STUDENT' }, 'person-1'), true)
  assert.equal(canIssueStatement({ orbitPersonId: 'admin-1', role: 'KITCHEN_ADMIN' }, 'person-1'), true)
  assert.equal(canIssueStatement({ orbitPersonId: 'finance-1', role: 'FINANCE' }, 'person-1'), false)
  assert.equal(canIssueStatement({ orbitPersonId: 'person-2', role: 'TEACHER' }, 'person-1'), false)
})

test('date-only periods use Africa/Kinshasa day bounds with an exclusive end', () => {
  const period = resolveStatementPeriod({ from: '2026-10-01', to: '2026-10-04' }, issuedAt)
  assert.equal(period.from.toISOString(), '2026-09-30T23:00:00.000Z')
  assert.equal(period.toExclusive.toISOString(), '2026-10-04T23:00:00.000Z')
})

test('default period covers complete Kinshasa calendar days', () => {
  const period = resolveStatementPeriod({}, new Date('2026-10-04T23:30:00.000Z'))
  assert.equal(period.toExclusive.toISOString(), '2026-10-05T23:00:00.000Z')
  assert.equal(period.toExclusive.getTime() - period.from.getTime(), 366 * 24 * 60 * 60_000)
})

test('ISO bounds remain exact and periods over 366 days or invalid dates are rejected', () => {
  const exact = resolveStatementPeriod({
    from: '2026-10-01T08:30:00.000Z',
    to: '2026-10-02T09:45:00+01:00'
  }, issuedAt)
  assert.equal(exact.from.toISOString(), '2026-10-01T08:30:00.000Z')
  assert.equal(exact.toExclusive.toISOString(), '2026-10-02T08:45:00.000Z')
  assert.throws(() => resolveStatementPeriod({ from: '2025-01-01T00:00:00Z', to: '2026-01-03T00:00:00Z' }, issuedAt), /366 days/)
  assert.throws(() => resolveStatementPeriod({ from: '2026-02-30', to: '2026-03-02' }, issuedAt), /Invalid calendar date/)
  assert.throws(() => resolveStatementPeriod({ from: '2026-10-01T10:00:00', to: '2026-10-02T10:00:00' }, issuedAt), /explicit timezone/)
})

test('mixed or non-CDF entries cannot be signed into an official statement', () => {
  assert.throws(() => artifact({
    entries: entries.map((entry, index) => index === 0 ? { ...entry, currency: 'USD' } : entry)
  }), /Mixed-currency/)
})

test('document identifiers have 96 bits of entropy and entry cap remains explicit', () => {
  assert.equal(createStatementDocumentId(issuedAt, Buffer.from('00112233445566778899aabb', 'hex')), 'KCS-KIT-STMT-20261004-00112233445566778899AABB')
  assert.equal(KITCHEN_STATEMENT_MAX_ENTRIES, 5000)
})
