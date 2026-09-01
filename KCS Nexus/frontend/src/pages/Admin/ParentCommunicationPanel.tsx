import React, { useEffect, useMemo, useState } from 'react'
import { CheckSquare, Eye, Mail, MessageSquare, Send, Square, Trash2, X } from 'lucide-react'
import { messagesAPI } from '../../services/api'

const fieldClass = 'w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-kcs-blue-950 outline-none focus:border-kcs-blue-500 dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white'
const primaryButton = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-kcs-blue-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-kcs-blue-800 disabled:cursor-not-allowed disabled:opacity-45'

const displayName = (parent: any) => [parent.lastName, parent.middleName, parent.firstName].filter(Boolean).join(' ') || 'Parent'
const messageRecipient = (message: any) => message.recipient
  ? [message.recipient.lastName, message.recipient.firstName].filter(Boolean).join(' ')
  : 'Parent'
const friendlyStatus = (value?: string) => value === 'sent' ? 'Envoyé' : value === 'failed' ? 'Échec' : value === 'simulated' ? 'Simulation' : 'Enregistré'

export default function ParentCommunicationPanel() {
  const [parents, setParents] = useState<any[]>([])
  const [selectedParents, setSelectedParents] = useState<string[]>([])
  const [parentQuery, setParentQuery] = useState('')
  const [channels, setChannels] = useState<Array<'email' | 'sms'>>(['email', 'sms'])
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [history, setHistory] = useState<any[]>([])
  const [historyQuery, setHistoryQuery] = useState('')
  const [historyFrom, setHistoryFrom] = useState('')
  const [historyTo, setHistoryTo] = useState('')
  const [selectedHistory, setSelectedHistory] = useState<string[]>([])
  const [viewingMessage, setViewingMessage] = useState<any | null>(null)
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [notice, setNotice] = useState('')

  const load = async () => {
    const [contactsResponse, historyResponse] = await Promise.all([
      messagesAPI.getParentContacts(),
      messagesAPI.getAll({ box: 'sent' }),
    ])
    setParents(contactsResponse.data?.data ?? [])
    setHistory(historyResponse.data?.data ?? [])
  }

  useEffect(() => {
    void load().catch(() => setNotice('Chargement impossible.'))
  }, [])

  const parentRows = useMemo(() => {
    const tokens = parentQuery.trim().toLowerCase().split(/\s+/).filter(Boolean)
    return parents.filter((parent) => {
      const haystack = [displayName(parent), parent.email, parent.phone, parent.accessCode].filter(Boolean).join(' ').toLowerCase()
      return tokens.every((token) => haystack.includes(token))
    })
  }, [parentQuery, parents])

  const historyRows = useMemo(() => {
    const tokens = historyQuery.trim().toLowerCase().split(/\s+/).filter(Boolean)
    const from = historyFrom ? new Date(`${historyFrom}T00:00:00`) : null
    const to = historyTo ? new Date(`${historyTo}T23:59:59.999`) : null
    return history.filter((message) => {
      const createdAt = new Date(message.createdAt)
      const haystack = [message.subject, message.body, messageRecipient(message), message.recipient?.email, message.recipient?.phone, createdAt.toLocaleString()].filter(Boolean).join(' ').toLowerCase()
      return tokens.every((token) => haystack.includes(token))
        && (!from || createdAt >= from)
        && (!to || createdAt <= to)
    })
  }, [history, historyFrom, historyQuery, historyTo])

  const allParentsSelected = parentRows.length > 0 && parentRows.every((parent) => selectedParents.includes(parent.id))
  const allHistorySelected = historyRows.length > 0 && historyRows.every((message) => selectedHistory.includes(message.id))
  const toggle = (setter: React.Dispatch<React.SetStateAction<string[]>>, id: string) =>
    setter((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])

  const send = async () => {
    if (!selectedParents.length) return setNotice('Sélectionnez au moins un parent.')
    if (!channels.length) return setNotice('Sélectionnez Email ou SMS.')
    if (!subject.trim() || !body.trim()) return setNotice('Saisissez un sujet et un message.')
    if (selectedParents.length > 1 && !window.confirm(`Confirmer l’envoi à ${selectedParents.length} parents ?`)) return
    setBusy(true)
    setNotice('')
    try {
      const response = await messagesAPI.deliverToParents({ recipientIds: selectedParents, channels, subject: subject.trim(), body: body.trim() })
      const data = response.data?.data
      const delivery = Array.isArray(data?.delivery) ? data.delivery : []
      const emailSent = delivery.filter((row: any) => row.email?.sent).length
      const smsSent = delivery.filter((row: any) => row.sms?.sent).length
      const emailFailed = channels.includes('email') ? delivery.length - emailSent : 0
      const smsFailed = channels.includes('sms') ? delivery.length - smsSent : 0
      setNotice(`Message enregistré pour ${data?.recipients ?? 0} parent(s). Email envoyés : ${emailSent}, échecs : ${emailFailed}. SMS envoyés : ${smsSent}, échecs : ${smsFailed}.`)
      setSubject('')
      setBody('')
      setSelectedParents([])
      await load()
    } catch (error: any) {
      setNotice(error?.response?.data?.message ?? 'Échec de l’envoi.')
    } finally {
      setBusy(false)
    }
  }

  const deleteSelected = async () => {
    if (!selectedHistory.length || deleting) return
    if (!window.confirm(`Supprimer définitivement ${selectedHistory.length} ancien(s) message(s) ?`)) return
    setDeleting(true)
    setNotice('')
    try {
      const response = await messagesAPI.deleteMany(selectedHistory)
      const deletedCount = response.data?.data?.deletedCount ?? 0
      const selected = new Set(selectedHistory)
      setHistory((current) => current.filter((message) => !selected.has(message.id)))
      setSelectedHistory([])
      setViewingMessage(null)
      setNotice(`${deletedCount} message(s) supprimé(s).`)
    } catch (error: any) {
      setNotice(error?.response?.data?.message ?? 'Suppression impossible.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      {notice ? <div className="rounded-2xl border border-kcs-blue-200 bg-kcs-blue-50 p-4 text-sm font-semibold text-kcs-blue-800 dark:border-kcs-blue-700 dark:bg-kcs-blue-900/60 dark:text-kcs-blue-100">{notice}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[1.05fr_.95fr]">
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
          <div className="flex justify-between gap-3">
            <div><p className="text-xs font-bold uppercase text-kcs-gold-600">Destinataires</p><h2 className="text-2xl font-bold dark:text-white">Parents et familles</h2></div>
            <b className="text-kcs-blue-700 dark:text-white">{selectedParents.length} sélectionné(s)</b>
          </div>
          <input className={fieldClass + ' mt-4'} value={parentQuery} onChange={(event) => setParentQuery(event.target.value)} placeholder="Nom, email, téléphone ou code d’accès..." />
          <div className="mt-3 flex flex-wrap gap-2">
            <button className={primaryButton} onClick={() => setSelectedParents((current) => allParentsSelected ? current.filter((id) => !parentRows.some((parent) => parent.id === id)) : Array.from(new Set([...current, ...parentRows.map((parent) => parent.id)])))}>
              {allParentsSelected ? <CheckSquare size={17} /> : <Square size={17} />} {allParentsSelected ? 'Désélectionner' : 'Sélectionner les résultats'}
            </button>
            <button className={primaryButton} onClick={() => setSelectedParents([])}>Effacer</button>
          </div>
          <div className="mt-4 max-h-[480px] space-y-2 overflow-y-auto pr-1">
            {parentRows.map((parent) => {
              const selected = selectedParents.includes(parent.id)
              return <button key={parent.id} onClick={() => toggle(setSelectedParents, parent.id)} className={`w-full rounded-xl border p-4 text-left transition ${selected ? 'border-kcs-gold-400 bg-kcs-gold-50 shadow-[inset_4px_0_0_#eab308] dark:bg-kcs-gold-900/20' : 'border-gray-100 bg-gray-50 dark:border-kcs-blue-800 dark:bg-kcs-blue-800/30'}`}>
                <b className="flex items-center gap-2 dark:text-white">{selected ? <CheckSquare size={18} /> : <Square size={18} />}{displayName(parent)}</b>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-300">{parent.email || 'Email absent'} · {parent.phone || 'Téléphone absent'}</p>
                <p className="text-xs text-kcs-blue-600 dark:text-kcs-blue-300">{parent.accessCode}</p>
              </button>
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
          <p className="text-xs font-bold uppercase text-kcs-gold-600">Communication officielle</p>
          <h2 className="text-2xl font-bold dark:text-white">Email, SMS et boîte Nexus</h2>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {(['email', 'sms'] as const).map((channel) => <button key={channel} onClick={() => toggle(setChannels as React.Dispatch<React.SetStateAction<string[]>>, channel)} className={`${primaryButton} ${channels.includes(channel) ? 'ring-2 ring-kcs-gold-400' : 'opacity-65'}`}>{channel === 'email' ? <Mail size={18} /> : <MessageSquare size={18} />}{channels.includes(channel) ? '✓ ' : ''}{channel.toUpperCase()}</button>)}
          </div>
          <input className={fieldClass + ' mt-4'} value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Sujet" />
          <textarea className={fieldClass + ' mt-3 min-h-44 resize-y'} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Message exact à envoyer..." />
          <p className="my-3 text-xs text-gray-500 dark:text-gray-300">Sans préfixe applicatif ; une copie est conservée dans Nexus.</p>
          <button className={primaryButton + ' w-full'} disabled={busy || !selectedParents.length} onClick={() => void send()}><Send size={18} />{busy ? 'Envoi...' : `Envoyer à ${selectedParents.length} parent(s)`}</button>
        </section>
      </div>

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div><p className="text-xs font-bold uppercase text-kcs-gold-600">Historique</p><h2 className="text-2xl font-bold dark:text-white">Anciens messages envoyés</h2></div>
          <div className="grid w-full gap-2 sm:grid-cols-2 xl:max-w-4xl xl:grid-cols-3">
            <input className={fieldClass} value={historyQuery} onChange={(event) => setHistoryQuery(event.target.value)} placeholder="Parent, sujet, contenu, email ou date..." />
            <input type="date" className={fieldClass} value={historyFrom} onChange={(event) => setHistoryFrom(event.target.value)} aria-label="Date de début" />
            <input type="date" className={fieldClass} value={historyTo} onChange={(event) => setHistoryTo(event.target.value)} aria-label="Date de fin" />
          </div>
        </div>
        <div className="my-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-gray-50 p-3 dark:bg-kcs-blue-800/30">
          <button className={primaryButton} onClick={() => setSelectedHistory((current) => allHistorySelected ? current.filter((id) => !historyRows.some((message) => message.id === id)) : Array.from(new Set([...current, ...historyRows.map((message) => message.id)])))}>
            {allHistorySelected ? <CheckSquare size={17} /> : <Square size={17} />} {allHistorySelected ? 'Désélectionner les résultats' : 'Sélectionner les résultats'}
          </button>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-gray-500 dark:text-gray-300">{historyRows.length} résultat(s) · {selectedHistory.length} sélectionné(s)</span>
            <button className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-40" disabled={!selectedHistory.length || deleting} onClick={() => void deleteSelected()}><Trash2 size={17} />{deleting ? 'Suppression...' : 'Supprimer la sélection'}</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead><tr className="border-b text-left text-gray-500 dark:border-kcs-blue-700 dark:text-gray-300"><th className="p-3">Choix</th><th className="p-3">Parent</th><th className="p-3">Sujet</th><th className="p-3">Date</th><th className="p-3">Action</th></tr></thead>
            <tbody>{historyRows.map((message) => {
              const selected = selectedHistory.includes(message.id)
              return <tr key={message.id} className={`border-b transition dark:border-kcs-blue-800 ${selected ? 'bg-kcs-gold-50 shadow-[inset_4px_0_0_#eab308] dark:bg-kcs-gold-900/20' : 'hover:bg-gray-50 dark:hover:bg-kcs-blue-800/30'}`}>
                <td className="p-3"><button aria-pressed={selected} onClick={() => toggle(setSelectedHistory, message.id)} className={`rounded-lg border p-2 ${selected ? 'border-kcs-gold-500 bg-kcs-gold-400 text-kcs-blue-950' : 'border-gray-300 dark:border-kcs-blue-700 dark:text-white'}`}>{selected ? <CheckSquare size={19} /> : <Square size={19} />}</button></td>
                <td className="p-3 font-semibold dark:text-white">{messageRecipient(message)}</td>
                <td className="p-3"><b className="dark:text-white">{message.subject}</b><p className="mt-1 line-clamp-1 text-xs text-gray-500">{message.body}</p></td>
                <td className="p-3 text-gray-500 dark:text-gray-300">{new Date(message.createdAt).toLocaleString()}</td>
                <td className="p-3"><button className={primaryButton} onClick={() => setViewingMessage(message)}><Eye size={17} />Voir</button></td>
              </tr>
            })}</tbody>
          </table>
        </div>
      </section>

      {viewingMessage ? <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm" onClick={() => setViewingMessage(null)} role="dialog" aria-modal="true">
        <section className="max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto rounded-3xl border border-kcs-blue-300/30 bg-white p-6 shadow-2xl dark:bg-kcs-blue-950" onClick={(event) => event.stopPropagation()}>
          <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase text-kcs-gold-600">Message envoyé</p><h3 className="mt-2 text-2xl font-bold text-kcs-blue-950 dark:text-white">{viewingMessage.subject}</h3><p className="mt-1 text-sm text-gray-500 dark:text-gray-300">{messageRecipient(viewingMessage)} · {new Date(viewingMessage.createdAt).toLocaleString()}</p></div><button className={primaryButton} onClick={() => setViewingMessage(null)}><X size={17} />Fermer</button></div>
          <div className="mt-5 whitespace-pre-wrap rounded-2xl bg-gray-50 p-5 leading-7 text-gray-700 dark:bg-kcs-blue-900 dark:text-gray-100">{viewingMessage.body}</div>
          <div className="mt-4 flex flex-wrap gap-2"><span className="rounded-full bg-green-100 px-3 py-1.5 text-xs font-bold text-green-700">Nexus · {friendlyStatus(viewingMessage.deliveryStatus)}</span></div>
        </section>
      </div> : null}
    </div>
  )
}
