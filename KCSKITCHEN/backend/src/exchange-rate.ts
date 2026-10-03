import { Prisma } from '@prisma/client'
import { prisma } from './db.js'

const PROVIDER_URL = 'https://open.er-api.com/v6/latest/USD'
const FRESH_FOR_MS = 30 * 60_000
const STALE_FOR_MS = 72 * 60 * 60_000
const RATE_ENTITY_TYPE = 'ExchangeRate'
const RATE_ENTITY_ID = 'USD_CDF'
const MIN_PLAUSIBLE_RATE = 100
const MAX_PLAUSIBLE_RATE = 100_000

export type ExchangeRateSnapshot = {
  base: 'USD'
  quote: 'CDF'
  rate: number
  fetchedAt: string
  providerUpdatedAt: string | null
  source: string
  stale: boolean
}

let cached: ExchangeRateSnapshot | null = null
let inFlight: Promise<ExchangeRateSnapshot> | null = null
let hydration: Promise<void> | null = null

function parseSnapshot(value: unknown): ExchangeRateSnapshot | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const candidate = value as Record<string, unknown>
  const rate = Number(candidate.rate)
  const fetchedAt = String(candidate.fetchedAt || '')
  if (candidate.base !== 'USD' || candidate.quote !== 'CDF') return null
  if (!Number.isFinite(rate) || rate < MIN_PLAUSIBLE_RATE || rate > MAX_PLAUSIBLE_RATE) return null
  if (!Number.isFinite(Date.parse(fetchedAt))) return null
  return {
    base: 'USD',
    quote: 'CDF',
    rate,
    fetchedAt,
    providerUpdatedAt: candidate.providerUpdatedAt ? String(candidate.providerUpdatedAt) : null,
    source: String(candidate.source || 'ExchangeRate-API'),
    stale: true
  }
}

async function hydratePersistentCache() {
  if (cached) return
  if (!hydration) {
    hydration = prisma.auditLog.findFirst({
      where: { entityType: RATE_ENTITY_TYPE, entityId: RATE_ENTITY_ID, action: 'EXCHANGE_RATE_REFRESHED' },
      orderBy: { createdAt: 'desc' },
      select: { newValue: true }
    }).then(record => { cached = parseSnapshot(record?.newValue) }).catch(error => {
      console.warn('Unable to hydrate the persistent USD/CDF cache', error)
    }).finally(() => { hydration = null })
  }
  await hydration
}

async function persistSnapshot(snapshot: ExchangeRateSnapshot) {
  try {
    await prisma.auditLog.create({ data: {
      actorId: 'KCS_KITCHEN_SYSTEM',
      actorRole: 'SYSTEM',
      action: 'EXCHANGE_RATE_REFRESHED',
      entityType: RATE_ENTITY_TYPE,
      entityId: RATE_ENTITY_ID,
      newValue: snapshot as unknown as Prisma.InputJsonValue
    } })
  } catch (error) {
    // A live, validated provider response remains usable even if persistence is
    // temporarily unavailable; the next refresh will retry the database write.
    console.warn('Unable to persist the USD/CDF exchange rate', error)
  }
}

async function fetchLatestRate(): Promise<ExchangeRateSnapshot> {
  const response = await fetch(PROVIDER_URL, {
    headers: { accept: 'application/json', 'user-agent': 'KCS-Kitchen/1.0' },
    signal: AbortSignal.timeout(7_000)
  })
  if (!response.ok) throw new Error(`Exchange-rate provider returned ${response.status}`)
  const body = await response.json() as { result?: string; rates?: Record<string, number>; time_last_update_unix?: number }
  const rate = Number(body.rates?.CDF)
  if (body.result !== 'success' || !Number.isFinite(rate) || rate < MIN_PLAUSIBLE_RATE || rate > MAX_PLAUSIBLE_RATE) {
    throw new Error('Exchange-rate provider returned an invalid USD/CDF rate')
  }
  return {
    base: 'USD', quote: 'CDF', rate, fetchedAt: new Date().toISOString(),
    providerUpdatedAt: body.time_last_update_unix ? new Date(body.time_last_update_unix * 1000).toISOString() : null,
    source: 'ExchangeRate-API', stale: false
  }
}

export async function getUsdCdfRate(force = false): Promise<ExchangeRateSnapshot> {
  await hydratePersistentCache()
  const age = cached ? Date.now() - Date.parse(cached.fetchedAt) : Number.POSITIVE_INFINITY
  if (!force && cached && age < FRESH_FOR_MS) return { ...cached, stale: false }
  if (!inFlight) {
    inFlight = fetchLatestRate().then(async snapshot => {
      cached = snapshot
      await persistSnapshot(snapshot)
      return snapshot
    }).finally(() => { inFlight = null })
  }
  try {
    return await inFlight
  } catch (error) {
    const fallbackAge = cached ? Date.now() - Date.parse(cached.fetchedAt) : Number.POSITIVE_INFINITY
    if (cached && fallbackAge < STALE_FOR_MS) return { ...cached, stale: true }
    throw error
  }
}
