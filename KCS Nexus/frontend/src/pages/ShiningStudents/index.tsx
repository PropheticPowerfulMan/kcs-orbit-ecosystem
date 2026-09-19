import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, CheckCircle2, RefreshCw, Sparkles, Trash2 } from 'lucide-react'
import { shiningStudentsAPI } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import PortalSidebar from '@/components/layout/PortalSidebar'

type Schedule = {
  id: string
  date: string
  division: 'LOWER' | 'MIDDLE_UPPER'
  topic?: string | null
  topicNotes?: string | null
  status: 'SCHEDULED' | 'TOPIC_SUBMITTED' | 'PRESENTED' | 'EXCUSED'
  notifiedAt?: string | null
  student: {
    id: string
    grade: string
    section: string
    user: { id: string; firstName: string; middleName?: string | null; lastName: string; email: string }
    parentLinks: Array<{ parent: { id: string; firstName: string; middleName?: string | null; lastName: string; email: string } }>
  }
}

const iso = (date: Date) => date.toISOString().slice(0, 10)
const addDays = (days: number) => { const date = new Date(); date.setUTCDate(date.getUTCDate() + days); return iso(date) }
const fullName = (user: Schedule['student']['user']) => [user.lastName, user.middleName, user.firstName].filter(Boolean).join(' ')
const card = 'rounded-2xl border border-sky-100 bg-white p-5 shadow-sm dark:border-kcs-blue-800 dark:bg-kcs-blue-900/55'

export default function ShiningStudentsPage() {
  const user = useAuthStore((state) => state.user)
  const language = useUIStore((state) => state.language)
  const tr = (fr: string, en: string) => language === 'fr' ? fr : en
  const admin = user?.role === 'admin'
  const [items, setItems] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState('')
  const [startDate, setStartDate] = useState(addDays(7))
  const [endDate, setEndDate] = useState(addDays(37))
  const [holiday, setHoliday] = useState('')
  const [excludedDates, setExcludedDates] = useState<string[]>([])
  const [topics, setTopics] = useState<Record<string, { topic: string; topicNotes: string }>>({})

  const load = async () => {
    setLoading(true)
    try {
      const response = await shiningStudentsAPI.list()
      const rows = response.data?.data || []
      setItems(rows)
      setTopics(Object.fromEntries(rows.map((item: Schedule) => [item.id, { topic: item.topic || '', topicNotes: item.topicNotes || '' }])))
      setNotice('')
    } catch (error: any) {
      setNotice(error?.response?.data?.message || tr('Impossible de charger le programme Shining Student.', 'Unable to load the Shining Student schedule.'))
    } finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])

  const generate = async () => {
    setLoading(true)
    try {
      const response = await shiningStudentsAPI.generate({ startDate, endDate, excludedDates })
      setNotice(response.data?.message || tr('Planning généré et familles informées.', 'Schedule generated and families notified.'))
      await load()
    } catch (error: any) {
      setNotice(error?.response?.data?.message || tr('Génération impossible.', 'Generation failed.'))
      setLoading(false)
    }
  }
  const saveTopic = async (item: Schedule) => {
    const draft = topics[item.id]
    if (!draft?.topic.trim()) { setNotice(tr('Choisissez d’abord un sujet.', 'Choose a topic first.')); return }
    try {
      await shiningStudentsAPI.saveTopic(item.id, { topic: draft.topic.trim(), topicNotes: draft.topicNotes.trim() || null })
      setNotice(tr('Votre sujet est enregistré.', 'Your topic has been saved.'))
      await load()
    } catch (error: any) { setNotice(error?.response?.data?.message || tr('Sujet non enregistré.', 'Topic was not saved.')) }
  }
  const changeStatus = async (item: Schedule, status: Schedule['status']) => {
    await shiningStudentsAPI.updateStatus(item.id, status)
    await load()
  }
  const remove = async (item: Schedule) => {
    if (!window.confirm(tr('Supprimer cette programmation ?', 'Remove this assignment?'))) return
    await shiningStudentsAPI.remove(item.id)
    await load()
  }
  const upcoming = useMemo(() => items.filter((item) => new Date(item.date) >= new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z')), [items])
  const canEditTopic = (item: Schedule) => admin || item.student.user.id === user?.id
  const statusLabel = (status: Schedule['status']) => ({
    SCHEDULED: tr('Programmé', 'Scheduled'),
    TOPIC_SUBMITTED: tr('Sujet soumis', 'Topic submitted'),
    PRESENTED: tr('Présenté', 'Presented'),
    EXCUSED: tr('Excusé / à reprogrammer', 'Excused / reschedule'),
  }[status])

  return <div className="portal-shell flex"><PortalSidebar/><main className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-slate-50 px-4 py-6 pt-20 dark:bg-kcs-blue-950 sm:px-6 lg:px-8 lg:pt-8">
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="overflow-hidden rounded-3xl bg-gradient-to-br from-kcs-blue-950 via-kcs-blue-800 to-sky-700 p-6 text-white shadow-xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div><p className="text-xs font-black uppercase tracking-[0.2em] text-kcs-gold-300">KCS · Shining Student</p><h1 className="mt-2 text-3xl font-black">{tr('Prendre la parole, inspirer toute l’école', 'Speak up and inspire the whole school')}</h1><p className="mt-2 max-w-3xl text-sm text-sky-100">{tr('Deux élèves par jour scolaire : un du Lower School et un du Middle/Upper School. La rotation est équitable, vérifiable et exclut les week-ends ainsi que les dates fermées.', 'Two students per school day: one from Lower School and one from Middle/Upper School. Selection is fair, auditable and excludes weekends and closed dates.')}</p></div>
          <div className="rounded-2xl bg-white/10 px-5 py-4 backdrop-blur"><p className="text-xs uppercase text-sky-200">{tr('Passages à venir', 'Upcoming presentations')}</p><p className="mt-1 text-4xl font-black">{upcoming.length}</p></div>
        </div>
      </header>

      {admin && <section className={card}>
        <div className="flex items-center gap-3"><CalendarDays className="text-kcs-blue-700 dark:text-sky-300"/><div><h2 className="text-xl font-bold text-kcs-blue-950 dark:text-white">{tr('Générer le planning officiel', 'Generate the official schedule')}</h2><p className="text-sm text-slate-500 dark:text-slate-300">{tr('Les sélections existantes ne sont jamais écrasées. Les élèves et parents reçoivent une notification et un email.', 'Existing assignments are never overwritten. Students and parents receive a notification and an email.')}</p></div></div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm font-semibold dark:text-white">{tr('Du', 'From')}<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="mt-1 w-full rounded-xl border p-3 text-slate-900 dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white"/></label>
          <label className="text-sm font-semibold dark:text-white">{tr('Au', 'To')}<input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="mt-1 w-full rounded-xl border p-3 text-slate-900 dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white"/></label>
          <label className="text-sm font-semibold dark:text-white">{tr('Jour férié / école fermée', 'Holiday / school closed')}<div className="mt-1 flex gap-2"><input type="date" value={holiday} onChange={(event) => setHoliday(event.target.value)} className="min-w-0 flex-1 rounded-xl border p-3 text-slate-900 dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white"/><button type="button" onClick={() => { if (holiday && !excludedDates.includes(holiday)) setExcludedDates([...excludedDates, holiday].sort()); setHoliday('') }} className="rounded-xl bg-sky-100 px-4 font-bold text-kcs-blue-800">+</button></div></label>
          <button type="button" disabled={loading || !startDate || !endDate} onClick={() => void generate()} className="self-end rounded-xl bg-kcs-blue-700 px-5 py-3 font-bold text-white hover:bg-kcs-blue-800 disabled:opacity-50"><Sparkles className="mr-2 inline" size={18}/>{tr('Générer et notifier', 'Generate and notify')}</button>
        </div>
        {excludedDates.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{excludedDates.map((date) => <button key={date} type="button" onClick={() => setExcludedDates(excludedDates.filter((item) => item !== date))} className="rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700">{date} ×</button>)}</div>}
      </section>}

      {notice && <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 font-semibold text-kcs-blue-900 dark:border-kcs-blue-700 dark:bg-kcs-blue-900 dark:text-white">{notice}</div>}
      <section className={card}>
        <div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-bold text-kcs-blue-950 dark:text-white">{tr('Planning et sujets', 'Schedule and topics')}</h2><p className="text-sm text-slate-500 dark:text-slate-300">{tr('Chaque sujet appartient à l’élève : libre, personnel et préparé à l’avance.', 'Each topic belongs to the student: free, personal and prepared in advance.')}</p></div><button onClick={() => void load()} className="rounded-xl border p-3 dark:border-kcs-blue-700 dark:text-white" aria-label={tr('Actualiser', 'Refresh')}><RefreshCw size={18} className={loading ? 'animate-spin' : ''}/></button></div>
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {items.map((item) => <article key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-kcs-blue-700 dark:bg-kcs-blue-950/50">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wider text-sky-700 dark:text-sky-300">{item.division === 'LOWER' ? 'Lower School' : 'Middle & Upper School'}</p><h3 className="mt-1 text-lg font-bold text-kcs-blue-950 dark:text-white">{fullName(item.student.user)}</h3><p className="text-sm text-slate-500 dark:text-slate-300">{item.student.grade}{item.student.section ? ' · ' + item.student.section : ''}</p></div><div className="text-right"><p className="font-bold text-kcs-blue-800 dark:text-sky-200">{new Intl.DateTimeFormat(language === 'fr' ? 'fr-FR' : 'en-US', { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(item.date))}</p><span className="mt-2 inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">{statusLabel(item.status)}</span></div></div>
            <div className="mt-4 grid gap-3"><input value={topics[item.id]?.topic || ''} onChange={(event) => setTopics((current) => ({ ...current, [item.id]: { topic: event.target.value, topicNotes: current[item.id]?.topicNotes || '' } }))} readOnly={!canEditTopic(item)} maxLength={180} placeholder={tr('Sujet libre de la présentation', 'Free-choice presentation topic')} className="rounded-xl border bg-white p-3 text-slate-900 read-only:opacity-70 dark:border-kcs-blue-700 dark:bg-kcs-blue-900 dark:text-white"/><textarea value={topics[item.id]?.topicNotes || ''} onChange={(event) => setTopics((current) => ({ ...current, [item.id]: { topic: current[item.id]?.topic || '', topicNotes: event.target.value } }))} readOnly={!canEditTopic(item)} maxLength={1200} rows={3} placeholder={tr('Quelques notes de préparation (facultatif)', 'Preparation notes (optional)')} className="rounded-xl border bg-white p-3 text-slate-900 read-only:opacity-70 dark:border-kcs-blue-700 dark:bg-kcs-blue-900 dark:text-white"/></div>
            <div className="mt-4 flex flex-wrap gap-2">{canEditTopic(item) && <button type="button" onClick={() => void saveTopic(item)} className="rounded-xl bg-kcs-blue-700 px-4 py-2 text-sm font-bold text-white"><CheckCircle2 className="mr-2 inline" size={16}/>{tr('Enregistrer le sujet', 'Save topic')}</button>}{admin && <><select value={item.status} onChange={(event) => void changeStatus(item, event.target.value as Schedule['status'])} className="rounded-xl border px-3 py-2 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-900 dark:text-white">{(['SCHEDULED','TOPIC_SUBMITTED','PRESENTED','EXCUSED'] as const).map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</select><button type="button" onClick={() => void remove(item)} className="rounded-xl border border-rose-200 px-3 py-2 text-rose-700"><Trash2 size={16}/></button></>}</div>
          </article>)}
          {!loading && items.length === 0 && <p className="rounded-xl bg-slate-50 p-8 text-center text-slate-500 dark:bg-kcs-blue-950/40 dark:text-slate-300">{tr('Aucun passage n’est encore programmé.', 'No presentation has been scheduled yet.')}</p>}
        </div>
      </section>
    </div>
  </main></div>
}
