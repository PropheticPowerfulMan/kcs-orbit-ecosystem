import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, CheckCircle2, ClipboardCheck, Save, X } from 'lucide-react'
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
      <header className="flex items-start justify-between gap-3 bg-kcs-blue-900 p-4 text-white sm:p-6"><div><h3 className="text-lg font-black sm:text-xl">{fr?'Detail de la presence':'Attendance details'}</h3><p className="mt-1 text-xs text-sky-200 sm:text-sm">{new Date(register.date+'T00:00:00').toLocaleDateString(fr?'fr-FR':'en-US')} {' - '} {register.className} {' - '} {register.period || (fr?'Journee':'Daily')}</p></div><button type="button" onClick={close} className="rounded-xl bg-white/10 p-2 hover:bg-white/20" aria-label={fr?'Fermer':'Close'}><X size={20}/></button></header>
      <div className="overflow-auto p-3 sm:p-6">
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{([['PRESENT',register.summary.present],['ABSENT',register.summary.absent],['LATE',register.summary.late],['EXCUSED',register.summary.excused]] as const).map(([status,count])=><div key={status} className="rounded-xl bg-sky-50 p-3 text-center dark:bg-kcs-blue-800"><b className="block text-xl dark:text-white">{count??0}</b><span className="text-xs text-gray-500">{labels[status][fr?'fr':'en']}</span></div>)}</div>
        <div className="overflow-x-auto rounded-xl border dark:border-kcs-blue-800"><table className="w-full min-w-[650px] text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-gray-500 dark:bg-kcs-blue-900"><tr><th className="p-3">{fr?'Eleve':'Student'}</th><th>{fr?'Matricule':'Student ID'}</th><th>{fr?'Statut':'Status'}</th><th>{fr?'Note':'Note'}</th></tr></thead><tbody>{(register.students??[]).map((student:any)=><tr key={student.id} className="border-t dark:border-kcs-blue-800"><td className="p-3 font-bold dark:text-white">{student.name}</td><td>{student.studentNumber||'--'}</td><td><span className="rounded-full bg-sky-50 px-2 py-1 text-xs font-bold text-kcs-blue-800 dark:bg-kcs-blue-800 dark:text-white">{labels[student.status as Status]?.[fr?'fr':'en']??student.status}</span></td><td>{student.note||'--'}</td></tr>)}</tbody></table></div>
      </div>
    </section>
  </div>
}

export default function TeacherClassAttendance() {
  const language = useUIStore((state) => state.language)
  const tr = (fr: string, en: string) => language === 'fr' ? fr : en
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [selectedClass, setSelectedClass] = useState('')
  const [data, setData] = useState<any>({ class: null, classes: [], students: [] })
  const [states, setStates] = useState<Record<string, Status>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [summary, setSummary] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [saveConfirmation, setSaveConfirmation] = useState<any>(null)
  const [history, setHistory] = useState<any[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [selectedHistory, setSelectedHistory] = useState<any>(null)

  const load = async () => {
    setBusy(true)
    setNotice('')
    try {
      const [grade, section = ''] = selectedClass ? selectedClass.split('::') : []
      const register = await attendanceAPI.teacherHomeroom(date, grade, section)
      const next = register.data.data
      setData(next)
      setSummary(next.summary)
      if (!selectedClass && next.class) setSelectedClass(classKey(next.class))
      setStates(Object.fromEntries((next.students ?? []).map((student: any) => [student.id, student.status ?? 'PRESENT'])))
      setNotes(Object.fromEntries((next.students ?? []).map((student: any) => [student.id, student.note ?? ''])))
    } catch (error: any) {
      setNotice(error?.response?.data?.message ?? tr('Impossible de charger le registre de la classe.', 'Unable to load the class attendance register.'))
    } finally { setBusy(false) }
  }

  useEffect(() => { void load() }, [date, selectedClass])
  const loadHistory = async () => {
    setHistoryLoading(true)
    try {
      const to = new Date().toISOString().slice(0, 10)
      const fromDate = new Date()
      fromDate.setDate(fromDate.getDate() - 29)
      const response = await attendanceAPI.history(fromDate.toISOString().slice(0, 10), to)
      setHistory(response.data.data?.registers ?? [])
    } catch { setHistory([]) } finally { setHistoryLoading(false) }
  }
  useEffect(() => { void loadHistory() }, [])

  const counts = useMemo(() => statuses.map((status) => ({ status, count: data.students.filter((student: any) => (states[student.id] ?? 'PRESENT') === status).length })), [data.students, states])

  const save = async () => {
    if (!data.class || !data.students.length) return
    setBusy(true)
    try {
      const response = await attendanceAPI.saveTeacherHomeroom({
        date, grade: data.class.grade, section: data.class.section, period: 'Daily',
        entries: data.students.map((student: any) => ({ studentId: student.id, status: states[student.id] ?? 'PRESENT', note: notes[student.id] || undefined })),
      })
      const saved = response.data.data
      setSummary(saved.summary)
      setSaveConfirmation({ ...saved, grade: data.class.grade, section: data.class.section })
      setNotice(tr(`Présence officielle enregistrée pour ${saved.saved} élève(s).`, `Official attendance saved for ${saved.saved} student(s).`))
      await load()
      await loadHistory()
    } catch (error: any) {
      setNotice(error?.response?.data?.message ?? tr('Impossible d’enregistrer la présence.', 'Unable to save attendance.'))
    } finally { setBusy(false) }
  }

  return <div className="space-y-5">
    <section className={panel}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div><div className="flex items-center gap-2"><ClipboardCheck className="text-kcs-blue-600" /><h2 className="text-xl font-bold dark:text-white">{tr('Présence des élèves', 'Student attendance')}</h2></div>
          <p className="mt-2 text-sm text-gray-500">{data.class ? `${data.class.grade} ${data.class.section} · ${data.students.length} ${tr('élève(s)', 'student(s)')}` : tr('Aucun élève disponible.', 'No students available.')}</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-[minmax(190px,1fr)_auto_auto]">
          <select className={field} value={selectedClass} onChange={(event) => setSelectedClass(event.target.value)} disabled={busy || !data.classes?.length}>
            {((data.classes ?? []) as SchoolClass[]).map((item) => <option key={classKey(item)} value={classKey(item)}>{[item.grade, item.section].filter(Boolean).join(' ')} ({item.studentCount})</option>)}
          </select>
          <input type="date" className={field} value={date} onChange={(event) => setDate(event.target.value)} />
          <button disabled={busy || !data.class || !data.students.length} onClick={() => void save()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-kcs-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><Save size={16} />{busy ? tr('Traitement…', 'Processing…') : tr('Enregistrer', 'Save')}</button>
        </div>
      </div>
      {summary && <p className="mt-4 rounded-xl bg-sky-50 p-3 text-sm text-kcs-blue-800 dark:bg-kcs-blue-800/30 dark:text-white">{tr('Présence journalière de la classe', 'Daily class attendance')}: {summary.present} {tr('présent(s)', 'present')}, {summary.absent} {tr('absence(s)', 'absent')}, {summary.late} {tr('retard(s)', 'late')} · {tr('taux', 'rate')} {summary.attendanceRate ?? '—'}%</p>}
    </section>
    {notice && <p className="rounded-xl bg-kcs-blue-50 p-4 text-sm font-semibold text-kcs-blue-800 dark:bg-kcs-blue-900 dark:text-white">{notice}</p>}
    {data.class && <>
      <section className={panel}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">{counts.map((item) => <div key={item.status} className="rounded-xl bg-sky-50 p-3 text-center dark:bg-kcs-blue-800/30"><b className="block text-xl dark:text-white">{item.count}</b><span className="text-xs text-gray-500">{labels[item.status][language]}</span></div>)}</div>
        <button onClick={() => setStates(Object.fromEntries(data.students.map((student: any) => [student.id, 'PRESENT'])))} className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-green-700"><CheckCircle2 size={17} />{tr('Tout marquer présent', 'Mark all present')}</button>
      </section>
      <section className={panel}><div className="overflow-x-auto"><table className="min-w-[720px] w-full text-sm">
        <thead><tr className="border-b text-left text-xs uppercase text-gray-400"><th className="pb-3">{tr('Élève', 'Student')}</th><th>{tr('Matricule', 'Student ID')}</th><th>{tr('Statut', 'Status')}</th><th>{tr('Note', 'Note')}</th></tr></thead>
        <tbody>{data.students.map((student: any) => <tr key={student.id} className="border-b dark:border-kcs-blue-800"><td className="py-3 font-semibold dark:text-white">{student.name}</td><td>{student.studentNumber}</td><td><select className={field} value={states[student.id] ?? 'PRESENT'} onChange={(event) => setStates((current) => ({ ...current, [student.id]: event.target.value as Status }))}>{statuses.map((status) => <option key={status} value={status}>{labels[status][language]}</option>)}</select></td><td><input className={field} value={notes[student.id] ?? ''} onChange={(event) => setNotes((current) => ({ ...current, [student.id]: event.target.value }))} placeholder={tr('Note vérifiée', 'Verified note')} /></td></tr>)}</tbody>
      </table></div></section>
    </>}
    <section className={panel}>
      <div className="flex items-center gap-2"><CalendarDays className="text-kcs-blue-600"/><div><h3 className="font-bold dark:text-white">{tr('Historique officiel des présences','Official attendance history')}</h3><p className="text-xs text-gray-500">{tr('Registres que vous avez enregistrés durant les 30 derniers jours.','Registers you saved during the last 30 days.')}</p></div></div>
      {historyLoading?<p className="mt-4 text-sm text-gray-500">{tr('Chargement de l’historique…','Loading history…')}</p>:history.length===0?<p className="mt-4 text-sm text-gray-500">{tr('Aucune présence passée enregistrée.','No past attendance has been saved.')}</p>:<div className="mt-4 overflow-x-auto"><table className="min-w-[720px] w-full text-sm"><thead><tr className="border-b text-left text-xs uppercase text-gray-400"><th className="pb-3">{tr('Date','Date')}</th><th>{tr('Classe','Class')}</th><th>{tr('Élèves','Students')}</th><th>{tr('Présents','Present')}</th><th>{tr('Absents','Absent')}</th><th>{tr('Retards','Late')}</th><th>{tr('Taux','Rate')}</th></tr></thead><tbody>{history.map((register:any)=><tr key={`${register.date}-${register.className}-${register.period}`} className="border-b dark:border-kcs-blue-800"><td className="py-3 font-semibold dark:text-white"><button type="button" className="text-kcs-blue-700 underline dark:text-sky-300" onClick={()=>setSelectedHistory(register)}>{new Date(`${register.date}T00:00:00`).toLocaleDateString(language==='fr'?'fr-FR':'en-US')}</button></td><td>{register.className}</td><td>{register.summary.total}</td><td>{register.summary.present}</td><td>{register.summary.absent}</td><td>{register.summary.late}</td><td>{register.summary.attendanceRate??'—'}%</td></tr>)}</tbody></table></div>}
      <p className="mt-3 text-xs text-gray-500">{tr('Cliquez sur une date pour rouvrir le registre détaillé et vérifier chaque élève.','Click a date to reopen the detailed register and verify every student.')}</p>
    </section>
    {selectedHistory && <HistoryDetail register={selectedHistory} language={language} close={()=>setSelectedHistory(null)}/>}
    {saveConfirmation && <div className="fixed inset-0 z-[150] flex items-center justify-center bg-kcs-blue-950/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="attendance-confirmation-title"><section className="w-full max-w-lg rounded-3xl border border-sky-200 bg-white p-6 text-center shadow-2xl dark:border-sky-700 dark:bg-kcs-blue-900 sm:p-8"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"><CheckCircle2 size={34} /></div><h3 id="attendance-confirmation-title" className="mt-4 text-2xl font-bold text-kcs-blue-950 dark:text-white">{tr('Présence journalière enregistrée','Daily attendance saved')}</h3><p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{[saveConfirmation.grade, saveConfirmation.section].filter(Boolean).join(' ')} · {saveConfirmation.date} · {saveConfirmation.saved} {tr('élève(s)','student(s)')}</p><div className="mt-5 grid grid-cols-3 gap-2"><div className="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-950/30"><b className="block text-xl text-emerald-700 dark:text-emerald-300">{saveConfirmation.summary?.present ?? 0}</b><span className="text-xs text-gray-600 dark:text-gray-300">{tr('Présents','Present')}</span></div><div className="rounded-xl bg-rose-50 p-3 dark:bg-rose-950/30"><b className="block text-xl text-rose-700 dark:text-rose-300">{saveConfirmation.summary?.absent ?? 0}</b><span className="text-xs text-gray-600 dark:text-gray-300">{tr('Absents','Absent')}</span></div><div className="rounded-xl bg-amber-50 p-3 dark:bg-amber-950/30"><b className="block text-xl text-amber-700 dark:text-amber-300">{saveConfirmation.summary?.late ?? 0}</b><span className="text-xs text-gray-600 dark:text-gray-300">{tr('Retards','Late')}</span></div></div><p className="mt-4 rounded-xl bg-sky-50 p-3 text-sm font-semibold text-kcs-blue-800 dark:bg-kcs-blue-800 dark:text-white">{tr('Taux de présence','Attendance rate')} : {saveConfirmation.summary?.attendanceRate ?? '—'}%</p><button type="button" onClick={() => setSaveConfirmation(null)} className="mt-5 w-full rounded-xl bg-kcs-blue-700 px-5 py-3 font-bold text-white hover:bg-kcs-blue-800">{tr('Compris','Done')}</button></section></div>}
  </div>
}
