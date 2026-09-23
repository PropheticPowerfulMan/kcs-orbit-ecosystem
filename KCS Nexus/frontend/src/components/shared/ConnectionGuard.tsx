import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

type ConnectionState = 'online' | 'degraded' | 'offline' | 'recovered'

export default function ConnectionGuard() {
  const { i18n } = useTranslation()
  const [state, setState] = useState<ConnectionState>(() => navigator.onLine ? 'online' : 'offline')
  const [retryAttempt, setRetryAttempt] = useState(0)
  const isFrench = (i18n.resolvedLanguage || i18n.language || 'fr').startsWith('fr')

  useEffect(() => {
    let recoveryTimer = 0
    const clearRecoveryTimer = () => {
      if (recoveryTimer) window.clearTimeout(recoveryTimer)
      recoveryTimer = 0
    }
    const showRecovered = () => {
      clearRecoveryTimer()
      setRetryAttempt(0)
      setState('recovered')
      recoveryTimer = window.setTimeout(() => setState('online'), 4_000)
    }
    const handleOffline = () => {
      clearRecoveryTimer()
      setRetryAttempt(0)
      setState('offline')
    }
    const handleOnline = () => showRecovered()
    const handleDegraded = (event: Event) => {
      clearRecoveryTimer()
      const detail = (event as CustomEvent<{ attempt?: number }>).detail
      setRetryAttempt(detail?.attempt || 0)
      setState(navigator.onLine ? 'degraded' : 'offline')
    }
    const handleRestored = () => showRecovered()

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)
    window.addEventListener('ecosystem:connection-degraded', handleDegraded)
    window.addEventListener('ecosystem:connection-restored', handleRestored)
    return () => {
      clearRecoveryTimer()
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('ecosystem:connection-degraded', handleDegraded)
      window.removeEventListener('ecosystem:connection-restored', handleRestored)
    }
  }, [])

  if (state === 'online') return null

  const presentation = state === 'offline'
    ? {
        tone: 'border-red-300 bg-red-50 text-red-950 dark:border-red-800 dark:bg-red-950/95 dark:text-red-100',
        icon: '!',
        message: isFrench
          ? 'Vous êtes hors ligne. Les champs restent affichés et aucune modification ne sera envoyée avant le retour de la connexion.'
          : 'You are offline. Form fields remain visible and no change will be sent until the connection returns.',
      }
    : state === 'degraded'
      ? {
          tone: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/95 dark:text-amber-100',
          icon: '↻',
          message: isFrench
            ? `Connexion instable. Nexus sécurise et retente uniquement les lectures${retryAttempt ? ` (tentative ${retryAttempt}/2)` : ''}. Les créations et modifications ne sont jamais doublées.`
            : `Unstable connection. Nexus is safely retrying read-only requests${retryAttempt ? ` (attempt ${retryAttempt}/2)` : ''}. Creates and updates are never duplicated.`,
        }
      : {
          tone: 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/95 dark:text-emerald-100',
          icon: '✓',
          message: isFrench ? 'Connexion rétablie. Nexus est de nouveau synchronisé.' : 'Connection restored. Nexus is synchronized again.',
        }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-2 z-[1390] flex justify-center px-3" role="status" aria-live="assertive">
      <div className={`flex max-w-3xl items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold shadow-2xl backdrop-blur ${presentation.tone}`}>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-current/30 font-black" aria-hidden="true">{presentation.icon}</span>
        <span>{presentation.message}</span>
      </div>
    </div>
  )
}
