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
const cleanClassName = (value: unknown) => {
  const raw = String(value ?? '').trim()
  const repeated = raw.match(/^(Grade\s+\d+)\s+\1$/i)
  if (repeated) return repeated[1]
  const parts = raw.split(/\s*[|/]\s*|\s{2,}/).filter(Boolean)
  return parts.filter((part,index)=>parts.findIndex((item)=>item.toLocaleLowerCase()===part.toLocaleLowerCase())===index).join(' / ') || '-'
}
const comparable = (value: unknown) => String(value ?? '').trim().toLocaleLowerCase().replace(/\s+/g,' ')

const AdministratorMainTeacherAssignmentPanel = () => {
  const language = useUIStore((state) => state.language)
  const tr = (fr: string, en: string) => language === 'fr' ? fr : en
  const [teachers, setTeachers] = useState<any[]>([])
  const [drafts, setDrafts] = useState<Record<string, { status: 'HOMEROOM_TEACHER' | 'ASSISTANT_TEACHER' | 'TEACHER'; grade: string; section: string }>>({})
  const [busyId, setBusyId] = useState('')
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [teacherQuery, setTeacherQuery] = useState('')
  const name = (item: any) => [item.user?.lastName, item.user?.middleName, item.user?.firstName].filter(Boolean).join(' ')
  const filteredTeachers = useMemo(() => {
    const needle = teacherQuery.trim().toLocaleLowerCase()
    if (!needle) return teachers
    return teachers.filter((item) => [name(item), item.user?.email, item.homeroomGrade, item.homeroomSection].some((value) => String(value ?? '').toLocaleLowerCase().includes(needle)))
  }, [teachers, teacherQuery])
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
      <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div className="flex flex-wrap gap-2 text-xs font-bold"><span className="rounded-full bg-blue-100 px-3 py-1.5 text-blue-800">{teachers.filter((item) => item.status === 'HOMEROOM_TEACHER').length} Main Teacher(s)</span><span className="rounded-full bg-amber-100 px-3 py-1.5 text-amber-800">{teachers.filter((item) => item.status === 'ASSISTANT_TEACHER').length} Assistant(s)</span><span className="rounded-full bg-emerald-100 px-3 py-1.5 text-emerald-800">{filteredTeachers.length} / {teachers.length} {tr('enseignants', 'teachers')}</span></div><label className="relative block w-full lg:max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17}/><input value={teacherQuery} onChange={(event) => setTeacherQuery(event.target.value)} className="w-full rounded-xl border border-sky-200 bg-white py-2.5 pl-10 pr-3 text-sm text-kcs-blue-950 outline-none focus:border-kcs-blue-500 focus:ring-2 focus:ring-kcs-blue-200 dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white" placeholder={tr('Rechercher par nom, e-mail, classe ou section', 'Search by name, email, class or section')}/></label></div>
    </section>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
      <div className="grid grid-cols-[minmax(12rem,1.4fr)_minmax(9rem,.8fr)_minmax(9rem,.8fr)_minmax(8rem,.8fr)_minmax(7rem,.6fr)_auto] gap-3 border-b bg-slate-50 px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500 dark:border-kcs-blue-800 dark:bg-kcs-blue-950/60 dark:text-slate-300">
        <span>{tr('Employé / professeur', 'Employee / teacher')}</span><span>Main Teacher</span><span>{tr('Assistant', 'Assistant')}</span><span>{tr('Classe', 'Class')}</span><span>{tr('Section', 'Section')}</span><span>{tr('Action', 'Action')}</span>
      </div>
      <div className="divide-y dark:divide-kcs-blue-800">{filteredTeachers.map((item) => {
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
      {!filteredTeachers.length && <p className="p-8 text-center text-sm text-slate-500">{tr('Aucun professeur disponible.', 'No teacher is available.')}</p>}
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
    if (!needle) return [...students].sort((a: any, b: any) => cleanClassName(a.className).localeCompare(cleanClassName(b.className), undefined, { numeric: true }) || personName(a).localeCompare(personName(b)))
    return students.filter((student: any) => [personName(student), student.studentNumber, cleanClassName(student.className), student.email, student.phone, student.status].some((value) => comparable(value).includes(needle))).sort((a: any, b: any) => cleanClassName(a.className).localeCompare(cleanClassName(b.className), undefined, { numeric: true }) || personName(a).localeCompare(personName(b)))
  }, [students, query])

  const parents = directory.parents ?? []
  const filteredParents = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return [...parents].sort((a: any, b: any) => { const classOf=(parent:any)=>cleanClassName(students.find((student:any)=>parent.studentIds?.includes(student.id)||student.parentId===parent.id)?.className); return classOf(a).localeCompare(classOf(b), undefined, { numeric: true }) || personName(a).localeCompare(personName(b)) })
    return parents.filter((parent: any) => { const linked=students.filter((student:any)=>parent.studentIds?.includes(student.id)||student.parentId===parent.id); return [personName(parent),parent.email,parent.phone,parent.parentNumber,parent.displayId,...linked.flatMap((student:any)=>[personName(student),student.studentNumber,cleanClassName(student.className)])].some((value)=>comparable(value).includes(needle)) }).sort((a:any,b:any)=>personName(a).localeCompare(personName(b)))
  }, [parents, students, query])

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

  const parentById = new Map(parents.map((parent: any) => [parent.id, parent]))
  const currency = new Intl.NumberFormat(language === 'fr' ? 'fr-FR' : 'en-US', { style: 'currency', currency: 'USD' })
  const studentFinanceAccount = (student: any) => (finance?.studentAccounts ?? []).find((account: any) => comparable(account.studentId) === comparable(student.id) || comparable(account.studentNumber) === comparable(student.studentNumber) || comparable(account.studentName) === comparable(personName(student)))
  const parentFinanceAccount = (parent: any) => (finance?.parentAccounts ?? []).find((account: any) => comparable(account.parentId) === comparable(parent.id) || comparable(account.parentName) === comparable(personName(parent)) || comparable(account.email) === comparable(parent.email))
  const studentsView = <div className="space-y-6">
    <section className={card}>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-kcs-blue-600">{language === 'fr' ? 'Registre officiel' : 'Official registry'}</p><h2 className="mt-1 text-2xl font-bold dark:text-white">{language === 'fr' ? 'Élèves' : 'Students'}</h2><p className="text-sm text-gray-500">{language === 'fr' ? 'Même tableau que la Super Administration, strictement en lecture seule.' : 'The same table as Super Administration, strictly read-only.'}</p></div><label className="relative block w-full lg:max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/><input value={query} onChange={(event)=>setQuery(event.target.value)} className="w-full rounded-xl border py-2.5 pl-9 pr-3 text-sm dark:bg-kcs-blue-950" placeholder={language === 'fr' ? 'Nom, ID, classe, parent ou e-mail' : 'Name, ID, class, parent or email'}/></label></div>
      <div className="overflow-x-auto"><table className="min-w-[980px] w-full text-sm"><thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500 dark:bg-kcs-blue-950 dark:text-gray-400"><tr><th className="px-5 py-3">Élève</th><th className="px-5 py-3">ID élève</th><th className="px-5 py-3">Classe</th><th className="px-5 py-3">Parent responsable</th><th className="px-5 py-3">Contact</th><th className="px-5 py-3">Statut</th><th className="px-5 py-3 text-right">Action</th></tr></thead><tbody className="divide-y dark:divide-kcs-blue-800">{filteredStudents.map((student:any)=>{const parent=parentById.get(student.parentId) as any;return <tr key={student.id} className="hover:bg-gray-50 dark:hover:bg-kcs-blue-800/20"><td className="px-5 py-4 font-semibold text-kcs-blue-900 dark:text-white">{personName(student)}</td><td className="px-5 py-4 font-mono text-xs">{student.studentNumber ?? '—'}</td><td className="px-5 py-4">{cleanClassName(student.className)}</td><td className="px-5 py-4">{parent ? personName(parent) : '—'}</td><td className="px-5 py-4 text-xs"><p>{parent?.email ?? student.email ?? '—'}</p><p className="mt-1">{parent?.phone ?? '—'}</p></td><td className="px-5 py-4"><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">{student.status ?? 'ACTIVE'}</span></td><td className="px-5 py-4 text-right"><button onClick={()=>setSelected(student)} className="rounded-lg border border-kcs-blue-300 bg-kcs-blue-50 px-3 py-2 text-xs font-bold text-kcs-blue-800 hover:bg-kcs-blue-100 dark:border-sky-400 dark:bg-sky-400 dark:text-kcs-blue-950 dark:hover:bg-sky-300">{language === 'fr' ? 'Voir' : 'View'}</button></td></tr>})}</tbody></table></div>
      {filteredStudents.length===0&&empty(language === 'fr' ? 'Aucun élève ne correspond aux filtres.' : 'No student matches the filters.')}
    </section>
    {selected&&<div className="fixed inset-0 z-[120] flex items-center justify-center bg-kcs-blue-950/70 p-4" role="dialog" aria-modal="true" onClick={()=>setSelected(null)}><section className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl dark:bg-kcs-blue-950" onClick={(event)=>event.stopPropagation()}><div className="flex justify-between gap-4"><div><p className="text-xs font-bold uppercase text-kcs-blue-600">{language==='fr'?'Consultation uniquement':'View only'}</p><h3 className="mt-2 text-2xl font-bold dark:text-white">{personName(selected)}</h3></div><button onClick={()=>setSelected(null)} className="rounded-xl border px-4 py-2 text-sm font-bold">{language==='fr'?'Fermer':'Close'}</button></div><div className="mt-6 grid gap-3 sm:grid-cols-2">{[['ID élève',selected.studentNumber],['E-mail scolaire',selected.email],['Classe',cleanClassName(selected.className)],['Statut',selected.status],['Parent responsable',parentById.get(selected.parentId)?personName(parentById.get(selected.parentId)):null],['Téléphone parent',(parentById.get(selected.parentId) as any)?.phone]].map(([label,value])=><div key={String(label)} className="rounded-xl bg-sky-50 p-4 dark:bg-kcs-blue-900"><p className="text-xs font-bold uppercase text-gray-400">{label}</p><p className="mt-2 break-words font-semibold dark:text-white">{value||'—'}</p></div>)}</div><div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-700/60 dark:bg-amber-950/30"><p className="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">{language==='fr'?'Situation financi\u00e8re EduPay':'EduPay financial profile'}</p><div className="mt-3 grid gap-3 sm:grid-cols-3"><div><p className="text-xs text-gray-500">{language==='fr'?'Classe':'Class'}</p><p className="font-bold dark:text-white">{cleanClassName(selected.className)}</p></div><div><p className="text-xs text-gray-500">{language==='fr'?'Pay\u00e9':'Paid'}</p><p className="font-bold text-emerald-700 dark:text-emerald-300">{currency.format(Number(studentFinanceAccount(selected)?.paid ?? studentFinanceAccount(selected)?.totalPaid ?? 0))}</p></div><div><p className="text-xs text-gray-500">{language==='fr'?'Reste \u00e0 payer':'Outstanding'}</p><p className="font-bold text-amber-700 dark:text-amber-300">{currency.format(Number(studentFinanceAccount(selected)?.debt ?? studentFinanceAccount(selected)?.totalDebt ?? 0))}</p></div></div></div><p className="mt-5 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm font-semibold text-kcs-blue-800 dark:border-kcs-blue-700 dark:bg-kcs-blue-900 dark:text-sky-100">{language==='fr'?'Aucune modification, suppression ou réinitialisation d’accès n’est autorisée dans cet espace Administrator.':'No edit, deletion or access reset is permitted in this Administrator workspace.'}</p></section></div>}
  </div>

  const parentsView = <div className="space-y-6">
    <section className={card}>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-kcs-blue-600">{language === 'fr' ? 'Registre officiel' : 'Official registry'}</p><h2 className="mt-1 text-2xl font-bold dark:text-white">Parents</h2><p className="text-sm text-gray-500">{language === 'fr' ? 'Même tableau que la Super Administration, strictement en lecture seule.' : 'The same table as Super Administration, strictly read-only.'}</p></div><label className="relative block w-full lg:max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/><input value={query} onChange={(event)=>setQuery(event.target.value)} className="w-full rounded-xl border py-2.5 pl-9 pr-3 text-sm dark:bg-kcs-blue-950" placeholder={language === 'fr' ? 'Nom, email, téléphone ou identifiant' : 'Name, email, phone or identifier'}/></label></div>
      <div className="overflow-x-auto"><table className="min-w-[920px] w-full text-sm"><thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500 dark:bg-kcs-blue-950 dark:text-gray-400"><tr><th className="px-5 py-3">Parent responsable</th><th className="px-5 py-3">Identifiant</th><th className="px-5 py-3">Enfants liés</th><th className="px-5 py-3">Contact</th><th className="px-5 py-3">Statut</th><th className="px-5 py-3 text-right">Action</th></tr></thead><tbody className="divide-y dark:divide-kcs-blue-800">{filteredParents.map((parent:any)=>{const linked=students.filter((student:any)=>parent.studentIds?.includes(student.id)||student.parentId===parent.id);return <tr key={parent.id} className="hover:bg-gray-50 dark:hover:bg-kcs-blue-800/20"><td className="px-5 py-4 font-semibold text-kcs-blue-900 dark:text-white">{personName(parent)}</td><td className="px-5 py-4 font-mono text-xs">{parent.parentNumber ?? parent.displayId ?? '—'}</td><td className="px-5 py-4"><p className="font-bold">{linked.length}</p><p className="mt-1 max-w-xs truncate text-xs text-gray-500">{linked.map((student:any)=>personName(student)+' / '+cleanClassName(student.className)).join(', ')||'—'}</p></td><td className="px-5 py-4 text-xs"><p>{parent.email??'—'}</p><p className="mt-1">{parent.phone??'—'}</p></td><td className="px-5 py-4"><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">{linked.length?language==='fr'?'Actif':'Active':language==='fr'?'Sans enfant lié':'No linked child'}</span></td><td className="px-5 py-4 text-right"><button onClick={()=>setSelectedParent(parent)} className="rounded-lg border border-kcs-blue-300 bg-kcs-blue-50 px-3 py-2 text-xs font-bold text-kcs-blue-800 hover:bg-kcs-blue-100 dark:border-sky-400 dark:bg-sky-400 dark:text-kcs-blue-950 dark:hover:bg-sky-300">{language==='fr'?'Voir':'View'}</button></td></tr>})}</tbody></table></div>
      {filteredParents.length===0&&empty(language === 'fr' ? 'Aucun parent ne correspond aux filtres.' : 'No parent matches the filters.')}
    </section>
    {selectedParent&&<div className="fixed inset-0 z-[120] flex items-center justify-center bg-kcs-blue-950/70 p-4" role="dialog" aria-modal="true" onClick={()=>setSelectedParent(null)}><section className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl dark:bg-kcs-blue-950" onClick={(event)=>event.stopPropagation()}><div className="flex justify-between gap-4"><div><p className="text-xs font-bold uppercase text-kcs-blue-600">{language==='fr'?'Consultation uniquement':'View only'}</p><h3 className="mt-2 text-2xl font-bold dark:text-white">{personName(selectedParent)}</h3></div><button onClick={()=>setSelectedParent(null)} className="rounded-xl border px-4 py-2 text-sm font-bold">{language==='fr'?'Fermer':'Close'}</button></div><div className="mt-6 grid gap-3 sm:grid-cols-2">{[['E-mail',selectedParent.email],['Téléphone',selectedParent.phone],['Identifiant',selectedParent.parentNumber??selectedParent.displayId],['Enfants liés',students.filter((student:any)=>selectedParent.studentIds?.includes(student.id)||student.parentId===selectedParent.id).map((student:any)=>personName(student)+' / '+cleanClassName(student.className)).join(', ')]].map(([label,value])=><div key={String(label)} className="rounded-xl bg-sky-50 p-4 dark:bg-kcs-blue-900"><p className="text-xs font-bold uppercase text-gray-400">{label}</p><p className="mt-2 break-words font-semibold dark:text-white">{value||'—'}</p></div>)}</div><div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-700/60 dark:bg-amber-950/30"><p className="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">{language==='fr'?'Suivi financier familial EduPay':'EduPay family finance tracking'}</p><div className="mt-3 grid gap-3 sm:grid-cols-3"><div><p className="text-xs text-gray-500">{language==='fr'?'\u00c9l\u00e8ves li\u00e9s':'Linked students'}</p><p className="font-bold dark:text-white">{students.filter((student:any)=>selectedParent.studentIds?.includes(student.id)||student.parentId===selectedParent.id).length}</p></div><div><p className="text-xs text-gray-500">{language==='fr'?'Pay\u00e9':'Paid'}</p><p className="font-bold text-emerald-700 dark:text-emerald-300">{currency.format(Number(parentFinanceAccount(selectedParent)?.totalPaid ?? 0))}</p></div><div><p className="text-xs text-gray-500">{language==='fr'?'Reste \u00e0 payer':'Outstanding'}</p><p className="font-bold text-amber-700 dark:text-amber-300">{currency.format(Number(parentFinanceAccount(selectedParent)?.totalDebt ?? 0))}</p></div></div></div><p className="mt-5 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm font-semibold text-kcs-blue-800 dark:border-kcs-blue-700 dark:bg-kcs-blue-900 dark:text-sky-100">{language==='fr'?'Aucune modification, suppression, blocage ou réinitialisation d’accès n’est autorisée dans cet espace Administrator.':'No edit, deletion, blocking or access reset is permitted in this Administrator workspace.'}</p></section></div>}
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
