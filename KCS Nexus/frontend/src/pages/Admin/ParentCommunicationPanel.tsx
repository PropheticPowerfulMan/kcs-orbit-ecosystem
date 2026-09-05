import React, { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, CheckSquare, Download, Eye, Mail, MessageSquare, Paperclip, Send, Square, Trash2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { messagesAPI } from '../../services/api'

const fieldClass = 'w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-kcs-blue-950 outline-none focus:border-kcs-blue-500 dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white'
const primaryButton = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-kcs-blue-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-kcs-blue-800 disabled:cursor-not-allowed disabled:opacity-45'

const displayName = (parent: any) => [parent.lastName, parent.middleName, parent.firstName].filter(Boolean).join(' ') || 'Parent'
const messageRecipient = (message: any) => message.recipient
  ? [message.recipient.lastName, message.recipient.middleName, message.recipient.firstName].filter(Boolean).join(' ')
  : 'Parent'

const copy = {
  fr: {
    loadFailed: 'Chargement impossible.', selectParent: 'Sélectionnez au moins un parent.', selectChannel: 'Sélectionnez Email ou SMS.', enterMessage: 'Saisissez un sujet et un message.',
    confirmSend: (count: number) => 'Confirmer l’envoi à ' + count + ' parent(s) ?', recorded: (count: number, es: number, ef: number, ss: number, sf: number) => 'Message enregistré pour ' + count + ' parent(s). Emails placés dans la file sécurisée : ' + es + ', erreurs immédiates : ' + ef + '. SMS envoyés : ' + ss + ', échecs : ' + sf + '.',
    sendFailed: 'Échec de l’envoi.', confirmDelete: (count: number) => 'Supprimer définitivement ' + count + ' ancien(s) message(s) ?', deleted: (count: number) => count + ' message(s) supprimé(s).', deleteFailed: 'Suppression impossible.',
    recipients: 'Destinataires', families: 'Parents et familles', selected: 'sélectionné(s)', parentSearch: 'Nom complet, email, téléphone ou code d’accès...', deselect: 'Désélectionner', selectResults: 'Sélectionner les résultats', clear: 'Effacer', noEmail: 'Email absent', noPhone: 'Téléphone absent',
    official: 'Communication officielle', channels: 'Email, SMS et boîte Nexus', subject: 'Sujet', exactMessage: 'Message exact à envoyer...', copyStored: 'Sans préfixe applicatif ; une copie est conservée dans Nexus.', sending: 'Envoi...', sendTo: (count: number) => 'Envoyer à ' + count + ' parent(s)',
    history: 'Historique', oldMessages: 'Anciens messages envoyés', historySearch: 'Parent, sujet, contenu, email, téléphone ou date...', startDate: 'Date de début', endDate: 'Date de fin', results: 'résultat(s)', deleting: 'Suppression...', deleteSelection: 'Supprimer la sélection',
    choice: 'Choix', parent: 'Parent', date: 'Date', action: 'Action', view: 'Voir', sentMessage: 'Message envoyé', close: 'Fermer', nexus: 'Nexus', sent: 'Envoyé', failed: 'Échec', logged: 'Enregistré', deliveryTitle: 'Résultat de l’envoi', deliveryIntro: 'Résultat technique reçu pour chaque destinataire.', providerAccepted: 'Accepté par le fournisseur', notSent: 'Non envoyé', finalPending: 'Réception finale à confirmer', deliveryNote: 'Un statut accepté confirme la prise en charge par le serveur email ou l’opérateur SMS. La réception finale dans la boîte mail ou sur le téléphone dépend ensuite du fournisseur.', emailLabel: 'E-mail', smsLabel: 'SMS'
  },
  en: {
    loadFailed: 'Unable to load communications.', selectParent: 'Select at least one parent.', selectChannel: 'Select Email or SMS.', enterMessage: 'Enter a subject and a message.',
    confirmSend: (count: number) => 'Confirm delivery to ' + count + ' parent(s)?', recorded: (count: number, es: number, ef: number, ss: number, sf: number) => 'Message recorded for ' + count + ' parent(s). Emails placed in the secure queue: ' + es + ', immediate errors: ' + ef + '. SMS sent: ' + ss + ', failed: ' + sf + '.',
    sendFailed: 'Delivery failed.', confirmDelete: (count: number) => 'Permanently delete ' + count + ' old message(s)?', deleted: (count: number) => count + ' message(s) deleted.', deleteFailed: 'Unable to delete messages.',
    recipients: 'Recipients', families: 'Parents and families', selected: 'selected', parentSearch: 'Full name, email, phone number or access code...', deselect: 'Deselect', selectResults: 'Select results', clear: 'Clear', noEmail: 'No email', noPhone: 'No phone number',
    official: 'Official communication', channels: 'Email, SMS and Nexus inbox', subject: 'Subject', exactMessage: 'Exact message to send...', copyStored: 'No application prefix; a copy is retained in Nexus.', sending: 'Sending...', sendTo: (count: number) => 'Send to ' + count + ' parent(s)',
    history: 'History', oldMessages: 'Previously sent messages', historySearch: 'Parent, subject, content, email, phone number or date...', startDate: 'Start date', endDate: 'End date', results: 'result(s)', deleting: 'Deleting...', deleteSelection: 'Delete selection',
    choice: 'Select', parent: 'Parent', date: 'Date', action: 'Action', view: 'View', sentMessage: 'Sent message', close: 'Close', nexus: 'Nexus', sent: 'Sent', failed: 'Failed', logged: 'Recorded', deliveryTitle: 'Delivery result', deliveryIntro: 'Technical result received for each recipient.', providerAccepted: 'Accepted by provider', notSent: 'Not sent', finalPending: 'Final receipt pending confirmation', deliveryNote: 'An accepted status confirms processing by the email server or SMS operator. Final arrival in the inbox or on the phone then depends on the provider.', emailLabel: 'Email', smsLabel: 'SMS'
  },
} as const

export default function ParentCommunicationPanel() {
  const { i18n } = useTranslation()
  const language = (i18n.resolvedLanguage || i18n.language || 'en').startsWith('fr') ? 'fr' : 'en'
  const c = copy[language]
  const [parents, setParents] = useState<any[]>([])
  const [selectedParents, setSelectedParents] = useState<string[]>([])
  const [parentQuery, setParentQuery] = useState('')
  const [channels, setChannels] = useState<Array<'email' | 'sms'>>(['email', 'sms'])
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [attachment, setAttachment] = useState<File | null>(null)
  const [history, setHistory] = useState<any[]>([])
  const [historyQuery, setHistoryQuery] = useState('')
  const [historyFrom, setHistoryFrom] = useState('')
  const [historyTo, setHistoryTo] = useState('')
  const [selectedHistory, setSelectedHistory] = useState<string[]>([])
  const [viewingMessage, setViewingMessage] = useState<any | null>(null)
  const [deliveryReport, setDeliveryReport] = useState<any | null>(null)
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
    void load().catch(() => setNotice(c.loadFailed))
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
      const haystack = [message.subject, message.body, messageRecipient(message), message.recipient?.email, message.recipient?.phone, createdAt.toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US')].filter(Boolean).join(' ').toLowerCase()
      return tokens.every((token) => haystack.includes(token))
        && (!from || createdAt >= from)
        && (!to || createdAt <= to)
    })
  }, [history, historyFrom, historyQuery, historyTo, language])

  const allParentsSelected = parentRows.length > 0 && parentRows.every((parent) => selectedParents.includes(parent.id))
  const allHistorySelected = historyRows.length > 0 && historyRows.every((message) => selectedHistory.includes(message.id))
  const toggle = (setter: React.Dispatch<React.SetStateAction<string[]>>, id: string) =>
    setter((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])

  const send = async () => {
    if (!selectedParents.length) return setNotice(c.selectParent)
    if (!channels.length) return setNotice(c.selectChannel)
    if (!subject.trim() || !body.trim()) return setNotice(c.enterMessage)
    if (selectedParents.length > 1 && !window.confirm(c.confirmSend(selectedParents.length))) return
    setBusy(true)
    setNotice('')
    try {
      const formData = new FormData()
      formData.append('recipientIds', JSON.stringify(selectedParents))
      formData.append('channels', JSON.stringify(channels))
      formData.append('subject', subject.trim())
      formData.append('body', body.trim())
      if (attachment) formData.append('attachment', attachment)
      const response = await messagesAPI.deliverToParents(formData)
      const data = response.data?.data
      const delivery = Array.isArray(data?.delivery) ? data.delivery : []
      const emailSent = delivery.filter((row: any) => row.email?.sent || row.email?.queued).length
      const smsSent = delivery.filter((row: any) => row.sms?.sent).length
      const emailFailed = channels.includes('email') ? delivery.length - emailSent : 0
      const smsFailed = channels.includes('sms') ? delivery.length - smsSent : 0
      setNotice(c.recorded(data?.recipients ?? 0, emailSent, emailFailed, smsSent, smsFailed))
      setDeliveryReport({ delivery, channels: data?.channels ?? channels, recipients: data?.recipients ?? delivery.length })
      setSubject('')
      setBody('')
      setAttachment(null)
      setSelectedParents([])
      await load()
    } catch (error: any) {
      setNotice(error?.response?.data?.message ?? c.sendFailed)
    } finally {
      setBusy(false)
    }
  }

  const deleteSelected = async () => {
    if (!selectedHistory.length || deleting) return
    if (!window.confirm(c.confirmDelete(selectedHistory.length))) return
    setDeleting(true)
    setNotice('')
    try {
      const response = await messagesAPI.deleteMany(selectedHistory)
      const deletedCount = response.data?.data?.deletedCount ?? 0
      const selected = new Set(selectedHistory)
      setHistory((current) => current.filter((message) => !selected.has(message.id)))
      setSelectedHistory([])
      setViewingMessage(null)
      setNotice(c.deleted(deletedCount))
    } catch (error: any) {
      setNotice(error?.response?.data?.message ?? c.deleteFailed)
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
            <div><p className="text-xs font-bold uppercase text-kcs-gold-600">{c.recipients}</p><h2 className="text-2xl font-bold dark:text-white">{c.families}</h2></div>
            <b className="text-kcs-blue-700 dark:text-white">{selectedParents.length} {c.selected}</b>
          </div>
          <input className={fieldClass + ' mt-4'} value={parentQuery} onChange={(event) => setParentQuery(event.target.value)} placeholder={c.parentSearch} />
          <div className="mt-3 flex flex-wrap gap-2">
            <button className={primaryButton} onClick={() => setSelectedParents((current) => allParentsSelected ? current.filter((id) => !parentRows.some((parent) => parent.id === id)) : Array.from(new Set([...current, ...parentRows.map((parent) => parent.id)])))}>
              {allParentsSelected ? <CheckSquare size={17} /> : <Square size={17} />} {allParentsSelected ? c.deselect : c.selectResults}
            </button>
            <button className={primaryButton} onClick={() => setSelectedParents([])}>{c.clear}</button>
          </div>
          <div className="mt-4 max-h-[480px] space-y-2 overflow-y-auto pr-1">
            {parentRows.map((parent) => {
              const selected = selectedParents.includes(parent.id)
              return <button key={parent.id} onClick={() => toggle(setSelectedParents, parent.id)} className={`w-full rounded-xl border p-4 text-left transition ${selected ? 'border-kcs-gold-400 bg-kcs-gold-50 shadow-[inset_4px_0_0_#eab308] dark:bg-kcs-gold-900/20' : 'border-gray-100 bg-gray-50 dark:border-kcs-blue-800 dark:bg-kcs-blue-800/30'}`}>
                <b className="flex items-center gap-2 dark:text-white">{selected ? <CheckSquare size={18} /> : <Square size={18} />}{displayName(parent)}</b>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-300">{parent.email || c.noEmail} · {parent.phone || c.noPhone}</p>
                <p className="text-xs text-kcs-blue-600 dark:text-kcs-blue-300">{parent.accessCode}</p>
              </button>
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
          <p className="text-xs font-bold uppercase text-kcs-gold-600">{c.official}</p>
          <h2 className="text-2xl font-bold dark:text-white">{c.channels}</h2>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {(['email', 'sms'] as const).map((channel) => <button key={channel} onClick={() => toggle(setChannels as React.Dispatch<React.SetStateAction<string[]>>, channel)} className={`${primaryButton} ${channels.includes(channel) ? 'ring-2 ring-kcs-gold-400' : 'opacity-65'}`}>{channel === 'email' ? <Mail size={18} /> : <MessageSquare size={18} />}{channels.includes(channel) ? '✓ ' : ''}{channel.toUpperCase()}</button>)}
          </div>
          <input className={fieldClass + ' mt-4'} value={subject} onChange={(event) => setSubject(event.target.value)} placeholder={c.subject} />
          <textarea className={fieldClass + ' mt-3 min-h-44 resize-y'} value={body} onChange={(event) => setBody(event.target.value)} placeholder={c.exactMessage} />
          <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-kcs-blue-300 p-3 text-sm font-bold text-kcs-blue-700 dark:text-kcs-blue-200"><Paperclip size={18}/>{attachment?.name||'Joindre un document'}<input type="file" className="sr-only" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,image/jpeg,image/png,image/webp" onChange={event=>{const file=event.target.files?.[0];if(file&&file.size>10*1024*1024){setNotice('Le document ne doit pas dépasser 10 Mo.');return}setAttachment(file||null)}}/></label>
          {attachment?<button type="button" className="mt-2 text-xs font-bold text-red-600" onClick={()=>setAttachment(null)}>Retirer la pièce jointe</button>:null}
          <p className="my-3 text-xs text-gray-500 dark:text-gray-300">{c.copyStored}</p>
          <button className={primaryButton + ' w-full'} disabled={busy || !selectedParents.length} onClick={() => void send()}><Send size={18} />{busy ? c.sending : c.sendTo(selectedParents.length)}</button>
        </section>
      </div>

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div><p className="text-xs font-bold uppercase text-kcs-gold-600">{c.history}</p><h2 className="text-2xl font-bold dark:text-white">{c.oldMessages}</h2></div>
          <div className="grid w-full gap-2 sm:grid-cols-2 xl:max-w-4xl xl:grid-cols-3">
            <input className={fieldClass} value={historyQuery} onChange={(event) => setHistoryQuery(event.target.value)} placeholder={c.historySearch} />
            <input type="date" className={fieldClass} value={historyFrom} onChange={(event) => setHistoryFrom(event.target.value)} aria-label={c.startDate} />
            <input type="date" className={fieldClass} value={historyTo} onChange={(event) => setHistoryTo(event.target.value)} aria-label={c.endDate} />
          </div>
        </div>
        <div className="my-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-gray-50 p-3 dark:bg-kcs-blue-800/30">
          <button className={primaryButton} onClick={() => setSelectedHistory((current) => allHistorySelected ? current.filter((id) => !historyRows.some((message) => message.id === id)) : Array.from(new Set([...current, ...historyRows.map((message) => message.id)])))}>
            {allHistorySelected ? <CheckSquare size={17} /> : <Square size={17} />} {allHistorySelected ? c.deselect : c.selectResults}
          </button>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-gray-500 dark:text-gray-300">{historyRows.length} {c.results} · {selectedHistory.length} {c.selected}</span>
            <button className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-40" disabled={!selectedHistory.length || deleting} onClick={() => void deleteSelected()}><Trash2 size={17} />{deleting ? c.deleting : c.deleteSelection}</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead><tr className="border-b text-left text-gray-500 dark:border-kcs-blue-700 dark:text-gray-300"><th className="p-3">{c.choice}</th><th className="p-3">{c.parent}</th><th className="p-3">{c.subject}</th><th className="p-3">{c.date}</th><th className="p-3">{c.action}</th></tr></thead>
            <tbody>{historyRows.map((message) => {
              const selected = selectedHistory.includes(message.id)
              return <tr key={message.id} className={`border-b transition dark:border-kcs-blue-800 ${selected ? 'bg-kcs-gold-50 shadow-[inset_4px_0_0_#eab308] dark:bg-kcs-gold-900/20' : 'hover:bg-gray-50 dark:hover:bg-kcs-blue-800/30'}`}>
                <td className="p-3"><button aria-pressed={selected} onClick={() => toggle(setSelectedHistory, message.id)} className={`rounded-lg border p-2 ${selected ? 'border-kcs-gold-500 bg-kcs-gold-400 text-kcs-blue-950' : 'border-gray-300 dark:border-kcs-blue-700 dark:text-white'}`}>{selected ? <CheckSquare size={19} /> : <Square size={19} />}</button></td>
                <td className="p-3 font-semibold dark:text-white">{messageRecipient(message)}</td>
                <td className="p-3"><b className="dark:text-white">{message.subject}</b><p className="mt-1 line-clamp-1 text-xs text-gray-500">{message.body}</p></td>
                <td className="p-3 text-gray-500 dark:text-gray-300">{new Date(message.createdAt).toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US')}</td>
                <td className="p-3"><button className={primaryButton} onClick={() => setViewingMessage(message)}><Eye size={17} />{c.view}</button></td>
              </tr>
            })}</tbody>
          </table>
        </div>
      </section>

      {deliveryReport ? <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm" onClick={() => setDeliveryReport(null)} role="dialog" aria-modal="true" aria-labelledby="delivery-result-title">
        <section className="max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto rounded-3xl border border-kcs-blue-300/30 bg-white p-6 shadow-2xl dark:bg-kcs-blue-950" onClick={(event) => event.stopPropagation()}>
          <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-kcs-gold-600">{c.official}</p><h3 id="delivery-result-title" className="mt-2 text-2xl font-bold text-kcs-blue-950 dark:text-white">{c.deliveryTitle}</h3><p className="mt-1 text-sm text-gray-500 dark:text-gray-300">{c.deliveryIntro}</p></div><button className={primaryButton} onClick={() => setDeliveryReport(null)}><X size={17}/>{c.close}</button></div>
          <div className="mt-5 space-y-3">{deliveryReport.delivery.map((row: any) => <article key={row.userId} className="rounded-2xl border border-gray-200 p-4 dark:border-kcs-blue-700 dark:bg-kcs-blue-900/50"><h4 className="font-bold text-kcs-blue-950 dark:text-white">{row.name}</h4><div className="mt-3 grid gap-3 sm:grid-cols-2">{deliveryReport.channels.map((channel: 'email' | 'sms') => { const result = row[channel]; const accepted = Boolean(result?.sent); const reason = result?.reason === 'SMS_INSUFFICIENT_BALANCE' ? (language === 'fr' ? 'Solde SMS du fournisseur insuffisant.' : 'SMS provider balance is insufficient.') : result?.reason === 'SMS_INVALID_PHONE' ? (language === 'fr' ? 'Numéro de téléphone invalide.' : 'Invalid phone number.') : result?.reason === 'SMTP_SEND_FAILED' ? (language === 'fr' ? 'Le serveur e-mail a temporairement refusé l’envoi.' : 'The email server temporarily rejected delivery.') : result?.reason; return <div key={channel} className={`rounded-xl border p-3 ${accepted ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/30' : 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950/30'}`}><div className="flex items-center gap-2">{accepted ? <CheckCircle2 className="text-emerald-600" size={20}/> : <AlertTriangle className="text-red-600" size={20}/>}<b className="text-kcs-blue-950 dark:text-white">{channel === 'email' ? c.emailLabel : c.smsLabel}</b></div><p className={`mt-2 text-sm font-bold ${accepted ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>{accepted ? c.providerAccepted : c.notSent}</p>{accepted ? <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">{c.finalPending}</p> : reason ? <p className="mt-1 text-xs text-red-700 dark:text-red-300">{reason}</p> : null}</div> })}</div></article>)}</div>
          <div className="mt-5 flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-100"><AlertTriangle className="mt-0.5 shrink-0" size={20}/><p>{c.deliveryNote}</p></div>
        </section>
      </div> : null}

      {viewingMessage ? <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm" onClick={() => setViewingMessage(null)} role="dialog" aria-modal="true">
        <section className="max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto rounded-3xl border border-kcs-blue-300/30 bg-white p-6 shadow-2xl dark:bg-kcs-blue-950" onClick={(event) => event.stopPropagation()}>
          <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase text-kcs-gold-600">{c.sentMessage}</p><h3 className="mt-2 text-2xl font-bold text-kcs-blue-950 dark:text-white">{viewingMessage.subject}</h3><p className="mt-1 text-sm text-gray-500 dark:text-gray-300">{messageRecipient(viewingMessage)} · {new Date(viewingMessage.createdAt).toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US')}</p></div><button className={primaryButton} onClick={() => setViewingMessage(null)}><X size={17} />{c.close}</button></div>
          <div className="mt-5 whitespace-pre-wrap rounded-2xl bg-gray-50 p-5 leading-7 text-gray-700 dark:bg-kcs-blue-900 dark:text-gray-100">{viewingMessage.body}</div>
          <div className="mt-4 flex flex-wrap gap-2"><span className="rounded-full bg-green-100 px-3 py-1.5 text-xs font-bold text-green-700">{c.nexus} · {viewingMessage.deliveries?.some((item: any) => item.status === 'FAILED') ? c.failed : viewingMessage.deliveries?.some((item: any) => item.status === 'SENT' || item.status === 'DELIVERED') ? c.sent : c.logged}</span></div>
          {viewingMessage.hasAttachment?<button type="button" className={primaryButton+' mt-4'} onClick={async()=>{const response=await messagesAPI.attachment(viewingMessage.id);const url=URL.createObjectURL(response.data);const link=document.createElement('a');link.href=url;link.download=viewingMessage.attachmentName||'document';link.click();URL.revokeObjectURL(url)}}><Download size={17}/>Télécharger · {viewingMessage.attachmentName}</button>:null}
        </section>
      </div> : null}
    </div>
  )
}
