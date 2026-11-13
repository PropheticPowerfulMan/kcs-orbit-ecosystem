import {useAttendanceDayAccess} from '@/hooks/useAttendanceDayAccess'
import { useAcademicPeriodAccess } from '@/hooks/useAcademicPeriodAccess'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, CheckCircle2, ClipboardCheck, Save, Search, X } from 'lucide-react'
import { attendanceAPI } from '@/services/api'
import { useUIStore } from '@/store/uiStore'

type Status = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED' | 'SICK' | 'SUSPENDED'
type SchoolClass = { grade: string; section: string; studentCount: number }

const statuses: Status[] = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED', 'SICK', 'SUSPENDED']
const labels: Record<Status, Record<'fr' | 'en', string>> = {
  PRESENT: { fr: 'Présent', en: 'Present' }, ABSENT: { fr: 'Absent', en: 'Absent' },
  LATE: { fr: 'Retard', en: 'Late' }, EXCUSED: { fr: 'Excusé', en: 'Excused' },
  SICK: { fr: 'Malade', en: 'Sick' }, SUSPENDED: { fr: 'Suspendu', en: 'Suspended' },
}
const panel = 'rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50'
const field = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white'
const classKey = (value: { grade: string; section: string }) => `${value.grade}::${value.section}`

function HistoryDetail({ register, language, close }: { register: any; language: string; close: () => void }) {
  const fr = language === 'fr'
  return <div className="fixed inset-0 z-[170] flex items-center justify-center bg-kcs-blue-950/75 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" onMouseDown={(event)=>{if(event.target===event.currentTarget)close()}}>
    <section className="flex max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-kcs-blue-950">
      <header className="flex items-start justify-between gap-3 bg-kcs-blue-900 p-4 text-white sm:p-6"><div><h3 className="text-lg font-black sm:text-xl">{fr?'Détail des présences':'Attendance details'}</h3><p className="mt-1 text-xs text-sky-200 sm:text-sm">{new Date(register.date+'T00:00:00').toLocaleDateString(fr?'fr-FR':'en-US')} {' - '} {register.className} {' - '} {register.period || (fr?'Journée':'Daily')}</p></div><button type="button" onClick={close} className="rounded-xl bg-white/10 p-2 hover:bg-white/20" aria-label={fr?'Fermer':'Close'}><X size={20}/></button></header>
      <div className="overflow-auto p-3 sm:p-6">
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{([['PRESENT',register.summary.present],['ABSENT',register.summary.absent],['LATE',register.summary.late],['EXCUSED',register.summary.excused]] as const).map(([status,count])=><div key={status} className="rounded-xl bg-sky-50 p-3 text-center dark:bg-kcs-blue-800"><b className="block text-xl dark:text-white">{count??0}</b><span className="text-xs text-gray-500">{labels[status][fr?'fr':'en']}</span></div>)}</div>
        <div className="overflow-x-auto rounded-xl border dark:border-kcs-blue-800"><table className="w-full min-w-[650px] text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-gray-500 dark:bg-kcs-blue-900"><tr><th className="p-3">{fr?'Élève':'Student'}</th><th>{fr?'Matricule':'Student ID'}</th><th>{fr?'Statut':'Status'}</th><th>{fr?'Note':'Note'}</th></tr></thead><tbody>{(register.students??[]).map((student:any)=><tr key={student.id} className="border-t dark:border-kcs-blue-800"><td className="p-3 font-bold dark:text-white">{student.name}</td><td>{student.studentNumber||'--'}</td><td><span className="rounded-full bg-sky-50 px-2 py-1 text-xs font-bold text-kcs-blue-800 dark:bg-kcs-blue-800 dark:text-white">{labels[student.status as Status]?.[fr?'fr':'en']??student.status}</span></td><td>{student.note||'--'}</td></tr>)}</tbody></table></div>
      </div>
    </section>
  </div>
}

export default function TeacherClassAttendance() {
  const language = useUIStore((state) => state.language)
  const tr = (fr: string, en: string) => language === 'fr' ? fr : en
  const today = new Date().toISOString().slice(0, 10)
  const schoolYearStart = Number(today.slice(0, 4)) - (Number(today.slice(5, 7)) < 9 ? 1 : 0)
  const [date, setDate] = useState(today)
  const schoolDay=useAttendanceDayAccess(date)
  const [selectedClass, setSelectedClass] = useState('')
  const [data, setData] = useState<any>({ class: null, classes: [], students: [] })
  const [states, setStates] = useState<Record<string, Status>>({})
  const { access, readOnly: periodReadOnly } = useAcademicPeriodAccess(undefined, undefined, date)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const busy = loading || saving
  const registerReady = data.date === date && Boolean(data.class) && (!selectedClass || classKey(data.class) === selectedClass)
  const [notice, setNotice] = useState('')
  const [saveConfirmation, setSaveConfirmation] = useState<any>(null)
  const [historyResult, setHistoryResult] = useState<any>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [selectedHistory, setSelectedHistory] = useState<any>(null)
  const [historyFrom, setHistoryFrom] = useState(schoolYearStart + '-09-01')
  const [historyTo, setHistoryTo] = useState(today)
  const [historyQuery, setHistoryQuery] = useState('')
  const [historyRequest, setHistoryRequest] = useState({ from: historyFrom, to: today, q: '', page: 1 })
  const historyEdited = useRef(false)
  const registerSequence = useRef(0)
  const historySequence = useRef(0)

  useEffect(() => {
    const calendar = access?.calendars?.find(item => item.name === access.activeAcademicYear)
    const from = calendar?.startDate.slice(0, 10)
    if (!historyEdited.current && from && from <= today) {
      setHistoryFrom(from)
      setHistoryRequest(current => current.from === from ? current : { ...current, from, page: 1 })
    }
  }, [access, today])

  const load = useCallback(async () => {
    const sequence = ++registerSequence.current
    setLoading(true)
    setNotice('')
    try {
      const [grade, section = ''] = selectedClass ? selectedClass.split('::') : []
      const register = await attendanceAPI.teacherHomeroom(date, grade, section)
      if (sequence !== registerSequence.current) return
      const next = register.data.data
      setData(next)
      setSummary(next.summary)
      if (!selectedClass && next.class) setSelectedClass(classKey(next.class))
      setStates(Object.fromEntries((next.students ?? []).map((student: any) => [student.id, student.status ?? 'PRESENT'])))
      setNotes(Object.fromEntries((next.students ?? []).map((student: any) => [student.id, student.note ?? ''])))
    } catch (error: any) {
      if (sequence === registerSequence.current) setNotice(error?.response?.data?.message ?? (useUIStore.getState().language === 'fr' ? 'Impossible de charger le registre de la classe.' : 'Unable to load the class attendance register.'))
    } finally {
      if (sequence === registerSequence.current) setLoading(false)
    }
  }, [date, selectedClass])

  useEffect(() => {
    void load()
    return () => { registerSequence.current++ }
  }, [load])

  const loadHistory = useCallback(async () => {
    const sequence = ++historySequence.current
    setHistoryLoading(true)
    setHistoryError('')
    try {
      const response = await attendanceAPI.history(historyRequest.from, historyRequest.to, { page: historyRequest.page, q: historyRequest.q })
      if (sequence === historySequence.current) setHistoryResult(response.data.data)
    } catch {
      if (sequence === historySequence.current) setHistoryError(language === 'fr'
        ? 'Le chargement a échoué. Les derniers résultats reçus restent affichés. Réessayez pour actualiser la recherche.'
        : 'Loading failed. The last received results remain displayed. Retry to refresh the search.')
    } finally {
      if (sequence === historySequence.current) setHistoryLoading(false)
    }
  }, [historyRequest, language])

  useEffect(() => {
    void loadHistory()
    return () => { historySequence.current++ }
  }, [loadHistory])

  const counts = useMemo(() => statuses.map((status) => ({ status, count: data.students.filter((student: any) => (states[student.id] ?? 'PRESENT') === status).length })), [data.students, states])

  const searchHistory = (event: React.FormEvent) => {
    event.preventDefault()
    historyEdited.current = true
    if (!historyFrom || !historyTo || historyFrom > historyTo || Date.parse(historyTo) - Date.parse(historyFrom) > 366 * 86_400_000) {
      setHistoryError(tr('Choisissez une période valide de 366 jours maximum. Vous pouvez consulter chaque année séparément.', 'Choose a valid date range of up to 366 days. You can consult each year separately.'))
      return
    }
    setHistoryRequest({ from: historyFrom, to: historyTo, q: historyQuery.trim(), page: 1 })
  }

  const save = async () => {
    if (busy || periodReadOnly || !registerReady || !data.students.length) return
    setSaving(true)
    try {
      const response = await attendanceAPI.saveTeacherHomeroom({
        date, grade: data.class.grade, section: data.class.section, period: 'Daily',
        entries: data.students.map((student: any) => ({ studentId: student.id, status: states[student.id] ?? 'PRESENT', note: notes[student.id] || undefined })),
      })
      const saved = response.data.data
      if (saved.verified !== true || saved.saved !== data.students.length) throw new Error('Unverified attendance response')
      setSummary(saved.summary)
      setSaveConfirmation({ ...saved, grade: data.class.grade, section: data.class.section })
      await load()
      await loadHistory()
    } catch (error: any) {
      setNotice(error?.response?.data?.message ?? tr('La confirmation serveur n’a pas pu être obtenue. Rechargez le registre pour vérifier les présences avant de réessayer.', 'Server confirmation could not be obtained. Reload the register to verify attendance before retrying.'))
    } finally { setSaving(false) }
  }

  return <div className="space-y-5">
    {periodReadOnly && <p role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-bold text-amber-950 dark:bg-amber-950/40 dark:text-amber-200">{tr('Cette période est clôturée. Le registre est en lecture seule.', 'This academic period is closed. Attendance is read-only.')}</p>}
    <section className={panel}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div><div className="flex items-center gap-2"><ClipboardCheck className="text-kcs-blue-600" /><h2 className="text-xl font-bold dark:text-white">{tr('Présence des élèves', 'Student attendance')}</h2></div>
          <p className="mt-2 text-sm text-gray-500">{data.class ? `${data.class.grade} ${data.class.section} · ${data.students.length} ${tr('élève(s)', 'student(s)')}` : tr('Aucun élève disponible.', 'No students available.')}</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-[minmax(190px,1fr)_auto_auto]">
          <select className={field} value={selectedClass} onChange={(event) => setSelectedClass(event.target.value)} disabled={busy || !data.classes?.length}>
            {((data.classes ?? []) as SchoolClass[]).map((item) => <option key={classKey(item)} value={classKey(item)}>{[item.grade, item.section].filter(Boolean).join(' ')} ({item.studentCount})</option>)}
          </select>
          <input type="date" aria-label={tr('Date du registre', 'Register date')} disabled={busy} className={field} value={date} onChange={(event) => setDate(event.target.value)} />
          <button disabled={periodReadOnly || !schoolDay.allowed || busy || !registerReady || !data.students.length} onClick={() => void save()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-kcs-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><Save size={16} />{busy ? tr('Traitement…', 'Processing…') : tr('Enregistrer', 'Save')}</button>
        </div>
      </div>
      {registerReady && summary && <p className="mt-4 rounded-xl bg-sky-50 p-3 text-sm text-kcs-blue-800 dark:bg-kcs-blue-800/30 dark:text-white">{tr('Présence journalière de la classe', 'Daily class attendance')}: {summary.present} {tr('présent(s)', 'present')}, {summary.absent} {tr('absence(s)', 'absent')}, {summary.late} {tr('retard(s)', 'late')} · {tr('taux', 'rate')} {summary.attendanceRate ?? '—'}%</p>}
    </section>
    {!schoolDay.allowed && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">{schoolDay.reason[language]}</p>}
    {notice && <div role="alert" className="rounded-xl bg-kcs-blue-50 p-4 text-sm font-semibold text-kcs-blue-800 dark:bg-kcs-blue-900 dark:text-white">{notice}<button type="button" disabled={busy} onClick={() => void load()} className="ml-3 underline disabled:opacity-50">{tr('Recharger le registre', 'Reload register')}</button></div>}
    {data.requiresRosterAssignment && <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">{tr(`${data.unassignedStudentCount} \u00e9l\u00e8ve(s) de ce niveau ne sont pas encore affect\u00e9s \u00e0 une sous-classe. Le Principal doit terminer leur affectation dans "Main Teacher Assignment" avant qu\u2019ils apparaissent dans le registre appropri\u00e9.`, `${data.unassignedStudentCount} learner(s) in this grade are not assigned to a class section yet. The Principal must complete the roster in "Main Teacher Assignment" before they appear in the correct register.`)}</p>}
    {data.class && schoolDay.allowed && <>
      <section className={panel}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">{counts.map((item) => <div key={item.status} className="rounded-xl bg-sky-50 p-3 text-center dark:bg-kcs-blue-800/30"><b className="block text-xl dark:text-white">{item.count}</b><span className="text-xs text-gray-500">{labels[item.status][language]}</span></div>)}</div>
        <button disabled={periodReadOnly || !schoolDay.allowed || busy || !registerReady} onClick={() => setStates(Object.fromEntries(data.students.map((student: any) => [student.id, student.statusLocked ? 'SUSPENDED' : 'PRESENT'])))} className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-green-700"><CheckCircle2 size={17} />{tr('Tout marquer présent', 'Mark all present')}</button>
      </section>
      <section className={panel}><div className="overflow-x-auto"><table className="min-w-[720px] w-full text-sm">
        <thead><tr className="border-b text-left text-xs uppercase text-gray-400"><th className="pb-3">{tr('Élève', 'Student')}</th><th>{tr('Matricule', 'Student ID')}</th><th>{tr('Statut', 'Status')}</th><th>{tr('Explication / observation', 'Explanation / observation')}</th></tr></thead>
        <tbody>{data.students.map((student: any) => <tr key={student.id} className="border-b dark:border-kcs-blue-800"><td className="py-3 font-semibold dark:text-white">{student.name}{student.statusLocked?<small className="block text-rose-600">{tr('Suspension officielle active','Active official suspension')}</small>:null}</td><td>{student.studentNumber}</td><td><select disabled={periodReadOnly || !schoolDay.allowed || busy || !registerReady || student.statusLocked} className={field} value={states[student.id] ?? 'PRESENT'} onChange={(event) => setStates((current) => ({ ...current, [student.id]: event.target.value as Status }))}>{statuses.map((status) => <option key={status} value={status}>{labels[status][language]}</option>)}</select></td><td><textarea rows={2} maxLength={500} aria-label={tr('Explication pour ' + student.name, 'Explanation for ' + student.name)} disabled={periodReadOnly || !schoolDay.allowed || busy || !registerReady || student.statusLocked} className={field + ' min-w-52 resize-y'} value={notes[student.id] ?? ''} onChange={(event) => setNotes((current) => ({ ...current, [student.id]: event.target.value }))} placeholder={(states[student.id] ?? 'PRESENT') === 'ABSENT' ? tr('Motif de l’absence, si connu (facultatif)', 'Reason for absence, if known (optional)') : tr('Observation facultative', 'Optional observation')} /></td></tr>)}</tbody>
      </table></div></section>
    </>}
    <section className={panel} aria-label={tr('Historique officiel des présences', 'Official attendance history')}>
      <div className="flex items-center gap-2"><CalendarDays className="shrink-0 text-kcs-blue-600 dark:text-sky-300"/><div><h3 className="font-bold dark:text-white">{tr('Historique officiel des présences','Official attendance history')}</h3><p className="text-xs text-gray-600 dark:text-gray-300">{tr('Consultez les registres conservés, y compris les mois et années scolaires précédents.','Consult saved registers, including previous months and school years.')}</p></div></div>
      <form onSubmit={searchHistory} className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(140px,1fr)_minmax(140px,1fr)_minmax(200px,2fr)_auto] xl:items-end">
        <label className="text-xs font-semibold text-gray-600 dark:text-gray-200">{tr('Du', 'From')}<input type="date" required className={field + ' mt-1'} value={historyFrom} onChange={event => { historyEdited.current = true; setHistoryFrom(event.target.value) }}/></label>
        <label className="text-xs font-semibold text-gray-600 dark:text-gray-200">{tr('Au', 'To')}<input type="date" required className={field + ' mt-1'} value={historyTo} onChange={event => { historyEdited.current = true; setHistoryTo(event.target.value) }}/></label>
        <label className="text-xs font-semibold text-gray-600 dark:text-gray-200">{tr('Élève, matricule, classe ou observation', 'Student, ID, class or note')}<input maxLength={200} value={historyQuery} onChange={event => { historyEdited.current = true; setHistoryQuery(event.target.value) }} className={field + ' mt-1'} placeholder={tr('Rechercher dans tous les registres de la période', 'Search all registers in the date range')}/></label>
        <button type="submit" disabled={historyLoading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-kcs-blue-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-kcs-blue-800 disabled:opacity-50"><Search size={16}/>{historyLoading ? tr('Chargement…', 'Loading…') : tr('Rechercher', 'Search')}</button>
      </form>
      {historyError && <div role="alert" className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">{historyError}<button type="button" disabled={historyLoading} onClick={() => void loadHistory()} className="ml-3 font-bold underline">{tr('Réessayer', 'Retry')}</button></div>}
      {historyLoading && <p role="status" className="mt-4 text-sm text-gray-600 dark:text-gray-300">{tr('Chargement de l’historique…','Loading history…')}</p>}
      {historyResult && <>
        <p className="mt-4 text-xs font-semibold text-gray-600 dark:text-gray-300">{tr('Résultats affichés', 'Displayed results')} · {historyResult.from} → {historyResult.to} · {historyResult.pagination.total} {tr('registre(s)', 'register(s)')}</p>
        {historyResult.registers.length === 0 ? <p className="mt-4 text-sm text-gray-600 dark:text-gray-300">{tr('Aucun registre ne correspond à cette période et à cette recherche.', 'No register matches this date range and search.')}</p> : <div className="mt-4 overflow-x-auto"><table className="min-w-[620px] w-full text-sm"><thead><tr className="border-b text-left text-xs uppercase text-gray-500 dark:text-gray-300"><th className="pb-3">{tr('Date','Date')}</th><th>{tr('Classe','Class')}</th><th>{tr('Élèves','Students')}</th><th>{tr('Présents','Present')}</th><th>{tr('Absents','Absent')}</th><th>{tr('Retards','Late')}</th><th>{tr('Taux','Rate')}</th></tr></thead><tbody>{historyResult.registers.map((register:any, index:number)=><tr key={`${register.date}-${register.className}-${register.period}-${index}`} className="border-b text-gray-700 dark:border-kcs-blue-800 dark:text-gray-200"><td className="py-3 font-semibold"><button type="button" className="text-kcs-blue-700 underline dark:text-sky-300" onClick={()=>setSelectedHistory(register)}>{new Date(`${register.date}T00:00:00`).toLocaleDateString(language==='fr'?'fr-FR':'en-US')}</button></td><td>{register.className}</td><td>{register.summary.total}</td><td>{register.summary.present}</td><td>{register.summary.absent}</td><td>{register.summary.late}</td><td>{register.summary.attendanceRate??'—'}%</td></tr>)}</tbody></table></div>}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-700 dark:text-gray-200">
          <span>{tr('Page', 'Page')} {historyResult.pagination.page} / {historyResult.pagination.pageCount}</span>
          <div className="flex gap-2">{([-1, 1] as const).map(direction => <button key={direction} type="button" disabled={historyLoading || (direction < 0 ? historyResult.pagination.page <= 1 : historyResult.pagination.page >= historyResult.pagination.pageCount)} onClick={() => setHistoryRequest(current => ({ ...current, page: historyResult.pagination.page + direction }))} className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 font-semibold text-kcs-blue-800 disabled:opacity-40 dark:border-kcs-blue-700 dark:bg-kcs-blue-800 dark:text-white">{direction < 0 ? tr('Précédent', 'Previous') : tr('Suivant', 'Next')}</button>)}</div>
        </div>
      </>}
      <p className="mt-3 text-xs text-gray-600 dark:text-gray-300">{tr('Cliquez sur une date pour rouvrir le registre détaillé et vérifier chaque élève.','Click a date to reopen the detailed register and verify every student.')}</p>
    </section>
    {selectedHistory && <HistoryDetail register={selectedHistory} language={language} close={()=>setSelectedHistory(null)}/>}
    {saveConfirmation && <div className="fixed inset-0 z-[150] flex items-center justify-center bg-kcs-blue-950/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="attendance-confirmation-title"><section className="w-full max-w-lg rounded-3xl border border-sky-200 bg-white p-6 text-center shadow-2xl dark:border-sky-700 dark:bg-kcs-blue-900 sm:p-8"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"><CheckCircle2 size={34} /></div><h3 id="attendance-confirmation-title" className="mt-4 text-2xl font-bold text-kcs-blue-950 dark:text-white">{tr('Présence journalière enregistrée','Daily attendance saved')}</h3><p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{[saveConfirmation.grade, saveConfirmation.section].filter(Boolean).join(' ')} · {saveConfirmation.date} · {saveConfirmation.saved} {tr('élève(s)','student(s)')}</p><div className="mt-5 grid grid-cols-3 gap-2"><div className="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-950/30"><b className="block text-xl text-emerald-700 dark:text-emerald-300">{saveConfirmation.summary?.present ?? 0}</b><span className="text-xs text-gray-600 dark:text-gray-300">{tr('Présents','Present')}</span></div><div className="rounded-xl bg-rose-50 p-3 dark:bg-rose-950/30"><b className="block text-xl text-rose-700 dark:text-rose-300">{saveConfirmation.summary?.absent ?? 0}</b><span className="text-xs text-gray-600 dark:text-gray-300">{tr('Absents','Absent')}</span></div><div className="rounded-xl bg-amber-50 p-3 dark:bg-amber-950/30"><b className="block text-xl text-amber-700 dark:text-amber-300">{saveConfirmation.summary?.late ?? 0}</b><span className="text-xs text-gray-600 dark:text-gray-300">{tr('Retards','Late')}</span></div></div><p className="mt-4 rounded-xl bg-sky-50 p-3 text-sm font-semibold text-kcs-blue-800 dark:bg-kcs-blue-800 dark:text-white">{tr('Taux de présence','Attendance rate')} : {saveConfirmation.summary?.attendanceRate ?? '—'}%</p><button type="button" onClick={() => setSaveConfirmation(null)} className="mt-5 w-full rounded-xl bg-kcs-blue-700 px-5 py-3 font-bold text-white hover:bg-kcs-blue-800">{tr('Compris','Done')}</button></section></div>}
  </div>
}
