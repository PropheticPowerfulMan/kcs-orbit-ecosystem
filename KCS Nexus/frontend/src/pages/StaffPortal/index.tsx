import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Bell, ClipboardList, FileText, Megaphone, MessageSquare, Search, ShieldCheck, Users, WalletCards } from 'lucide-react'
import PortalSidebar from '@/components/layout/PortalSidebar'
import AccountSettingsPanel from '@/components/shared/AccountSettingsPanel'
import ShiningStudentWeekWidget from '@/components/shared/ShiningStudentWeekWidget'
import AdminOperationsPanel from '@/components/admin/AdminOperationsPanel'
import SuggestionBox from '@/components/shared/SuggestionBox'
import MessageAttachment from '@/components/shared/MessageAttachment'
import AudioRecorder from '@/components/shared/AudioRecorder'
import StaffAttendanceSelf from '@/components/staff/StaffAttendanceSelf'
import AdministratorPortalHeader from '@/components/admin/AdministratorPortalHeader'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import { adminAPI, admissionsAPI, financeAPI, mainTeacherAPI, messagesAPI, registryAPI } from '@/services/api'
import { getLocalizedGreeting, getLocalizedPortalDate } from '@/utils/portalGreeting'
import { SCHOOL_LEVELS } from '@/constants/schoolLevels'

const segmentOf = (pathname: string) => {
  const value = pathname.split('/').filter(Boolean).at(-1)
  return !value || value === 'staff' || value === 'dashboard' ? 'dashboard' : value
}
const card = 'rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50'
const button = 'rounded-xl bg-kcs-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-kcs-blue-800 disabled:opacity-50'
const empty = (text: string) => <p className="rounded-xl bg-gray-50 p-5 text-sm text-gray-500 dark:bg-kcs-blue-800/30 dark:text-gray-300">{text}</p>
const personName = (value: any) => value?.fullName || [value?.firstName, value?.middleName, value?.lastName].filter(Boolean).join(' ') || 'Unidentified record'

const AdministratorMainTeacherAssignmentPanel = () => {
  const language = useUIStore((state) => state.language)
  const tr = (fr: string, en: string) => language === 'fr' ? fr : en
  const [teachers, setTeachers] = useState<any[]>([])
  const [drafts, setDrafts] = useState<Record<string, { status: 'HOMEROOM_TEACHER' | 'ASSISTANT_TEACHER' | 'TEACHER'; grade: string; section: string }>>({})
  const [busyId, setBusyId] = useState('')
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  const name = (item: any) => [item.user?.lastName, item.user?.middleName, item.user?.firstName].filter(Boolean).join(' ')
  const load = async () => {
    try {
      const response = await mainTeacherAPI.list()
      const rows = response.data?.data || []
      setTeachers(rows)
      setDrafts(Object.fromEntries(rows.map((item: any) => [item.id, {
        status: item.status || 'TEACHER',
        grade: item.homeroomGrade || SCHOOL_LEVELS[0],
        section: item.homeroomSection || '',
      }])))
    } catch (error: any) {
      setResult({ ok: false, message: error?.response?.data?.message || tr('Impossible de charger les enseignants.', 'Unable to load teachers.') })
    }
  }
  useEffect(() => { void load() }, [])
  const updateDraft = (id: string, patch: Partial<{ status: 'HOMEROOM_TEACHER' | 'ASSISTANT_TEACHER' | 'TEACHER'; grade: string; section: string }>) =>
    setDrafts((current) => ({ ...current, [id]: { ...(current[id] || { status: 'TEACHER', grade: SCHOOL_LEVELS[0], section: '' }), ...patch } }))
  const save = async (item: any) => {
    const draft = drafts[item.id]
    if (!draft) return
    setBusyId(item.id)
    try {
      await mainTeacherAPI.assign(item.id, {
        status: draft.status,
        homeroomGrade: draft.status === 'TEACHER' ? undefined : draft.grade,
        homeroomSection: draft.status === 'TEACHER' ? undefined : draft.section,
      })
      setResult({ ok: true, message: draft.status === 'HOMEROOM_TEACHER'
        ? tr(`${name(item)} est maintenant Main Teacher de ${draft.grade}${draft.section ? ' · ' + draft.section : ''}. Ses autres cours sont conservés.`, `${name(item)} is now the Main Teacher for ${draft.grade}${draft.section ? ' · ' + draft.section : ''}. Other courses remain unchanged.`)
        : draft.status === 'ASSISTANT_TEACHER'
          ? tr(`${name(item)} est maintenant Assistant Teacher de ${draft.grade}${draft.section ? ' · ' + draft.section : ''}.`, `${name(item)} is now the Assistant Teacher for ${draft.grade}${draft.section ? ' · ' + draft.section : ''}.`)
          : tr(`La responsabilité de classe de ${name(item)} a été retirée sans modifier ses cours ni son compte employé.`, `${name(item)}'s class responsibility was removed without changing courses or the employee account.`) })
      await load()
    } catch (error: any) {
      setResult({ ok: false, message: error?.response?.data?.message || tr('Affectation impossible.', 'Assignment failed.') })
    } finally { setBusyId('') }
  }
  return <div className="space-y-6">
    {result && <div className="fixed inset-0 z-[170] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true"><div className="w-full max-w-lg rounded-2xl bg-white p-6 text-center shadow-2xl dark:bg-kcs-blue-950"><div className={'mx-auto flex h-14 w-14 items-center justify-center rounded-full text-2xl font-black text-white ' + (result.ok ? 'bg-emerald-600' : 'bg-red-600')}>{result.ok ? '✓' : '!'}</div><h3 className="mt-4 text-xl font-bold text-kcs-blue-950 dark:text-white">{result.ok ? tr('Opération réussie', 'Operation successful') : tr('Opération impossible', 'Operation failed')}</h3><p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{result.message}</p><button type="button" onClick={() => setResult(null)} className="mt-5 w-full rounded-xl bg-kcs-blue-700 px-4 py-3 font-bold text-white">{tr('Fermer', 'Close')}</button></div></div>}
    <section className="rounded-2xl border border-sky-100 bg-sky-50/70 p-5 dark:border-kcs-blue-700 dark:bg-kcs-blue-900/60">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-kcs-gold-600">{tr('Responsabilités de classe', 'Class responsibilities')}</p>
      <h2 className="mt-2 text-2xl font-bold text-kcs-blue-950 dark:text-white">{tr('Main Teachers et Assistants', 'Main Teachers and Assistants')}</h2>
      <p className="mt-2 max-w-4xl text-sm text-slate-600 dark:text-slate-300">{tr('Cochez directement le rôle de chaque enseignant, choisissez sa classe puis enregistrez. Un seul Main Teacher et un seul Assistant peuvent être affectés à une même classe. Les autres cours et le statut employé restent inchangés.', 'Check each teacher role directly, choose the class, then save. Each class accepts one Main Teacher and one Assistant. Other courses and employee status remain unchanged.')}</p>
      <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold"><span className="rounded-full bg-blue-100 px-3 py-1.5 text-blue-800">{teachers.filter((item) => item.status === 'HOMEROOM_TEACHER').length} Main Teacher(s)</span><span className="rounded-full bg-amber-100 px-3 py-1.5 text-amber-800">{teachers.filter((item) => item.status === 'ASSISTANT_TEACHER').length} Assistant(s)</span></div>
    </section>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
      <div className="grid grid-cols-[minmax(12rem,1.4fr)_minmax(9rem,.8fr)_minmax(9rem,.8fr)_minmax(8rem,.8fr)_minmax(7rem,.6fr)_auto] gap-3 border-b bg-slate-50 px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500 dark:border-kcs-blue-800 dark:bg-kcs-blue-950/60 dark:text-slate-300">
        <span>{tr('Employé / professeur', 'Employee / teacher')}</span><span>Main Teacher</span><span>{tr('Assistant', 'Assistant')}</span><span>{tr('Classe', 'Class')}</span><span>{tr('Section', 'Section')}</span><span>{tr('Action', 'Action')}</span>
      </div>
      <div className="divide-y dark:divide-kcs-blue-800">{teachers.map((item) => {
        const draft = drafts[item.id] || { status: 'TEACHER', grade: SCHOOL_LEVELS[0], section: '' }
        return <article key={item.id} className="grid grid-cols-1 gap-3 p-4 md:grid-cols-[minmax(12rem,1.4fr)_minmax(9rem,.8fr)_minmax(9rem,.8fr)_minmax(8rem,.8fr)_minmax(7rem,.6fr)_auto] md:items-center">
          <div><p className="font-bold text-kcs-blue-950 dark:text-white">{name(item)}</p><p className="text-xs text-slate-500">{item.user?.email} · {item._count?.courses || 0} {tr('cours', 'courses')}</p></div>
          <label className="flex items-center gap-2 text-sm font-semibold dark:text-white"><input type="checkbox" checked={draft.status === 'HOMEROOM_TEACHER'} onChange={(event) => updateDraft(item.id, { status: event.target.checked ? 'HOMEROOM_TEACHER' : 'TEACHER' })} className="h-5 w-5 accent-kcs-blue-700"/>Main Teacher</label>
          <label className="flex items-center gap-2 text-sm font-semibold dark:text-white"><input type="checkbox" checked={draft.status === 'ASSISTANT_TEACHER'} onChange={(event) => updateDraft(item.id, { status: event.target.checked ? 'ASSISTANT_TEACHER' : 'TEACHER' })} className="h-5 w-5 accent-amber-600"/>{tr('Assistant', 'Assistant')}</label>
          <select value={draft.grade} disabled={draft.status === 'TEACHER'} onChange={(event) => updateDraft(item.id, { grade: event.target.value })} className="rounded-xl border bg-white p-2.5 text-sm disabled:opacity-40 dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white">{SCHOOL_LEVELS.map((level) => <option key={level}>{level}</option>)}</select>
          <select value={draft.section} disabled={draft.status === 'TEACHER'} onChange={(event) => updateDraft(item.id, { section: event.target.value })} className="rounded-xl border bg-white p-2.5 text-sm disabled:opacity-40 dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white">{['', 'A', 'B', 'C', 'D'].map((value) => <option key={value || 'none'} value={value}>{value || tr('Sans section', 'No section')}</option>)}</select>
          <button type="button" disabled={busyId === item.id} onClick={() => void save(item)} className="rounded-xl bg-kcs-blue-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busyId === item.id ? tr('Enregistrement…', 'Saving…') : tr('Enregistrer', 'Save')}</button>
        </article>
      })}</div>
      {!teachers.length && <p className="p-8 text-center text-sm text-slate-500">{tr('Aucun professeur disponible.', 'No teacher is available.')}</p>}
    </section>
  </div>
}

const StaffPortal = () => {
  const { user } = useAuthStore()
  const language = useUIStore((state) => state.language)
  const location = useLocation()
  const segment = segmentOf(location.pathname)
  const isAdministrator = user?.role === 'admin'
  const roleTitle = isAdministrator ? (language === 'fr' ? 'Administrateur' : 'Administrator') : (language === 'fr' ? 'Personnel administratif' : 'Administrative Staff')
  const workspaceTitle = isAdministrator ? (language === 'fr' ? 'Centre opérationnel administrateur' : 'Administrator operations center') : (language === 'fr' ? 'Espace du personnel administratif' : 'Administrative Staff workspace')
  const basePath = isAdministrator ? '/admin' : '/portal/staff'
  const [overview, setOverview] = useState<any>({ stats: {}, attendanceByClass: [], applications: [], reportCards: [], announcements: [], recentActivity: [] })
  const [directory, setDirectory] = useState<any>({ students: [], parents: [], teachers: [], counts: {} })
  const [messages, setMessages] = useState<any[]>([])
  const [contacts, setContacts] = useState<any[]>([])
  const [finance, setFinance] = useState<any>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<any>(null)
  const [selectedParent, setSelectedParent] = useState<any>(null)
  const [messageDraft, setMessageDraft] = useState({ recipientId: '', subject: '', body: '' })
  const [busy, setBusy] = useState(false)
  const [messageAttachment, setMessageAttachment] = useState<File | null>(null)

  const load = async () => {
    setStatus('loading')
    const results = await Promise.allSettled([
      adminAPI.getStaffOverview(),
      registryAPI.getDirectory(),
      messagesAPI.getAll({ box: 'all' }),
      messagesAPI.getContacts(),
      financeAPI.getEduPaySummary(),
    ])
    if (results[0].status === 'fulfilled') setOverview(results[0].value.data?.data ?? {})
    if (results[1].status === 'fulfilled') setDirectory(results[1].value.data?.data ?? {})
    if (results[2].status === 'fulfilled') setMessages(results[2].value.data?.data ?? [])
    if (results[3].status === 'fulfilled') {
      const next = results[3].value.data?.data ?? []
      setContacts(next)
      setMessageDraft((draft) => ({ ...draft, recipientId: draft.recipientId || next[0]?.id || '' }))
    }
    if (results[4].status === 'fulfilled') setFinance(results[4].value.data?.data ?? null)
    setStatus(results.slice(0, 4).some((result) => result.status === 'rejected') ? 'error' : 'ready')
  }

  useEffect(() => { void load() }, [])

  const students = directory.students ?? []
  const filteredStudents = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return students
    return students.filter((student: any) => [personName(student), student.studentNumber, student.className, student.email].some((value) => String(value ?? '').toLowerCase().includes(needle)))
  }, [students, query])

  const parents = directory.parents ?? []
  const filteredParents = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return parents
    return parents.filter((parent: any) => [personName(parent), parent.email, parent.phone, parent.parentNumber].some((value) => String(value ?? '').toLowerCase().includes(needle)))
  }, [parents, query])

  const updateAdmission = async (id: string, nextStatus: 'UNDER_REVIEW' | 'INTERVIEW_SCHEDULED') => {
    setBusy(true); setNotice('')
    try {
      await admissionsAPI.updateStatus(id, nextStatus)
      setOverview((current: any) => ({ ...current, applications: (current.applications ?? []).map((item: any) => item.id === id ? { ...item, status: nextStatus } : item) }))
      setNotice('The admission stage was saved. Final approval remains reserved for the Super Administrator.')
    } catch (error: any) { setNotice(error?.response?.data?.message ?? 'The admission stage could not be updated.') }
    finally { setBusy(false) }
  }

  const sendMessage = async () => {
    if (!messageDraft.recipientId || !messageDraft.subject.trim() || !messageDraft.body.trim()) return setNotice('Select a recipient and complete the subject and message.')
    setBusy(true); setNotice('')
    try {
      const payload = new FormData(); payload.append("recipientId", messageDraft.recipientId); payload.append("subject", messageDraft.subject.trim()); payload.append("body", messageDraft.body.trim()); if (messageAttachment) payload.append("attachment", messageAttachment); const response = await messagesAPI.send(payload)
      setMessages((items) => [response.data?.data, ...items].filter(Boolean))
      setMessageDraft((draft) => ({ ...draft, subject: '', body: '' })); setMessageAttachment(null)
      setNotice('The internal message was sent and recorded.')
    } catch (error: any) { setNotice(error?.response?.data?.message ?? 'The message could not be sent.') }
    finally { setBusy(false) }
  }

  const studentsView = <div className="grid gap-6 xl:grid-cols-[1.25fr_.75fr]">
    <section className={card}>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-bold dark:text-white">{language === 'fr' ? 'Élèves' : 'Students'}</h2><p className="text-sm text-gray-500">{language === 'fr' ? 'Registre Orbit officiel en lecture seule. Aucune modification ou suppression n’est autorisée ici.' : 'Official read-only Orbit registry. Editing and deletion are not permitted here.'}</p></div><div className="relative"><Search className="absolute left-3 top-3 text-gray-400" size={16}/><input value={query} onChange={(event)=>setQuery(event.target.value)} className="rounded-xl border py-2.5 pl-9 pr-3 text-sm dark:bg-kcs-blue-950" placeholder="Name, ID, class, email"/></div></div>
      <div className="overflow-x-auto"><table className="min-w-[720px] w-full text-sm"><thead><tr className="border-b text-left text-xs text-gray-400"><th className="py-3">Student</th><th>Identifier</th><th>Class</th><th>Status</th><th></th></tr></thead><tbody>{filteredStudents.map((student:any)=><tr key={student.id} className="border-b dark:border-kcs-blue-800"><td className="py-3 font-semibold dark:text-white">{personName(student)}</td><td>{student.studentNumber ?? '—'}</td><td>{student.className ?? '—'}</td><td>{student.status ?? '—'}</td><td className="text-right"><button onClick={()=>setSelected(student)} className="rounded-lg bg-kcs-blue-50 px-3 py-1.5 text-xs font-bold text-kcs-blue-700">Open</button></td></tr>)}</tbody></table></div>
      {filteredStudents.length===0&&empty('No record matches this search.')}
    </section>
    <section className={card}><h2 className="font-bold dark:text-white">Selected record</h2>{!selected?empty('Select a student to view the synchronized administrative details.'):<div className="mt-4 space-y-3 text-sm"><p className="text-2xl font-bold dark:text-white">{personName(selected)}</p><p><b>Student ID:</b> {selected.studentNumber ?? '—'}</p><p><b>Class:</b> {selected.className ?? '—'}</p><p><b>Email:</b> {selected.email ?? '—'}</p><p><b>Status:</b> {selected.status ?? '—'}</p><p className="rounded-xl bg-kcs-blue-50 p-3 text-xs text-kcs-blue-800">Parent and medical details are not exposed here unless required by the authorized workflow.</p></div>}</section>
  </div>

  const parentsView = <div className="grid gap-6 xl:grid-cols-[1.25fr_.75fr]">
    <section className={card}>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-bold dark:text-white">Parents</h2><p className="text-sm text-gray-500">{language === 'fr' ? 'Registre familial officiel en lecture seule.' : 'Official read-only family registry.'}</p></div><div className="relative"><Search className="absolute left-3 top-3 text-gray-400" size={16}/><input value={query} onChange={(event)=>setQuery(event.target.value)} className="rounded-xl border py-2.5 pl-9 pr-3 text-sm dark:bg-kcs-blue-950" placeholder={language === 'fr' ? 'Nom, email, téléphone' : 'Name, email, phone'}/></div></div>
      <div className="overflow-x-auto"><table className="min-w-[680px] w-full text-sm"><thead><tr className="border-b text-left text-xs text-gray-400"><th className="py-3">Parent</th><th>Email</th><th>{language === 'fr' ? 'Téléphone' : 'Phone'}</th><th></th></tr></thead><tbody>{filteredParents.map((parent:any)=><tr key={parent.id} className="border-b dark:border-kcs-blue-800"><td className="py-3 font-semibold dark:text-white">{personName(parent)}</td><td>{parent.email ?? '—'}</td><td>{parent.phone ?? '—'}</td><td className="text-right"><button onClick={()=>setSelectedParent(parent)} className="rounded-lg bg-kcs-blue-50 px-3 py-1.5 text-xs font-bold text-kcs-blue-700">{language === 'fr' ? 'Voir' : 'View'}</button></td></tr>)}</tbody></table></div>
      {filteredParents.length===0&&empty(language === 'fr' ? 'Aucun parent ne correspond à cette recherche.' : 'No parent matches this search.')}
    </section>
    <section className={card}><h2 className="font-bold dark:text-white">{language === 'fr' ? 'Parent sélectionné' : 'Selected parent'}</h2>{!selectedParent?empty(language === 'fr' ? 'Sélectionnez un parent pour consulter ses informations.' : 'Select a parent to view the synchronized details.'):<div className="mt-4 space-y-3 text-sm"><p className="text-2xl font-bold dark:text-white">{personName(selectedParent)}</p><p><b>Email:</b> {selectedParent.email ?? '—'}</p><p><b>{language === 'fr' ? 'Téléphone' : 'Phone'}:</b> {selectedParent.phone ?? '—'}</p><p><b>{language === 'fr' ? 'Identifiant' : 'Identifier'}:</b> {selectedParent.parentNumber ?? selectedParent.id ?? '—'}</p><p className="rounded-xl bg-kcs-blue-50 p-3 text-xs text-kcs-blue-800">{language === 'fr' ? 'Consultation uniquement : aucune commande de modification ou de suppression.' : 'View only: no edit or delete command is available.'}</p></div>}</section>
  </div>

  const admissionsView = <section className={card}><div className="mb-4"><h2 className="font-bold dark:text-white">Admissions processing queue</h2><p className="text-sm text-gray-500">Administrators may review and schedule. Only the Super Administrator can approve, reject, and provision accounts.</p></div>{(overview.applications??[]).length===0?empty('No application is waiting for administrative processing.'):<div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">{overview.applications.map((item:any)=><article key={item.id} className="rounded-xl border p-4 dark:border-kcs-blue-800"><p className="text-xs font-bold text-kcs-gold-600">{item.applicationNumber}</p><h3 className="mt-1 font-bold dark:text-white">{[item.firstName,item.middleName,item.lastName].filter(Boolean).join(' ')}</h3><p className="text-sm text-gray-500">{item.gradeApplying} · {item.parentName}</p><span className="mt-3 inline-block rounded-full bg-kcs-blue-50 px-3 py-1 text-xs font-bold text-kcs-blue-700">{String(item.status).replace(/_/g,' ')}</span><div className="mt-4 grid gap-2"><button disabled={busy} onClick={()=>void updateAdmission(item.id,'UNDER_REVIEW')} className={button}>Mark under review</button><button disabled={busy} onClick={()=>void updateAdmission(item.id,'INTERVIEW_SCHEDULED')} className="rounded-xl border px-4 py-2.5 text-sm font-semibold dark:border-kcs-blue-700">Schedule interview</button></div></article>)}</div>}</section>

  const announcementsView = <section className={card}><h2 className="font-bold dark:text-white">Published school announcements</h2><p className="mb-4 text-sm text-gray-500">Publication is controlled by the Super Administrator. Use Messages for operational communication.</p>{(overview.announcements??[]).length===0?empty('No published announcement.'):<div className="grid gap-3 md:grid-cols-2">{overview.announcements.map((item:any)=><article key={item.id} className="rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-800/30"><h3 className="font-semibold dark:text-white">{item.title}</h3><p className="mt-1 text-sm text-gray-500">{item.excerpt}</p><p className="mt-2 text-xs text-gray-400">{new Date(item.publishedAt).toLocaleString()}</p></article>)}</div>}</section>

  const reportsView = <section className={card}><h2 className="font-bold dark:text-white">Report-card workflow</h2><p className="mb-4 text-sm text-gray-500">Operational visibility without SuperAdmin approval rights.</p>{(overview.reportCards??[]).length===0?empty('No report card has been submitted to the workflow.'):<div className="grid gap-3 md:grid-cols-2">{overview.reportCards.map((item:any)=><article key={item.id} className="rounded-xl border p-4 dark:border-kcs-blue-800"><h3 className="font-semibold dark:text-white">{personName(item.student?.user)}</h3><p className="text-sm text-gray-500">{item.term} · {item.average}%</p><p className="mt-2 text-xs font-bold text-kcs-blue-600">{item.principalStatus} · {item.publicationStatus}</p></article>)}</div>}</section>

  const financeView = <section className={card}><h2 className="font-bold dark:text-white">{language === 'fr' ? 'Restes à payer par élève' : 'Outstanding fees by student'}</h2><p className="mb-4 text-sm text-gray-500">{language === 'fr' ? 'Consultation uniquement des soldes restant dus synchronisés depuis EduPay.' : 'Read-only view of outstanding balances synchronized from EduPay.'}</p>{!finance?empty(language === 'fr' ? 'La synchronisation EduPay est indisponible.' : 'EduPay synchronization is unavailable.'):<><div className="mb-5 rounded-xl bg-amber-50 p-4 dark:bg-amber-950/20"><p className="text-xs font-bold uppercase text-amber-700">{language === 'fr' ? 'Total restant à payer' : 'Total outstanding'}</p><p className="mt-1 text-2xl font-bold dark:text-white">{new Intl.NumberFormat(language==='fr'?'fr-FR':'en-US',{style:'currency',currency:'USD'}).format(Number(finance.totals?.outstandingDebt ?? 0))}</p></div><div className="grid gap-3 md:grid-cols-2">{(finance.studentAccounts??[]).map((account:any,index:number)=><div key={index} className="rounded-xl border p-4 dark:border-kcs-blue-800"><p className="font-semibold dark:text-white">{account.studentName ?? (language === 'fr' ? 'Compte élève' : 'Student account')}</p><p className="text-sm font-bold text-amber-700">{language === 'fr' ? 'Reste à payer' : 'Outstanding'}: {new Intl.NumberFormat(language==='fr'?'fr-FR':'en-US',{style:'currency',currency:'USD'}).format(Number(account.debt ?? 0))}</p><p className="text-xs text-gray-500">{account.className ?? '—'}</p></div>)}</div></>}</section>

  const messagesView = <div className="grid gap-6 xl:grid-cols-[1fr_1fr]"><section className={card}><h2 className="font-bold dark:text-white">Internal messages</h2>{messages.length===0?empty('No internal message.'):<div className="mt-4 space-y-3">{messages.slice(0,30).map((item:any)=><article key={item.id} className="rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-800/30"><h3 className="font-semibold dark:text-white">{item.subject}</h3><p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{item.body}</p><MessageAttachment message={item} compact/><p className="mt-2 text-xs text-gray-400">{new Date(item.createdAt).toLocaleString()}</p></article>)}</div>}</section><section className={card}><h2 className="font-bold dark:text-white">Send an operational message</h2><div className="mt-4 grid gap-3"><select value={messageDraft.recipientId} onChange={(event)=>setMessageDraft({...messageDraft,recipientId:event.target.value})} className="rounded-xl border bg-white p-3 dark:bg-kcs-blue-950">{contacts.map((contact:any)=><option key={contact.id} value={contact.id}>{personName(contact)} · {contact.role}</option>)}</select><input value={messageDraft.subject} onChange={(event)=>setMessageDraft({...messageDraft,subject:event.target.value})} className="rounded-xl border p-3 dark:bg-kcs-blue-950" placeholder="Subject"/><textarea value={messageDraft.body} onChange={(event)=>setMessageDraft({...messageDraft,body:event.target.value})} className="min-h-36 rounded-xl border p-3 dark:bg-kcs-blue-950" placeholder="Message"/><label className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-kcs-blue-300 p-3 text-sm font-semibold dark:text-sky-200">{messageAttachment?.name || (language === "fr" ? "Joindre un audio, une vidéo, une image ou un document" : "Attach audio, video, image or document")}<input type="file" className="sr-only" accept="image/*,audio/*,video/mp4,video/webm,video/quicktime,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv" onChange={(event)=>{const file=event.target.files?.[0]||null;if(file&&file.size>25*1024*1024){setNotice(language === "fr" ? "Le fichier ne doit pas dépasser 25 Mo." : "The file must not exceed 25 MB.");return}setMessageAttachment(file)}}/></label><AudioRecorder language={language} disabled={busy} onRecorded={setMessageAttachment}/><button disabled={busy} onClick={()=>void sendMessage()} className={button}>Send and record</button></div></section></div>

  const permissionsView = <div className="grid gap-6 xl:grid-cols-2"><section className={card}><h2 className="font-bold dark:text-white">{roleTitle} permissions</h2><div className="mt-4 flex flex-wrap gap-2">{(isAdministrator ? ['Read shared records','Coordinate admission review','Read EduPay summary','Send internal messages','Read report workflow','Review incidents','No Super Admin provisioning'] : ['Read shared records','Process admission stages','Read EduPay summary','Send internal messages','Read report workflow','No final approval','No account provisioning']).map((item)=><span key={item} className="rounded-full bg-kcs-blue-50 px-3 py-1 text-xs font-bold text-kcs-blue-700">{item}</span>)}</div></section><section className={card}><h2 className="font-bold dark:text-white">My audit activity</h2>{(overview.recentActivity??[]).length===0?empty('No recent administrative action recorded for this account.'):<div className="mt-4 space-y-3">{overview.recentActivity.map((item:any)=><div key={item.id} className="rounded-xl bg-gray-50 p-3 text-sm dark:bg-kcs-blue-800/30"><b>{item.action}</b><p className="text-xs text-gray-500">{item.targetType} · {new Date(item.createdAt).toLocaleString()}</p></div>)}</div>}</section></div>

  const dashboard = <><ShiningStudentWeekWidget/><SuggestionBox/><AdminOperationsPanel isAdministrator={isAdministrator} basePath={basePath} overview={overview} language={language}/><div className="grid grid-cols-2 gap-4 xl:grid-cols-5">{[
    ['Student records',directory.counts?.students??students.length,Users,'Shared Orbit registry'],
    ['Families',directory.counts?.families??0,Users,'Responsible families'],
    ['Pending messages',overview.stats?.pendingMessages??0,MessageSquare,'Unread internal messages'],
    ['Admission tasks',overview.stats?.admissionTasks??0,ClipboardList,'Review or interview'],
    ['Pending reports',overview.stats?.pendingReports??0,ShieldCheck,'Operational follow-up'],
  ].map(([label,value,Icon,sub]:any)=><motion.div key={label} initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} className={card}><Icon className="text-kcs-blue-600" size={20}/><p className="mt-3 text-3xl font-bold dark:text-white">{value}</p><p className="text-sm font-semibold dark:text-gray-200">{label}</p><p className="text-xs text-gray-400">{sub}</p></motion.div>)}</div>
  <div className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]"><section className={card}><h2 className="font-bold dark:text-white">Recorded attendance by class</h2>{(overview.attendanceByClass??[]).length===0?empty('Attendance indicators will appear after records are entered.'):<ResponsiveContainer width="100%" height={280}><BarChart data={overview.attendanceByClass}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="label"/><YAxis domain={[0,100]}/><Tooltip/><Bar dataKey="attendance" fill="#1d4ed8" radius={[7,7,0,0]}/></BarChart></ResponsiveContainer>}</section><section className={card}><h2 className="font-bold dark:text-white">Administrative workload</h2><div className="mt-4 space-y-3">{[[ClipboardList,'Admissions',overview.stats?.admissionTasks??0],[MessageSquare,'Messages',overview.stats?.pendingMessages??0],[FileText,'Reports',overview.stats?.pendingReports??0],[ShieldCheck,'Open incidents',overview.stats?.openIncidents??0]].map(([Icon,label,value]:any)=><Link key={label} to={label==='Admissions'?basePath+'/admissions':label==='Messages'?basePath+'/messages':label==='Reports'?basePath+'/reports':basePath+'/permissions'} className="flex items-center justify-between rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-800/30"><span className="flex items-center gap-3 font-semibold dark:text-white"><Icon size={18}/>{label}</span><b>{value}</b></Link>)}</div></section></div>
  <div className="grid gap-6 xl:grid-cols-3"><section className={card}><h2 className="flex items-center gap-2 font-bold dark:text-white"><ClipboardList size={18}/>Recent admissions</h2><div className="mt-4 space-y-3">{(overview.applications??[]).slice(0,5).map((item:any)=><div key={item.id} className="rounded-xl bg-gray-50 p-3 dark:bg-kcs-blue-800/30"><b className="dark:text-white">{[item.firstName,item.lastName].join(' ')}</b><p className="text-xs text-gray-500">{item.gradeApplying} · {String(item.status).replace(/_/g,' ')}</p></div>)}</div></section><section className={card}><h2 className="flex items-center gap-2 font-bold dark:text-white"><Bell size={18}/>Announcements</h2><div className="mt-4 space-y-3">{(overview.announcements??[]).slice(0,5).map((item:any)=><div key={item.id} className="rounded-xl bg-gray-50 p-3 dark:bg-kcs-blue-800/30"><b className="dark:text-white">{item.title}</b><p className="text-xs text-gray-500">{new Date(item.publishedAt).toLocaleDateString()}</p></div>)}</div></section><section className={card}><h2 className="flex items-center gap-2 font-bold dark:text-white"><WalletCards size={18}/>EduPay status</h2>{finance?<div className="mt-4 space-y-2"><p className="text-3xl font-bold dark:text-white">{finance.totals?.paymentCompletionRate??0}%</p><p className="text-sm text-gray-500">Payment completion</p><Link to={basePath+'/finance'} className={button+' mt-4 inline-block'}>Open finance tracking</Link></div>:empty('EduPay synchronization unavailable.')}</section></div></>

  const content = segment==='attendance'?<StaffAttendanceSelf/>:segment==='main-teachers'?<AdministratorMainTeacherAssignmentPanel/>:(segment==='students'||segment==='records')?studentsView:segment==='parents'?parentsView:segment==='admissions'?admissionsView:segment==='announcements'?announcementsView:segment==='reports'?reportsView:segment==='finance'?financeView:segment==='messages'?messagesView:segment==='permissions'?permissionsView:segment==='settings'?<AccountSettingsPanel roleLabel={roleTitle}/>:dashboard

  return <div className="portal-shell flex"><PortalSidebar/><main className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto"><AdministratorPortalHeader status={status}/><div className="space-y-6 p-4 sm:p-6">{notice&&<p className="rounded-xl bg-kcs-blue-50 p-3 text-sm font-semibold text-kcs-blue-800">{notice}</p>}{status==='error'&&<button onClick={()=>void load()} className={button}>Retry synchronization</button>}{content}</div></main></div>
}
export default StaffPortal
