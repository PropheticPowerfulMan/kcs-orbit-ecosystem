import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LayoutDashboard, BarChart3, FileText, Calendar, Brain,
  Bell, BookOpen, TrendingUp, Award, Clock, CheckCircle2,
  AlertCircle, ChevronRight, MessageSquare, User
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import PortalSidebar from '@/components/layout/PortalSidebar'
import PortalSectionPanel from '@/components/shared/PortalSectionPanel'
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

const StudentSectionView = ({ segment }: { segment: string }) => {
  const [localAssignments, setLocalAssignments] = useState(assignments)
  const [messageSent, setMessageSent] = useState(false)
  const [actionMessage, setActionMessage] = useState('')

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
              <button className={`${studentActionButton} w-full sm:w-auto`} onClick={() => setActionMessage('Report card download prepared for your student file.')}>Download report card</button>
            </div>
            {actionMessage && <p className="mb-4 rounded-xl bg-green-50 p-3 text-sm font-semibold text-green-700 dark:bg-green-900/20 dark:text-green-300">{actionMessage}</p>}
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
            <button
              className={`${studentActionButton} w-full sm:w-auto`}
              onClick={() => {
                const nextAssignment = {
                  id: Date.now(),
                  title: 'Uploaded student file',
                  course: 'Teacher review',
                  due: 'Submitted now',
                  status: 'submitted',
                  priority: 'low',
                }
                setLocalAssignments((items) => [nextAssignment, ...items])
                setActionMessage('File uploaded and added to the assignment center for teacher review.')
              }}
            >
              Upload new file
            </button>
          </div>
          {actionMessage && <p className="mt-4 rounded-xl bg-green-50 p-3 text-sm font-semibold text-green-700 dark:bg-green-900/20 dark:text-green-300">{actionMessage}</p>}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {localAssignments.map((assignment) => (
            <div key={assignment.id} className={`rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50 border-l-4 ${priorityColors[assignment.priority]}`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold text-kcs-blue-900 dark:text-white">{assignment.title}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{assignment.course} - {assignment.due}</p>
                </div>
                <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusColors[assignment.status]}`}>{assignment.status}</span>
              </div>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button
                  className={studentActionButton}
                  disabled={assignment.status === 'submitted' || assignment.status === 'graded'}
                  onClick={() => {
                    setLocalAssignments((items) => items.map((item) => item.id === assignment.id ? { ...item, status: 'submitted' } : item))
                    setActionMessage(`${assignment.title} submitted successfully.`)
                  }}
                >
                  Submit work
                </button>
                <button
                  className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-kcs-blue-700 transition-colors hover:bg-kcs-blue-50 dark:border-kcs-blue-700 dark:text-kcs-blue-200 dark:hover:bg-kcs-blue-800"
                  onClick={() => {
                    setLocalAssignments((items) => items.map((item) => item.id === assignment.id ? { ...item, status: 'graded' } : item))
                    setActionMessage(`${assignment.title} marked as reviewed.`)
                  }}
                >
                  Mark reviewed
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (segment === 'timetable') {
    return (
      <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
          <h2 className="mb-4 font-bold text-kcs-blue-900 dark:text-white">Full Timetable</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {schedule.map((item, index) => (
              <div key={`${item.time}-${item.subject}`} className={`rounded-xl border p-4 ${index === 1 ? 'border-kcs-blue-300 bg-kcs-blue-50 dark:border-kcs-blue-600 dark:bg-kcs-blue-800/50' : 'border-gray-100 bg-gray-50 dark:border-kcs-blue-800 dark:bg-kcs-blue-800/30'}`}>
                <p className="text-xs font-semibold text-gray-400">{item.time}</p>
                <p className="mt-1 font-semibold text-kcs-blue-900 dark:text-white">{item.subject}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{item.room}{item.teacher ? ` - ${item.teacher}` : ''}</p>
              </div>
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
      </div>
    )
  }

  if (segment === 'messages') {
    return (
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
          <h2 className="mb-4 font-bold text-kcs-blue-900 dark:text-white">Inbox</h2>
          <div className="space-y-3">
            {internalThreads.slice(0, 4).map((thread) => (
              <button key={thread.subject} className="w-full rounded-xl bg-gray-50 p-4 text-left transition-colors hover:bg-kcs-blue-50 dark:bg-kcs-blue-800/30 dark:hover:bg-kcs-blue-800">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-kcs-blue-900 dark:text-white">{thread.subject}</p>
                  <span className="rounded-full bg-kcs-blue-100 px-2 py-1 text-xs font-semibold text-kcs-blue-700 dark:bg-kcs-blue-900/40 dark:text-kcs-blue-300">{thread.unread}</span>
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{thread.channel} - {thread.participants.join(', ')}</p>
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
          <h2 className="mb-4 font-bold text-kcs-blue-900 dark:text-white">New Message</h2>
          <div className="grid gap-3">
            <select className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white">
              <option>Academic Office</option>
              <option>Mrs. Diallo - English</option>
              <option>Mr. Belanger - AP Calculus</option>
            </select>
            <input className="rounded-xl border border-gray-200 px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white" placeholder="Subject" />
            <textarea className="min-h-36 rounded-xl border border-gray-200 px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white" placeholder="Write your message..." />
            <button className={studentActionButton} onClick={() => setMessageSent(true)}>Send message</button>
            {messageSent && <p className="rounded-xl bg-green-50 p-3 text-sm font-semibold text-green-700 dark:bg-green-900/20 dark:text-green-300">Message prepared and saved in the portal thread.</p>}
          </div>
        </div>
      </div>
    )
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
  const location = useLocation()
  const activeSegment = getStudentSegment(location.pathname)
  const [activeView, setActiveView] = useState<'dashboard' | 'grades' | 'assignments' | 'schedule' | 'ai-tutor'>('dashboard')

  return (
    <div className="portal-shell flex">
      <PortalSidebar />

      <main className="min-w-0 flex-1">
        {/* Top Bar */}
        <div className="sticky top-0 z-20 border-b border-gray-100 bg-white/90 px-4 py-3 backdrop-blur-md dark:border-kcs-blue-800 dark:bg-kcs-blue-950/90 sm:px-6 sm:py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h1 className="truncate font-display text-lg font-bold text-kcs-blue-900 dark:text-white sm:text-xl">
                Good morning, {user?.firstName}! 👋
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
            <div className="flex w-full items-center gap-2 sm:w-auto sm:gap-3">
              <Link to="/portal/student/ai-tutor" className="btn-gold flex flex-1 items-center justify-center gap-2 py-2 text-sm sm:flex-none">
                <Brain size={16} /> AI Tutor
              </Link>
              <div className="relative">
                <button className="rounded-xl bg-gray-100 p-2 text-gray-600 transition-colors hover:bg-gray-200 dark:bg-kcs-blue-800 dark:text-gray-300 dark:hover:bg-kcs-blue-700">
                  <Bell size={18} />
                  <span className="absolute top-1 right-1 w-3 h-3 bg-red-500 rounded-full text-xs" />
                </button>
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
