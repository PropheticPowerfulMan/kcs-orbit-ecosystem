import { useEffect, useMemo, useState } from 'react'
import { CalendarClock, Plus, Save, Trash2, UsersRound } from 'lucide-react'
import { academicCalendarAPI } from '@/services/api'
import { useUIStore } from '@/store/uiStore'

type ScheduleRow = { id: string; grade: string; classGroup: string; day: string; period: number; startTime: string; endTime: string; subject: string; teacherName: string; room: string }
const emptyRow = (): ScheduleRow => ({ id: crypto.randomUUID(), grade: 'K3', classGroup: '', day: 'Monday', period: 1, startTime: '08:00', endTime: '08:45', subject: '', teacherName: '', room: '' })
const grades = ['K3', 'K4', 'K5', ...Array.from({ length: 12 }, (_, index) => `Grade ${index + 1}`)]
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
const field = 'min-w-0 rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white'

export default function SemesterTimetableManager({ academicYear }: { academicYear: string }) {
  const language = useUIStore((state) => state.language)
  const tr = (fr: string, en: string) => language === 'fr' ? fr : en
  const [semester, setSemester] = useState(1)
  const [rows, setRows] = useState<ScheduleRow[]>([emptyRow()])
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [promotionPlan, setPromotionPlan] = useState<any>(null)
  const [overrides, setOverrides] = useState<Record<string, string>>({})
  const sortedRows = useMemo(() => [...rows].sort((a, b) => grades.indexOf(a.grade) - grades.indexOf(b.grade) || days.indexOf(a.day) - days.indexOf(b.day) || a.period - b.period), [rows])

  useEffect(() => {
    setBusy(true)
    academicCalendarAPI.schedule(academicYear, semester).then(({ data }) => {
      const entries = data?.data ?? []
      setRows(entries.length ? entries.map((entry: any) => ({ ...entry, id: entry.id, classGroup: entry.classGroup ?? '', teacherName: entry.teacherName ?? '', room: entry.room ?? '' })) : [emptyRow()])
    }).catch(() => setNotice(tr('Aucun horaire publié pour cette période.', 'No timetable has been published for this period.'))).finally(() => setBusy(false))
  }, [academicYear, semester])

  const update = (id: string, patch: Partial<ScheduleRow>) => setRows((current) => current.map((row) => row.id === id ? { ...row, ...patch } : row))
  const publish = async () => {
    const valid = rows.filter((row) => row.subject.trim() && row.teacherName.trim())
    if (!valid.length) return setNotice(tr('Ajoutez au moins un cours avec matière et enseignant.', 'Add at least one course with a subject and teacher.'))
    setBusy(true)
    try {
      await academicCalendarAPI.publishSchedule({ academicYear, semester, entries: valid.map(({ id: _id, ...row }) => ({ ...row, classGroup: row.classGroup || null, room: row.room || null })) })
      setNotice(tr('Horaire semestriel publié. Les tableaux enseignants et élèves sont synchronisés.', 'Semester timetable published. Teacher and student dashboards are synchronized.'))
    } catch (error: any) { setNotice(error?.response?.data?.message || tr('Publication impossible.', 'Publication failed.')) }
    finally { setBusy(false) }
  }
  const previewPromotion = async () => {
    setBusy(true)
    try { const { data } = await academicCalendarAPI.previewPromotion({ effectiveDate: new Date().toISOString(), passThreshold: 70 }); setPromotionPlan(data.plan); setNotice('') }
    catch (error: any) { setNotice(error?.response?.data?.message || tr('Prévisualisation impossible.', 'Preview failed.')) }
    finally { setBusy(false) }
  }
  const executePromotion = async () => {
    if (!promotionPlan || !window.confirm(tr('Confirmer le passage/reclassement de ces élèves ? Cette opération est auditée.', 'Confirm promotion/class placement for these learners? This operation is audited.'))) return
    setBusy(true)
    try {
      const decisions = Object.entries(overrides).filter(([, decision]) => decision !== 'AUTO').map(([studentId, decision]) => ({ studentId, decision, reason: 'Manual Super Administrator decision from Nexus' }))
      const { data } = await academicCalendarAPI.runPromotion({ effectiveDate: new Date().toISOString(), passThreshold: 70, force: true, overrides: decisions })
      setPromotionPlan(data.plan); setNotice(tr('Passage de classe exécuté et propagé par Orbit.', 'Class promotion executed and propagated by Orbit.'))
    } catch (error: any) { setNotice(error?.response?.data?.message || tr('Exécution impossible.', 'Execution failed.')) }
    finally { setBusy(false) }
  }

  return <div className="mt-6 space-y-5">
    <section className="rounded-2xl border border-sky-200 bg-sky-50/70 p-4 dark:border-kcs-blue-700 dark:bg-kcs-blue-900/50">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="flex items-center gap-2 font-black text-kcs-blue-950 dark:text-white"><CalendarClock size={20}/>{tr('Horaire semestriel officiel','Official semester timetable')}</h3><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{tr('Le Principal ou le Superadministrateur publie ici la source unique affichée dans Timetable.','The Principal or Super Administrator publishes the single timetable source shown in Timetable.')}</p></div><select className={field} value={semester} onChange={(event)=>setSemester(Number(event.target.value))}><option value={1}>{tr('Semestre 1','Semester 1')}</option><option value={2}>{tr('Semestre 2','Semester 2')}</option></select></div>
      <div className="mt-4 overflow-x-auto"><div className="min-w-[1060px] space-y-2">{sortedRows.map((row) => <div key={row.id} className="grid grid-cols-[120px_90px_120px_70px_95px_95px_1fr_1fr_100px_42px] gap-2">
        <select className={field} value={row.grade} onChange={(e)=>update(row.id,{grade:e.target.value})}>{grades.map((grade)=><option key={grade}>{grade}</option>)}</select><input className={field} value={row.classGroup} onChange={(e)=>update(row.id,{classGroup:e.target.value})} placeholder={tr('Section','Section')}/><select className={field} value={row.day} onChange={(e)=>update(row.id,{day:e.target.value})}>{days.map((day)=><option key={day}>{day}</option>)}</select><input type="number" min={1} max={20} className={field} value={row.period} onChange={(e)=>update(row.id,{period:Number(e.target.value)})}/><input type="time" className={field} value={row.startTime} onChange={(e)=>update(row.id,{startTime:e.target.value})}/><input type="time" className={field} value={row.endTime} onChange={(e)=>update(row.id,{endTime:e.target.value})}/><input className={field} value={row.subject} onChange={(e)=>update(row.id,{subject:e.target.value})} placeholder={tr('Matière','Subject')}/><input className={field} value={row.teacherName} onChange={(e)=>update(row.id,{teacherName:e.target.value})} placeholder={tr('Nom complet enseignant','Teacher full name')}/><input className={field} value={row.room} onChange={(e)=>update(row.id,{room:e.target.value})} placeholder={tr('Salle','Room')}/><button type="button" onClick={()=>setRows((current)=>current.filter((item)=>item.id!==row.id))} className="rounded-xl border border-red-200 text-red-600"><Trash2 size={16} className="mx-auto"/></button>
      </div>)}</div></div>
      <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={()=>setRows((current)=>[...current,emptyRow()])} className="rounded-xl border border-sky-300 px-4 py-2 text-sm font-bold text-sky-800 dark:text-sky-200"><Plus size={16} className="mr-1 inline"/>{tr('Ajouter un cours','Add course')}</button><button type="button" disabled={busy} onClick={()=>void publish()} className="rounded-xl bg-kcs-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><Save size={16} className="mr-1 inline"/>{tr('Publier l’horaire','Publish timetable')}</button></div>
    </section>
    <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-800 dark:bg-amber-950/20"><h3 className="flex items-center gap-2 font-black text-kcs-blue-950 dark:text-white"><UsersRound size={20}/>{tr('Passage automatique et décisions manuelles','Automatic promotion and manual decisions')}</h3><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{tr('La règle automatique est ≥ 70 %. Une prévisualisation est obligatoire; le Superadministrateur peut promouvoir ou faire redoubler un élève avant exécution.','The automatic rule is ≥ 70%. Preview is mandatory; the Super Administrator may promote or retain a learner before execution.')}</p><button type="button" disabled={busy} onClick={()=>void previewPromotion()} className="mt-3 rounded-xl bg-amber-500 px-4 py-2 text-sm font-black text-kcs-blue-950 disabled:opacity-50">{tr('Prévisualiser le passage','Preview promotion')}</button>
      {promotionPlan ? <div className="mt-4 max-h-[420px] overflow-auto rounded-xl bg-white dark:bg-kcs-blue-950"><table className="w-full min-w-[760px] text-sm"><thead className="sticky top-0 bg-kcs-blue-900 text-white"><tr><th className="p-3 text-left">{tr('Élève','Learner')}</th><th>{tr('Classe actuelle','Current class')}</th><th>{tr('Moyenne','Average')}</th><th>{tr('Décision calculée','Calculated')}</th><th>{tr('Décision manuelle','Manual decision')}</th></tr></thead><tbody>{promotionPlan.items?.map((item:any)=><tr key={item.studentId} className="border-b dark:border-kcs-blue-800"><td className="p-3 font-bold">{item.studentName}</td><td>{item.fromClassName||'—'}</td><td>{item.averagePercent==null?'—':`${item.averagePercent}%`}</td><td>{item.action} → {item.toClassName||'—'}</td><td><select className={field} value={overrides[item.studentId]||'AUTO'} onChange={(e)=>setOverrides((current)=>({...current,[item.studentId]:e.target.value}))}><option value="AUTO">AUTO</option><option value="PROMOTE">PROMOTE</option><option value="REPEAT">REPEAT</option><option value="GRADUATE">GRADUATE</option></select></td></tr>)}</tbody></table></div> : null}
      {promotionPlan ? <button type="button" disabled={busy} onClick={()=>void executePromotion()} className="mt-3 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-black text-white disabled:opacity-50">{tr('Exécuter et synchroniser','Execute and synchronize')}</button> : null}
    </section>
    {notice ? <p className="rounded-xl bg-sky-100 p-3 text-sm font-bold text-kcs-blue-900 dark:bg-kcs-blue-800 dark:text-white">{notice}</p> : null}
  </div>
}
