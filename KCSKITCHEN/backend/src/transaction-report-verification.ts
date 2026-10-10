import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { canonicalJson, sha256Hex, type StatementSigningKey } from './statement-verification.js'

export const KITCHEN_TRANSACTION_REPORT_VERSION = 1
export const KITCHEN_TRANSACTION_REPORT_MAX_ROWS = 5000
const SIGNING_DOMAIN = `kcs-kitchen-transaction-register:v${KITCHEN_TRANSACTION_REPORT_VERSION}`

export type TransactionReportRowSnapshot = {
  id: string
  transactionNumber: string
  createdAt: string
  personName: string
  cashierName: string
  subtotal: string
  discount: string
  total: string
  currency: string
  paymentMode: string
  paymentStatus: string
  status: string
}

export type TransactionReportFilters = {
  status: string | null
  paymentMode: string | null
}

export type TransactionReportPayload = {
  application: 'KCS Kitchen'
  currency: string
  documentId: string
  filters: TransactionReportFilters
  issuedAt: string
  issuedBy: string
  issuer: 'Kinshasa Christian School'
  keyId: string
  payloadHash: string
  periodFrom: string
  periodToExclusive: string
  rowsHash: string
  transactionCount: number
  confirmedSubtotal: string
  confirmedDiscount: string
  confirmedTotal: string
  voidedCount: number
  version: number
}

export type StoredTransactionReportProof = {
  documentId: string
  keyId: string
  version: number
  periodFrom: Date
  periodTo: Date
  statusFilter: string | null
  paymentModeFilter: string | null
  currency: string
  transactionCount: number
  confirmedSubtotal: { toFixed(fractionDigits: number): string } | string | number
  confirmedDiscount: { toFixed(fractionDigits: number): string } | string | number
  confirmedTotal: { toFixed(fractionDigits: number): string } | string | number
  voidedCount: number
  rowsHash: string
  canonicalPayload: string
  payloadHash: string
  signature: string
  revokedAt: Date | null
}

function fixedMoney(value: StoredTransactionReportProof['confirmedTotal']) {
  if (typeof value === 'object' && value !== null && 'toFixed' in value) return value.toFixed(2)
  return Number(value).toFixed(2)
}

function sign(canonicalPayload: string, key: StatementSigningKey) {
  if (!/^[a-z0-9][a-z0-9._-]{1,63}$/i.test(key.keyId)) throw new Error('Invalid Kitchen report signing key id')
  if (key.secret.length < 16) throw new Error('Kitchen report signing secret is too short')
  return createHmac('sha256', key.secret)
    .update(SIGNING_DOMAIN, 'utf8')
    .update('\0', 'utf8')
    .update(key.keyId, 'utf8')
    .update('\0', 'utf8')
    .update(canonicalPayload, 'utf8')
    .digest('base64url')
}

function secureEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left, 'utf8')
  const rightBuffer = Buffer.from(right, 'utf8')
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

export function createTransactionReportDocumentId(issuedAt = new Date()) {
  const date = issuedAt.toISOString().slice(0, 10).replaceAll('-', '')
  return `KCS-KIT-REG-${date}-${randomBytes(12).toString('hex').toUpperCase()}`
}

export function buildTransactionReportArtifact(input: {
  documentId: string
  issuedBy: string
  issuedAt: Date
  periodFrom: Date
  periodToExclusive: Date
  filters: TransactionReportFilters
  currency: string
  confirmedSubtotal: string
  confirmedDiscount: string
  confirmedTotal: string
  voidedCount: number
  rows: TransactionReportRowSnapshot[]
}, key: StatementSigningKey) {
  const rowsHash = sha256Hex(canonicalJson(input.rows))
  const unsigned = {
    application: 'KCS Kitchen' as const,
    currency: input.currency,
    documentId: input.documentId,
    filters: input.filters,
    issuedAt: input.issuedAt.toISOString(),
    issuedBy: input.issuedBy,
    issuer: 'Kinshasa Christian School' as const,
    keyId: key.keyId,
    periodFrom: input.periodFrom.toISOString(),
    periodToExclusive: input.periodToExclusive.toISOString(),
    rowsHash,
    transactionCount: input.rows.length,
    confirmedSubtotal: input.confirmedSubtotal,
    confirmedDiscount: input.confirmedDiscount,
    confirmedTotal: input.confirmedTotal,
    voidedCount: input.voidedCount,
    version: KITCHEN_TRANSACTION_REPORT_VERSION
  }
  const unsignedCanonical = canonicalJson(unsigned)
  const payloadHash = sha256Hex(unsignedCanonical)
  const payload: TransactionReportPayload = { ...unsigned, payloadHash }
  const canonicalPayload = canonicalJson(payload)
  return {
    payload,
    canonicalPayload,
    payloadHash,
    rowsHash,
    signature: sign(canonicalPayload, key)
  }
}

export function createTransactionReportDeduplicationKey(
  periodFrom: Date,
  periodToExclusive: Date,
  filters: TransactionReportFilters,
  rowsHash: string
) {
  return sha256Hex(canonicalJson({
    kind: 'KCS_KITCHEN_TRANSACTION_REGISTER',
    periodFrom: periodFrom.toISOString(),
    periodToExclusive: periodToExclusive.toISOString(),
    filters,
    rowsHash
  }))
}

export function verifyStoredTransactionReport(
  stored: StoredTransactionReportProof,
  presentedSignature: string,
  keys: Readonly<Record<string, string>>
): { valid: true; status: 'VALID'; payload: TransactionReportPayload } | { valid: false; status: 'INVALID_SIGNATURE' | 'CORRUPTED' | 'UNKNOWN_KEY' | 'REVOKED' } {
  if (stored.revokedAt) return { valid: false, status: 'REVOKED' }
  const secret = keys[stored.keyId]
  if (!secret) return { valid: false, status: 'UNKNOWN_KEY' }
  if (!secureEqual(stored.signature, presentedSignature)) return { valid: false, status: 'INVALID_SIGNATURE' }

  let payload: TransactionReportPayload
  try { payload = JSON.parse(stored.canonicalPayload) as TransactionReportPayload }
  catch { return { valid: false, status: 'CORRUPTED' } }

  const { payloadHash: claimedHash, ...unsigned } = payload
  const computedHash = sha256Hex(canonicalJson(unsigned))
  const expectedSignature = sign(stored.canonicalPayload, { keyId: stored.keyId, secret })
  const databaseMatches = payload.documentId === stored.documentId &&
    payload.keyId === stored.keyId &&
    payload.version === stored.version &&
    payload.periodFrom === stored.periodFrom.toISOString() &&
    payload.periodToExclusive === stored.periodTo.toISOString() &&
    payload.filters.status === stored.statusFilter &&
    payload.filters.paymentMode === stored.paymentModeFilter &&
    payload.currency === stored.currency &&
    payload.transactionCount === stored.transactionCount &&
    payload.confirmedSubtotal === fixedMoney(stored.confirmedSubtotal) &&
    payload.confirmedDiscount === fixedMoney(stored.confirmedDiscount) &&
    payload.confirmedTotal === fixedMoney(stored.confirmedTotal) &&
    payload.voidedCount === stored.voidedCount &&
    payload.rowsHash === stored.rowsHash &&
    claimedHash === stored.payloadHash &&
    computedHash === claimedHash &&
    secureEqual(expectedSignature, stored.signature)

  return databaseMatches ? { valid: true, status: 'VALID', payload } : { valid: false, status: 'CORRUPTED' }
}
