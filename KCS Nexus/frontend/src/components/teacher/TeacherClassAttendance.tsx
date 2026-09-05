import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ClipboardCheck, Save } from 'lucide-react'
import { attendanceAPI } from '@/services/api'

type Status = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED' | 'SICK' | 'SUSPENDED'
type SchoolClass = { grade: string; section: string; studentCount: number }

const statuses: Status[] = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED', 'SICK', 'SUSPENDED']
const labels: Record<Status, string> = { PRESENT: 'Présent', ABSENT: 'Absent', LATE: 'Retard', EXCUSED: 'Excusé', SICK: 'Malade', SUSPENDED: 'Suspendu' }
const panel = 'rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50'
const field = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white'
const classKey = (value: { grade: string; section: string }) => `${value.grade}::${value.section}`

export default function TeacherClassAttendance() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [selectedClass, setSelectedClass] = useState('')
  const [data, setData] = useState<any>({ class: null, classes: [], students: [] })
  const [states, setStates] = useState<Record<string, Status>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [summary, setSummary] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

  const load = async () => {
    setBusy(true)
    setNotice('')
    try {
      const [grade, section = ''] = selectedClass ? selectedClass.split('::') : []
      const [register, own] = await Promise.all([attendanceAPI.teacherHomeroom(date, grade, section), attendanceAPI.mine()])
      const next = register.data.data
      setData(next)
      setSummary(own.data.data?.summary)
      if (!selectedClass && next.class) setSelectedClass(classKey(next.class))
      setStates(Object.fromEntries((next.students ?? []).map((student: any) => [student.id, student.status ?? 'PRESENT'])))
      setNotes(Object.fromEntries((next.students ?? []).map((student: any) => [student.id, student.note ?? ''])))
    } catch (error: any) {
      setNotice(error?.response?.data?.message ?? 'Impossible de charger le registre de la classe.')
    } finally { setBusy(false) }
  }

  useEffect(() => { void load() }, [date, selectedClass])

  const counts = useMemo(() => statuses.map((status) => ({ status, count: data.students.filter((student: any) => (states[student.id] ?? 'PRESENT') === status).length })), [data.students, states])

  const save = async () => {
    if (!data.class || !data.students.length) return
    setBusy(true)
    try {
      await attendanceAPI.saveTeacherHomeroom({
        date, grade: data.class.grade, section: data.class.section, period: 'Daily',
        entries: data.students.map((student: any) => ({ studentId: student.id, status: states[student.id] ?? 'PRESENT', note: notes[student.id] || undefined })),
      })
      setNotice(`Présence officielle enregistrée pour ${data.students.length} élève(s).`)
      await load()
    } catch (error: any) {
      setNotice(error?.response?.data?.message ?? 'Impossible d’enregistrer la présence.')
    } finally { setBusy(false) }
  }

  return <div className="space-y-5">
    <section className={panel}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div><div className="flex items-center gap-2"><ClipboardCheck className="text-kcs-blue-600" /><h2 className="text-xl font-bold dark:text-white">Présence des élèves</h2></div>
          <p className="mt-2 text-sm text-gray-500">{data.class ? `${data.class.grade} ${data.class.section} · ${data.students.length} élèves` : 'Aucun élève disponible.'}</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-[minmax(190px,1fr)_auto_auto]">
          <select className={field} value={selectedClass} onChange={(event) => setSelectedClass(event.target.value)} disabled={busy || !data.classes?.length}>
            {((data.classes ?? []) as SchoolClass[]).map((item) => <option key={classKey(item)} value={classKey(item)}>{[item.grade, item.section].filter(Boolean).join(' ')} ({item.studentCount})</option>)}
          </select>
          <input type="date" className={field} value={date} onChange={(event) => setDate(event.target.value)} />
          <button disabled={busy || !data.class || !data.students.length} onClick={() => void save()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-kcs-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><Save size={16} />Enregistrer</button>
        </div>
      </div>
      {summary && <p className="mt-4 rounded-xl bg-sky-50 p-3 text-sm text-kcs-blue-800 dark:bg-kcs-blue-800/30 dark:text-white">Ma présence personnelle : {summary.present} présent(s), {summary.absent} absence(s), {summary.late} retard(s) · taux {summary.attendanceRate ?? '—'}%</p>}
    </section>
    {notice && <p className="rounded-xl bg-kcs-blue-50 p-4 text-sm font-semibold text-kcs-blue-800 dark:bg-kcs-blue-900 dark:text-white">{notice}</p>}
    {data.class && <>
      <section className={panel}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">{counts.map((item) => <div key={item.status} className="rounded-xl bg-sky-50 p-3 text-center dark:bg-kcs-blue-800/30"><b className="block text-xl dark:text-white">{item.count}</b><span className="text-xs text-gray-500">{labels[item.status]}</span></div>)}</div>
        <button onClick={() => setStates(Object.fromEntries(data.students.map((student: any) => [student.id, 'PRESENT'])))} className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-green-700"><CheckCircle2 size={17} />Tout marquer présent</button>
      </section>
      <section className={panel}><div className="overflow-x-auto"><table className="min-w-[720px] w-full text-sm">
        <thead><tr className="border-b text-left text-xs uppercase text-gray-400"><th className="pb-3">Élève</th><th>Matricule</th><th>Statut</th><th>Note</th></tr></thead>
        <tbody>{data.students.map((student: any) => <tr key={student.id} className="border-b dark:border-kcs-blue-800"><td className="py-3 font-semibold dark:text-white">{student.name}</td><td>{student.studentNumber}</td><td><select className={field} value={states[student.id] ?? 'PRESENT'} onChange={(event) => setStates((current) => ({ ...current, [student.id]: event.target.value as Status }))}>{statuses.map((status) => <option key={status} value={status}>{labels[status]}</option>)}</select></td><td><input className={field} value={notes[student.id] ?? ''} onChange={(event) => setNotes((current) => ({ ...current, [student.id]: event.target.value }))} placeholder="Note vérifiée" /></td></tr>)}</tbody>
      </table></div></section>
    </>}
  </div>
}
