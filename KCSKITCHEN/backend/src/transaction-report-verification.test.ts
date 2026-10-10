import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildTransactionReportArtifact,
  createTransactionReportDeduplicationKey,
  createTransactionReportDocumentId,
  verifyStoredTransactionReport,
  type StoredTransactionReportProof,
  type TransactionReportRowSnapshot
} from './transaction-report-verification.js'

const key = { keyId: 'report-test-v1', secret: 'a-secure-report-test-secret-2026' }
const periodFrom = new Date('2026-10-01T00:00:00.000Z')
const periodTo = new Date('2026-11-01T00:00:00.000Z')
const rows: TransactionReportRowSnapshot[] = [{
  id: 'transaction-1',
  transactionNumber: 'KIT-20261004-001',
  createdAt: '2026-10-04T10:00:00.000Z',
  personName: 'Test Student',
  cashierName: 'Kitchen Admin',
  subtotal: '10000.00',
  discount: '500.00',
  total: '9500.00',
  currency: 'CDF',
  paymentMode: 'CASH',
  paymentStatus: 'PAID',
  status: 'CONFIRMED'
}]

function issue() {
  return buildTransactionReportArtifact({
    documentId: 'KCS-KIT-REG-20261004-00112233445566778899AABB',
    issuedBy: 'orbit-admin',
    issuedAt: new Date('2026-10-04T12:00:00.000Z'),
    periodFrom,
    periodToExclusive: periodTo,
    filters: { status: null, paymentMode: null },
    currency: 'CDF',
    confirmedSubtotal: '10000.00',
    confirmedDiscount: '500.00',
    confirmedTotal: '9500.00',
    voidedCount: 0,
    rows
  }, key)
}

function stored(): StoredTransactionReportProof {
  const artifact = issue()
  return {
    documentId: artifact.payload.documentId,
    keyId: artifact.payload.keyId,
    version: artifact.payload.version,
    periodFrom,
    periodTo,
    statusFilter: null,
    paymentModeFilter: null,
    currency: 'CDF',
    transactionCount: 1,
    confirmedSubtotal: '10000.00',
    confirmedDiscount: '500.00',
    confirmedTotal: '9500.00',
    voidedCount: 0,
    rowsHash: artifact.rowsHash,
    canonicalPayload: artifact.canonicalPayload,
    payloadHash: artifact.payloadHash,
    signature: artifact.signature,
    revokedAt: null
  }
}

test('official transaction-register proof verifies against its stored snapshot', () => {
  const proof = stored()
  const result = verifyStoredTransactionReport(proof, proof.signature, { [key.keyId]: key.secret })
  assert.equal(result.valid, true)
  if (result.valid) {
    assert.equal(result.payload.transactionCount, 1)
    assert.equal(result.payload.confirmedTotal, '9500.00')
  }
})

test('tampered signature and database totals are rejected', () => {
  const proof = stored()
  const badSignature = proof.signature.slice(0, -1) + (proof.signature.endsWith('A') ? 'B' : 'A')
  assert.equal(verifyStoredTransactionReport(proof, badSignature, { [key.keyId]: key.secret }).status, 'INVALID_SIGNATURE')
  assert.equal(
    verifyStoredTransactionReport({ ...proof, confirmedTotal: '9501.00' }, proof.signature, { [key.keyId]: key.secret }).status,
    'CORRUPTED'
  )
})

test('revoked reports and unknown signing keys never validate', () => {
  const proof = stored()
  assert.equal(
    verifyStoredTransactionReport({ ...proof, revokedAt: new Date() }, proof.signature, { [key.keyId]: key.secret }).status,
    'REVOKED'
  )
  assert.equal(verifyStoredTransactionReport(proof, proof.signature, {}).status, 'UNKNOWN_KEY')
})

test('deduplication changes with rows or filters but remains deterministic', () => {
  const artifact = issue()
  const first = createTransactionReportDeduplicationKey(periodFrom, periodTo, { status: null, paymentMode: null }, artifact.rowsHash)
  const again = createTransactionReportDeduplicationKey(periodFrom, periodTo, { status: null, paymentMode: null }, artifact.rowsHash)
  const filtered = createTransactionReportDeduplicationKey(periodFrom, periodTo, { status: 'CONFIRMED', paymentMode: null }, artifact.rowsHash)
  assert.equal(first, again)
  assert.notEqual(first, filtered)
})

test('transaction-register identifiers carry date plus 96 bits of randomness', () => {
  const first = createTransactionReportDocumentId(new Date('2026-10-04T12:00:00.000Z'))
  const second = createTransactionReportDocumentId(new Date('2026-10-04T12:00:00.000Z'))
  assert.match(first, /^KCS-KIT-REG-20261004-[A-F0-9]{24}$/)
  assert.notEqual(first, second)
})
