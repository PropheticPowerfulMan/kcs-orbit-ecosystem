import { useEffect, useMemo, useState } from 'react'
import { RefreshCw, TrendingUp } from 'lucide-react'
import { api, money } from './api'

export type ExchangeRate = { base: 'USD'; quote: 'CDF'; rate: number; fetchedAt: string; providerUpdatedAt: string | null; source: string; stale: boolean }

export function useExchangeRate() {
  const [rate, setRate] = useState<ExchangeRate | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  async function refresh(force = false) {
    setLoading(true); setError('')
    try { setRate(await api<ExchangeRate>('/exchange-rate' + (force ? '?refresh=true' : ''))) }
    catch (err) { setError((err as Error).message) }
    finally { setLoading(false) }
  }
  useEffect(() => { void refresh(); const timer = window.setInterval(() => void refresh(), 15 * 60_000); return () => window.clearInterval(timer) }, [])
  return { rate, loading, error, refresh }
}

export function convertedMoney(value: unknown, currency: string, rate: ExchangeRate | null) {
  if (!rate) return null
  const amount = Number(value || 0)
  return currency === 'USD' ? money(amount * rate.rate, 'CDF') : money(amount / rate.rate, 'USD')
}

export function DualMoney({ value, currency = 'CDF', rate, compact = false }: { value: unknown; currency?: string; rate: ExchangeRate | null; compact?: boolean }) {
  const converted = useMemo(() => convertedMoney(value, currency, rate), [value, currency, rate])
  return <span className={compact ? 'dual-money compact' : 'dual-money'}><b>{money(value, currency)}</b>{converted && <small>≈ {converted}</small>}</span>
}

export function ExchangeRateCard({ lang, compact = false }: { lang: 'fr' | 'en'; compact?: boolean }) {
  const { rate, loading, error, refresh } = useExchangeRate()
  const value = rate ? '1 USD = ' + money(rate.rate, 'CDF') : (loading ? '…' : (lang === 'fr' ? 'Indisponible' : 'Unavailable'))
  return <div className={compact ? 'fx-card compact' : 'fx-card'}>
    <TrendingUp />
    <span><small>{lang === 'fr' ? 'TAUX USD / CDF ACTUALISÉ' : 'LIVE USD / CDF RATE'}</small><b>{value}</b>{rate && <em>{rate.stale ? (lang === 'fr' ? 'Dernier taux fiable' : 'Last reliable rate') : <a href="https://www.exchangerate-api.com" target="_blank" rel="noreferrer">Rates by ExchangeRate-API</a>}</em>}{error && <em>{lang === 'fr' ? 'Nouvel essai automatique' : 'Automatic retry enabled'}</em>}</span>
    <button onClick={() => void refresh(true)} disabled={loading} aria-label={lang === 'fr' ? 'Actualiser le taux' : 'Refresh rate'}><RefreshCw className={loading ? 'spin' : ''} /></button>
  </div>
}
