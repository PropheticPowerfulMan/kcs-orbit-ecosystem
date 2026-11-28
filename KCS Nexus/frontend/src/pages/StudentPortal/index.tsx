import {uiLocale} from '@/utils/uiLocale'
import PublishedGradesPanel from '@/components/student/PublishedGradesPanel'
import StudentOfficialAttendance from '@/components/student/StudentOfficialAttendance'
import CourseAverageOverview from '@/components/student/CourseAverageOverview'
import StudentNotificationCenter from '@/components/student/StudentNotificationCenter'
import SchoolAnnouncements from '@/components/shared/SchoolAnnouncements'
import GpaIndicator from '@/components/shared/GpaIndicator'
import RemoteLearningWorkspace from '@/components/shared/RemoteLearningWorkspace'
import AcademicHomeWelcome from '@/components/shared/AcademicHomeWelcome'
import StudentCourseAttendance from '@/components/student/StudentCourseAttendance'
import StudentMessagesPanel,{StudentMessageComposer} from '@/components/student/StudentMessagesPanel'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { BarChart3, Bell, BookOpen, Calendar, CheckCircle2, Clock, Download, FileText, Mail, RefreshCw, Search, Send, TrendingUp, UserRound, X } from 'lucide-react'
import PortalSidebar from '@/components/layout/PortalSidebar'
import AccountSettingsPanel from '@/components/shared/AccountSettingsPanel'
import SuggestionBox from '@/components/shared/SuggestionBox'
import MessageAttachment from '@/components/shared/MessageAttachment'
import AudioRecorder from '@/components/shared/AudioRecorder'
import OfficialTranscriptPanel from '@/components/shared/OfficialTranscriptPanel'
import PortalWorkspaceHeading from '@/components/shared/PortalWorkspaceHeading'
import PublishedCalendarStrip from '@/components/shared/PublishedCalendarStrip'
import WeeklyTimetable from '@/components/shared/WeeklyTimetable'
import StudentDiagnosticsPanel from './StudentDiagnosticsPanel'
import StudentInteractiveAssignments from '@/components/student/StudentInteractiveAssignments'
import StudentReportCardsPanel from './StudentReportCardsPanel'
import { api, financeAPI, messagesAPI, notificationsAPI, studentsAPI } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import { getLocalizedGreeting, getLocalizedPortalDate } from '@/utils/portalGreeting'

type Grade = { id: string; score: number; maxScore: number; percentage: number; letterGrade: string; period: string; createdAt: string; course?: { name?: string; code?: string } }
type Assignment = { id: string; status: string; score?: number | null; feedback?: string | null; assignment: { title: string; description?: string; dueDate: string; maxScore?: number; type?: string; cadence?: string; estimatedMinutes?: number|null; resourceUrl?: string|null; resourceName?: string|null; course?: { name?: string; code?: string } } }
type Schedule = { id?: string; day: string; startTime: string; endTime: string; room: string; teacher?: string; course?: { name?: string; code?: string; description?: string } }
type Profile = { id: string; studentNumber: string; grade: string; section: string; officialAvatar?: string | null; gpa?: number | null; attendanceRate?: number | null; status: string; user: { firstName: string; middleName?: string | null; lastName: string; email: string; phone?: string | null; avatar?: string | null } }
type Notice = { id: string; title: string; message: string; type: string; isRead: boolean; createdAt: string; link?: string }
type Contact = { id: string; firstName: string; middleName?: string | null; lastName: string; role: string; emailAvailable?: boolean }
type Message = { id: string; senderId: string; recipientId?: string; subject: string; body: string; createdAt: string; readAt?: string | null; sender?: Contact; recipient?: Contact; targetRole?: string; attachmentName?: string | null; attachmentMime?: string | null; attachmentSize?: number | null; hasAttachment?: boolean }
type Clearance = { synchronizedAt: string; accountMatched: boolean; parentName: string | null; balance: number; totalPaid: number; overdueInstallments: number; eligible: boolean; reason: string }
type AcademicSummary = { gpa?:number|null; academicYear?: string | null; term?: string | null; source?: string; average: number | null; attendanceRate: number | null; publishedGrades: number; attendanceRecords: number; pendingAssignments: number; overdueAssignments: number; assignmentCompletion: number | null; enrolledCourses: number }
type DataIntegrity = { identityVerified: boolean; profileId: string; source: string; lastAcademicUpdate: string | null; officialOnly: boolean }
type Overview = { academicVisibility?:{enabled:boolean;grades:boolean;reportCards:boolean;transcripts:boolean;revision:number}; profile: Profile | null; academicSummary: AcademicSummary | null; dataIntegrity?: DataIntegrity | null; grades: Grade[]; assignments: Assignment[]; timetable: Schedule[]; attendance: any[]; reportCards: any[]; transcripts: any[] }

const card = 'nexus-workspace-card min-w-0 overflow-hidden rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50'
const button = 'rounded-xl bg-kcs-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-kcs-blue-800 disabled:cursor-not-allowed disabled:opacity-50'
const field = 'block w-full min-w-0 max-w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-kcs-blue-950 outline-none focus:border-kcs-blue-500 dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white'
const empty = (text: string) => <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500 dark:bg-kcs-blue-800/30 dark:text-gray-300">{text}</p>
const dateText = (value?: string) => value ? new Intl.DateTimeFormat(uiLocale(), { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—'
const nameOf = (person?: Contact) => person ? [person.firstName, person.middleName, person.lastName].filter(Boolean).join(' ') : 'KCS'
const identityOf = (person?: Contact) => person ? `${nameOf(person)} — ${person.role}` : 'KCS — SCHOOL'
const segmentOf = (pathname: string) => { const value = pathname.split('/').filter(Boolean).at(-1); return !value || value === 'student' || value === 'dashboard' ? 'dashboard' : value }
const initialOverview: Overview = { profile: null, academicSummary: null, dataIntegrity: null, grades: [], assignments: [], timetable: [], attendance: [], reportCards: [], transcripts: [] }

export default function StudentPortal() {
  const { user } = useAuthStore()
  const language = useUIStore((state) => state.language)
  const tr = (fr: string, en: string) => language === 'fr' ? fr : en
  const segment = segmentOf(useLocation().pathname)
  const [overview, setOverview] = useState<Overview>(initialOverview)
  const [notices, setNotices] = useState<Notice[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [clearance, setClearance] = useState<Clearance | null>(null)
  const [clearanceLoading, setClearanceLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null)
  const [composeOpen, setComposeOpen] = useState(false)
  const [draft, setDraft] = useState({ recipientId: '', subject: '', body: '', deliveryMode: 'NEXUS_ONLY' as 'NEXUS_ONLY'|'NEXUS_EMAIL' })
  const [sending, setSending] = useState(false)
  const [messageAttachment, setMessageAttachment] = useState<File | null>(null)
  const [feedback, setFeedback] = useState('')
  const sendRequest = useRef('')

  const loadDashboard = async () => {
    setLoading(true); setError('')
    const results = await Promise.allSettled([studentsAPI.getMyOverview(), notificationsAPI.getAll(), messagesAPI.getHistory({ box: 'all' }), messagesAPI.getContacts()])
    if (results[0].status === 'fulfilled') {
      const next={...initialOverview,...(results[0].value.data?.data??{})} as Overview
      if(!next.academicVisibility?.grades){next.grades=[];if(next.profile)next.profile={...next.profile,gpa:null};if(next.academicSummary)next.academicSummary={...next.academicSummary,average:null,publishedGrades:0}}
      if(!next.academicVisibility?.reportCards)next.reportCards=[]
      if(!next.academicVisibility?.transcripts)next.transcripts=[]
      setOverview(next)
    }
    else setError(results[0].reason?.response?.data?.message ?? 'The academic dashboard could not be synchronized.')
    if (results[1].status === 'fulfilled') setNotices(Array.isArray(results[1].value.data?.data) ? results[1].value.data.data : [])
    if (results[2].status === 'fulfilled') setMessages(Array.isArray(results[2].value.data?.data) ? results[2].value.data.data : [])
    if (results[3].status === 'fulfilled') setContacts(Array.isArray(results[3].value.data?.data) ? results[3].value.data.data : [])
    setLoading(false)
  }
  useEffect(() => { void loadDashboard() }, [])

  const filteredAssignments = useMemo(() => overview.assignments.filter((item) => status === 'all' || item.status.toLowerCase() === status).filter((item) => !query.trim() || `${item.assignment.title} ${item.assignment.course?.name ?? ''} ${item.assignment.description ?? ''}`.toLowerCase().includes(query.trim().toLowerCase())), [overview.assignments, query, status])
  const groupedGrades = useMemo(() => { const values = new Map<string, Grade[]>(); overview.grades.forEach((grade) => { const key = grade.course?.name ?? grade.course?.code ?? 'Course'; values.set(key, [...(values.get(key) ?? []), grade]) }); return [...values.entries()].map(([course, grades]) => ({ course, average: grades.reduce((sum, grade) => sum + grade.percentage, 0) / grades.length, letter: grades[0]?.letterGrade ?? '—', count: grades.length })) }, [overview.grades])
  const pendingAssignments = overview.assignments.filter((item) => !['GRADED', 'SUBMITTED'].includes(item.status.toUpperCase()))
  const unread = notices.filter((item) => !item.isRead).length
  const shiningNotice = notices.find((item) => item.title.toLowerCase().includes('shining student'))

  const refreshClearance = async () => {
    setClearanceLoading(true); setFeedback('')
    try { const response = await financeAPI.getStudentClearance(); setClearance(response.data.data) }
    catch (reason: any) { setFeedback(reason?.response?.data?.message ?? 'EduPay financial clearance is temporarily unavailable.') }
    finally { setClearanceLoading(false) }
  }
  useEffect(() => { if (segment === 'grades') void refreshClearance() }, [segment])

  const downloadReport = () => {
    if (!clearance?.eligible || overview.grades.length === 0) return
    const rows = overview.grades.map((grade) => `<tr><td>${grade.course?.name ?? grade.course?.code ?? 'Course'}</td><td>${grade.period}</td><td>${grade.score}/${grade.maxScore}</td><td>${grade.percentage.toFixed(1)}%</td><td>${grade.letterGrade}</td></tr>`).join('')
    const studentName = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || 'Student'
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>KCS Academic Report</title><style>body{font-family:Arial,sans-serif;color:#102552;padding:36px}header{border-bottom:4px solid #c99a2e;padding-bottom:18px}table{width:100%;border-collapse:collapse;margin-top:24px}th,td{padding:10px;border-bottom:1px solid #dbe3ef;text-align:left}.seal{margin-top:28px;padding:16px;background:#f4f7fb}.ok{color:#167445;font-weight:bold}</style></head><body><header><h1>Kinshasa Christian School</h1><p>Student academic report</p></header><h2>${studentName}</h2><p>${overview.profile?.grade ?? ''} ${overview.profile?.section ?? ''} · ${overview.profile?.studentNumber ?? ''}</p><table><thead><tr><th>Course</th><th>Period</th><th>Score</th><th>Average</th><th>Grade</th></tr></thead><tbody>${rows}</tbody></table><div class="seal"><p class="ok">Financial clearance verified by EduPay</p><p>Account: ${clearance.parentName ?? 'Family account'} · Balance: $${clearance.balance.toFixed(2)} · Verified: ${dateText(clearance.synchronizedAt)}</p></div></body></html>`
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `KCS-academic-report-${overview.profile?.studentNumber ?? 'student'}.html`; anchor.click(); URL.revokeObjectURL(url); setFeedback('Academic report downloaded with current EduPay clearance.')
  }

  const sendMessage = async () => {
    if (!draft.recipientId || draft.subject.trim().length < 2 || !draft.body.trim()) return
    setSending(true); setFeedback('')
    try { const payload = new FormData(); payload.append('recipientId', draft.recipientId); payload.append('subject', draft.subject.trim()); payload.append('body', draft.body.trim()); payload.append('deliveryMode',draft.deliveryMode); payload.append('language',language); sendRequest.current ||= crypto.randomUUID(); payload.append('requestId',sendRequest.current); if (messageAttachment) payload.append('attachment', messageAttachment); const response = await messagesAPI.send(payload); setMessages((items) => [response.data.data, ...items.filter(item=>item.id!==response.data.data.id)]); sendRequest.current=''; setDraft({ recipientId: '', subject: '', body: '', deliveryMode: 'NEXUS_ONLY' }); setMessageAttachment(null); setComposeOpen(false); setFeedback(response.data.data.emailQueued?tr('Message Nexus enregistré ; e-mail en attente d’envoi.','Nexus message saved; email queued for delivery.'):tr('Message envoyé dans Nexus uniquement.','Message sent in Nexus only.')) }
    catch (reason: any) { setFeedback(reason?.response?.data?.message ?? 'The message could not be sent.') }
    finally { setSending(false) }
  }


  const title = segment === 'dashboard' ? 'Student Dashboard' : ({ grades:'Grades & Academic Reports', assignments:'Assignments', timetable:'My Timetable', attendance:'Attendance History', 'course-attendance':tr('Présences par cours','Course attendance'), diagnostics:'Official Diagnostics', messages:tr('Messagerie scolaire','School Messages'), profile:'My Profile', settings:'Account Settings' } as Record<string,string>)[segment] ?? 'Student Portal'

  const clearanceText = clearanceLoading ? tr('Synchronisation du compte familial…', 'Synchronizing the family account…') : clearance ? (clearance.eligible ? tr('Le compte financier est à jour. Le téléchargement du bulletin est autorisé.', 'The financial account is current. Report card download is authorized.') : !clearance.accountMatched ? tr('Aucun profil financier EduPay correspondant n’a été trouvé. Vérifiez la liaison du parent responsable.', 'No matching EduPay financial profile was found. Please verify the primary parent link.') : tr('Le bulletin reste bloqué jusqu’au règlement du solde et des échéances en retard.', 'The report card remains unavailable until the balance and overdue installments are cleared.')) : tr('Vérification EduPay en attente.', 'Waiting for EduPay verification.')

  const gradesView = <div className="space-y-6"><div className="grid gap-4 sm:grid-cols-3">{[[tr('Moyenne générale','Overall average')+(overview.academicSummary?.academicYear?' · '+overview.academicSummary.academicYear+' · '+overview.academicSummary.term:''),overview.academicSummary?.average!=null?overview.academicSummary.average.toFixed(2)+'%':'—'],[tr('Notes publiées','Published grades'),String(overview.academicSummary?.publishedGrades??overview.grades.length)],[tr('Moyennes par cours','Course averages'),String(groupedGrades.length)]].map(([label,value])=><div key={label} className={card}><p className="text-xs font-bold uppercase text-gray-500 dark:text-gray-300">{label}</p><p className="mt-2 text-3xl font-bold dark:text-white">{value}</p></div>)}</div><PublishedGradesPanel grades={overview.grades} feedback={feedback} actions={<button className="learning-button learning-button-primary" disabled={clearanceLoading||!clearance?.eligible||overview.grades.length===0} onClick={downloadReport}>{clearanceLoading?tr('Vérification EduPay…','Checking EduPay…'):tr('Télécharger le relevé vérifié','Download verified report')}</button>} notice={<>{clearanceText}<button onClick={()=>void refreshClearance()}>{tr('Actualiser','Refresh')}</button></>}/>{overview.academicVisibility?.transcripts&&<OfficialTranscriptPanel studentId={overview.profile?.id}/>}</div>

  const assignmentsView = <StudentInteractiveAssignments items={overview.assignments as any} reload={loadDashboard}/>

  const timetableEntries = overview.timetable.map((item) => ({ id: item.id, day: item.day, startTime: item.startTime, endTime: item.endTime, title: item.course?.name, courseName: item.course?.name, courseCode: item.course?.code, room: item.room, teacher: item.teacher, description: item.course?.description }))
  const timetableView = <WeeklyTimetable entries={timetableEntries} language={language} audience="student"/>

  const messagesView = <StudentMessagesPanel messages={messages} currentUserId={user?.id||''} onRead={async id=>{const response=await api.patch('/messages/'+id+'/read',{}, {headers:{'x-silent-feedback':'true'}});const updated=response.data.data;setMessages(items=>items.map(item=>item.id===id?{...item,...updated}:item))}} onCompose={()=>setComposeOpen(true)} onReply={message=>{setDraft({recipientId:message.senderId===user?.id?message.recipientId||'':message.senderId,subject:'Re: '+message.subject,body:'',deliveryMode:'NEXUS_ONLY'});setComposeOpen(true)}} onRefresh={()=>void loadDashboard()} refreshing={loading}/>

  const attendanceView = <StudentOfficialAttendance records={overview.attendance} rate={overview.academicSummary?.attendanceRate}/>

  const diagnosticsView = <StudentDiagnosticsPanel/>

  const dashboardView = <div data-academic-home="student" className="space-y-6"><AcademicHomeWelcome role="student"/><SchoolAnnouncements/>{shiningNotice&&<div className="rounded-2xl border-2 border-kcs-gold-400 bg-amber-50 p-5 shadow-sm dark:border-kcs-gold-500 dark:bg-amber-950/30"><p className="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">Shining Student</p><h2 className="mt-1 text-xl font-bold text-kcs-blue-950 dark:text-white">{shiningNotice.title}</h2><p className="mt-2 text-sm text-slate-700 dark:text-slate-200">{shiningNotice.message}</p><Link to="/shining-students" className="mt-4 inline-flex rounded-xl bg-kcs-blue-700 px-4 py-3 text-sm font-bold text-white">Voir mon passage et choisir mon sujet</Link></div>}{overview.dataIntegrity?.identityVerified&&<div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100"><strong>Institutional student record linked.</strong> Grades, assignments, attendance, schedules and official documents below belong to profile {overview.profile?.studentNumber}.{overview.dataIntegrity.lastAcademicUpdate&&<span> Last academic update: {dateText(overview.dataIntegrity.lastAcademicUpdate)}.</span>}</div>}<div data-dashboard-stats className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[[BookOpen,'Published grades',String(overview.academicSummary?.publishedGrades ?? overview.grades.length)],[TrendingUp,'Verified average',overview.academicSummary?.average != null ? overview.academicSummary.average.toFixed(2) + '%' : '—'],[CheckCircle2,'Verified attendance',overview.academicSummary?.attendanceRate != null ? overview.academicSummary.attendanceRate + '%' : '—'],[FileText,'Overdue assignments',String(overview.academicSummary?.overdueAssignments ?? 0)]].map(([Icon,label,value]:any)=><div key={label} className={card}><Icon className="text-kcs-blue-600"/><p className="mt-3 text-xs font-bold uppercase text-gray-400">{label}</p><p className="mt-1 text-3xl font-bold dark:text-white">{value}</p></div>)}</div><div className="grid gap-6 xl:grid-cols-2"><CourseAverageOverview rows={groupedGrades}/><div className={card}><div className="mb-4 flex justify-between"><h2 className="font-bold dark:text-white">Upcoming assignments</h2><Link className="text-sm font-bold text-kcs-blue-600" to="/portal/student/assignments">View all</Link></div>{pendingAssignments.length===0?empty('No pending assignment.'):pendingAssignments.slice(0,5).map((item)=><div key={item.id} className="mb-2 rounded-xl bg-gray-50 p-3 dark:bg-kcs-blue-800/30"><p className="font-semibold dark:text-white" data-no-translate>{item.assignment.title}</p><p className="mt-1 text-xs text-gray-500">{item.assignment.course?.name ?? 'Course'} · {dateText(item.assignment.dueDate)}</p></div>)}</div></div><div className="grid gap-6 xl:grid-cols-2"><div className={card}><div className="mb-4 flex justify-between"><h2 className="font-bold dark:text-white">Today & timetable</h2><Link className="text-sm font-bold text-kcs-blue-600" to="/portal/student/timetable">Full timetable</Link></div>{overview.timetable.length===0?empty('No timetable has been published.'):overview.timetable.slice(0,5).map((item,index)=><div key={item.id ?? index} className="flex justify-between border-b py-3 text-sm dark:border-kcs-blue-800"><span className="dark:text-white">{item.day} · {item.course?.name ?? 'Course'}</span><span className="text-gray-500">{item.startTime} · {item.room}</span></div>)}</div><StudentNotificationCenter notices={notices} onRead={async id=>{await api.patch('/notifications/'+id+'/read',{}, {headers:{'x-silent-feedback':'true'}});setNotices(items=>items.map(item=>item.id===id?{...item,isRead:true}:item))}}/></div></div>

  const profileView = <div className="grid gap-6 xl:grid-cols-2"><div className={card}><div className="flex items-center gap-4"><div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-kcs-blue-100 text-xl font-bold text-kcs-blue-700">{user?.firstName?.[0]}{user?.lastName?.[0]}</div><div><h2 className="text-2xl font-bold dark:text-white">{`${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim()}</h2><p className="text-sm text-gray-500">Verified student account</p></div></div><div className="mt-5 space-y-2 text-sm"><p><strong>Email:</strong> {user?.email}</p><p><strong>Student number:</strong> {overview.profile?.studentNumber ?? 'Synchronization pending'}</p><p><strong>Status:</strong> {overview.profile?.status ?? 'Academic profile pending'}</p></div></div><div className={card}><h2 className="font-bold dark:text-white">Academic placement</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{[['Grade',overview.profile?.grade ?? '—'],['Section',overview.profile?.section || '—'],[tr('Moyenne générale', 'Overall average') + (overview.academicSummary?.academicYear ? ' · ' + overview.academicSummary.academicYear + ' · ' + overview.academicSummary.term : ''),overview.academicSummary?.average != null ? overview.academicSummary.average.toFixed(2) + '%' : '—'],['Verified attendance',overview.academicSummary?.attendanceRate != null ? overview.academicSummary.attendanceRate + '%' : '—']].map(([label,value])=><div key={label} className="rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-800/30"><p className="text-xs font-bold uppercase text-gray-400">{label}</p><p className="mt-1 font-bold dark:text-white">{value}</p></div>)}</div></div></div>

  const releaseNotice=<div className={card+' border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40'} role="status"><h3 className="font-bold text-amber-900 dark:text-amber-100">{tr('Résultats non publiés par la Super Administration','Results not released by Super Administration')}</h3><p className="mt-2 text-sm text-amber-800 dark:text-amber-200">{tr('Les points et documents restent masqués jusqu’à autorisation. Vos données sont conservées dans le dossier officiel.','Grades and documents remain hidden until authorized. Your official academic records are retained.')}</p></div>
  const gradesReleased=Boolean(overview.academicVisibility?.enabled&&overview.academicVisibility?.grades)
  const documentsView=overview.academicVisibility?.reportCards?<StudentReportCardsPanel reportCards={overview.reportCards}/>:null
  const academicView=<div className="space-y-5">{gradesReleased&&<GpaIndicator value={overview.academicSummary?.gpa}/>}{gradesReleased?gradesView:releaseNotice}{documentsView}{!gradesReleased&&overview.academicVisibility?.transcripts&&<OfficialTranscriptPanel studentId={overview.profile?.id??''}/>}</div>
  const content = segment==='distance-learning'?<RemoteLearningWorkspace/>:segment==='course-attendance'?<StudentCourseAttendance/>:segment==='grades'?academicView:segment==='assignments'?assignmentsView:segment==='timetable'?timetableView:segment==='attendance'?attendanceView:segment==='messages'?messagesView:segment==='diagnostics'?diagnosticsView:segment==='profile'?profileView:segment==='settings'?<AccountSettingsPanel roleLabel="Student account"/>:dashboardView

  const overviewDescription = language === "fr" ? "Une vue claire de vos cours, devoirs, présences, résultats et progression scolaire." : "A clear view of your courses, assignments, attendance, results, and academic progress."
  const liveLabel = language === "fr" ? "Dossier scolaire en direct" : "Live academic record"
  const refreshLabel = language === "fr" ? "Actualiser" : "Refresh"

  return <div className="portal-shell flex min-h-screen bg-gray-50 dark:bg-kcs-blue-950"><PortalSidebar/><main data-portal-workspace={`student-${segment}`} className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto"><div className="portal-dashboard-topbar sticky top-0 z-20 border-b px-4 py-3 backdrop-blur-2xl sm:px-6 sm:py-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div className="min-w-0"><h1 className="portal-dashboard-title font-display text-xl font-bold leading-tight sm:text-2xl">{getLocalizedGreeting(language)}{user?.firstName ? ", " + user.firstName : ""}</h1><p className="mt-1 text-sm font-medium text-kcs-blue-700 dark:text-kcs-blue-100">{getLocalizedPortalDate(language)} - {overviewDescription}</p></div><div className="flex flex-wrap items-center gap-2"><div className="w-fit rounded-2xl border border-white/60 bg-white/65 px-4 py-2 text-sm font-semibold text-kcs-blue-800 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-kcs-blue-900/45 dark:text-kcs-blue-100">{overview.profile ? [overview.profile.grade, overview.profile.section && overview.profile.section.trim().toLocaleLowerCase() !== overview.profile.grade.trim().toLocaleLowerCase() ? overview.profile.section : "", liveLabel].filter(Boolean).join(" · ") : liveLabel}</div><button className={button} onClick={() => void loadDashboard()} disabled={loading}><RefreshCw size={16} className={loading ? "mr-2 inline animate-spin" : "mr-2 inline"}/>{refreshLabel}</button></div></div></div><div className="w-full max-w-none p-4 sm:p-6 lg:p-8"><PublishedCalendarStrip/>{segment !== "dashboard"&&<PortalWorkspaceHeading title={title} audience="student"/>}{error&&<p className="mb-5 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p>}{!loading&&overview.profile&&!gradesReleased&&segment!=='grades'&&segment!=='course-attendance'&&<div className="mb-5">{releaseNotice}</div>}{segment==='course-attendance'?content:loading&&!(segment==='messages'&&overview.profile)?<div className={card}><Clock className="inline animate-spin mr-2"/>Loading your secure academic workspace…</div>:!overview.profile?<div className={card}><UserRound className="text-kcs-blue-500"/><h2 className="mt-3 text-xl font-bold dark:text-white">Academic profile synchronization pending</h2><p className="mt-2 text-sm text-gray-500">Your institutional login is valid, but no Nexus academic record is linked to it yet. Please contact the school registry; no other student's data will be shown.</p></div>:content}<div className="mt-8"><SuggestionBox/></div></div></main>{selectedSchedule&&<div className="fixed inset-0 z-[80] flex items-center justify-center bg-kcs-blue-950/60 p-4" onClick={()=>setSelectedSchedule(null)}><div className="w-full max-w-lg rounded-3xl bg-white p-6 dark:bg-kcs-blue-950" onClick={(event)=>event.stopPropagation()}><div className="flex justify-between"><h2 className="text-xl font-bold dark:text-white">{selectedSchedule.course?.name ?? 'Course'}</h2><button onClick={()=>setSelectedSchedule(null)}><X/></button></div><p className="mt-4 text-sm text-gray-600 dark:text-gray-300">{selectedSchedule.day} · {selectedSchedule.startTime}–{selectedSchedule.endTime}</p><p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Teacher: {selectedSchedule.teacher || 'Pending'} · Room: {selectedSchedule.room}</p><p className="mt-4 text-sm text-gray-600 dark:text-gray-300">{selectedSchedule.course?.description || 'No additional course details.'}</p></div></div>}{composeOpen&&<StudentMessageComposer contacts={contacts} draft={draft} onChange={next=>{sendRequest.current='';setDraft({...next,deliveryMode:next.deliveryMode||'NEXUS_ONLY'})}} onClose={()=>setComposeOpen(false)} onSend={()=>void sendMessage()} sending={sending} attachment={messageAttachment} onAttachment={file=>{sendRequest.current='';setMessageAttachment(file)}} onError={setFeedback}/>}</div>
}
