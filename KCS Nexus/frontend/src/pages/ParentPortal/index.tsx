import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Bell, TrendingUp, Award, CheckCircle2, AlertCircle,
  FileText, Calendar, MessageSquare, ChevronRight,
  Clock, BookOpen, BarChart3, User, Phone, Mail
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import PortalSidebar from '@/components/layout/PortalSidebar'
import PortalSectionPanel from '@/components/shared/PortalSectionPanel'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis
} from 'recharts'
import {
  announcements as ecosystemAnnouncements,
  assignments as ecosystemAssignments,
  attendance as ecosystemAttendance,
  aiSignals,
  aiRecommendations,
  events as ecosystemEvents,
  feeAccounts,
  grades as ecosystemGrades,
  internalThreads,
  reportCards,
  students as ecosystemStudents,
} from '@/data/schoolEcosystem'

/* ────────────────── Mock data ────────────────── */
const children = [
  { id: '1', name: 'Elise Kabongo', grade: 'Grade 11', avatar: null, gpa: 3.9, attendance: 97, rank: 5 },
  { id: '2', name: 'David Kabongo', grade: 'Grade 8',  avatar: null, gpa: 3.5, attendance: 94, rank: 12 },
]

const performanceHistory = [
  { month: 'Sep', elise: 3.2, david: 3.0 },
  { month: 'Oct', elise: 3.4, david: 3.2 },
  { month: 'Nov', elise: 3.3, david: 3.1 },
  { month: 'Dec', elise: 3.6, david: 3.4 },
  { month: 'Jan', elise: 3.5, david: 3.3 },
  { month: 'Feb', elise: 3.7, david: 3.6 },
  { month: 'Mar', elise: 3.8, david: 3.5 },
  { month: 'Apr', elise: 3.9, david: 3.5 },
]

const radarData = [
  { subject: 'Math',    elise: 92, david: 78 },
  { subject: 'Science', elise: 95, david: 82 },
  { subject: 'English', elise: 88, david: 75 },
  { subject: 'History', elise: 85, david: 90 },
  { subject: 'French',  elise: 90, david: 72 },
  { subject: 'Bible',   elise: 97, david: 95 },
]

const recentGrades = [
  { child: 'Elise', course: 'AP Biology', assessment: 'Lab Report', grade: 95, max: 100, date: 'Apr 18' },
  { child: 'Elise', course: 'AP Calculus', assessment: 'Quiz #7', grade: 89, max: 100, date: 'Apr 17' },
  { child: 'David', course: 'Pre-Algebra', assessment: 'Chapter Test', grade: 83, max: 100, date: 'Apr 16' },
  { child: 'Elise', course: 'English Literature', assessment: 'Essay Draft', grade: 91, max: 100, date: 'Apr 15' },
  { child: 'David', course: 'World Geography', assessment: 'Map Quiz', grade: 88, max: 100, date: 'Apr 14' },
]

const upcomingEvents = [
  { date: 'Apr 25', title: 'Parent-Teacher Conferences', type: 'meeting', desc: 'Sign up for your slot online' },
  { date: 'May 3',  title: 'AP Exams Begin (Elise)', type: 'exam',    desc: 'AP Calculus, AP Biology' },
  { date: 'May 12', title: 'Spring Music Concert', type: 'event',   desc: 'Gymnasium, 6 PM' },
  { date: 'May 20', title: 'End-of-Year Awards Ceremony', type: 'event', desc: 'All families invited' },
]

const teacherMessages = [
  {
    id: 1,
    teacher: 'Mrs. Diallo',
    subject: 'English Literature',
    message: "Elise's essay on The Great Gatsby was outstanding. She demonstrates strong critical thinking.",
    time: '2h ago',
    child: 'Elise',
    read: false,
  },
  {
    id: 2,
    teacher: 'Mr. Belanger',
    subject: 'AP Calculus',
    message: "David needs extra practice on fractions. I recommend 30 minutes daily with the AI Tutor.",
    time: '1d ago',
    child: 'David',
    read: true,
  },
  {
    id: 3,
    teacher: 'Dr. Mukendi',
    subject: 'AP Biology',
    message: "Elise is performing exceptionally well this semester. Consider entering her into the Science Fair.",
    time: '3d ago',
    child: 'Elise',
    read: true,
  },
]

const notifications = [
  { id: 1, type: 'success', message: 'Elise ranked #5 in her class — up from #7 last month!', time: '1h ago' },
  { id: 2, type: 'info',    message: 'Parent-Teacher conferences registration opens tomorrow.', time: '4h ago' },
  { id: 3, type: 'warning', message: "David's Math grade dropped below 80% — check with teacher.", time: '2d ago' },
]

const eventTypeColor = {
  meeting: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  exam:    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  event:   'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
}

const getParentSegment = (pathname: string) => {
  const segment = pathname.split('/').filter(Boolean).at(-1)
  return !segment || segment === 'parent' || segment === 'dashboard' ? 'dashboard' : segment
}

const parentButton = 'rounded-xl bg-kcs-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-kcs-blue-800'

type ParentChild = typeof children[number]

const ParentSectionView = ({ segment, selectedChild }: { segment: string; selectedChild: ParentChild }) => {
  const [bookedEvent, setBookedEvent] = useState<string | null>(null)
  const [messageSent, setMessageSent] = useState(false)
  const [actionMessage, setActionMessage] = useState('')
  const [paidInvoices, setPaidInvoices] = useState<string[]>([])
  const childKey = selectedChild.name.split(' ')[0].toLowerCase() as 'elise' | 'david'
  const childFirstName = selectedChild.name.split(' ')[0]

  if (segment === 'performance' || segment === 'grades') {
    const childReport = reportCards.find((card) => card.student.includes(childFirstName))
    const childGrades = recentGrades.filter((grade) => grade.child === childFirstName)

    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            ['GPA', selectedChild.gpa.toFixed(1), 'Semester average'],
            ['Attendance', `${selectedChild.attendance}%`, 'Family visible'],
            ['Class Rank', `#${selectedChild.rank}`, selectedChild.grade],
          ].map(([label, value, sub]) => (
            <div key={label} className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
              <p className="mt-2 font-display text-4xl font-bold text-kcs-blue-900 dark:text-white">{value}</p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{sub}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
          <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="font-bold text-kcs-blue-900 dark:text-white">{selectedChild.name} Grades</h2>
              <button className={`${parentButton} w-full sm:w-auto`} onClick={() => setActionMessage(`${selectedChild.name}'s parent copy is ready to download.`)}>Download parent copy</button>
            </div>
            {actionMessage && <p className="mb-4 rounded-xl bg-green-50 p-3 text-sm font-semibold text-green-700 dark:bg-green-900/20 dark:text-green-300">{actionMessage}</p>}
            <div className="overflow-x-auto">
              <table className="min-w-[620px] w-full text-sm">
                <thead className="text-left text-xs text-gray-400">
                  <tr className="border-b border-gray-100 dark:border-kcs-blue-800">
                    <th className="pb-3 font-medium">Course</th>
                    <th className="pb-3 font-medium">Assessment</th>
                    <th className="pb-3 text-right font-medium">Grade</th>
                    <th className="pb-3 text-right font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-kcs-blue-800/50">
                  {(childGrades.length ? childGrades : recentGrades.filter((grade) => grade.child === 'Elise')).map((grade) => (
                    <tr key={`${grade.course}-${grade.assessment}`}>
                      <td className="py-3 font-semibold text-kcs-blue-900 dark:text-white">{grade.course}</td>
                      <td className="py-3 text-gray-500 dark:text-gray-400">{grade.assessment}</td>
                      <td className="py-3 text-right font-bold text-kcs-blue-700 dark:text-kcs-blue-300">{grade.grade}/{grade.max}</td>
                      <td className="py-3 text-right text-gray-500 dark:text-gray-400">{grade.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {childReport && <p className="mt-4 rounded-xl bg-kcs-blue-50 p-4 text-sm text-kcs-blue-800 dark:bg-kcs-blue-900/30 dark:text-kcs-blue-200">{childReport.teacherComment}</p>}
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
            <h2 className="mb-4 font-bold text-kcs-blue-900 dark:text-white">Subject Balance</h2>
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: '#64748b' }} />
                <Radar dataKey={childKey} stroke="#1d4ed8" fill="#1d4ed8" fillOpacity={0.22} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    )
  }

  if (segment === 'messages') {
    const childMessages = teacherMessages.filter((message) => message.child === childFirstName)
    return (
      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
          <h2 className="mb-4 font-bold text-kcs-blue-900 dark:text-white">Teacher Threads</h2>
          <div className="space-y-3">
            {(childMessages.length ? childMessages : teacherMessages).map((message) => (
              <div key={message.id} className="rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-800/30">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <p className="font-semibold text-kcs-blue-900 dark:text-white">{message.teacher}</p>
                  <span className="text-xs font-semibold text-kcs-blue-600 dark:text-kcs-blue-300">{message.subject}</span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{message.message}</p>
                <p className="mt-2 text-xs text-gray-400">{message.time}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
          <h2 className="mb-4 font-bold text-kcs-blue-900 dark:text-white">Write to School</h2>
          <div className="grid gap-3">
            <select className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white">
              <option>Homeroom Teacher</option>
              <option>Academic Office</option>
              <option>Finance Office</option>
              <option>Discipline Office</option>
            </select>
            <input className="rounded-xl border border-gray-200 px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white" value={`Regarding ${selectedChild.name}`} readOnly />
            <textarea className="min-h-36 rounded-xl border border-gray-200 px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white" placeholder="Type parent message..." />
            <button className={parentButton} onClick={() => setMessageSent(true)}>Send message</button>
            {messageSent && <p className="rounded-xl bg-green-50 p-3 text-sm font-semibold text-green-700 dark:bg-green-900/20 dark:text-green-300">Message saved for school communication and parent history.</p>}
          </div>
        </div>
      </div>
    )
  }

  if (segment === 'calendar') {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {upcomingEvents.map((event) => (
          <div key={event.title} className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-bold text-kcs-blue-700 dark:text-kcs-blue-300">{event.date}</span>
              <span className={`rounded-full px-2 py-1 text-xs font-semibold capitalize ${eventTypeColor[event.type as keyof typeof eventTypeColor]}`}>{event.type}</span>
            </div>
            <p className="mt-3 font-semibold text-kcs-blue-900 dark:text-white">{event.title}</p>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{event.desc}</p>
            <button className="mt-4 w-full rounded-xl border border-kcs-blue-200 px-4 py-2.5 text-sm font-semibold text-kcs-blue-700 hover:bg-kcs-blue-50 dark:border-kcs-blue-700 dark:text-kcs-blue-200 dark:hover:bg-kcs-blue-800" onClick={() => setBookedEvent(event.title)}>
              {bookedEvent === event.title ? 'Added to family plan' : 'Add / book'}
            </button>
          </div>
        ))}
      </div>
    )
  }

  if (segment === 'finance') {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          {feeAccounts.filter((fee) => fee.family === 'Kabongo Family').map((fee) => (
            <div key={fee.invoice} className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{fee.invoice}</p>
              <p className="mt-2 font-display text-3xl font-bold text-kcs-blue-900 dark:text-white">${paidInvoices.includes(fee.invoice) ? 0 : fee.balance}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{fee.student} - due {fee.dueDate}</p>
              <button
                className="mt-4 w-full rounded-xl bg-kcs-gold-500 px-4 py-2.5 text-sm font-bold text-kcs-blue-950 hover:bg-kcs-gold-400"
                onClick={() => {
                  setPaidInvoices((items) => items.includes(fee.invoice) ? items : [...items, fee.invoice])
                  setActionMessage(`${fee.invoice} receipt prepared for ${fee.student}.`)
                }}
              >
                {paidInvoices.includes(fee.invoice) ? 'Receipt ready' : 'Pay / receipt'}
              </button>
            </div>
          ))}
        </div>
        {actionMessage && <p className="rounded-xl bg-green-50 p-3 text-sm font-semibold text-green-700 dark:bg-green-900/20 dark:text-green-300">{actionMessage}</p>}
      </div>
    )
  }

  if (segment === 'profile') {
    return (
      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
          <h2 className="font-display text-2xl font-bold text-kcs-blue-900 dark:text-white">Kabongo Family</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Parent portal for Rachel Kabongo, guardian contacts, children, school documents, and communication preferences.</p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <a className="rounded-xl bg-kcs-blue-700 px-4 py-2.5 text-center text-sm font-semibold text-white" href="mailto:rachel.kabongo@family.kcs.test">Email</a>
            <a className="rounded-xl border border-gray-200 px-4 py-2.5 text-center text-sm font-semibold text-kcs-blue-700 dark:border-kcs-blue-700 dark:text-kcs-blue-200" href="tel:+243810000001">Call</a>
          </div>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
          <h2 className="mb-4 font-bold text-kcs-blue-900 dark:text-white">Children & Documents</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {children.map((child) => (
              <div key={child.id} className="rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-800/30">
                <p className="font-semibold text-kcs-blue-900 dark:text-white">{child.name}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{child.grade} - GPA {child.gpa}</p>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Documents: report card, transcript request, medical form</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return <PortalSectionPanel />
}

const ParentPortal = () => {
  const { user } = useAuthStore()
  const location = useLocation()
  const activeSegment = getParentSegment(location.pathname)
  const [selectedChild, setSelectedChild] = useState(children[0])

  return (
    <div className="portal-shell flex">
      <PortalSidebar />

      <main className="min-w-0 flex-1">
        {/* Top Bar */}
        <div className="sticky top-0 z-20 border-b border-gray-100 bg-white/90 px-4 py-3 backdrop-blur-md dark:border-kcs-blue-800 dark:bg-kcs-blue-950/90 sm:px-6 sm:py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <h1 className="truncate font-display text-lg font-bold text-kcs-blue-900 dark:text-white sm:text-xl">
                Welcome, {user?.firstName}! 👨‍👩‍👧‍👦
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:w-auto lg:gap-3">
              {/* Child selector */}
              <div className="flex w-full overflow-hidden rounded-xl border border-gray-200 dark:border-kcs-blue-700 sm:w-auto">
                {children.map((child) => (
                  <button
                    key={child.id}
                    onClick={() => setSelectedChild(child)}
                    className={`flex-1 px-4 py-2 text-sm font-medium transition-colors sm:flex-none ${
                      selectedChild.id === child.id
                        ? 'kcs-gradient text-white'
                        : 'bg-white dark:bg-kcs-blue-900 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-kcs-blue-800'
                    }`}
                  >
                    {child.name.split(' ')[0]}
                  </button>
                ))}
              </div>
              <div className="relative">
                <button className="rounded-xl bg-gray-100 p-2 text-gray-600 transition-colors hover:bg-gray-200 dark:bg-kcs-blue-800 dark:text-gray-300 dark:hover:bg-kcs-blue-700">
                  <Bell size={18} />
                  <span className="absolute top-1 right-1 w-3 h-3 bg-red-500 rounded-full" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-6">
          {activeSegment !== 'dashboard' ? (
            <ParentSectionView segment={activeSegment} selectedChild={selectedChild} />
          ) : (
            <>
          <PortalSectionPanel />

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <h2 className="mb-3 font-bold text-kcs-blue-900 dark:text-white">School Information</h2>
              <div className="space-y-3">
                {ecosystemAnnouncements.filter((item) => item.audience.includes('parent')).map((item) => (
                  <div key={item.id} className="rounded-xl bg-gray-50 p-3 dark:bg-kcs-blue-800/30">
                    <p className="text-sm font-semibold text-kcs-blue-900 dark:text-white">{item.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{item.date} • {item.priority} priority</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <h2 className="mb-3 font-bold text-kcs-blue-900 dark:text-white">Parent Responsibilities</h2>
              <div className="space-y-3 text-sm">
                {['Confirm David math intervention message', 'Review updated parent rights and duties', 'Upload medical form before May 1', 'Book parent-teacher conference slot'].map((item) => (
                  <div key={item} className="flex items-start gap-2 rounded-xl bg-gray-50 p-3 text-gray-700 dark:bg-kcs-blue-800/30 dark:text-gray-300">
                    <CheckCircle2 size={15} className="mt-0.5 text-kcs-gold-500" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <h2 className="mb-3 font-bold text-kcs-blue-900 dark:text-white">Parent AI Assistant</h2>
              <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                Ask about policies, schedules, grades, attendance, and how to support each child at home. Current AI focus: {aiSignals.find((signal) => signal.roles.includes('parent'))?.detail}
              </p>
              <button className="mt-4 w-full rounded-xl bg-kcs-blue-700 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-kcs-blue-800">
                Ask Parent AI
              </button>
            </div>
          </div>

          {/* Child Overview Card */}
          <motion.div
            key={selectedChild.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-kcs-blue-900 to-kcs-blue-700 rounded-2xl p-6 text-white"
          >
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center text-2xl font-bold">
                  {selectedChild.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <h2 className="text-2xl font-bold font-display">{selectedChild.name}</h2>
                  <p className="text-kcs-blue-200">{selectedChild.grade} · KCS Kinshasa</p>
                </div>
              </div>
              <div className="flex gap-6">
                <div className="text-center">
                  <p className="text-2xl font-bold text-kcs-gold-400">{selectedChild.gpa.toFixed(1)}</p>
                  <p className="text-xs text-kcs-blue-200">GPA</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-400">{selectedChild.attendance}%</p>
                  <p className="text-xs text-kcs-blue-200">Attendance</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-white">#{selectedChild.rank}</p>
                  <p className="text-xs text-kcs-blue-200">Class Rank</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Current GPA',      value: selectedChild.gpa.toFixed(1), icon: Award,       color: 'text-kcs-gold-600',  bg: 'bg-kcs-gold-50 dark:bg-kcs-gold-900/20',  sub: 'Semester Average' },
              { label: 'Attendance Rate',  value: `${selectedChild.attendance}%`, icon: CheckCircle2, color: 'text-green-600',   bg: 'bg-green-50 dark:bg-green-900/20',       sub: '2 absences this year' },
              { label: 'Unread Messages',  value: '1',  icon: MessageSquare, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20', sub: 'From teachers' },
              { label: 'Upcoming Events',  value: '4',  icon: Calendar,      color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20', sub: 'Next 30 days' },
            ].map(({ label, value, icon: Icon, color, bg, sub }) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-kcs-blue-900/50 rounded-2xl p-5 border border-gray-100 dark:border-kcs-blue-800 hover:shadow-kcs transition-all duration-300"
              >
                <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center mb-3`}>
                  <Icon size={20} className={color} />
                </div>
                <p className="text-2xl font-bold font-display text-kcs-blue-900 dark:text-white">{value}</p>
                <p className="text-xs font-medium text-gray-600 dark:text-gray-300">{label}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>
              </motion.div>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <h2 className="mb-4 font-bold text-kcs-blue-900 dark:text-white">Live Child Records</h2>
              <div className="space-y-3">
                {ecosystemStudents.filter((student) => student.parentId === 'parent-kabongo').map((student) => (
                  <div key={student.id} className="rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-800/30">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-kcs-blue-900 dark:text-white">{student.name}</p>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{student.grade} {student.section}</span>
                    </div>
                    <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">{student.aiInsight}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <h2 className="mb-4 font-bold text-kcs-blue-900 dark:text-white">Attendance Updates</h2>
              <div className="space-y-3">
                {ecosystemAttendance.map((record) => {
                  const student = ecosystemStudents.find((item) => item.id === record.studentId)
                  return (
                    <div key={`${record.studentId}-${record.date}`} className="flex items-center justify-between rounded-xl bg-gray-50 p-3 dark:bg-kcs-blue-800/30">
                      <div>
                        <p className="text-sm font-semibold text-kcs-blue-900 dark:text-white">{student?.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{record.date} • {record.className}</p>
                      </div>
                      <span className="rounded-full bg-kcs-blue-50 px-2.5 py-1 text-xs font-semibold capitalize text-kcs-blue-700 dark:bg-kcs-blue-900/40 dark:text-kcs-blue-300">{record.status}</span>
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <h2 className="mb-4 font-bold text-kcs-blue-900 dark:text-white">Upcoming Work & Events</h2>
              <div className="space-y-3">
                {[...ecosystemAssignments.filter((item) => item.status !== 'submitted').slice(0, 3), ...ecosystemEvents.filter((item) => item.target.includes('parent')).slice(0, 2)].map((item: any) => (
                  <div key={item.id ?? item.title} className="rounded-xl bg-gray-50 p-3 dark:bg-kcs-blue-800/30">
                    <p className="text-sm font-semibold text-kcs-blue-900 dark:text-white">{item.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{item.due ?? item.date} • {item.subject ?? item.type}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <h2 className="mb-4 font-bold text-kcs-blue-900 dark:text-white">Fee Obligations</h2>
              <div className="space-y-3">
                {feeAccounts.filter((fee) => fee.family === 'Kabongo Family').map((fee) => (
                  <div key={fee.invoice} className="rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-800/30">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-kcs-blue-900 dark:text-white">{fee.student}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{fee.invoice} • due {fee.dueDate}</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${fee.balance === 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'}`}>
                        ${fee.balance}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <h2 className="mb-4 font-bold text-kcs-blue-900 dark:text-white">Report Cards</h2>
              <div className="space-y-3">
                {reportCards.map((card) => (
                  <div key={card.student} className="rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-800/30">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-kcs-blue-900 dark:text-white">{card.student}</p>
                      <span className="text-sm font-bold text-kcs-blue-700 dark:text-kcs-blue-300">{card.average}%</span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{card.term} • {card.principalStatus} • {card.download}</p>
                    <p className="mt-2 text-xs leading-relaxed text-gray-600 dark:text-gray-300">{card.teacherComment}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <h2 className="mb-4 font-bold text-kcs-blue-900 dark:text-white">Private Communication</h2>
              <div className="space-y-3">
                {internalThreads.filter((thread) => thread.participants.includes('Rachel Kabongo')).map((thread) => (
                  <div key={thread.subject} className="rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-800/30">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-kcs-blue-900 dark:text-white">{thread.subject}</p>
                      <span className="rounded-full bg-kcs-blue-100 px-2 py-1 text-xs font-semibold text-kcs-blue-700 dark:bg-kcs-blue-900/40 dark:text-kcs-blue-300">{thread.unread} unread</span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{thread.channel}</p>
                  </div>
                ))}
                {aiRecommendations.filter((item) => item.owner === 'Parent').map((item) => (
                  <div key={item.title} className="rounded-xl border border-kcs-gold-200 bg-kcs-gold-50 p-4 dark:border-kcs-gold-900/40 dark:bg-kcs-gold-900/10">
                    <p className="text-sm font-semibold text-kcs-blue-900 dark:text-white">{item.title}</p>
                    <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">{item.action}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Performance Chart */}
            <div className="lg:col-span-2 bg-white dark:bg-kcs-blue-900/50 rounded-2xl p-6 border border-gray-100 dark:border-kcs-blue-800">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-bold text-kcs-blue-900 dark:text-white">GPA Comparison — Both Children</h2>
                <span className="badge-blue text-xs">2025/26 School Year</span>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={performanceHistory}>
                  <defs>
                    <linearGradient id="eliseGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1d4ed8" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#1d4ed8" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="davidGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,58,138,0.1)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[2.5, 4.0]} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: '#0f2352', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '12px' }} />
                  <Area type="monotone" dataKey="elise" name="Elise" stroke="#1d4ed8" strokeWidth={2.5} fill="url(#eliseGrad)" dot={{ r: 3, fill: '#1d4ed8' }} />
                  <Area type="monotone" dataKey="david" name="David" stroke="#f59e0b" strokeWidth={2.5} fill="url(#davidGrad)" dot={{ r: 3, fill: '#f59e0b' }} />
                </AreaChart>
              </ResponsiveContainer>
              <div className="flex gap-4 mt-3 justify-end">
                <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                  <span className="w-3 h-1.5 bg-kcs-blue-600 rounded-full inline-block" /> Elise
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                  <span className="w-3 h-1.5 bg-kcs-gold-500 rounded-full inline-block" /> David
                </span>
              </div>
            </div>

            {/* Notifications */}
            <div className="bg-white dark:bg-kcs-blue-900/50 rounded-2xl p-5 border border-gray-100 dark:border-kcs-blue-800">
              <h2 className="font-bold text-kcs-blue-900 dark:text-white mb-4 flex items-center gap-2">
                <Bell size={18} className="text-kcs-gold-500" /> Notifications
              </h2>
              <div className="space-y-3">
                {notifications.map((n) => (
                  <div key={n.id} className="flex gap-3 p-3 rounded-xl bg-gray-50 dark:bg-kcs-blue-800/50">
                    {n.type === 'success' && <CheckCircle2 size={18} className="text-green-500 flex-shrink-0 mt-0.5" />}
                    {n.type === 'info'    && <Bell          size={18} className="text-kcs-blue-500 flex-shrink-0 mt-0.5" />}
                    {n.type === 'warning' && <AlertCircle   size={18} className="text-yellow-500 flex-shrink-0 mt-0.5" />}
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
            {/* Recent Grades */}
            <div className="bg-white dark:bg-kcs-blue-900/50 rounded-2xl p-6 border border-gray-100 dark:border-kcs-blue-800">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-bold text-kcs-blue-900 dark:text-white flex items-center gap-2">
                  <BarChart3 size={18} className="text-kcs-blue-600 dark:text-kcs-blue-400" /> Recent Grades
                </h2>
                <Link to="/portal/parent/grades" className="text-xs text-kcs-blue-600 dark:text-kcs-blue-400 font-semibold flex items-center gap-1 hover:gap-1.5">
                  View All <ChevronRight size={14} />
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-kcs-blue-800">
                      <th className="pb-3 text-left font-medium">Student</th>
                      <th className="pb-3 text-left font-medium">Course</th>
                      <th className="pb-3 text-left font-medium">Assessment</th>
                      <th className="pb-3 text-right font-medium">Grade</th>
                      <th className="pb-3 text-right font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-kcs-blue-800/50">
                    {recentGrades.map((g, i) => (
                      <tr key={i} className="hover:bg-gray-50 dark:hover:bg-kcs-blue-800/30 transition-colors">
                        <td className="py-3">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            g.child === 'Elise'
                              ? 'bg-kcs-blue-100 text-kcs-blue-700 dark:bg-kcs-blue-900/30'
                              : 'bg-kcs-gold-100 text-kcs-gold-700 dark:bg-kcs-gold-900/30'
                          }`}>
                            {g.child}
                          </span>
                        </td>
                        <td className="py-3 text-gray-600 dark:text-gray-400">{g.course}</td>
                        <td className="py-3 text-gray-500 dark:text-gray-500 text-xs">{g.assessment}</td>
                        <td className="py-3 text-right">
                          <span className={`font-bold ${
                            g.grade >= 90 ? 'text-green-600 dark:text-green-400' :
                            g.grade >= 80 ? 'text-kcs-blue-600 dark:text-kcs-blue-400' :
                            'text-yellow-600 dark:text-yellow-400'
                          }`}>
                            {g.grade}%
                          </span>
                        </td>
                        <td className="py-3 text-right text-xs text-gray-400">{g.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Teacher Messages */}
            <div className="bg-white dark:bg-kcs-blue-900/50 rounded-2xl p-6 border border-gray-100 dark:border-kcs-blue-800">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-bold text-kcs-blue-900 dark:text-white flex items-center gap-2">
                  <MessageSquare size={18} className="text-purple-500" /> Teacher Messages
                </h2>
                <Link to="/portal/parent/messages" className="text-xs text-kcs-blue-600 dark:text-kcs-blue-400 font-semibold flex items-center gap-1 hover:gap-1.5">
                  All Messages <ChevronRight size={14} />
                </Link>
              </div>
              <div className="space-y-3">
                {teacherMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-4 rounded-xl border transition-all ${
                      !msg.read
                        ? 'border-kcs-blue-200 dark:border-kcs-blue-600 bg-kcs-blue-50 dark:bg-kcs-blue-800/30'
                        : 'border-gray-100 dark:border-kcs-blue-800 bg-gray-50 dark:bg-kcs-blue-800/10'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div>
                        <span className="font-semibold text-sm text-kcs-blue-900 dark:text-white">{msg.teacher}</span>
                        <span className="mx-1.5 text-gray-300 dark:text-gray-600">·</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">{msg.subject}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          msg.child === 'Elise'
                            ? 'bg-kcs-blue-100 text-kcs-blue-700 dark:bg-kcs-blue-900/30'
                            : 'bg-kcs-gold-100 text-kcs-gold-700 dark:bg-kcs-gold-900/30'
                        }`}>
                          {msg.child}
                        </span>
                        {!msg.read && <span className="w-2 h-2 bg-kcs-blue-600 rounded-full" />}
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">{msg.message}</p>
                    <p className="text-xs text-gray-400 mt-1.5">{msg.time}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Upcoming Events */}
          <div className="bg-white dark:bg-kcs-blue-900/50 rounded-2xl p-6 border border-gray-100 dark:border-kcs-blue-800">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-kcs-blue-900 dark:text-white flex items-center gap-2">
                <Calendar size={18} className="text-orange-500" /> Upcoming Events
              </h2>
              <Link to="/portal/parent/calendar" className="text-xs text-kcs-blue-600 dark:text-kcs-blue-400 font-semibold flex items-center gap-1 hover:gap-1.5">
                Full Calendar <ChevronRight size={14} />
              </Link>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {upcomingEvents.map((event, i) => (
                <div
                  key={i}
                  className="p-4 rounded-xl border border-gray-100 dark:border-kcs-blue-800 bg-gray-50 dark:bg-kcs-blue-800/20 hover:shadow-md transition-all"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-kcs-blue-600 dark:text-kcs-blue-400">{event.date}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${eventTypeColor[event.type as keyof typeof eventTypeColor]}`}>
                      {event.type}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-kcs-blue-900 dark:text-white mb-1">{event.title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{event.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Contact */}
          <div className="bg-gradient-to-r from-kcs-blue-50 to-kcs-gold-50 dark:from-kcs-blue-900/30 dark:to-kcs-blue-900/20 rounded-2xl p-6 border border-kcs-blue-100 dark:border-kcs-blue-800">
            <h2 className="font-bold text-kcs-blue-900 dark:text-white mb-4">Quick Contact</h2>
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { label: 'School Office', phone: '+243 81 000 0000', email: 'office@kcskinshasa.com', icon: '🏫' },
                { label: "Elise's Counselor", phone: '+243 81 000 0001', email: 'counselor@kcskinshasa.com', icon: '👩‍🏫' },
                { label: 'IT Support', phone: '+243 81 000 0002', email: 'support@kcskinshasa.com', icon: '💻' },
              ].map(({ label, phone, email, icon }) => (
                <div key={label} className="bg-white dark:bg-kcs-blue-900/50 p-4 rounded-xl border border-gray-100 dark:border-kcs-blue-800 flex gap-3">
                  <span className="text-2xl">{icon}</span>
                  <div>
                    <p className="font-semibold text-sm text-kcs-blue-900 dark:text-white">{label}</p>
                    <a href={`tel:${phone}`} className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-kcs-blue-600 mt-1">
                      <Phone size={11} /> {phone}
                    </a>
                    <a href={`mailto:${email}`} className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-kcs-blue-600">
                      <Mail size={11} /> {email}
                    </a>
                  </div>
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

export default ParentPortal
