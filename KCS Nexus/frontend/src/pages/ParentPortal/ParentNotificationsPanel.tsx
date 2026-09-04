import { useEffect, useMemo, useState } from 'react'
import { Bell, CheckCheck, Search, Trash2, X } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { notificationsAPI } from '@/services/api'

export type ParentNotice = {
  id: string
  title: string
  message: string
  type: string
  isRead: boolean
  createdAt: string
  link?: string
}

type Props = {
  notices: ParentNotice[]
  onChange: (notices: ParentNotice[]) => void
}

const formatDate = (value: string) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))

export default function ParentNotificationsPanel({ notices, onChange }: Props) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase()
    if (!needle) return notices
    return notices.filter((notice) =>
      [notice.title, notice.message, notice.type, formatDate(notice.createdAt)]
        .join(' ')
        .toLocaleLowerCase()
        .includes(needle),
    )
  }, [notices, query])
  const activeNotice = notices.find((notice) => notice.id === activeId) ?? null
  const selectedVisible = filtered.length > 0 && filtered.every((notice) => selectedIds.includes(notice.id))

  const markReadAndOpen = async (notice: ParentNotice) => {
    setActiveId(notice.id)
    if (notice.isRead) return
    try {
      await notificationsAPI.markRead(notice.id)
      onChange(notices.map((item) => item.id === notice.id ? { ...item, isRead: true } : item))
    } catch {
      setFeedback('La notification est ouverte, mais son statut de lecture n’a pas pu être enregistré.')
    }
  }

  useEffect(() => {
    const requestedId = searchParams.get('notice')
    const requested = notices.find((notice) => notice.id === requestedId)
    if (!requested) return
    void markReadAndOpen(requested)
    const next = new URLSearchParams(searchParams)
    next.delete('notice')
    setSearchParams(next, { replace: true })
  }, [notices.length])

  const markAllRead = async () => {
    setBusy(true)
    setFeedback('')
    try {
      await notificationsAPI.markAllRead()
      onChange(notices.map((notice) => ({ ...notice, isRead: true })))
      setFeedback('Toutes les notifications ont été marquées comme lues.')
    } catch {
      setFeedback('Impossible de marquer toutes les notifications comme lues.')
    } finally {
      setBusy(false)
    }
  }

  const deleteSelected = async () => {
    if (!selectedIds.length || !window.confirm(`Supprimer ${selectedIds.length} notification(s) ?`)) return
    setBusy(true)
    setFeedback('')
    try {
      await notificationsAPI.deleteMany(selectedIds)
      const removed = new Set(selectedIds)
      onChange(notices.filter((notice) => !removed.has(notice.id)))
      if (activeId && removed.has(activeId)) setActiveId(null)
      setSelectedIds([])
      setFeedback('Les notifications sélectionnées ont été supprimées.')
    } catch {
      setFeedback('Impossible de supprimer les notifications sélectionnées.')
    } finally {
      setBusy(false)
    }
  }

  const toggleVisible = () => {
    const visibleIds = filtered.map((notice) => notice.id)
    setSelectedIds((current) => selectedVisible
      ? current.filter((id) => !visibleIds.includes(id))
      : [...new Set([...current, ...visibleIds])])
  }

  return (
    <>
      <section className="space-y-5">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Bell className="text-kcs-blue-600" size={22} />
                <h2 className="text-xl font-bold text-kcs-blue-950 dark:text-white">Centre de notifications</h2>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                {notices.filter((notice) => !notice.isRead).length} non lue(s) sur {notices.length}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={busy || notices.every((notice) => notice.isRead)} onClick={() => void markAllRead()} className="inline-flex items-center gap-2 rounded-xl border border-kcs-blue-200 px-4 py-2 text-sm font-semibold text-kcs-blue-700 disabled:opacity-50 dark:border-kcs-blue-700 dark:text-kcs-blue-200">
                <CheckCheck size={17} /> Tout marquer lu
              </button>
              <button type="button" disabled={busy || selectedIds.length === 0} onClick={() => void deleteSelected()} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                <Trash2 size={17} /> Supprimer ({selectedIds.length})
              </button>
            </div>
          </div>
          <div className="relative mt-5">
            <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-11 pr-4 text-sm outline-none focus:border-kcs-blue-500 dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white" placeholder="Rechercher par titre, contenu, type ou date…" />
          </div>
          {feedback && <p className="mt-4 rounded-xl bg-kcs-blue-50 p-3 text-sm text-kcs-blue-800 dark:bg-kcs-blue-800 dark:text-white">{feedback}</p>}
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-kcs-blue-800">
            <label className="inline-flex items-center gap-3 text-sm font-semibold text-gray-600 dark:text-gray-200">
              <input type="checkbox" checked={selectedVisible} onChange={toggleVisible} disabled={filtered.length === 0} className="h-4 w-4 rounded border-gray-300 text-kcs-blue-600" />
              Sélectionner les résultats
            </label>
            <span className="text-xs font-semibold text-gray-400">{filtered.length} résultat(s)</span>
          </div>
          {filtered.length === 0 ? (
            <p className="m-5 rounded-xl bg-gray-50 p-4 text-sm text-gray-500 dark:bg-kcs-blue-800/30 dark:text-gray-300">Aucune notification ne correspond à cette recherche.</p>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-kcs-blue-800">
              {filtered.map((notice) => (
                <article key={notice.id} className={`flex items-start gap-3 p-4 sm:p-5 ${notice.isRead ? '' : 'bg-kcs-blue-50/70 dark:bg-kcs-blue-800/25'}`}>
                  <input type="checkbox" aria-label={`Sélectionner ${notice.title}`} checked={selectedIds.includes(notice.id)} onChange={() => setSelectedIds((current) => current.includes(notice.id) ? current.filter((id) => id !== notice.id) : [...current, notice.id])} className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300 text-kcs-blue-600" />
                  <button type="button" onClick={() => void markReadAndOpen(notice)} className="min-w-0 flex-1 text-left">
                    <span className="flex flex-wrap items-center gap-2">
                      <strong className="text-sm text-kcs-blue-950 dark:text-white">{notice.title}</strong>
                      {!notice.isRead && <span className="rounded-full bg-kcs-gold-500 px-2 py-0.5 text-[10px] font-bold uppercase text-kcs-blue-950">Nouveau</span>}
                    </span>
                    <span className="mt-1 block line-clamp-2 text-sm text-gray-600 dark:text-gray-300">{notice.message}</span>
                    <span className="mt-2 block text-xs font-medium text-gray-400">{notice.type} · {formatDate(notice.createdAt)}</span>
                  </button>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {activeNotice && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-kcs-blue-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="parent-notification-title" onMouseDown={(event) => { if (event.currentTarget === event.target) setActiveId(null) }}>
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl dark:bg-kcs-blue-900 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="rounded-full bg-kcs-blue-100 px-3 py-1 text-xs font-bold uppercase text-kcs-blue-700 dark:bg-kcs-blue-800 dark:text-kcs-blue-200">{activeNotice.type}</span>
                <h2 id="parent-notification-title" className="mt-3 text-2xl font-bold text-kcs-blue-950 dark:text-white">{activeNotice.title}</h2>
                <p className="mt-1 text-sm text-gray-400">{formatDate(activeNotice.createdAt)}</p>
              </div>
              <button type="button" onClick={() => setActiveId(null)} className="rounded-full p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-kcs-blue-800" aria-label="Fermer"><X size={22} /></button>
            </div>
            <p className="mt-6 whitespace-pre-wrap text-base leading-7 text-gray-700 dark:text-gray-200">{activeNotice.message}</p>
            <button type="button" onClick={() => setActiveId(null)} className="mt-7 w-full rounded-xl bg-kcs-blue-700 px-4 py-3 font-semibold text-white hover:bg-kcs-blue-800">Fermer</button>
          </div>
        </div>
      )}
    </>
  )
}
