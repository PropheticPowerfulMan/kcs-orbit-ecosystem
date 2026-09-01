import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Bell, ClipboardList, FileText, Megaphone, MessageSquare, Search, ShieldCheck, Users, WalletCards } from 'lucide-react'
import PortalSidebar from '@/components/layout/PortalSidebar'
import AccountSettingsPanel from '@/components/shared/AccountSettingsPanel'
import AdminOperationsPanel from '@/components/admin/AdminOperationsPanel'
import SuggestionBox from '@/components/shared/SuggestionBox'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import { adminAPI, admissionsAPI, financeAPI, messagesAPI, registryAPI } from '@/services/api'
import { getLocalizedGreeting, getLocalizedPortalDate } from '@/utils/portalGreeting'

const segmentOf = (pathname: string) => {
  const value = pathname.split('/').filter(Boolean).at(-1)
  return !value || value === 'staff' || value === 'dashboard' ? 'dashboard' : value
}
const card = 'rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50'
const button = 'rounded-xl bg-kcs-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-kcs-blue-800 disabled:opacity-50'
const empty = (text: string) => <p className="rounded-xl bg-gray-50 p-5 text-sm text-gray-500 dark:bg-kcs-blue-800/30 dark:text-gray-300">{text}</p>
const personName = (value: any) => value?.fullName || [value?.firstName, value?.middleName, value?.lastName].filter(Boolean).join(' ') || 'Unidentified record'

const StaffPortal = () => {
  const { user } = useAuthStore()
  const { language } = useUIStore()
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
  const [messageDraft, setMessageDraft] = useState({ recipientId: '', subject: '', body: '' })
  const [busy, setBusy] = useState(false)

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
      const response = await messagesAPI.send(messageDraft)
      setMessages((items) => [response.data?.data, ...items].filter(Boolean))
      setMessageDraft((draft) => ({ ...draft, subject: '', body: '' }))
      setNotice('The internal message was sent and recorded.')
    } catch (error: any) { setNotice(error?.response?.data?.message ?? 'The message could not be sent.') }
    finally { setBusy(false) }
  }

  const recordsView = <div className="grid gap-6 xl:grid-cols-[1.25fr_.75fr]">
    <section className={card}>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-bold dark:text-white">Official student records</h2><p className="text-sm text-gray-500">Read-only shared Orbit registry. Sensitive changes remain controlled.</p></div><div className="relative"><Search className="absolute left-3 top-3 text-gray-400" size={16}/><input value={query} onChange={(event)=>setQuery(event.target.value)} className="rounded-xl border py-2.5 pl-9 pr-3 text-sm dark:bg-kcs-blue-950" placeholder="Name, ID, class, email"/></div></div>
      <div className="overflow-x-auto"><table className="min-w-[720px] w-full text-sm"><thead><tr className="border-b text-left text-xs text-gray-400"><th className="py-3">Student</th><th>Identifier</th><th>Class</th><th>Status</th><th></th></tr></thead><tbody>{filteredStudents.map((student:any)=><tr key={student.id} className="border-b dark:border-kcs-blue-800"><td className="py-3 font-semibold dark:text-white">{personName(student)}</td><td>{student.studentNumber ?? '—'}</td><td>{student.className ?? '—'}</td><td>{student.status ?? '—'}</td><td className="text-right"><button onClick={()=>setSelected(student)} className="rounded-lg bg-kcs-blue-50 px-3 py-1.5 text-xs font-bold text-kcs-blue-700">Open</button></td></tr>)}</tbody></table></div>
      {filteredStudents.length===0&&empty('No record matches this search.')}
    </section>
    <section className={card}><h2 className="font-bold dark:text-white">Selected record</h2>{!selected?empty('Select a student to view the synchronized administrative details.'):<div className="mt-4 space-y-3 text-sm"><p className="text-2xl font-bold dark:text-white">{personName(selected)}</p><p><b>Student ID:</b> {selected.studentNumber ?? '—'}</p><p><b>Class:</b> {selected.className ?? '—'}</p><p><b>Email:</b> {selected.email ?? '—'}</p><p><b>Status:</b> {selected.status ?? '—'}</p><p className="rounded-xl bg-kcs-blue-50 p-3 text-xs text-kcs-blue-800">Parent and medical details are not exposed here unless required by the authorized workflow.</p></div>}</section>
  </div>

  const admissionsView = <section className={card}><div className="mb-4"><h2 className="font-bold dark:text-white">Admissions processing queue</h2><p className="text-sm text-gray-500">Administrators may review and schedule. Only the Super Administrator can approve, reject, and provision accounts.</p></div>{(overview.applications??[]).length===0?empty('No application is waiting for administrative processing.'):<div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">{overview.applications.map((item:any)=><article key={item.id} className="rounded-xl border p-4 dark:border-kcs-blue-800"><p className="text-xs font-bold text-kcs-gold-600">{item.applicationNumber}</p><h3 className="mt-1 font-bold dark:text-white">{[item.firstName,item.middleName,item.lastName].filter(Boolean).join(' ')}</h3><p className="text-sm text-gray-500">{item.gradeApplying} · {item.parentName}</p><span className="mt-3 inline-block rounded-full bg-kcs-blue-50 px-3 py-1 text-xs font-bold text-kcs-blue-700">{String(item.status).replace(/_/g,' ')}</span><div className="mt-4 grid gap-2"><button disabled={busy} onClick={()=>void updateAdmission(item.id,'UNDER_REVIEW')} className={button}>Mark under review</button><button disabled={busy} onClick={()=>void updateAdmission(item.id,'INTERVIEW_SCHEDULED')} className="rounded-xl border px-4 py-2.5 text-sm font-semibold dark:border-kcs-blue-700">Schedule interview</button></div></article>)}</div>}</section>

  const announcementsView = <section className={card}><h2 className="font-bold dark:text-white">Published school announcements</h2><p className="mb-4 text-sm text-gray-500">Publication is controlled by the Super Administrator. Use Messages for operational communication.</p>{(overview.announcements??[]).length===0?empty('No published announcement.'):<div className="grid gap-3 md:grid-cols-2">{overview.announcements.map((item:any)=><article key={item.id} className="rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-800/30"><h3 className="font-semibold dark:text-white">{item.title}</h3><p className="mt-1 text-sm text-gray-500">{item.excerpt}</p><p className="mt-2 text-xs text-gray-400">{new Date(item.publishedAt).toLocaleString()}</p></article>)}</div>}</section>

  const reportsView = <section className={card}><h2 className="font-bold dark:text-white">Report-card workflow</h2><p className="mb-4 text-sm text-gray-500">Operational visibility without SuperAdmin approval rights.</p>{(overview.reportCards??[]).length===0?empty('No report card has been submitted to the workflow.'):<div className="grid gap-3 md:grid-cols-2">{overview.reportCards.map((item:any)=><article key={item.id} className="rounded-xl border p-4 dark:border-kcs-blue-800"><h3 className="font-semibold dark:text-white">{personName(item.student?.user)}</h3><p className="text-sm text-gray-500">{item.term} · {item.average}%</p><p className="mt-2 text-xs font-bold text-kcs-blue-600">{item.principalStatus} · {item.publicationStatus}</p></article>)}</div>}</section>

  const financeView = <section className={card}><h2 className="font-bold dark:text-white">EduPay fee tracking</h2><p className="mb-4 text-sm text-gray-500">Synchronized read-only finance overview.</p>{!finance?empty('EduPay finance synchronization is unavailable.'):<><div className="mb-5 grid gap-3 sm:grid-cols-3">{[['Collected',finance.totals?.collectedRevenue],['Outstanding',finance.totals?.outstandingDebt],['Completion',String(finance.totals?.paymentCompletionRate??0)+'%']].map(([label,value])=><div key={String(label)} className="rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-800/30"><p className="text-xs text-gray-500">{label}</p><p className="mt-1 text-xl font-bold dark:text-white">{typeof value==='number'?new Intl.NumberFormat(language==='fr'?'fr-FR':'en-US',{style:'currency',currency:'USD'}).format(value):value}</p></div>)}</div><div className="grid gap-3 md:grid-cols-2">{(finance.parentAccounts??[]).map((account:any,index:number)=><div key={index} className="rounded-xl border p-4 dark:border-kcs-blue-800"><p className="font-semibold dark:text-white">{account.parentName??'Family account'}</p><p className="text-sm text-gray-500">Paid {account.totalPaid??0} · Outstanding {account.totalDebt??0} · {account.studentCount??0} student(s)</p></div>)}</div></>}</section>

  const messagesView = <div className="grid gap-6 xl:grid-cols-[1fr_1fr]"><section className={card}><h2 className="font-bold dark:text-white">Internal messages</h2>{messages.length===0?empty('No internal message.'):<div className="mt-4 space-y-3">{messages.slice(0,30).map((item:any)=><article key={item.id} className="rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-800/30"><h3 className="font-semibold dark:text-white">{item.subject}</h3><p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{item.body}</p><p className="mt-2 text-xs text-gray-400">{new Date(item.createdAt).toLocaleString()}</p></article>)}</div>}</section><section className={card}><h2 className="font-bold dark:text-white">Send an operational message</h2><div className="mt-4 grid gap-3"><select value={messageDraft.recipientId} onChange={(event)=>setMessageDraft({...messageDraft,recipientId:event.target.value})} className="rounded-xl border bg-white p-3 dark:bg-kcs-blue-950">{contacts.map((contact:any)=><option key={contact.id} value={contact.id}>{personName(contact)} · {contact.role}</option>)}</select><input value={messageDraft.subject} onChange={(event)=>setMessageDraft({...messageDraft,subject:event.target.value})} className="rounded-xl border p-3 dark:bg-kcs-blue-950" placeholder="Subject"/><textarea value={messageDraft.body} onChange={(event)=>setMessageDraft({...messageDraft,body:event.target.value})} className="min-h-36 rounded-xl border p-3 dark:bg-kcs-blue-950" placeholder="Message"/><button disabled={busy} onClick={()=>void sendMessage()} className={button}>Send and record</button></div></section></div>

  const permissionsView = <div className="grid gap-6 xl:grid-cols-2"><section className={card}><h2 className="font-bold dark:text-white">{roleTitle} permissions</h2><div className="mt-4 flex flex-wrap gap-2">{(isAdministrator ? ['Read shared records','Coordinate admission review','Read EduPay summary','Send internal messages','Read report workflow','Review incidents','No Super Admin provisioning'] : ['Read shared records','Process admission stages','Read EduPay summary','Send internal messages','Read report workflow','No final approval','No account provisioning']).map((item)=><span key={item} className="rounded-full bg-kcs-blue-50 px-3 py-1 text-xs font-bold text-kcs-blue-700">{item}</span>)}</div></section><section className={card}><h2 className="font-bold dark:text-white">My audit activity</h2>{(overview.recentActivity??[]).length===0?empty('No recent administrative action recorded for this account.'):<div className="mt-4 space-y-3">{overview.recentActivity.map((item:any)=><div key={item.id} className="rounded-xl bg-gray-50 p-3 text-sm dark:bg-kcs-blue-800/30"><b>{item.action}</b><p className="text-xs text-gray-500">{item.targetType} · {new Date(item.createdAt).toLocaleString()}</p></div>)}</div>}</section></div>

  const dashboard = <><SuggestionBox/><AdminOperationsPanel isAdministrator={isAdministrator} basePath={basePath} overview={overview} language={language}/><div className="grid grid-cols-2 gap-4 xl:grid-cols-5">{[
    ['Student records',directory.counts?.students??students.length,Users,'Shared Orbit registry'],
    ['Families',directory.counts?.families??0,Users,'Responsible families'],
    ['Pending messages',overview.stats?.pendingMessages??0,MessageSquare,'Unread internal messages'],
    ['Admission tasks',overview.stats?.admissionTasks??0,ClipboardList,'Review or interview'],
    ['Pending reports',overview.stats?.pendingReports??0,ShieldCheck,'Operational follow-up'],
  ].map(([label,value,Icon,sub]:any)=><motion.div key={label} initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} className={card}><Icon className="text-kcs-blue-600" size={20}/><p className="mt-3 text-3xl font-bold dark:text-white">{value}</p><p className="text-sm font-semibold dark:text-gray-200">{label}</p><p className="text-xs text-gray-400">{sub}</p></motion.div>)}</div>
  <div className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]"><section className={card}><h2 className="font-bold dark:text-white">Recorded attendance by class</h2>{(overview.attendanceByClass??[]).length===0?empty('Attendance indicators will appear after records are entered.'):<ResponsiveContainer width="100%" height={280}><BarChart data={overview.attendanceByClass}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="label"/><YAxis domain={[0,100]}/><Tooltip/><Bar dataKey="attendance" fill="#1d4ed8" radius={[7,7,0,0]}/></BarChart></ResponsiveContainer>}</section><section className={card}><h2 className="font-bold dark:text-white">Administrative workload</h2><div className="mt-4 space-y-3">{[[ClipboardList,'Admissions',overview.stats?.admissionTasks??0],[MessageSquare,'Messages',overview.stats?.pendingMessages??0],[FileText,'Reports',overview.stats?.pendingReports??0],[ShieldCheck,'Open incidents',overview.stats?.openIncidents??0]].map(([Icon,label,value]:any)=><Link key={label} to={label==='Admissions'?basePath+'/admissions':label==='Messages'?basePath+'/messages':label==='Reports'?basePath+'/reports':basePath+'/permissions'} className="flex items-center justify-between rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-800/30"><span className="flex items-center gap-3 font-semibold dark:text-white"><Icon size={18}/>{label}</span><b>{value}</b></Link>)}</div></section></div>
  <div className="grid gap-6 xl:grid-cols-3"><section className={card}><h2 className="flex items-center gap-2 font-bold dark:text-white"><ClipboardList size={18}/>Recent admissions</h2><div className="mt-4 space-y-3">{(overview.applications??[]).slice(0,5).map((item:any)=><div key={item.id} className="rounded-xl bg-gray-50 p-3 dark:bg-kcs-blue-800/30"><b className="dark:text-white">{[item.firstName,item.lastName].join(' ')}</b><p className="text-xs text-gray-500">{item.gradeApplying} · {String(item.status).replace(/_/g,' ')}</p></div>)}</div></section><section className={card}><h2 className="flex items-center gap-2 font-bold dark:text-white"><Bell size={18}/>Announcements</h2><div className="mt-4 space-y-3">{(overview.announcements??[]).slice(0,5).map((item:any)=><div key={item.id} className="rounded-xl bg-gray-50 p-3 dark:bg-kcs-blue-800/30"><b className="dark:text-white">{item.title}</b><p className="text-xs text-gray-500">{new Date(item.publishedAt).toLocaleDateString()}</p></div>)}</div></section><section className={card}><h2 className="flex items-center gap-2 font-bold dark:text-white"><WalletCards size={18}/>EduPay status</h2>{finance?<div className="mt-4 space-y-2"><p className="text-3xl font-bold dark:text-white">{finance.totals?.paymentCompletionRate??0}%</p><p className="text-sm text-gray-500">Payment completion</p><Link to={basePath+'/finance'} className={button+' mt-4 inline-block'}>Open finance tracking</Link></div>:empty('EduPay synchronization unavailable.')}</section></div></>

  const content = segment==='records'?recordsView:segment==='admissions'?admissionsView:segment==='announcements'?announcementsView:segment==='reports'?reportsView:segment==='finance'?financeView:segment==='messages'?messagesView:segment==='permissions'?permissionsView:segment==='settings'?<AccountSettingsPanel roleLabel={roleTitle}/>:dashboard

  return <div className="portal-shell flex"><PortalSidebar/><main><header className="portal-dashboard-topbar sticky top-0 z-20 border-b px-4 py-3 backdrop-blur-2xl sm:px-6 sm:py-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><h1 className="portal-dashboard-title font-display text-xl font-bold sm:text-2xl">{getLocalizedGreeting(language)}, {user?.firstName}</h1><p className="mt-1 text-sm font-medium text-kcs-blue-700 dark:text-kcs-blue-100">{getLocalizedPortalDate(language)} · {workspaceTitle} · {status}</p></div><div className="flex gap-2"><Link to={basePath+'/announcements'} className="btn-primary flex items-center gap-2 py-2 text-sm"><Megaphone size={16}/>Announcements</Link><Link to={basePath+'/messages'} className="btn-gold flex items-center gap-2 py-2 text-sm"><MessageSquare size={16}/>Messages</Link></div></div></header><div className="space-y-6 p-4 sm:p-6">{notice&&<p className="rounded-xl bg-kcs-blue-50 p-3 text-sm font-semibold text-kcs-blue-800">{notice}</p>}{status==='error'&&<button onClick={()=>void load()} className={button}>Retry synchronization</button>}{content}</div></main></div>
}
export default StaffPortal
