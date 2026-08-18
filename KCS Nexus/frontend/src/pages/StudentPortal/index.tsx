import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LayoutDashboard, BarChart3, FileText, Calendar, Brain,
  Bell, BookOpen, TrendingUp, Award, Clock, CheckCircle2,
  AlertCircle, ChevronRight, MessageSquare, User, Search, Download, RefreshCw, Upload, X, PlayCircle, ArrowLeft, Mail, Inbox, Send
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import PortalSidebar from '@/components/layout/PortalSidebar'
import PortalSectionPanel from '@/components/shared/PortalSectionPanel'
import SuggestionBox from '@/components/shared/SuggestionBox'
import AccountSettingsPanel from '@/components/shared/AccountSettingsPanel'
import { getLocalizedGreeting, getLocalizedPortalDate } from '@/utils/portalGreeting'
import { financeAPI, messagesAPI, notificationsAPI, studentsAPI } from '@/services/api'
import type { Notification as PortalNotification } from '@/types'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar
} from 'recharts'
import {
  academicContext,
  announcements as ecosystemAnnouncements,
  assignments as ecosystemAssignments,
  attendanceAnalytics,
  events as ecosystemEvents,
  grades as ecosystemGrades,
  internalThreads,
  lmsResources,
  reportCards,
  students as ecosystemStudents,
  transcripts,
} from '@/data/schoolEcosystem'

const performanceData = [
  { month: 'Sep', gpa: 3.2 },
  { month: 'Oct', gpa: 3.4 },
  { month: 'Nov', gpa: 3.3 },
  { month: 'Dec', gpa: 3.6 },
  { month: 'Jan', gpa: 3.5 },
  { month: 'Feb', gpa: 3.7 },
  { month: 'Mar', gpa: 3.8 },
  { month: 'Apr', gpa: 3.9 },
]

const subjectGrades = [
  { subject: 'Math', grade: 92, letter: 'A-' },
  { subject: 'English', grade: 88, letter: 'B+' },
  { subject: 'Science', grade: 95, letter: 'A' },
  { subject: 'History', grade: 85, letter: 'B' },
  { subject: 'French', grade: 90, letter: 'A-' },
  { subject: 'Bible', grade: 97, letter: 'A+' },
]

const assignments = [
  { id: 1, title: 'AP Calculus Problem Set #8', course: 'Mathematics', due: 'Tomorrow, 11:59 PM', status: 'pending', priority: 'high' },
  { id: 2, title: 'Essay: The Congo Independence Movement', course: 'History', due: 'Apr 25, 11:59 PM', status: 'pending', priority: 'medium' },
  { id: 3, title: 'Science Lab Report — Photosynthesis', course: 'Biology', due: 'Apr 23', status: 'submitted', priority: 'low' },
  { id: 4, title: 'French Oral Presentation', course: 'French', due: 'Apr 22', status: 'graded', priority: 'low' },
]

const schedule = [
  { time: '7:45 AM', subject: 'Bible & Devotions', room: 'Homeroom', teacher: 'Mrs. Smith' },
  { time: '8:15 AM', subject: 'AP Calculus', room: 'Room 204', teacher: 'Mr. Belanger' },
  { time: '9:15 AM', subject: 'English Literature', room: 'Room 110', teacher: 'Mrs. Diallo' },
  { time: '10:15 AM', subject: 'AP Biology', room: 'Lab 3', teacher: 'Dr. Mukendi' },
  { time: '11:30 AM', subject: 'Lunch Break', room: 'Cafeteria', teacher: '' },
  { time: '12:30 PM', subject: 'World History', room: 'Room 305', teacher: 'Mr. Rivera' },
  { time: '1:30 PM', subject: 'French Language', room: 'Room 108', teacher: 'Mrs. Nkosi' },
  { time: '2:30 PM', subject: 'Free Study / AI Tutor', room: 'Library', teacher: '' },
]

const notifications = [
  { id: 1, type: 'warning', message: 'AP Calculus exam scheduled for May 3rd — 2 weeks away', time: '2h ago' },
  { id: 2, type: 'success', message: 'French Oral Presentation graded: 90/100 — Excellent!', time: '5h ago' },
  { id: 3, type: 'info', message: 'Parent-Teacher Conference: May 20th, 1 PM — Parent notified', time: '1d ago' },
]

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  submitted: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  graded: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  late: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

const priorityColors: Record<string, string> = {
  high: 'border-l-red-500',
  medium: 'border-l-yellow-500',
  low: 'border-l-green-500',
}

const getStudentSegment = (pathname: string) => {
  const segment = pathname.split('/').filter(Boolean).at(-1)
  return !segment || segment === 'student' || segment === 'dashboard' ? 'dashboard' : segment
}

const studentActionButton = 'rounded-xl bg-kcs-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-kcs-blue-800 disabled:cursor-not-allowed disabled:bg-gray-300 dark:disabled:bg-kcs-blue-800'

type StudentAssignment = {
  id: string | number
  title: string
  course: string
  due: string
  status: string
  priority: string
  description?: string
  maxScore?: number
}

type FinancialClearance = {
  source: string
  synchronizedAt: string
  accountMatched: boolean
  parentName: string | null
  balance: number
  totalPaid: number
  overdueInstallments: number
  eligible: boolean
  reason: string
}

const StudentSectionView = ({ segment }: { segment: string }) => {
  const { user } = useAuthStore()
  const [localAssignments, setLocalAssignments] = useState<StudentAssignment[]>(assignments)
  const [messageSent, setMessageSent] = useState(false)
  const [actionMessage, setActionMessage] = useState('')
  const [actionError, setActionError] = useState('')
  const [clearance, setClearance] = useState<FinancialClearance | null>(null)
  const [clearanceLoading, setClearanceLoading] = useState(false)
  const [assignmentLoading, setAssignmentLoading] = useState(false)
  const [assignmentQuery, setAssignmentQuery] = useState('')
  const [assignmentStatus, setAssignmentStatus] = useState('all')
  const [assignmentCourse, setAssignmentCourse] = useState('all')
  const [assignmentSort, setAssignmentSort] = useState('due')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [submissionTarget, setSubmissionTarget] = useState<string | number | null>(null)
  const [selectedSchedule, setSelectedSchedule] = useState<any>(null)
  const [liveSchedule, setLiveSchedule] = useState<any[]>([])
  const [messagesList, setMessagesList] = useState<any[]>([])
  const [selectedMessage, setSelectedMessage] = useState<any>(null)
  const [messageQuery, setMessageQuery] = useState('')
  const [messageBox, setMessageBox] = useState('all')
  const [contacts, setContacts] = useState<any[]>([])
  const [composeOpen, setComposeOpen] = useState(false)
  const [messageDraft, setMessageDraft] = useState({ recipientId: '', subject: '', body: '' })
  const [diagnosticSubject, setDiagnosticSubject] = useState('Mathematics')
  const [diagnosticStarted, setDiagnosticStarted] = useState(false)
  const [diagnosticAnswers, setDiagnosticAnswers] = useState<Record<number, number>>({})
  const [diagnosticResult, setDiagnosticResult] = useState<number | null>(null)

  const refreshClearance = async () => {
    setClearanceLoading(true)
    setActionError('')
    try {
      const response = await financeAPI.getStudentClearance()
      setClearance(response.data.data as FinancialClearance)
    } catch (error: any) {
      setActionError(error?.response?.data?.message ?? 'EduPay financial clearance is temporarily unavailable.')
    } finally {
      setClearanceLoading(false)
    }
  }

  const refreshAssignments = async () => {
    setAssignmentLoading(true)
    setActionError('')
    try {
      const response = await studentsAPI.getMyAssignments()
      const records = Array.isArray(response.data.data) ? response.data.data : []
      if (records.length) {
        setLocalAssignments(records.map((record: any) => ({
          id: record.id,
          title: record.assignment.title,
          course: record.assignment.course?.name ?? record.assignment.course?.code ?? 'Course',
          due: new Date(record.assignment.dueDate).toLocaleString(),
          status: String(record.status).toLowerCase(),
          priority: new Date(record.assignment.dueDate).getTime() < Date.now() ? 'high' : 'medium',
          description: record.assignment.description,
          maxScore: record.assignment.maxScore,
        })))
      }
    } catch (error: any) {
      setActionError(error?.response?.data?.message ?? 'Live assignments could not be loaded; cached assignments remain visible.')
    } finally {
      setAssignmentLoading(false)
    }
  }

  useEffect(() => {
    if (segment === 'grades') void refreshClearance()
    if (segment === 'assignments') void refreshAssignments()
  }, [segment])

  const downloadReportCard = () => {
    if (!clearance?.eligible) return
    const reportCard = reportCards.find((card) => card.student === 'Elise Kabongo')
    const rows = subjectGrades.map((grade) => `<tr><td>${grade.subject}</td><td>${grade.grade}/100</td><td>${grade.letter}</td></tr>`).join('')
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>KCS Report Card</title><style>body{font-family:Arial,sans-serif;color:#102552;padding:36px}header{border-bottom:4px solid #c99a2e;padding-bottom:18px}h1{margin-bottom:4px}table{width:100%;border-collapse:collapse;margin-top:24px}th,td{padding:12px;border-bottom:1px solid #dbe3ef;text-align:left}.seal{margin-top:28px;padding:16px;background:#f4f7fb}.ok{color:#167445;font-weight:bold}</style></head><body><header><h1>Kinshasa Christian School</h1><p>Official Student Report Card</p></header><h2>${user?.firstName ?? 'Elise'} ${user?.lastName ?? 'Kabongo'}</h2><p>${reportCard?.term ?? 'Current term'} · Final average: <strong>${reportCard?.average ?? 0}%</strong></p><table><thead><tr><th>Subject</th><th>Score</th><th>Grade</th></tr></thead><tbody>${rows}</tbody></table><p>Teacher comment: ${reportCard?.teacherComment ?? ''}</p><div class="seal"><p class="ok">Financial clearance verified by EduPay</p><p>Account: ${clearance.parentName ?? 'Family account'} · Balance: $${clearance.balance.toFixed(2)} · Synchronized: ${new Date(clearance.synchronizedAt).toLocaleString()}</p></div></body></html>`
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `KCS-report-card-${user?.firstName ?? 'student'}.html`
    anchor.click()
    URL.revokeObjectURL(url)
    setActionMessage('Official report card downloaded with current EduPay clearance.')
  }

  const assignmentCourses = useMemo(() => Array.from(new Set(localAssignments.map((item) => item.course))).sort(), [localAssignments])
  const filteredAssignments = useMemo(() => {
    const query = assignmentQuery.trim().toLocaleLowerCase()
    return localAssignments
      .filter((item) => assignmentStatus === 'all' || item.status === assignmentStatus)
      .filter((item) => assignmentCourse === 'all' || item.course === assignmentCourse)
      .filter((item) => !query || `${item.title} ${item.course} ${item.description ?? ''} ${item.due}`.toLocaleLowerCase().includes(query))
      .sort((left, right) => assignmentSort === 'title' ? left.title.localeCompare(right.title) : assignmentSort === 'status' ? left.status.localeCompare(right.status) : String(left.due).localeCompare(String(right.due)))
  }, [assignmentCourse, assignmentQuery, assignmentSort, assignmentStatus, localAssignments])

  const diagnosticQuestions = useMemo(() => ({
    Mathematics: [
      { q: 'Solve 3x + 5 = 20.', choices: ['x = 3', 'x = 5', 'x = 8', 'x = 15'], answer: 1 },
      { q: 'Which fraction equals 0.75?', choices: ['1/2', '2/3', '3/4', '4/5'], answer: 2 },
      { q: 'What is the slope between (1,2) and (3,6)?', choices: ['1', '2', '3', '4'], answer: 1 },
    ],
    Science: [
      { q: 'Where does photosynthesis mainly occur?', choices: ['Nucleus', 'Chloroplast', 'Mitochondrion', 'Ribosome'], answer: 1 },
      { q: 'What carries genetic information?', choices: ['ATP', 'DNA', 'Water', 'Glucose'], answer: 1 },
      { q: 'A controlled variable is...', choices: ['Measured', 'Changed', 'Kept constant', 'Ignored'], answer: 2 },
    ],
    English: [
      { q: 'A thesis statement primarily...', choices: ['Lists sources', 'States the central claim', 'Ends a paragraph', 'Defines every word'], answer: 1 },
      { q: 'Which is a complete sentence?', choices: ['Because it rained.', 'Running quickly.', 'The class began on time.', 'After the bell.'], answer: 2 },
      { q: 'Evidence in an argument should be...', choices: ['Unrelated', 'Relevant and credible', 'Only emotional', 'Anonymous'], answer: 1 },
    ],
  }), [])

  const loadTimetable = async () => {
    setAssignmentLoading(true)
    try { const response = await studentsAPI.getMyTimetable(); setLiveSchedule(Array.isArray(response.data.data) ? response.data.data : []) }
    catch { setActionError('The administrative timetable is temporarily unavailable; the published cached schedule is shown.') }
    finally { setAssignmentLoading(false) }
  }

  const loadMessages = async () => {
    setAssignmentLoading(true)
    try {
      const [messagesResponse, contactsResponse] = await Promise.all([messagesAPI.getAll({ q: messageQuery || undefined, box: messageBox }), messagesAPI.getContacts()])
      setMessagesList(Array.isArray(messagesResponse.data.data) ? messagesResponse.data.data : [])
      setContacts(Array.isArray(contactsResponse.data.data) ? contactsResponse.data.data : [])
    } catch { setActionError('Messages could not be synchronized.') }
    finally { setAssignmentLoading(false) }
  }

  useEffect(() => { if (segment === 'timetable') void loadTimetable() }, [segment])
  useEffect(() => { if (segment === 'messages') { const timer = window.setTimeout(() => void loadMessages(), 250); return () => window.clearTimeout(timer) } }, [segment, messageQuery, messageBox])

  if (segment === 'grades') {
    const reportCard = reportCards.find((card) => card.student === 'Elise Kabongo')
    const transcript = transcripts.find((item) => item.student === 'Elise Kabongo')

    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Final Average</p>
            <p className="mt-2 font-display text-4xl font-bold text-kcs-blue-900 dark:text-white">{reportCard?.average ?? 0}%</p>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{reportCard?.term} - {reportCard?.principalStatus}</p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Transcript</p>
            <p className="mt-2 font-display text-3xl font-bold text-kcs-blue-900 dark:text-white">GPA {transcript?.cumulativeGpa}</p>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{transcript?.credits} credits - {transcript?.status}</p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Teacher Comment</p>
            <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{reportCard?.teacherComment}</p>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="font-bold text-kcs-blue-900 dark:text-white">Current Grades</h2>
              <button className={`${studentActionButton} flex w-full items-center justify-center gap-2 sm:w-auto`} disabled={!clearance?.eligible || clearanceLoading} onClick={downloadReportCard}>
                {clearanceLoading ? <RefreshCw size={16} className="animate-spin" /> : <Download size={16} />}
                {clearanceLoading ? 'Checking EduPay...' : 'Download report card'}
              </button>
            </div>
            {actionMessage && <p className="mb-4 rounded-xl bg-green-50 p-3 text-sm font-semibold text-green-700 dark:bg-green-900/20 dark:text-green-300">{actionMessage}</p>}
            {actionError && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700 dark:bg-red-900/20 dark:text-red-300">{actionError}</p>}
            <div className={`mb-4 rounded-xl border p-4 ${clearance?.eligible ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20' : 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20'}`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-kcs-blue-900 dark:text-white">EduPay financial clearance</p>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{clearanceLoading ? 'Synchronizing the family account...' : clearance?.reason ?? 'Waiting for EduPay verification.'}</p>
                  {clearance && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Balance: ${clearance.balance.toFixed(2)} · Overdue installments: {clearance.overdueInstallments} · {new Date(clearance.synchronizedAt).toLocaleString()}</p>}
                </div>
                <button type="button" onClick={() => void refreshClearance()} disabled={clearanceLoading} className="rounded-xl border border-kcs-blue-200 px-3 py-2 text-xs font-bold text-kcs-blue-700 hover:bg-white disabled:opacity-50 dark:border-kcs-blue-700 dark:text-kcs-blue-200">
                  Refresh
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[620px] w-full text-sm">
                <thead className="text-left text-xs text-gray-400">
                  <tr className="border-b border-gray-100 dark:border-kcs-blue-800">
                    <th className="pb-3 font-medium">Subject</th>
                    <th className="pb-3 font-medium">Latest assessment</th>
                    <th className="pb-3 text-right font-medium">Score</th>
                    <th className="pb-3 text-right font-medium">Letter</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-kcs-blue-800/50">
                  {subjectGrades.map((grade) => (
                    <tr key={grade.subject}>
                      <td className="py-3 font-semibold text-kcs-blue-900 dark:text-white">{grade.subject}</td>
                      <td className="py-3 text-gray-500 dark:text-gray-400">{ecosystemGrades.find((item) => item.subject.includes(grade.subject) || grade.subject.includes(item.subject))?.assessment ?? 'Quarter grade'}</td>
                      <td className="py-3 text-right font-bold text-kcs-blue-700 dark:text-kcs-blue-300">{grade.grade}/100</td>
                      <td className="py-3 text-right"><span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-300">{grade.letter}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
            <h2 className="mb-4 font-bold text-kcs-blue-900 dark:text-white">GPA Trend</h2>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis domain={[2.5, 4]} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#0f2352', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '12px' }} />
                <Area type="monotone" dataKey="gpa" stroke="#1d4ed8" strokeWidth={2.5} fill="#dbeafe" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    )
  }

  if (segment === 'assignments') {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-bold text-kcs-blue-900 dark:text-white">Assignment Center</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Submit work, track deadlines, and keep teachers updated.</p>
            </div>
            <button className={`${studentActionButton} flex w-full items-center justify-center gap-2 sm:w-auto`} onClick={() => void refreshAssignments()} disabled={assignmentLoading}>
              <RefreshCw size={16} className={assignmentLoading ? 'animate-spin' : ''} /> Refresh assignments
            </button>
          </div>
          {actionMessage && <p className="mt-4 rounded-xl bg-green-50 p-3 text-sm font-semibold text-green-700 dark:bg-green-900/20 dark:text-green-300">{actionMessage}</p>}
          {actionError && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700 dark:bg-red-900/20 dark:text-red-300">{actionError}</p>}
          <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(240px,1fr)_180px_180px_160px]">
            <label className="relative">
              <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={assignmentQuery} onChange={(event) => setAssignmentQuery(event.target.value)} placeholder="Search title, course, instructions, deadline..." className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-10 pr-10 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white" />
              {assignmentQuery && <button type="button" onClick={() => setAssignmentQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><X size={16} /></button>}
            </label>
            <select value={assignmentStatus} onChange={(event) => setAssignmentStatus(event.target.value)} className="rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white">
              <option value="all">All statuses</option><option value="pending">Pending</option><option value="submitted">Submitted</option><option value="graded">Graded</option><option value="late">Late</option>
            </select>
            <select value={assignmentCourse} onChange={(event) => setAssignmentCourse(event.target.value)} className="rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white">
              <option value="all">All courses</option>{assignmentCourses.map((course) => <option key={course} value={course}>{course}</option>)}
            </select>
            <select value={assignmentSort} onChange={(event) => setAssignmentSort(event.target.value)} className="rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white">
              <option value="due">Sort by deadline</option><option value="title">Sort by title</option><option value="status">Sort by status</option>
            </select>
          </div>
          <p className="mt-3 text-xs font-semibold text-gray-500 dark:text-gray-400">{filteredAssignments.length} of {localAssignments.length} assignments shown</p>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.txt"
            onChange={async (event) => {
              const file = event.target.files?.[0]
              if (!file || submissionTarget === null) return
              setActionError('')
              try {
                if (typeof submissionTarget === 'string') await studentsAPI.submitMyAssignment(submissionTarget, file.name)
                setLocalAssignments((items) => items.map((item) => item.id === submissionTarget ? { ...item, status: 'submitted' } : item))
                setActionMessage(`${file.name} submitted successfully for teacher review.`)
              } catch (error: any) {
                setActionError(error?.response?.data?.message ?? 'The assignment could not be submitted.')
              } finally {
                event.target.value = ''
                setSubmissionTarget(null)
              }
            }}
          />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {filteredAssignments.map((assignment) => (
            <div key={assignment.id} className={`rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50 border-l-4 ${priorityColors[assignment.priority]}`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold text-kcs-blue-900 dark:text-white">{assignment.title}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{assignment.course} - {assignment.due}</p>
                  {assignment.description && <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{assignment.description}</p>}
                  {assignment.maxScore !== undefined && <p className="mt-2 text-xs font-semibold text-kcs-blue-600 dark:text-kcs-blue-300">Maximum score: {assignment.maxScore} points</p>}
                </div>
                <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusColors[assignment.status]}`}>{assignment.status}</span>
              </div>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button
                  className={studentActionButton}
                  disabled={assignment.status === 'submitted' || assignment.status === 'graded'}
                  onClick={() => { setSubmissionTarget(assignment.id); fileInputRef.current?.click() }}
                >
                  <Upload size={15} className="mr-2 inline" /> Select file & submit
                </button>
                <button
                  className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-kcs-blue-700 transition-colors hover:bg-kcs-blue-50 dark:border-kcs-blue-700 dark:text-kcs-blue-200 dark:hover:bg-kcs-blue-800"
                  onClick={() => {
                    setActionMessage(`${assignment.title}: ${assignment.description ?? 'No additional teacher instructions.'}`)
                  }}
                >
                  View instructions
                </button>
              </div>
            </div>
          ))}
          {!filteredAssignments.length && <div className="rounded-2xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500 dark:border-kcs-blue-700 dark:text-gray-400 lg:col-span-2">No assignment matches the current search and filters.</div>}
        </div>
      </div>
    )
  }

  if (segment === 'diagnostics') {
    const questions = diagnosticQuestions[diagnosticSubject as keyof typeof diagnosticQuestions]
    if (diagnosticResult !== null) return <div className="mx-auto max-w-2xl rounded-2xl border border-gray-100 bg-white p-8 text-center dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50"><CheckCircle2 size={52} className="mx-auto text-green-500" /><h2 className="mt-4 font-display text-3xl font-bold text-kcs-blue-900 dark:text-white">Diagnostic complete</h2><p className="mt-3 text-5xl font-bold text-kcs-blue-700 dark:text-kcs-blue-300">{diagnosticResult}%</p><p className="mt-4 text-gray-600 dark:text-gray-300">{diagnosticResult >= 80 ? 'Strong mastery. Continue with advanced practice.' : diagnosticResult >= 60 ? 'Developing mastery. AI Tutor will reinforce the missed skills.' : 'Foundational support recommended. A personalized revision plan is ready.'}</p><button className={`${studentActionButton} mt-6`} onClick={() => { setDiagnosticResult(null); setDiagnosticStarted(false); setDiagnosticAnswers({}) }}>Take another diagnostic</button></div>
    return <div className="space-y-6"><div className="rounded-2xl border border-gray-100 bg-white p-6 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50"><p className="text-xs font-bold uppercase tracking-wide text-kcs-gold-600">KCS Nexus AI</p><h2 className="mt-2 font-display text-2xl font-bold text-kcs-blue-900 dark:text-white">Diagnostic Test Center</h2><p className="mt-2 text-sm text-gray-500">Choose a subject, answer every question, and receive an immediate mastery score and learning recommendation.</p></div>{!diagnosticStarted ? <div className="grid gap-4 md:grid-cols-3">{Object.keys(diagnosticQuestions).map((subject) => <button key={subject} onClick={() => { setDiagnosticSubject(subject); setDiagnosticStarted(true); setDiagnosticAnswers({}) }} className="rounded-2xl border border-gray-100 bg-white p-6 text-left transition hover:-translate-y-1 hover:border-kcs-blue-300 hover:shadow-kcs dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50"><Brain className="text-kcs-blue-600" /><h3 className="mt-4 text-lg font-bold text-kcs-blue-900 dark:text-white">{subject}</h3><p className="mt-2 text-sm text-gray-500">3 adaptive baseline questions</p><span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-kcs-blue-600"><PlayCircle size={17} /> Take diagnostic test</span></button>)}</div> : <div className="space-y-4"><button onClick={() => setDiagnosticStarted(false)} className="inline-flex items-center gap-2 text-sm font-bold text-kcs-blue-600"><ArrowLeft size={16} /> Subjects</button>{questions.map((question, index) => <section key={question.q} className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50"><p className="text-xs font-bold text-kcs-gold-600">Question {index + 1} of {questions.length}</p><h3 className="mt-2 font-bold text-kcs-blue-900 dark:text-white">{question.q}</h3><div className="mt-4 grid gap-2 sm:grid-cols-2">{question.choices.map((choice, choiceIndex) => <button key={choice} onClick={() => setDiagnosticAnswers((current) => ({ ...current, [index]: choiceIndex }))} className={`rounded-xl border p-3 text-left text-sm ${diagnosticAnswers[index] === choiceIndex ? 'border-kcs-blue-600 bg-kcs-blue-50 text-kcs-blue-800 dark:bg-kcs-blue-800' : 'border-gray-200 dark:border-kcs-blue-700'}`}>{choice}</button>)}</div></section>)}<button disabled={Object.keys(diagnosticAnswers).length !== questions.length} onClick={() => setDiagnosticResult(Math.round((questions.filter((question, index) => diagnosticAnswers[index] === question.answer).length / questions.length) * 100))} className={`${studentActionButton} w-full`}>Submit diagnostic test</button></div>}</div>
  }

  if (segment === 'timetable') {
    const displayedSchedule = liveSchedule.length ? liveSchedule : schedule.map((item, index) => ({ id: `cached-${index}`, day: 'Today', startTime: item.time, endTime: '', room: item.room, teacher: item.teacher, course: { name: item.subject, description: 'Published school schedule.' } }))
    return (
      <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
          <h2 className="mb-4 font-bold text-kcs-blue-900 dark:text-white">Full Timetable</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {displayedSchedule.map((item: any, index: number) => (
              <button type="button" onClick={() => setSelectedSchedule(item)} key={item.id ?? index} className={`rounded-xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${index === 1 ? 'border-kcs-blue-300 bg-kcs-blue-50 dark:border-kcs-blue-600 dark:bg-kcs-blue-800/50' : 'border-gray-100 bg-gray-50 dark:border-kcs-blue-800 dark:bg-kcs-blue-800/30'}`}>
                <p className="text-xs font-semibold text-gray-400">{item.day} · {item.startTime}{item.endTime ? `–${item.endTime}` : ''}</p>
                <p className="mt-1 font-semibold text-kcs-blue-900 dark:text-white">{item.course?.name}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{item.room}{item.teacher ? ` · ${item.teacher}` : ''}</p>
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
          <h2 className="mb-4 font-bold text-kcs-blue-900 dark:text-white">Events Connected to Schedule</h2>
          <div className="space-y-3">
            {ecosystemEvents.filter((item) => item.target.includes('student')).map((event) => (
              <div key={event.title} className="rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-800/30">
                <p className="font-semibold text-kcs-blue-900 dark:text-white">{event.title}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{event.date} - {event.type}</p>
              </div>
            ))}
          </div>
        </div>
        {selectedSchedule && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-kcs-blue-950/55 p-4 backdrop-blur-sm" onClick={() => setSelectedSchedule(null)}><section onClick={(event) => event.stopPropagation()} className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl dark:bg-kcs-blue-950"><div className="flex justify-between"><div><p className="text-xs font-bold uppercase text-kcs-gold-600">{selectedSchedule.day} · {selectedSchedule.startTime}–{selectedSchedule.endTime}</p><h2 className="mt-2 text-2xl font-bold text-kcs-blue-900 dark:text-white">{selectedSchedule.course?.name}</h2></div><button onClick={() => setSelectedSchedule(null)}><X /></button></div><div className="mt-5 space-y-3 text-sm text-gray-600 dark:text-gray-300"><p><strong>Teacher:</strong> {selectedSchedule.teacher || 'Administrative assignment pending'}</p><p><strong>Room:</strong> {selectedSchedule.room}</p><p><strong>Course details:</strong> {selectedSchedule.course?.description || 'No additional details.'}</p><p className="rounded-xl bg-kcs-blue-50 p-3 dark:bg-kcs-blue-900">This slot is synchronized with the general timetable published by administrative staff.</p></div></section></div>}
      </div>
    )
  }

  if (segment === 'messages') {
    return (
      <div className="space-y-5">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50"><div className="flex flex-col gap-3 lg:flex-row"><label className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={17}/><input value={messageQuery} onChange={(event) => setMessageQuery(event.target.value)} placeholder="Search old messages by subject, content, sender..." className="w-full rounded-xl border border-gray-200 py-3 pl-10 pr-4 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white"/></label><select value={messageBox} onChange={(event) => setMessageBox(event.target.value)} className="rounded-xl border border-gray-200 px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white"><option value="all">All messages</option><option value="inbox">Inbox</option><option value="sent">Sent</option></select><button onClick={() => setComposeOpen(true)} className={`${studentActionButton} flex items-center justify-center gap-2`}><Send size={16}/> New message</button></div></div>
        <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
          <section className="max-h-[650px] space-y-2 overflow-y-auto rounded-2xl border border-gray-100 bg-white p-3 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">{assignmentLoading && <p className="p-5 text-center text-sm text-gray-500">Synchronizing...</p>}{messagesList.map((message) => <button key={message.id} onClick={async () => { setSelectedMessage(message); if (!message.readAt && message.recipientId === user?.id) { const response = await messagesAPI.markRead(message.id); setSelectedMessage(response.data.data); setMessagesList((current) => current.map((item) => item.id === message.id ? response.data.data : item)) } }} className={`w-full rounded-xl border p-4 text-left transition hover:border-kcs-blue-300 ${selectedMessage?.id === message.id ? 'border-kcs-blue-500 bg-kcs-blue-50 dark:bg-kcs-blue-800' : 'border-gray-100 bg-gray-50 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/40'}`}><div className="flex justify-between gap-3"><p className="truncate font-bold text-kcs-blue-900 dark:text-white">{message.subject}</p>{!message.readAt && message.recipientId === user?.id && <span className="h-2.5 w-2.5 rounded-full bg-red-500"/>}</div><p className="mt-1 truncate text-xs text-gray-500">{message.sender ? `${message.sender.firstName} ${message.sender.lastName}` : 'School broadcast'} · {new Date(message.createdAt).toLocaleString()}</p><p className="mt-2 line-clamp-2 text-sm text-gray-600 dark:text-gray-300">{message.body}</p></button>)}{!assignmentLoading && !messagesList.length && <p className="p-8 text-center text-sm text-gray-500">No message matches your search.</p>}</section>
          <section className="min-h-[420px] rounded-2xl border border-gray-100 bg-white p-6 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">{selectedMessage ? <><div className="border-b border-gray-100 pb-4 dark:border-kcs-blue-800"><p className="text-xs font-bold uppercase text-kcs-gold-600">{selectedMessage.priority} priority</p><h2 className="mt-2 text-2xl font-bold text-kcs-blue-900 dark:text-white">{selectedMessage.subject}</h2><p className="mt-2 text-sm text-gray-500">From {selectedMessage.sender ? `${selectedMessage.sender.firstName} ${selectedMessage.sender.lastName}` : 'School'} · To {selectedMessage.recipient ? `${selectedMessage.recipient.firstName} ${selectedMessage.recipient.lastName}` : selectedMessage.targetRole ?? 'Audience'} · {new Date(selectedMessage.createdAt).toLocaleString()}</p></div><p className="whitespace-pre-wrap py-6 leading-7 text-gray-700 dark:text-gray-200">{selectedMessage.body}</p><button onClick={() => { setMessageDraft({ recipientId: selectedMessage.senderId ?? '', subject: `Re: ${selectedMessage.subject}`, body: '' }); setComposeOpen(true) }} className={studentActionButton}>Reply in dedicated window</button></> : <div className="flex h-full flex-col items-center justify-center text-center text-gray-500"><Mail size={48} className="mb-4 text-gray-300"/><p>Select a message to open its dedicated window.</p></div>}</section>
        </div>
        {composeOpen && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-kcs-blue-950/55 p-4 backdrop-blur-sm"><form onSubmit={async (event) => { event.preventDefault(); await messagesAPI.send(messageDraft); setComposeOpen(false); setMessageDraft({ recipientId:'', subject:'', body:'' }); setActionMessage('Message sent successfully.'); await loadMessages() }} className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl dark:bg-kcs-blue-950"><div className="flex justify-between"><h2 className="text-xl font-bold text-kcs-blue-900 dark:text-white">New message</h2><button type="button" onClick={() => setComposeOpen(false)}><X/></button></div><div className="mt-5 grid gap-3"><select required value={messageDraft.recipientId} onChange={(event) => setMessageDraft({...messageDraft,recipientId:event.target.value})} className="input-kcs"><option value="">Select recipient</option>{contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.firstName} {contact.lastName} · {contact.role}</option>)}</select><input required value={messageDraft.subject} onChange={(event) => setMessageDraft({...messageDraft,subject:event.target.value})} placeholder="Subject" className="input-kcs"/><textarea required value={messageDraft.body} onChange={(event) => setMessageDraft({...messageDraft,body:event.target.value})} placeholder="Write your message..." className="input-kcs min-h-44"/><button className={studentActionButton}>Send message</button></div></form></div>}
      </div>
    )
  }

  if (segment === 'settings') {
    return <AccountSettingsPanel roleLabel="Student account" />
  }

  if (segment === 'profile') {
    return (
      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-kcs-blue-100 text-xl font-bold text-kcs-blue-700 dark:bg-kcs-blue-800 dark:text-kcs-blue-200">EK</div>
            <div>
              <h2 className="font-display text-2xl font-bold text-kcs-blue-900 dark:text-white">Elise Kabongo</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Grade 11 A - Student ID stu-elise</p>
            </div>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{ecosystemStudents[0].aiInsight}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
          <h2 className="mb-4 font-bold text-kcs-blue-900 dark:text-white">Profile Details</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ['Guardian', 'Rachel Kabongo'],
              ['Email', 'elise.kabongo@student.kcs.test'],
              ['Homeroom', 'Grade 11 - Room 204'],
              ['Counselor', 'Mrs. Diallo'],
              ['Learning plan', 'AP STEM track'],
              ['Documents', 'Transcript, Medical form, Photo ID'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-800/30">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
                <p className="mt-1 font-semibold text-kcs-blue-900 dark:text-white">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return <PortalSectionPanel />
}

const StudentPortal = () => {
  const { user } = useAuthStore()
  const { language } = useUIStore()
  const location = useLocation()
  const activeSegment = getStudentSegment(location.pathname)
  const [activeView, setActiveView] = useState<'dashboard' | 'grades' | 'assignments' | 'schedule' | 'ai-tutor'>('dashboard')
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [portalNotifications, setPortalNotifications] = useState<PortalNotification[]>([])
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const notificationPanelRef = useRef<HTMLDivElement>(null)
  const unreadNotifications = portalNotifications.filter((item) => !item.isRead).length

  const loadNotifications = async () => {
    setNotificationsLoading(true)
    try {
      const response = await notificationsAPI.getAll()
      setPortalNotifications(Array.isArray(response.data.data) ? response.data.data : [])
    } finally {
      setNotificationsLoading(false)
    }
  }

  useEffect(() => { void loadNotifications() }, [])
  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (notificationPanelRef.current && !notificationPanelRef.current.contains(event.target as Node)) setNotificationOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    return () => document.removeEventListener('mousedown', closeOnOutsideClick)
  }, [])

  const markNotificationRead = async (item: PortalNotification) => {
    if (!item.isRead) {
      await notificationsAPI.markRead(item.id)
      setPortalNotifications((current) => current.map((notification) => notification.id === item.id ? { ...notification, isRead: true } : notification))
    }
  }

  return (
    <div className="portal-shell flex">
      <PortalSidebar />

      <main className="min-w-0 flex-1">
        {/* Top Bar */}
        <div className="portal-dashboard-topbar sticky top-0 z-20 border-b px-4 py-3 backdrop-blur-2xl sm:px-6 sm:py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h1 className="portal-dashboard-title font-display text-xl font-bold leading-tight sm:text-2xl">
                {getLocalizedGreeting(language)}, {user?.firstName}!
              </h1>
              <p className="mt-1 text-sm font-medium text-kcs-blue-700 dark:text-kcs-blue-100">
                {getLocalizedPortalDate(language)}
              </p>
            </div>
            <div className="flex w-full items-center gap-2 sm:w-auto sm:gap-3">
              <Link to="/portal/student/ai-tutor" className="btn-gold flex flex-1 items-center justify-center gap-2 py-2 text-sm sm:flex-none">
                <Brain size={16} /> AI Tutor
              </Link>
              <div className="relative" ref={notificationPanelRef}>
                <button type="button" onClick={() => setNotificationOpen((open) => !open)} aria-label={`Notifications, ${unreadNotifications} unread`} aria-expanded={notificationOpen} className="rounded-xl bg-gray-100 p-2 text-gray-600 transition-colors hover:bg-gray-200 dark:bg-kcs-blue-800 dark:text-gray-300 dark:hover:bg-kcs-blue-700">
                  <Bell size={18} />
                  {unreadNotifications > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{unreadNotifications > 9 ? '9+' : unreadNotifications}</span>}
                </button>
                {notificationOpen && (
                  <div className="absolute right-0 top-12 z-50 w-[min(92vw,380px)] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-kcs-blue-700 dark:bg-kcs-blue-950">
                    <div className="flex items-center justify-between border-b border-gray-100 p-4 dark:border-kcs-blue-800">
                      <div><p className="font-bold text-kcs-blue-900 dark:text-white">Notifications</p><p className="text-xs text-gray-500">{unreadNotifications} unread</p></div>
                      <button type="button" disabled={!unreadNotifications} onClick={async () => { await notificationsAPI.markAllRead(); setPortalNotifications((current) => current.map((item) => ({ ...item, isRead: true }))) }} className="text-xs font-bold text-kcs-blue-600 disabled:text-gray-400 dark:text-kcs-blue-300">Mark all read</button>
                    </div>
                    <div className="max-h-[420px] overflow-y-auto p-2">
                      {notificationsLoading && <p className="p-5 text-center text-sm text-gray-500">Loading notifications...</p>}
                      {!notificationsLoading && !portalNotifications.length && <p className="p-5 text-center text-sm text-gray-500">No notifications yet.</p>}
                      {portalNotifications.map((item) => (
                        <button key={item.id} type="button" onClick={() => void markNotificationRead(item)} className={`mb-1 w-full rounded-xl p-3 text-left transition-colors ${item.isRead ? 'hover:bg-gray-50 dark:hover:bg-kcs-blue-900' : 'bg-kcs-blue-50 hover:bg-kcs-blue-100 dark:bg-kcs-blue-900/60'}`}>
                          <div className="flex items-start gap-3"><span className={`mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full ${item.isRead ? 'bg-gray-300' : 'bg-red-500'}`} /><div><p className="text-sm font-bold text-kcs-blue-900 dark:text-white">{item.title}</p><p className="mt-1 text-xs leading-relaxed text-gray-600 dark:text-gray-300">{item.message}</p><p className="mt-1 text-[11px] text-gray-400">{new Date(item.createdAt).toLocaleString()}</p></div></div>
                        </button>
                      ))}
                    </div>
                    <button type="button" onClick={() => void loadNotifications()} className="flex w-full items-center justify-center gap-2 border-t border-gray-100 p-3 text-xs font-bold text-kcs-blue-600 dark:border-kcs-blue-800 dark:text-kcs-blue-300"><RefreshCw size={14} /> Refresh</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6 p-4 sm:p-6">
          {activeSegment !== 'dashboard' ? (
            <StudentSectionView segment={activeSegment} />
          ) : (
            <>
          <PortalSectionPanel />
          <SuggestionBox />

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <h2 className="mb-3 font-bold text-kcs-blue-900 dark:text-white">Academic Identity</h2>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {ecosystemStudents[0].name} • {ecosystemStudents[0].grade} {ecosystemStudents[0].section} • {academicContext.term}
              </p>
              <p className="mt-3 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{ecosystemStudents[0].aiInsight}</p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <h2 className="mb-3 font-bold text-kcs-blue-900 dark:text-white">School Alerts</h2>
              <div className="space-y-2">
                {ecosystemAnnouncements.filter((item) => item.audience.includes('student')).slice(0, 3).map((item) => (
                  <div key={item.id} className="rounded-xl bg-gray-50 p-3 text-sm dark:bg-kcs-blue-800/30">
                    <p className="font-semibold text-kcs-blue-900 dark:text-white">{item.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{item.date}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <h2 className="mb-3 font-bold text-kcs-blue-900 dark:text-white">AI Learning Coach</h2>
              <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                Build a study plan, revise difficult topics, generate practice questions, and prepare for {academicContext.nextExamWindow}.
              </p>
              <Link to="/portal/student/ai-tutor" className="mt-4 inline-flex w-full justify-center rounded-xl bg-kcs-blue-700 px-4 py-3 text-sm font-semibold text-white hover:bg-kcs-blue-800">
                Open AI Tutor
              </Link>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Current GPA', value: '3.9', sub: '+0.1 this semester', icon: Award, color: 'text-kcs-gold-600', bg: 'bg-kcs-gold-50 dark:bg-kcs-gold-900/20' },
              { label: 'Attendance', value: '97%', sub: '2 absences this year', icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
              { label: 'Assignments Due', value: '2', sub: 'This week', icon: FileText, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20' },
              { label: 'Rank', value: '#5', sub: 'Out of 112 students', icon: TrendingUp, color: 'text-kcs-blue-600', bg: 'bg-kcs-blue-50 dark:bg-kcs-blue-900/20' },
            ].map(({ label, value, sub, icon: Icon, color, bg }) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-kcs-blue-900/50 rounded-2xl p-5 border border-gray-100 dark:border-kcs-blue-800 hover:shadow-kcs transition-all duration-300"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center`}>
                    <Icon size={20} className={color} />
                  </div>
                </div>
                <p className="text-2xl font-bold font-display text-kcs-blue-900 dark:text-white">{value}</p>
                <p className="text-xs font-medium text-gray-600 dark:text-gray-300">{label}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>
              </motion.div>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <h2 className="mb-4 font-bold text-kcs-blue-900 dark:text-white">Latest Teacher Updates</h2>
              <div className="space-y-3">
                {ecosystemGrades.filter((grade) => grade.studentId === 'stu-elise').slice(0, 3).map((grade) => (
                  <div key={`${grade.subject}-${grade.assessment}`} className="rounded-xl bg-gray-50 p-3 dark:bg-kcs-blue-800/30">
                    <p className="text-sm font-semibold text-kcs-blue-900 dark:text-white">{grade.subject}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{grade.assessment} • {grade.score}/{grade.max} • {grade.teacher}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <h2 className="mb-4 font-bold text-kcs-blue-900 dark:text-white">Deadlines</h2>
              <div className="space-y-3">
                {ecosystemAssignments.filter((item) => item.studentId === 'stu-elise').map((item) => (
                  <div key={item.id} className="rounded-xl bg-gray-50 p-3 dark:bg-kcs-blue-800/30">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-kcs-blue-900 dark:text-white">{item.title}</p>
                      <span className="rounded-full bg-orange-100 px-2 py-1 text-xs font-semibold capitalize text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">{item.status}</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{item.subject} • {item.due}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <h2 className="mb-4 font-bold text-kcs-blue-900 dark:text-white">Calendar</h2>
              <div className="space-y-3">
                {ecosystemEvents.filter((item) => item.target.includes('student')).map((item) => (
                  <div key={item.title} className="rounded-xl bg-gray-50 p-3 dark:bg-kcs-blue-800/30">
                    <p className="text-sm font-semibold text-kcs-blue-900 dark:text-white">{item.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{item.date} • {item.type}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-4">
            <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <h2 className="mb-4 font-bold text-kcs-blue-900 dark:text-white">Report Card</h2>
              {reportCards.filter((card) => card.student === 'Elise Kabongo').map((card) => (
                <div key={card.student} className="rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-800/30">
                  <p className="font-display text-3xl font-bold text-kcs-blue-900 dark:text-white">{card.average}%</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{card.term} • {card.principalStatus}</p>
                  <p className="mt-2 text-xs leading-relaxed text-gray-600 dark:text-gray-300">{card.teacherComment}</p>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <h2 className="mb-4 font-bold text-kcs-blue-900 dark:text-white">Transcript</h2>
              {transcripts.filter((item) => item.student === 'Elise Kabongo').map((item) => (
                <div key={item.student} className="rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-800/30">
                  <p className="font-semibold text-kcs-blue-900 dark:text-white">{item.years}</p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{item.credits} credits • GPA {item.cumulativeGpa}</p>
                  <p className="mt-2 text-xs font-semibold text-green-600 dark:text-green-300">{item.status}</p>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <h2 className="mb-4 font-bold text-kcs-blue-900 dark:text-white">Learning Resources</h2>
              <div className="space-y-3">
                {lmsResources.filter((item) => item.audience.includes('student')).slice(0, 2).map((resource) => (
                  <div key={resource.title} className="rounded-xl bg-gray-50 p-3 dark:bg-kcs-blue-800/30">
                    <p className="text-sm font-semibold text-kcs-blue-900 dark:text-white">{resource.title}</p>
                    <p className="text-xs capitalize text-gray-500 dark:text-gray-400">{resource.type} • {resource.subject}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <h2 className="mb-4 font-bold text-kcs-blue-900 dark:text-white">Messages</h2>
              <div className="space-y-3">
                {internalThreads.filter((thread) => thread.participants.includes('Rachel Kabongo') || thread.participants.includes('Administration')).slice(0, 2).map((thread) => (
                  <div key={thread.subject} className="rounded-xl bg-gray-50 p-3 dark:bg-kcs-blue-800/30">
                    <p className="text-sm font-semibold text-kcs-blue-900 dark:text-white">{thread.subject}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{thread.channel} • {thread.unread} unread</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Performance Chart */}
            <div className="lg:col-span-2 bg-white dark:bg-kcs-blue-900/50 rounded-2xl p-6 border border-gray-100 dark:border-kcs-blue-800">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-bold text-kcs-blue-900 dark:text-white">GPA Trend This Year</h2>
                <span className="badge-blue text-xs">Grade 11 — 2025/26</span>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={performanceData}>
                  <defs>
                    <linearGradient id="gpagradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1d4ed8" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#1d4ed8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,58,138,0.1)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[2.5, 4.0]} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#0f2352', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                    formatter={(value: number) => [`GPA: ${value}`, '']}
                  />
                  <Area type="monotone" dataKey="gpa" stroke="#1d4ed8" strokeWidth={2.5} fill="url(#gpagradient)" dot={{ r: 4, fill: '#1d4ed8' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Notifications */}
            <div className="bg-white dark:bg-kcs-blue-900/50 rounded-2xl p-5 border border-gray-100 dark:border-kcs-blue-800">
              <h2 className="font-bold text-kcs-blue-900 dark:text-white mb-4 flex items-center gap-2">
                <Bell size={18} className="text-kcs-gold-500" /> Notifications
              </h2>
              <div className="space-y-3">
                {notifications.map((n) => (
                  <div key={n.id} className="flex gap-3 p-3 rounded-xl bg-gray-50 dark:bg-kcs-blue-800/50">
                    {n.type === 'warning' && <AlertCircle size={18} className="text-yellow-500 flex-shrink-0 mt-0.5" />}
                    {n.type === 'success' && <CheckCircle2 size={18} className="text-green-500 flex-shrink-0 mt-0.5" />}
                    {n.type === 'info' && <Bell size={18} className="text-kcs-blue-500 flex-shrink-0 mt-0.5" />}
                    <div>
                      <p className="text-xs text-gray-700 dark:text-gray-300">{n.message}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{n.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Subject Grades */}
            <div className="bg-white dark:bg-kcs-blue-900/50 rounded-2xl p-6 border border-gray-100 dark:border-kcs-blue-800">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-bold text-kcs-blue-900 dark:text-white flex items-center gap-2">
                  <BarChart3 size={18} className="text-kcs-blue-600 dark:text-kcs-blue-400" /> Current Grades
                </h2>
                <Link to="/portal/student/grades" className="text-xs text-kcs-blue-600 dark:text-kcs-blue-400 font-semibold flex items-center gap-1 hover:gap-1.5">
                  Full Report <ChevronRight size={14} />
                </Link>
              </div>
              <div className="space-y-3">
                {subjectGrades.map(({ subject, grade, letter }) => (
                  <div key={subject} className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-20 flex-shrink-0">{subject}</span>
                    <div className="flex-1 h-2 bg-gray-100 dark:bg-kcs-blue-800 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${grade}%` }}
                        transition={{ duration: 1, delay: 0.2 }}
                        className={`h-full rounded-full ${
                          grade >= 90 ? 'bg-green-500' : grade >= 80 ? 'bg-kcs-blue-500' : grade >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                      />
                    </div>
                    <span className={`text-xs font-bold w-8 text-center px-1.5 py-0.5 rounded-md ${
                      grade >= 90 ? 'bg-green-100 text-green-700 dark:bg-green-900/30' :
                      grade >= 80 ? 'bg-kcs-blue-100 text-kcs-blue-700 dark:bg-kcs-blue-900/30' :
                      'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30'
                    }`}>
                      {letter}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Upcoming Assignments */}
            <div className="bg-white dark:bg-kcs-blue-900/50 rounded-2xl p-6 border border-gray-100 dark:border-kcs-blue-800">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-bold text-kcs-blue-900 dark:text-white flex items-center gap-2">
                  <FileText size={18} className="text-orange-500" /> Assignments
                </h2>
                <Link to="/portal/student/assignments" className="text-xs text-kcs-blue-600 dark:text-kcs-blue-400 font-semibold flex items-center gap-1 hover:gap-1.5">
                  View All <ChevronRight size={14} />
                </Link>
              </div>
              <div className="space-y-3">
                {assignments.map((a) => (
                  <div
                    key={a.id}
                    className={`p-4 rounded-xl border-l-4 ${priorityColors[a.priority]} bg-gray-50 dark:bg-kcs-blue-800/50 border border-gray-100 dark:border-transparent`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-kcs-blue-900 dark:text-white truncate">{a.title}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{a.course}</p>
                        <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-400">
                          <Clock size={11} /> {a.due}
                        </div>
                      </div>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap flex-shrink-0 capitalize ${statusColors[a.status]}`}>
                        {a.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Today's Schedule */}
          <div className="bg-white dark:bg-kcs-blue-900/50 rounded-2xl p-6 border border-gray-100 dark:border-kcs-blue-800">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-kcs-blue-900 dark:text-white flex items-center gap-2">
                <Calendar size={18} className="text-purple-500" /> Today's Schedule
              </h2>
              <Link to="/portal/student/timetable" className="text-xs text-kcs-blue-600 dark:text-kcs-blue-400 font-semibold flex items-center gap-1 hover:gap-1.5">
                Full Timetable <ChevronRight size={14} />
              </Link>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {schedule.map((item, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-xl border ${
                    i === 1 ? 'border-kcs-blue-300 bg-kcs-blue-50 dark:bg-kcs-blue-800/50 dark:border-kcs-blue-600' :
                    'border-gray-100 dark:border-kcs-blue-800 bg-gray-50 dark:bg-kcs-blue-800/20'
                  }`}
                >
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">{item.time}</p>
                  <p className={`text-sm font-semibold ${i === 1 ? 'text-kcs-blue-700 dark:text-kcs-blue-300' : 'text-kcs-blue-900 dark:text-white'}`}>
                    {item.subject}
                  </p>
                  {item.teacher && <p className="text-xs text-gray-500 dark:text-gray-400">{item.teacher}</p>}
                  <p className="text-xs text-gray-400 dark:text-gray-500">{item.room}</p>
                  {i === 1 && (
                    <span className="inline-block mt-1 text-xs bg-kcs-blue-200 dark:bg-kcs-blue-700 text-kcs-blue-700 dark:text-kcs-blue-200 px-2 py-0.5 rounded-full font-medium">
                      Current
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-6 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-bold text-kcs-blue-900 dark:text-white">Attendance Analytics</h2>
              <span className="badge-gold text-xs">Visible to parents and staff</span>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {attendanceAnalytics.map((item) => (
                <div key={item.scope} className="rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-800/30">
                  <p className="font-semibold text-kcs-blue-900 dark:text-white">{item.scope}</p>
                  <p className="mt-2 text-2xl font-bold text-kcs-blue-700 dark:text-kcs-blue-300">{item.present}%</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{item.late}% late • {item.absent}% absent • {item.trend}</p>
                </div>
              ))}
            </div>
          </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}

export default StudentPortal
