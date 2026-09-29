const PROVIDER_URL = 'https://open.er-api.com/v6/latest/USD'
const FRESH_FOR_MS = 30 * 60_000
const STALE_FOR_MS = 24 * 60 * 60_000

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

async function fetchLatestRate(): Promise<ExchangeRateSnapshot> {
  const response = await fetch(PROVIDER_URL, {
    headers: { accept: 'application/json', 'user-agent': 'KCS-Kitchen/1.0' },
    signal: AbortSignal.timeout(7_000)
  })
  if (!response.ok) throw new Error(`Exchange-rate provider returned ${response.status}`)
  const body = await response.json() as { result?: string; rates?: Record<string, number>; time_last_update_unix?: number }
  const rate = Number(body.rates?.CDF)
  if (body.result !== 'success' || !Number.isFinite(rate) || rate <= 0) throw new Error('Exchange-rate provider returned an invalid USD/CDF rate')
  return { base: 'USD', quote: 'CDF', rate, fetchedAt: new Date().toISOString(), providerUpdatedAt: body.time_last_update_unix ? new Date(body.time_last_update_unix * 1000).toISOString() : null, source: 'ExchangeRate-API', stale: false }
}

export async function getUsdCdfRate(force = false): Promise<ExchangeRateSnapshot> {
  const age = cached ? Date.now() - Date.parse(cached.fetchedAt) : Number.POSITIVE_INFINITY
  if (!force && cached && age < FRESH_FOR_MS) return { ...cached, stale: false }
  if (!inFlight) inFlight = fetchLatestRate().then(snapshot => (cached = snapshot)).finally(() => { inFlight = null })
  try { return await inFlight }
  catch (error) { if (cached && age < STALE_FOR_MS) return { ...cached, stale: true }; throw error }
}
