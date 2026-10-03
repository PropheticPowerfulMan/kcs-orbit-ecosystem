import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowLeftRight, RefreshCw, TrendingUp } from 'lucide-react'
import { api, money } from './api'

export type ExchangeRate = { base: 'USD'; quote: 'CDF'; rate: number; fetchedAt: string; providerUpdatedAt: string | null; source: string; stale: boolean }
export type DisplayCurrency = 'CDF' | 'USD'

type CurrencyDisplayState = {
  rate: ExchangeRate | null
  loading: boolean
  error: string
  displayCurrency: DisplayCurrency
  setDisplayCurrency: (currency: DisplayCurrency) => void
  refresh: (force?: boolean) => Promise<void>
}

const CurrencyDisplayContext = createContext<CurrencyDisplayState | null>(null)
const RATE_CACHE_KEY = 'kcs-kitchen-usd-cdf-rate:v1'
const RATE_CACHE_MAX_AGE_MS = 72 * 60 * 60_000
const AUTO_REFRESH_MS = 10 * 60_000
const FORCE_REFRESH_AFTER_MS = 30 * 60_000
const MIN_RETRY_GAP_MS = 60_000

function readCachedRate(): ExchangeRate | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(RATE_CACHE_KEY) || 'null') as ExchangeRate | null
    const fetchedAt = parsed ? Date.parse(parsed.fetchedAt) : Number.NaN
    if (!parsed || parsed.base !== 'USD' || parsed.quote !== 'CDF' || !Number.isFinite(parsed.rate) || parsed.rate <= 0 || !Number.isFinite(fetchedAt)) return null
    if (Date.now() - fetchedAt > RATE_CACHE_MAX_AGE_MS) return null
    return { ...parsed, stale: true }
  } catch {
    return null
  }
}

function cacheRate(rate: ExchangeRate) {
  try { localStorage.setItem(RATE_CACHE_KEY, JSON.stringify(rate)) } catch { /* Private mode or full storage: memory state remains available. */ }
}

export function useExchangeRate() {
  const initialRate = useMemo(() => readCachedRate(), [])
  const [rate, setRate] = useState<ExchangeRate | null>(initialRate)
  const [loading, setLoading] = useState(!initialRate)
  const [error, setError] = useState('')
  const rateRef = useRef<ExchangeRate | null>(initialRate)
  const lastAttemptRef = useRef(0)
  const inFlightRef = useRef<Promise<void> | null>(null)

  const refresh = useCallback(async (force = false) => {
    if (inFlightRef.current) return inFlightRef.current
    const task = (async () => {
      lastAttemptRef.current = Date.now()
      setLoading(true)
      setError('')
      try {
        const latest = await api<ExchangeRate>('/exchange-rate' + (force ? '?refresh=true' : ''))
        rateRef.current = latest
        setRate(latest)
        cacheRate(latest)
      } catch (err) {
        setError((err as Error).message)
        if (!rateRef.current) {
          const cached = readCachedRate()
          rateRef.current = cached
          setRate(cached)
        }
      } finally {
        setLoading(false)
      }
    })()
    inFlightRef.current = task
    try { await task } finally { inFlightRef.current = null }
  }, [])

  const refreshIfNeeded = useCallback(() => {
    if (Date.now() - lastAttemptRef.current < MIN_RETRY_GAP_MS) return
    const fetchedAt = rateRef.current ? Date.parse(rateRef.current.fetchedAt) : Number.NaN
    const mustRefreshProvider = !Number.isFinite(fetchedAt) || Date.now() - fetchedAt >= FORCE_REFRESH_AFTER_MS
    void refresh(mustRefreshProvider)
  }, [refresh])

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(refreshIfNeeded, AUTO_REFRESH_MS)
    const resume = () => refreshIfNeeded()
    const visible = () => { if (document.visibilityState === 'visible') refreshIfNeeded() }
    window.addEventListener('focus', resume)
    window.addEventListener('online', resume)
    document.addEventListener('visibilitychange', visible)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', resume)
      window.removeEventListener('online', resume)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [refresh, refreshIfNeeded])

  return { rate, loading, error, refresh }
}

export function CurrencyDisplayProvider({ children, userKey }: { children: ReactNode; userKey: string }) {
  const exchange = useExchangeRate()
  const storageKey = 'kcs-kitchen-display-currency:' + userKey
  const [displayCurrency, setDisplayCurrencyState] = useState<DisplayCurrency>(() => localStorage.getItem(storageKey) === 'USD' ? 'USD' : 'CDF')
  useEffect(() => {
    const saved = localStorage.getItem(storageKey)
    setDisplayCurrencyState(saved === 'USD' ? 'USD' : 'CDF')
  }, [storageKey])
  function setDisplayCurrency(currency: DisplayCurrency) {
    localStorage.setItem(storageKey, currency)
    setDisplayCurrencyState(currency)
  }
  return <CurrencyDisplayContext.Provider value={{ ...exchange, displayCurrency, setDisplayCurrency }}>{children}</CurrencyDisplayContext.Provider>
}

export function useCurrencyDisplay() {
  const context = useContext(CurrencyDisplayContext)
  if (!context) throw new Error('CurrencyDisplayProvider is missing')
  return context
}

export function convertAmount(value: unknown, currency: string, displayCurrency: DisplayCurrency, rate: ExchangeRate | null) {
  const amount = Number(value || 0)
  if (currency === displayCurrency) return amount
  if (!rate) return null
  return currency === 'USD' ? amount * rate.rate : amount / rate.rate
}

export function DisplayMoney({ value, currency = 'CDF', className = '' }: { value: unknown; currency?: string; className?: string }) {
  const { rate, displayCurrency } = useCurrencyDisplay()
  const converted = useMemo(() => convertAmount(value, currency, displayCurrency, rate), [value, currency, displayCurrency, rate])
  const targetCurrency = converted === null ? currency : displayCurrency
  const amount = converted === null ? Number(value || 0) : converted
  return <span className={'display-money ' + className} title={currency === targetCurrency ? undefined : money(value, currency)}>{money(amount, targetCurrency)}</span>
}

export function ExchangeRateCard({ lang, compact = false }: { lang: 'fr' | 'en'; compact?: boolean }) {
  const { rate, loading, error, refresh, displayCurrency, setDisplayCurrency } = useCurrencyDisplay()
  const value = rate ? '1 USD = ' + money(rate.rate, 'CDF') : (loading ? '…' : (lang === 'fr' ? 'Indisponible' : 'Unavailable'))
  return <div className={compact ? 'fx-card compact' : 'fx-card'}>
    <TrendingUp />
    <span><small>{lang === 'fr' ? 'TAUX USD / CDF ACTUALISÉ' : 'LIVE USD / CDF RATE'}</small><b>{value}</b>{rate && <em>{rate.stale ? (lang === 'fr' ? 'Dernier taux fiable' : 'Last reliable rate') : <a href="https://www.exchangerate-api.com" target="_blank" rel="noreferrer">Rates by ExchangeRate-API</a>}</em>}{error && <em>{lang === 'fr' ? 'Nouvel essai automatique' : 'Automatic retry enabled'}</em>}</span>
    <div className="fx-toggle" role="group" aria-label={lang === 'fr' ? "Devise d'affichage de ce dashboard" : 'Display currency for this dashboard'}>
      <ArrowLeftRight />
      {(['CDF', 'USD'] as DisplayCurrency[]).map(currency => <button key={currency} className={displayCurrency === currency ? 'active' : ''} onClick={() => setDisplayCurrency(currency)} aria-pressed={displayCurrency === currency}>{currency}</button>)}
    </div>
    <button className="fx-refresh" onClick={() => void refresh(true)} disabled={loading} aria-label={lang === 'fr' ? 'Actualiser le taux' : 'Refresh rate'}><RefreshCw className={loading ? 'spin' : ''} /></button>
  </div>
}
