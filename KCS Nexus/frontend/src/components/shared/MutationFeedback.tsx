import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function MutationFeedback() {
  const { i18n } = useTranslation()
  const [feedback, setFeedback] = useState<{ message: string; isError: boolean } | null>(null)
  const isFrench = (i18n.resolvedLanguage || i18n.language || 'fr').startsWith('fr')

  useEffect(() => {
    const showSuccess = (event: Event) => setFeedback({
      message: (event as CustomEvent<{ message?: string }>).detail?.message || 'Modification enregistrée avec succès.',
      isError: false,
    })
    const showError = (event: Event) => setFeedback({
      message: (event as CustomEvent<{ message?: string }>).detail?.message || 'L’opération n’a pas pu être effectuée.',
      isError: true,
    })
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFeedback(null)
    }
    window.addEventListener('ecosystem:mutation-success', showSuccess)
    window.addEventListener('ecosystem:mutation-error', showError)
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      window.removeEventListener('ecosystem:mutation-success', showSuccess)
      window.removeEventListener('ecosystem:mutation-error', showError)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [])

  if (!feedback) return null
  const title = feedback.isError
    ? (isFrench ? 'Opération échouée' : 'Operation failed')
    : (isFrench ? 'Opération réussie' : 'Operation successful')
  const closeLabel = isFrench ? 'Fermer' : 'Close'

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-kcs-blue-950/75 p-4 backdrop-blur-sm" role="alertdialog" aria-modal="true" aria-live="assertive" aria-labelledby="mutation-feedback-title">
      <section className={`w-full max-w-md rounded-3xl border bg-white p-6 text-center shadow-2xl dark:bg-kcs-blue-900 ${feedback.isError ? 'border-red-300 dark:border-red-800' : 'border-emerald-300 dark:border-emerald-800'}`}>
        <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full text-3xl font-black ${feedback.isError ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'}`}>
          {feedback.isError ? '!' : '✓'}
        </div>
        <h2 id="mutation-feedback-title" className="mt-4 font-display text-2xl font-bold text-kcs-blue-950 dark:text-white">{title}</h2>
        <p className="mt-3 whitespace-pre-line text-sm leading-6 text-gray-600 dark:text-gray-200">{feedback.message}</p>
        <button type="button" autoFocus onClick={() => setFeedback(null)} className={`mt-6 w-full rounded-xl px-5 py-3 font-bold text-white transition focus:outline-none focus:ring-4 ${feedback.isError ? 'bg-red-700 hover:bg-red-800 focus:ring-red-200' : 'bg-kcs-blue-800 hover:bg-kcs-blue-950 focus:ring-kcs-blue-200'}`}>
          {closeLabel}
        </button>
      </section>
    </div>
  )
}
