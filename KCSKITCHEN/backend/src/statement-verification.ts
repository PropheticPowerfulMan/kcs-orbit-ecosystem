import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

export const KITCHEN_STATEMENT_ISSUER = 'Kinshasa Christian School'
export const KITCHEN_STATEMENT_APPLICATION = 'KCS Kitchen'
export const KITCHEN_STATEMENT_VERSION = 1
export const KITCHEN_STATEMENT_CURRENCY = 'CDF'
export const KITCHEN_STATEMENT_LEGACY_KEY_ID = 'qr-v1'
export const KITCHEN_STATEMENT_DEFAULT_KEY_ID = 'statement-v1'
export const KITCHEN_STATEMENT_MAX_ENTRIES = 5000
export const KITCHEN_STATEMENT_MAX_PERIOD_DAYS = 366

const SIGNING_DOMAIN = `kcs-kitchen-statement:v${KITCHEN_STATEMENT_VERSION}`
const DAY_MS = 24 * 60 * 60_000
const KINSHASA_UTC_OFFSET_MS = 60 * 60_000
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const ISO_WITH_ZONE_PATTERN = /^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:?\d{2})$/i

type CanonicalObject = { [key: string]: unknown }

export type StatementHolderSnapshot = {
  orbitPersonId: string
  displayId: string | null
  fullName: string
  email: string | null
  kind: 'STUDENT' | 'TEACHER' | 'STAFF'
}

export type StatementEntrySnapshot = {
  id: string
  transactionId: string | null
  paymentId: string | null
  type: string
  amount: string
  currency: string
  description: string
  reason: string | null
  performedBy: string
  createdAt: string
}

export type StatementSigningKey = {
  keyId: string
  secret: string
}

export type StatementArtifactInput = {
  documentId: string
  holder: StatementHolderSnapshot
  issuedBy: string
  issuedAt: Date
  periodFrom: Date
  periodToExclusive: Date
  expiresAt: Date | null
  currency: string
  openingBalance: string
  closingBalance: string
  entries: StatementEntrySnapshot[]
}

export type SignedStatementPayload = {
  application: string
  closingBalance: string
  currency: string
  documentId: string
  entries: StatementEntrySnapshot[]
  entriesHash: string
  entryCount: number
  expiresAt: string | null
  holder: StatementHolderSnapshot
  issuedAt: string
  issuedBy: string
  issuer: string
  keyId: string
  openingBalance: string
  payloadHash: string
  periodFrom: string
  periodToExclusive: string
  version: number
}

export type StoredStatementProof = {
  documentId: string
  orbitPersonId: string
  keyId: string
  version: number
  entriesHash: string
  canonicalPayload: string
  payloadHash: string
  signature: string
  expiresAt: Date | null
  revokedAt: Date | null
}

export type StatementVerificationStatus =
  | 'VALID'
  | 'INVALID_SIGNATURE'
  | 'CORRUPTED'
  | 'UNKNOWN_KEY'
  | 'EXPIRED'
  | 'REVOKED'

function canonicalFragment(value: unknown): string {
  if (value === null) return 'null'
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value)
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Canonical JSON accepts finite numbers only')
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) return `[${value.map(item => canonicalFragment(item ?? null)).join(',')}]`
  if (typeof value === 'object') {
    const record = value as CanonicalObject
    const members = Object.keys(record)
      .filter(key => record[key] !== undefined)
      .sort()
      .map(key => `${JSON.stringify(key)}:${canonicalFragment(record[key])}`)
    return `{${members.join(',')}}`
  }
  throw new TypeError(`Unsupported canonical JSON value: ${typeof value}`)
}

export function canonicalJson(value: unknown) {
  return canonicalFragment(value)
}

export function sha256Hex(value: string) {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function assertSigningKey(key: StatementSigningKey) {
  if (!/^[a-z0-9][a-z0-9._-]{1,63}$/i.test(key.keyId)) throw new Error('Invalid Kitchen statement signing key id')
  if (key.secret.length < 16) throw new Error('Kitchen statement signing secret is too short')
}

export function signStatementPayload(canonicalPayload: string, key: StatementSigningKey) {
  assertSigningKey(key)
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

function parseDateOnly(value: string, isEnd: boolean) {
  const match = DATE_ONLY_PATTERN.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const utc = new Date(Date.UTC(year, month - 1, day))
  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) {
    throw new RangeError('Invalid calendar date')
  }
  const localMidnightUtc = utc.getTime() - KINSHASA_UTC_OFFSET_MS
  return new Date(localMidnightUtc + (isEnd ? DAY_MS : 0))
}

function parsePeriodBoundary(value: string, isEnd: boolean) {
  const dateOnly = parseDateOnly(value, isEnd)
  if (dateOnly) return dateOnly
  if (!ISO_WITH_ZONE_PATTERN.test(value)) {
    throw new RangeError('Use YYYY-MM-DD or an ISO timestamp with an explicit timezone')
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) throw new RangeError('Invalid statement date')
  return parsed
}

export function resolveStatementPeriod(
  input: { from?: string; to?: string },
  now = new Date()
) {
  if (Number.isNaN(now.getTime())) throw new RangeError('Invalid issue date')
  const currentKinshasaDate = new Date(now.getTime() + KINSHASA_UTC_OFFSET_MS).toISOString().slice(0, 10)
  const toExclusive = input.to
    ? parsePeriodBoundary(input.to, true)
    : parseDateOnly(currentKinshasaDate, true)!
  const from = input.from
    ? parsePeriodBoundary(input.from, false)
    : new Date(toExclusive.getTime() - KITCHEN_STATEMENT_MAX_PERIOD_DAYS * DAY_MS)
  const duration = toExclusive.getTime() - from.getTime()
  if (duration <= 0) throw new RangeError('The statement period must have a positive duration')
  if (duration > KITCHEN_STATEMENT_MAX_PERIOD_DAYS * DAY_MS) {
    throw new RangeError(`The statement period cannot exceed ${KITCHEN_STATEMENT_MAX_PERIOD_DAYS} days`)
  }
  return { from, toExclusive }
}

export function createStatementDocumentId(issuedAt = new Date(), entropy = randomBytes(12)) {
  if (entropy.length < 12) throw new Error('Statement document entropy must contain at least 12 bytes')
  const date = issuedAt.toISOString().slice(0, 10).replaceAll('-', '')
  return `KCS-KIT-STMT-${date}-${entropy.subarray(0, 12).toString('hex').toUpperCase()}`
}

export function canIssueStatement(
  requester: { orbitPersonId: string; role: string },
  targetOrbitPersonId: string
) {
  return requester.orbitPersonId === targetOrbitPersonId || requester.role === 'KITCHEN_ADMIN'
}

type StatementContent = Omit<
  SignedStatementPayload,
  'documentId' | 'expiresAt' | 'issuedAt' | 'issuedBy' | 'keyId' | 'payloadHash'
>

export function createStatementDeduplicationKey(
  orbitPersonId: string,
  periodFrom: Date,
  periodToExclusive: Date,
  payloadHash: string
) {
  return sha256Hex(canonicalJson({
    orbitPersonId,
    payloadHash,
    periodFrom: periodFrom.toISOString(),
    periodToExclusive: periodToExclusive.toISOString()
  }))
}

export function buildStatementArtifact(input: StatementArtifactInput, key: StatementSigningKey) {
  assertSigningKey(key)
  if (input.currency !== KITCHEN_STATEMENT_CURRENCY) {
    throw new Error(`Kitchen statements must use ${KITCHEN_STATEMENT_CURRENCY}`)
  }
  const entries = [...input.entries].sort((left, right) => {
    const byDate = left.createdAt.localeCompare(right.createdAt)
    return byDate || left.id.localeCompare(right.id)
  })
  if (entries.some(entry => entry.currency !== input.currency)) {
    throw new Error('Mixed-currency Kitchen statements are not allowed')
  }
  const entriesHash = sha256Hex(canonicalJson(entries))
  const content: StatementContent = {
    application: KITCHEN_STATEMENT_APPLICATION,
    closingBalance: input.closingBalance,
    currency: input.currency,
    entries,
    entriesHash,
    entryCount: entries.length,
    holder: input.holder,
    issuer: KITCHEN_STATEMENT_ISSUER,
    openingBalance: input.openingBalance,
    periodFrom: input.periodFrom.toISOString(),
    periodToExclusive: input.periodToExclusive.toISOString(),
    version: KITCHEN_STATEMENT_VERSION
  }
  const payloadHash = sha256Hex(canonicalJson(content))
  const payload: SignedStatementPayload = {
    ...content,
    documentId: input.documentId,
    expiresAt: input.expiresAt?.toISOString() ?? null,
    issuedAt: input.issuedAt.toISOString(),
    issuedBy: input.issuedBy,
    keyId: key.keyId,
    payloadHash
  }
  const canonicalPayload = canonicalJson(payload)
  const signature = signStatementPayload(canonicalPayload, key)
  return { payload, canonicalPayload, payloadHash, signature, entriesHash }
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function parseSignedPayload(value: string): SignedStatementPayload | null {
  try {
    const payload = JSON.parse(value) as Partial<SignedStatementPayload>
    const holder = payload.holder as Partial<StatementHolderSnapshot> | undefined
    if (
      typeof payload.application !== 'string' ||
      typeof payload.closingBalance !== 'string' ||
      typeof payload.currency !== 'string' ||
      typeof payload.documentId !== 'string' ||
      !Array.isArray(payload.entries) ||
      typeof payload.entriesHash !== 'string' ||
      typeof payload.entryCount !== 'number' ||
      !isNullableString(payload.expiresAt) ||
      !holder ||
      typeof holder.orbitPersonId !== 'string' ||
      !isNullableString(holder.displayId) ||
      typeof holder.fullName !== 'string' ||
      !isNullableString(holder.email) ||
      !['STUDENT', 'TEACHER', 'STAFF'].includes(String(holder.kind)) ||
      typeof payload.issuedAt !== 'string' ||
      typeof payload.issuedBy !== 'string' ||
      typeof payload.issuer !== 'string' ||
      typeof payload.keyId !== 'string' ||
      typeof payload.openingBalance !== 'string' ||
      typeof payload.payloadHash !== 'string' ||
      typeof payload.periodFrom !== 'string' ||
      typeof payload.periodToExclusive !== 'string' ||
      typeof payload.version !== 'number'
    ) return null
    return payload as SignedStatementPayload
  } catch {
    return null
  }
}

function contentFromPayload(payload: SignedStatementPayload): StatementContent {
  return {
    application: payload.application,
    closingBalance: payload.closingBalance,
    currency: payload.currency,
    entries: payload.entries,
    entriesHash: payload.entriesHash,
    entryCount: payload.entryCount,
    holder: payload.holder,
    issuer: payload.issuer,
    openingBalance: payload.openingBalance,
    periodFrom: payload.periodFrom,
    periodToExclusive: payload.periodToExclusive,
    version: payload.version
  }
}

export function verifyStoredStatement(
  proof: StoredStatementProof,
  presentedSignature: string,
  keys: Readonly<Record<string, string>>,
  now = new Date()
): { valid: false; status: Exclude<StatementVerificationStatus, 'VALID'> } |
   { valid: true; status: 'VALID'; payload: SignedStatementPayload } {
  const secret = keys[proof.keyId]
  if (!secret) return { valid: false, status: 'UNKNOWN_KEY' }
  const key = { keyId: proof.keyId, secret }
  const computedSignature = signStatementPayload(proof.canonicalPayload, key)
  if (!secureEqual(computedSignature, proof.signature)) return { valid: false, status: 'CORRUPTED' }
  if (!secureEqual(proof.signature, presentedSignature)) return { valid: false, status: 'INVALID_SIGNATURE' }

  const payload = parseSignedPayload(proof.canonicalPayload)
  if (!payload) return { valid: false, status: 'CORRUPTED' }
  const computedEntriesHash = sha256Hex(canonicalJson(payload.entries))
  const computedPayloadHash = sha256Hex(canonicalJson(contentFromPayload(payload)))
  const metadataMatches =
    payload.documentId === proof.documentId &&
    payload.holder.orbitPersonId === proof.orbitPersonId &&
    payload.keyId === proof.keyId &&
    payload.version === proof.version &&
    payload.currency === KITCHEN_STATEMENT_CURRENCY &&
    payload.entryCount === payload.entries.length &&
    payload.entriesHash === proof.entriesHash &&
    payload.payloadHash === proof.payloadHash
  if (
    !metadataMatches ||
    !secureEqual(computedEntriesHash, proof.entriesHash) ||
    !secureEqual(computedPayloadHash, proof.payloadHash)
  ) return { valid: false, status: 'CORRUPTED' }

  if (proof.revokedAt) return { valid: false, status: 'REVOKED' }
  const storedExpiry = proof.expiresAt?.toISOString() ?? null
  if (payload.expiresAt !== storedExpiry) return { valid: false, status: 'CORRUPTED' }
  const signedExpiry = payload.expiresAt ? new Date(payload.expiresAt) : null
  if (signedExpiry && Number.isNaN(signedExpiry.getTime())) return { valid: false, status: 'CORRUPTED' }
  if (signedExpiry && signedExpiry.getTime() <= now.getTime()) {
    return { valid: false, status: 'EXPIRED' }
  }
  return { valid: true, status: 'VALID', payload }
}
