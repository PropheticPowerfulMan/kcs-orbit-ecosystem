import { useEffect, useMemo, useState } from 'react'
import { Archive, Ban, CalendarDays, Loader2, Search, ShieldAlert, UserX, XCircle } from 'lucide-react'
import { disciplineAPI } from '@/services/api'
import { useUIStore } from '@/store/uiStore'
import { canonicalClassLabel } from '@/utils/classLabels'

const field = 'w-full rounded-xl border border-sky-200 bg-white px-3 py-2.5 text-sm text-kcs-blue-950 outline-none focus:border-sky-500 dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white'
const nameOf = (value: any) => [value?.user?.lastName ?? value?.lastName, value?.user?.middleName ?? value?.middleName, value?.user?.firstName ?? value?.firstName].filter(Boolean).join(' ')

export default function AdminSuspensionCenter({ students }: { students: any[] }) {
  const language = useUIStore((state) => state.language)
  const tr = (fr: string, en: string) => language === 'fr' ? fr : en
  const [mode, setMode] = useState<'suspension' | 'dismissal'>('suspension')
  const [records, setRecords] = useState<any[]>([])
  const [archives, setArchives] = useState<any[]>([])
  const [query, setQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [draft, setDraft] = useState({ studentId: '', reason: '', startDate: '', endDate: '', effectiveDate: new Date().toISOString().slice(0, 10), notifyParent: true, notifyStudent: true, notifyParents: true })
  const now = new Date()

  const load = async () => {
    try {
      const [suspensions, dismissals] = await Promise.all([disciplineAPI.suspensions(), disciplineAPI.dismissals()])
      setRecords(suspensions.data?.data ?? [])
      setArchives(dismissals.data?.data ?? [])
    } catch (error: any) {
      setNotice(error?.response?.data?.message || tr('Registre disciplinaire indisponible.', 'Disciplinary register unavailable.'))
    }
  }
  useEffect(() => { void load() }, [])

  const filtered = useMemo(() => {
    const token = query.trim().toLocaleLowerCase(language === 'fr' ? 'fr' : 'en')
    return students.filter((student) => !token || [nameOf(student), student.studentNumber, student.grade, student.section].filter(Boolean).join(' ').toLocaleLowerCase(language === 'fr' ? 'fr' : 'en').includes(token))
  }, [students, query, language])

  const createSuspension = async () => {
    if (!draft.studentId) return setNotice(tr('Sélectionnez un élève.', 'Select a learner.'))
    if (draft.reason.trim().length < 5) return setNotice(tr('Expliquez précisément la mesure disciplinaire.', 'Describe the disciplinary measure precisely.'))
    setSaving(true); setNotice('')
    try {
      await disciplineAPI.createSuspension(draft)
      setDraft((current) => ({ ...current, reason: '' }))
      setNotice(tr('Suspension enregistrée. Les présences et bulletins seront synchronisés automatiquement.', 'Suspension saved. Attendance and report cards will synchronize automatically.'))
      await load()
    } catch (error: any) { setNotice(error?.response?.data?.message || tr('Suspension non enregistrée.', 'Suspension was not saved.')) }
    finally { setSaving(false) }
  }

  const createDismissal = async () => {
    if (!selectedIds.length) return setNotice(tr('Sélectionnez au moins un élève.', 'Select at least one learner.'))
    if (draft.reason.trim().length < 10) return setNotice(tr('Le motif officiel doit être détaillé.', 'The official reason must be detailed.'))
    if (confirmation.trim().toUpperCase() !== 'RENVOYER') return setNotice(tr('Tapez RENVOYER pour confirmer cette décision définitive.', 'Type RENVOYER to confirm this permanent decision.'))
    setSaving(true); setNotice('')
    try {
      await disciplineAPI.createDismissal({ studentIds: selectedIds, reason: draft.reason, effectiveDate: draft.effectiveDate, notifyParents: draft.notifyParents })
      setSelectedIds([]); setConfirmation(''); setDraft((current) => ({ ...current, reason: '' }))
      setNotice(tr('Renvoi exécuté : comptes bloqués, registres actifs nettoyés et dossiers archivés.', 'Dismissal completed: accounts blocked, active rosters cleared, and records archived.'))
      await load()
    } catch (error: any) { setNotice(error?.response?.data?.message || tr('Le renvoi définitif n’a pas été enregistré.', 'Permanent dismissal was not recorded.')) }
    finally { setSaving(false) }
  }

  const cancel = async (id: string) => {
    if (!confirm(tr('Annuler cette suspension officielle ?', 'Cancel this official suspension?'))) return
    await disciplineAPI.cancelSuspension(id); await load()
  }

  return <div className="space-y-6">
    <section className="rounded-3xl bg-gradient-to-br from-kcs-blue-950 to-rose-900 p-6 text-white shadow-xl">
      <div className="flex items-start gap-4"><span className="rounded-2xl bg-white/10 p-3"><ShieldAlert size={30}/></span><div><p className="text-xs font-black uppercase tracking-[.18em] text-rose-200">{tr('Superadministration · registre officiel', 'Super Administration · official register')}</p><h2 className="mt-1 text-2xl font-black">{tr('Suspensions et renvois définitifs', 'Suspensions and permanent dismissals')}</h2><p className="mt-2 max-w-3xl text-sm text-rose-100">{tr('La suspension est temporaire et réversible. Le renvoi définitif bloque le compte, retire l’élève de tous les registres actifs et conserve son dossier dans une archive administrative auditée.', 'Suspension is temporary and reversible. Permanent dismissal blocks the account, removes the learner from active rosters, and preserves the record in an audited administrative archive.')}</p></div></div>
      <div className="mt-5 flex flex-wrap gap-2"><button type="button" onClick={() => setMode('suspension')} className={`rounded-xl px-4 py-2 text-sm font-black ${mode === 'suspension' ? 'bg-white text-rose-800' : 'bg-white/10 text-white'}`}><Ban className="mr-2 inline" size={16}/>{tr('Suspension temporaire', 'Temporary suspension')}</button><button type="button" onClick={() => setMode('dismissal')} className={`rounded-xl px-4 py-2 text-sm font-black ${mode === 'dismissal' ? 'bg-white text-rose-800' : 'bg-white/10 text-white'}`}><UserX className="mr-2 inline" size={16}/>{tr('Renvoi définitif', 'Permanent dismissal')}</button></div>
    </section>

    {mode === 'suspension' ? <SuspensionWorkspace {...{ tr, query, setQuery, filtered, draft, setDraft, saving, createSuspension, records, now, cancel }} /> : <DismissalWorkspace {...{ tr, query, setQuery, filtered, selectedIds, setSelectedIds, draft, setDraft, confirmation, setConfirmation, saving, createDismissal, archives }} />}
    {notice ? <p className="rounded-xl bg-sky-100 p-3 text-sm font-bold text-kcs-blue-900 dark:bg-kcs-blue-800 dark:text-white">{notice}</p> : null}
  </div>
}

function SuspensionWorkspace({ tr, query, setQuery, filtered, draft, setDraft, saving, createSuspension, records, now, cancel }: any) {
  return <div className="grid gap-6 xl:grid-cols-[.9fr_1.1fr]">
    <section className="rounded-3xl border border-sky-100 bg-white p-5 shadow-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-900"><h3 className="font-black text-kcs-blue-950 dark:text-white">{tr('Programmer une suspension', 'Schedule a suspension')}</h3><label className="mt-4 block text-sm font-bold dark:text-white">{tr('Rechercher un élève', 'Find learner')}<span className="relative mt-1 block"><Search size={16} className="absolute left-3 top-3.5 text-slate-400"/><input className={field + ' pl-10'} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tr('Nom, matricule ou classe', 'Name, student ID or class')}/></span></label><label className="mt-3 block text-sm font-bold dark:text-white">{tr('Élève concerné', 'Learner')}<select className={field + ' mt-1'} value={draft.studentId} onChange={(event) => setDraft((current: any) => ({ ...current, studentId: event.target.value }))}><option value="">{tr('Choisir…', 'Choose…')}</option>{filtered.map((student: any) => <option key={student.id} value={student.id}>{nameOf(student)} · {student.studentNumber} · {canonicalClassLabel(student.grade, student.section)}</option>)}</select></label><div className="mt-3 grid grid-cols-2 gap-3"><label className="text-sm font-bold dark:text-white">{tr('Premier jour absent', 'First absent day')}<input type="date" className={field + ' mt-1'} value={draft.startDate} onChange={(event) => setDraft((current: any) => ({ ...current, startDate: event.target.value }))}/></label><label className="text-sm font-bold dark:text-white">{tr('Dernier jour absent', 'Last absent day')}<input type="date" className={field + ' mt-1'} value={draft.endDate} onChange={(event) => setDraft((current: any) => ({ ...current, endDate: event.target.value }))}/></label></div><label className="mt-3 block text-sm font-bold dark:text-white">{tr('Motif officiel et décision', 'Official reason and decision')}<textarea className={field + ' mt-1 min-h-28'} value={draft.reason} onChange={(event) => setDraft((current: any) => ({ ...current, reason: event.target.value }))}/></label><div className="mt-3 space-y-2 rounded-xl bg-sky-50 p-3 text-sm dark:bg-kcs-blue-950 dark:text-white"><label className="flex gap-2"><input type="checkbox" checked={draft.notifyParent} onChange={(event) => setDraft((current: any) => ({ ...current, notifyParent: event.target.checked }))}/>{tr('Notifier les parents liés', 'Notify linked parents')}</label><label className="flex gap-2"><input type="checkbox" checked={draft.notifyStudent} onChange={(event) => setDraft((current: any) => ({ ...current, notifyStudent: event.target.checked }))}/>{tr("Notifier l'élève", 'Notify the learner')}</label></div><button disabled={saving} onClick={() => void createSuspension()} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-rose-700 px-4 py-3 font-black text-white disabled:opacity-50">{saving ? <Loader2 className="animate-spin" size={18}/> : <Ban size={18}/>} {tr('Enregistrer la suspension', 'Save suspension')}</button></section>
    <section className="rounded-3xl border border-sky-100 bg-white p-5 shadow-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-900"><h3 className="font-black text-kcs-blue-950 dark:text-white">{tr('Registre daté et traçable', 'Dated auditable register')}</h3><div className="mt-4 max-h-[720px] space-y-3 overflow-auto">{records.map((record: any) => { const start = new Date(record.suspensionStart), end = new Date(record.suspensionEnd), active = record.status !== 'RESOLVED' && start <= now && end >= now; return <article key={record.id} className="rounded-2xl border border-sky-100 p-4 dark:border-kcs-blue-700"><div className="flex justify-between gap-3"><div><p className="font-black dark:text-white">{nameOf(record.student)}</p><p className="text-xs text-slate-500">{record.student?.studentNumber} · {canonicalClassLabel(record.student?.grade, record.student?.section)}</p></div><span className={`h-fit rounded-full px-3 py-1 text-xs font-black ${active ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>{active ? 'ACTIVE' : record.status}</span></div><p className="mt-3 flex items-center gap-2 text-sm font-bold dark:text-white"><CalendarDays size={16}/>{start.toLocaleDateString()} – {end.toLocaleDateString()}</p><p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{record.incident}</p>{record.status !== 'RESOLVED' ? <button onClick={() => void cancel(record.id)} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-rose-200 px-3 py-2 text-sm font-bold text-rose-700"><XCircle size={16}/>{tr('Annuler la suspension', 'Cancel suspension')}</button> : null}</article>})}{!records.length ? <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">{tr('Aucune suspension enregistrée.', 'No suspension recorded.')}</p> : null}</div></section>
  </div>
}

function DismissalWorkspace({ tr, query, setQuery, filtered, selectedIds, setSelectedIds, draft, setDraft, confirmation, setConfirmation, saving, createDismissal, archives }: any) {
  return <div className="grid gap-6 xl:grid-cols-[1fr_.85fr]">
    <section className="rounded-3xl border-2 border-rose-200 bg-white p-5 shadow-sm dark:border-rose-900 dark:bg-kcs-blue-900"><h3 className="flex items-center gap-2 font-black text-rose-800 dark:text-rose-200"><UserX/>{tr('Renvoi définitif d’un ou plusieurs élèves', 'Permanently dismiss one or more learners')}</h3><p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{tr('Cette opération retire les élèves des cours et registres actifs, bloque leurs connexions et archive leurs dossiers. Elle n’efface jamais les preuves académiques.', 'This removes learners from active courses and rosters, blocks sign-in, and archives their records. Academic evidence is never destroyed.')}</p><label className="mt-4 block text-sm font-bold dark:text-white">{tr('Recherche précise', 'Precise search')}<span className="relative mt-1 block"><Search size={16} className="absolute left-3 top-3.5 text-slate-400"/><input className={field + ' pl-10'} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tr('Nom, matricule, classe ou section', 'Name, student ID, class or section')}/></span></label><div className="mt-3 max-h-72 space-y-2 overflow-auto rounded-2xl border border-sky-100 p-2 dark:border-kcs-blue-700">{filtered.map((student: any) => <label key={student.id} className="flex cursor-pointer items-center gap-3 rounded-xl p-3 hover:bg-sky-50 dark:hover:bg-kcs-blue-800"><input type="checkbox" checked={selectedIds.includes(student.id)} onChange={(event) => setSelectedIds((current: string[]) => event.target.checked ? [...new Set([...current, student.id])] : current.filter((id) => id !== student.id))}/><span className="min-w-0"><b className="block truncate dark:text-white">{nameOf(student)}</b><small className="text-slate-500">{student.studentNumber} · {canonicalClassLabel(student.grade, student.section)}</small></span></label>)}</div><p className="mt-2 text-xs font-black text-rose-700">{selectedIds.length} {tr('élève(s) sélectionné(s)', 'learner(s) selected')}</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-sm font-bold dark:text-white">{tr('Date d’effet', 'Effective date')}<input type="date" className={field + ' mt-1'} value={draft.effectiveDate} onChange={(event) => setDraft((current: any) => ({ ...current, effectiveDate: event.target.value }))}/></label><label className="flex items-end gap-2 rounded-xl bg-sky-50 p-3 text-sm font-bold dark:bg-kcs-blue-950 dark:text-white"><input type="checkbox" checked={draft.notifyParents} onChange={(event) => setDraft((current: any) => ({ ...current, notifyParents: event.target.checked }))}/>{tr('Notifier les parents', 'Notify parents')}</label></div><label className="mt-3 block text-sm font-bold dark:text-white">{tr('Motif officiel détaillé', 'Detailed official reason')}<textarea className={field + ' mt-1 min-h-28'} value={draft.reason} onChange={(event) => setDraft((current: any) => ({ ...current, reason: event.target.value }))}/></label><label className="mt-3 block text-sm font-bold text-rose-800 dark:text-rose-200">{tr('Confirmation : tapez RENVOYER', 'Confirmation: type RENVOYER')}<input className={field + ' mt-1'} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off"/></label><button disabled={saving || !selectedIds.length} onClick={() => void createDismissal()} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-rose-800 px-4 py-3 font-black text-white disabled:opacity-50">{saving ? <Loader2 className="animate-spin" size={18}/> : <Archive size={18}/>} {tr('Retirer des registres actifs et archiver', 'Remove from active rosters and archive')}</button></section>
    <section className="rounded-3xl border border-sky-100 bg-white p-5 shadow-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-900"><h3 className="flex items-center gap-2 font-black text-kcs-blue-950 dark:text-white"><Archive size={20}/>{tr('Dossiers archivés', 'Archived records')}</h3><div className="mt-4 max-h-[720px] space-y-3 overflow-auto">{archives.map((archive: any) => <article key={archive.id} className="rounded-2xl border border-sky-100 p-4 dark:border-kcs-blue-700"><p className="font-black dark:text-white">{archive.fullName}</p><p className="text-xs text-slate-500">{archive.studentNumber} · {canonicalClassLabel(archive.grade, archive.section)}</p><p className="mt-2 text-xs font-bold text-rose-700">{new Date(archive.effectiveDate).toLocaleDateString()}</p><p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{archive.reason}</p></article>)}{!archives.length ? <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">{tr('Aucun dossier de renvoi archivé.', 'No dismissed record archived.')}</p> : null}</div></section>
  </div>
}
