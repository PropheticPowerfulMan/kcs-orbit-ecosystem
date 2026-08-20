import { useEffect, useState } from 'react'

export default function MutationFeedback() {
  const [message, setMessage] = useState('')
  useEffect(() => {
    const show = (event: Event) => setMessage((event as CustomEvent<{ message?: string }>).detail?.message || 'Modification enregistrée avec succès.')
    window.addEventListener('ecosystem:mutation-success', show)
    return () => window.removeEventListener('ecosystem:mutation-success', show)
  }, [])
  if (!message) return null
  return <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-kcs-blue-950/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true"><section className="w-full max-w-md rounded-2xl border border-emerald-300 bg-white p-6 text-center shadow-2xl dark:bg-kcs-blue-900"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-700">✓</div><h2 className="mt-4 text-xl font-bold text-kcs-blue-950 dark:text-white">Opération réussie</h2><p className="mt-3 text-sm text-gray-600 dark:text-gray-200">{message}</p><button type="button" onClick={() => setMessage('')} className="mt-6 w-full rounded-xl bg-kcs-blue-800 px-5 py-3 font-bold text-white hover:bg-kcs-blue-950">Compris</button></section></div>
}
