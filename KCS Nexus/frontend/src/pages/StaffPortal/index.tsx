import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  AlertTriangle, Bell, Brain, ClipboardList, FileText, Megaphone,
  MessageSquare, ShieldCheck, TrendingUp, Users
} from 'lucide-react'
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts'
import PortalSidebar from '@/components/layout/PortalSidebar'
import PortalSectionPanel from '@/components/shared/PortalSectionPanel'
import { useAuthStore } from '@/store/authStore'
import {
  academicContext, aiSignals, announcements, auditLogs,
  attendance, communicationFlows, disciplineReports, feeAccounts, financeReadiness, messages,
  reportCards, rolePermissions, scheduleConflicts, staffOperations, students
} from '@/data/schoolEcosystem'

const attendanceSummary = [
  { label: 'Elementary', attendance: 96 },
  { label: 'Middle', attendance: 91 },
  { label: 'High', attendance: 94 },
  { label: 'Staff', attendance: 98 },
]

const getStaffSegment = (pathname: string) => {
  const segment = pathname.split('/').filter(Boolean).at(-1)
  return !segment || segment === 'staff' || segment === 'dashboard' ? 'dashboard' : segment
}

const staffButton = 'rounded-xl bg-kcs-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-kcs-blue-800'

const statusTone = (value: string) => {
  if (['Open', 'pending', 'Action needed', 'high'].includes(value)) return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
  if (['Monitored', 'partially paid', 'medium', 'Needs review'].includes(value)) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
  return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
}

const StaffSectionView = ({ segment }: { segment: string }) => {
  const [selectedRecord, setSelectedRecord] = useState(students[0])
  const [announcementSent, setAnnouncementSent] = useState(false)
  const [messageSent, setMessageSent] = useState(false)

  if (segment === 'records') {
    return (
      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-bold text-kcs-blue-900 dark:text-white">Student & Parent Records</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Search, review, and update official family records.</p>
            </div>
            <button className={staffButton}>Register student</button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[720px] w-full text-sm">
              <thead className="text-left text-xs text-gray-400">
                <tr className="border-b border-gray-100 dark:border-kcs-blue-800">
                  <th className="pb-3 font-medium">Student</th>
                  <th className="pb-3 font-medium">Grade</th>
                  <th className="pb-3 font-medium">Advisor</th>
                  <th className="pb-3 text-right font-medium">Attendance</th>
                  <th className="pb-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-kcs-blue-800/50">
                {students.map((student) => (
                  <tr key={student.id}>
                    <td className="py-3 font-semibold text-kcs-blue-900 dark:text-white">{student.name}</td>
                    <td className="py-3 text-gray-500 dark:text-gray-400">{student.grade} {student.section}</td>
                    <td className="py-3 text-gray-500 dark:text-gray-400">{student.advisor}</td>
                    <td className="py-3 text-right font-bold text-kcs-blue-700 dark:text-kcs-blue-300">{student.attendance}%</td>
                    <td className="py-3 text-right">
                      <button className="rounded-lg bg-kcs-blue-50 px-3 py-1.5 text-xs font-semibold text-kcs-blue-700 hover:bg-kcs-blue-100 dark:bg-kcs-blue-900/40 dark:text-kcs-blue-200" onClick={() => setSelectedRecord(student)}>Open</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
          <h2 className="font-bold text-kcs-blue-900 dark:text-white">Selected Record</h2>
          <div className="mt-4 rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-800/30">
            <p className="font-display text-2xl font-bold text-kcs-blue-900 dark:text-white">{selectedRecord.name}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{selectedRecord.grade} {selectedRecord.section} - {selectedRecord.advisor}</p>
            <p className="mt-3 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{selectedRecord.aiInsight}</p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {['Parent contacts', 'Medical form', 'Academic flags', 'Documents'].map((item) => (
              <button key={item} className="rounded-xl border border-gray-100 px-4 py-3 text-left text-sm font-semibold text-kcs-blue-900 hover:bg-kcs-blue-50 dark:border-kcs-blue-800 dark:text-white dark:hover:bg-kcs-blue-800">{item}</button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (segment === 'admissions') {
    const admissionQueue = [
      { family: 'Mbuyi Family', student: 'Amani Mbuyi', grade: 'Grade 9', stage: 'Interview scheduled', owner: 'Registrar Office' },
      { family: 'Nsimba Family', student: 'Joelle Nsimba', grade: 'Grade 6', stage: 'Documents pending', owner: 'Admissions Office' },
      { family: 'Kanku Family', student: 'Samuel Kanku', grade: 'Grade 10', stage: 'Placement review', owner: 'Academic Coordinator' },
    ]
    return (
      <div className="grid gap-4 lg:grid-cols-3">
        {admissionQueue.map((item) => (
          <div key={item.student} className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{item.family}</p>
            <p className="mt-2 font-display text-xl font-bold text-kcs-blue-900 dark:text-white">{item.student}</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{item.grade} - {item.owner}</p>
            <span className="mt-4 inline-flex rounded-full bg-kcs-blue-100 px-3 py-1 text-xs font-semibold text-kcs-blue-700 dark:bg-kcs-blue-900/40 dark:text-kcs-blue-300">{item.stage}</span>
            <div className="mt-4 flex flex-col gap-2">
              <button className={staffButton}>Update stage</button>
              <button className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-kcs-blue-700 hover:bg-kcs-blue-50 dark:border-kcs-blue-700 dark:text-kcs-blue-200 dark:hover:bg-kcs-blue-800">Schedule interview</button>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (segment === 'announcements') {
    return (
      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
          <h2 className="mb-4 font-bold text-kcs-blue-900 dark:text-white">Recent Announcements</h2>
          <div className="space-y-3">
            {announcements.map((item) => (
              <div key={item.id} className="rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-800/30">
                <p className="font-semibold text-kcs-blue-900 dark:text-white">{item.title}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{item.date} - {item.audience.join(', ')}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
          <h2 className="mb-4 font-bold text-kcs-blue-900 dark:text-white">Compose Announcement</h2>
          <div className="grid gap-3">
            <input className="rounded-xl border border-gray-200 px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white" placeholder="Announcement title" />
            <select className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white">
              <option>Parents, students, teachers, staff</option>
              <option>Parents only</option>
              <option>Staff only</option>
              <option>High School</option>
            </select>
            <textarea className="min-h-36 rounded-xl border border-gray-200 px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white" placeholder="Write announcement..." />
            <button className={staffButton} onClick={() => setAnnouncementSent(true)}>Publish announcement</button>
            {announcementSent && <p className="rounded-xl bg-green-50 p-3 text-sm font-semibold text-green-700 dark:bg-green-900/20 dark:text-green-300">Announcement queued for portal, email, and SMS communication.</p>}
          </div>
        </div>
      </div>
    )
  }

  if (segment === 'reports') {
    return (
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50 xl:col-span-2">
          <h2 className="mb-4 font-bold text-kcs-blue-900 dark:text-white">Report Card Workflow</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {reportCards.map((card) => (
              <div key={card.student} className="rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-800/30">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-kcs-blue-900 dark:text-white">{card.student}</p>
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusTone(card.principalStatus)}`}>{card.principalStatus}</span>
                </div>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{card.term} - {card.average}% - {card.download}</p>
                <button className="mt-3 rounded-xl bg-kcs-blue-700 px-4 py-2 text-sm font-semibold text-white">Export report</button>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
          <h2 className="mb-4 font-bold text-kcs-blue-900 dark:text-white">AI Reports</h2>
          <div className="space-y-3">
            {['Attendance risk digest', 'Discipline summary', 'Finance follow-up CSV', 'Academic intervention list'].map((report) => (
              <button key={report} className="w-full rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-left text-sm font-semibold text-kcs-blue-900 hover:bg-kcs-blue-50 dark:border-kcs-blue-800 dark:bg-kcs-blue-800/30 dark:text-white dark:hover:bg-kcs-blue-800">{report}</button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (segment === 'finance') {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {feeAccounts.map((fee) => (
          <div key={fee.invoice} className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold text-kcs-blue-900 dark:text-white">{fee.family}</p>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone(fee.status)}`}>{fee.status}</span>
            </div>
            <p className="mt-3 font-display text-3xl font-bold text-kcs-blue-900 dark:text-white">${fee.balance}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{fee.student} - {fee.invoice}</p>
            <button className="mt-4 w-full rounded-xl bg-kcs-gold-500 px-4 py-2.5 text-sm font-bold text-kcs-blue-950 hover:bg-kcs-gold-400">Send finance notice</button>
          </div>
        ))}
      </div>
    )
  }

  if (segment === 'messages') {
    return (
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
          <h2 className="mb-4 font-bold text-kcs-blue-900 dark:text-white">Staff Inbox</h2>
          <div className="space-y-3">
            {messages.map((message) => (
              <div key={message.subject} className="rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-800/30">
                <p className="font-semibold text-kcs-blue-900 dark:text-white">{message.subject}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{message.from} - {message.toRole}</p>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{message.body}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
          <h2 className="mb-4 font-bold text-kcs-blue-900 dark:text-white">Send Communication</h2>
          <div className="grid gap-3">
            <select className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white">
              <option>All parents</option>
              <option>Selected student family</option>
              <option>All teachers</option>
              <option>Staff team</option>
            </select>
            <input className="rounded-xl border border-gray-200 px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white" placeholder="Subject" />
            <textarea className="min-h-36 rounded-xl border border-gray-200 px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white" placeholder="Email, SMS, and portal message..." />
            <button className={staffButton} onClick={() => setMessageSent(true)}>Send communication</button>
            {messageSent && <p className="rounded-xl bg-green-50 p-3 text-sm font-semibold text-green-700 dark:bg-green-900/20 dark:text-green-300">Communication prepared for portal, email, and SMS channels.</p>}
          </div>
        </div>
      </div>
    )
  }

  if (segment === 'permissions') {
    return (
      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
          <h2 className="mb-4 font-bold text-kcs-blue-900 dark:text-white">Staff Permissions</h2>
          <div className="flex flex-wrap gap-2">
            {rolePermissions.staff.map((permission) => (
              <span key={permission} className="rounded-full bg-kcs-blue-50 px-3 py-1 text-xs font-semibold text-kcs-blue-700 dark:bg-kcs-blue-900/40 dark:text-kcs-blue-300">{permission}</span>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
          <h2 className="mb-4 font-bold text-kcs-blue-900 dark:text-white">Audit Log</h2>
          <div className="space-y-3">
            {auditLogs.map((log) => (
              <div key={`${log.actor}-${log.time}`} className="rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-800/30">
                <p className="font-semibold text-kcs-blue-900 dark:text-white">{log.action}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{log.actor} - {log.target} - {log.time}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {disciplineReports.map((report) => (
        <div key={report.id} className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold text-kcs-blue-900 dark:text-white">{report.student}</p>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone(report.status)}`}>{report.status}</span>
          </div>
          <p className="mt-2 text-sm font-semibold text-kcs-blue-700 dark:text-kcs-blue-300">{report.category} - {report.date}</p>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{report.incident}</p>
          <p className="mt-3 rounded-xl bg-gray-50 p-3 text-xs text-gray-500 dark:bg-kcs-blue-800/30 dark:text-gray-400">{report.actionTaken}</p>
        </div>
      ))}
    </div>
  )
}

const StaffPortal = () => {
  const { user } = useAuthStore()
  const location = useLocation()
  const activeSegment = getStaffSegment(location.pathname)
  const staffMessages = messages.filter((message) => message.toRole === 'staff')
  const staffSignals = aiSignals.filter((signal) => signal.roles.includes('staff'))

  return (
    <div className="portal-shell flex">
      <PortalSidebar />

      <main>
        <div className="sticky top-0 z-20 border-b border-gray-100 bg-white/85 px-6 py-4 backdrop-blur-md dark:border-kcs-blue-800 dark:bg-kcs-blue-950/85">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="font-display text-xl font-bold text-kcs-blue-900 dark:text-white">
                Staff Operations, {user?.firstName}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {academicContext.year} • {academicContext.term} • records, communication, admissions, discipline, and reports.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to="/portal/staff/announcements" className="btn-primary flex items-center gap-2 py-2 text-sm">
                <Megaphone size={16} /> Send Announcement
              </Link>
              <Link to="/portal/staff/reports" className="btn-gold flex items-center gap-2 py-2 text-sm">
                <Brain size={16} /> AI Report
              </Link>
            </div>
          </div>
        </div>

        <div className="space-y-6 p-4 sm:p-6">
          {activeSegment !== 'dashboard' ? (
            <StaffSectionView segment={activeSegment} />
          ) : (
            <>
          <PortalSectionPanel />

          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            {[
              { label: 'Student Records', value: '511', sub: '18 changed today', icon: Users, tone: 'bg-kcs-blue-50 text-kcs-blue-700 dark:bg-kcs-blue-900/30 dark:text-kcs-blue-300' },
              { label: 'Pending Messages', value: '12', sub: 'Parents and staff', icon: MessageSquare, tone: 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
              { label: 'Admissions Tasks', value: '9', sub: '3 interviews pending', icon: ClipboardList, tone: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
              { label: 'Audit Items', value: '3', sub: 'Sensitive changes', icon: ShieldCheck, tone: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
            ].map((item) => {
              const Icon = item.icon
              return (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50"
                >
                  <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${item.tone}`}>
                    <Icon size={18} />
                  </div>
                  <p className="font-display text-2xl font-bold text-kcs-blue-900 dark:text-white">{item.value}</p>
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-300">{item.label}</p>
                  <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{item.sub}</p>
                </motion.div>
              )
            })}
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-2xl border border-gray-100 bg-white p-6 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="font-bold text-kcs-blue-900 dark:text-white">School-wide Attendance</h2>
                <span className="badge-blue text-xs">Today</span>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={attendanceSummary}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: '#0f2352', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '12px' }} />
                  <Bar dataKey="attendance" fill="#1d4ed8" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-6 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <h2 className="mb-4 flex items-center gap-2 font-bold text-kcs-blue-900 dark:text-white">
                <Brain size={18} className="text-kcs-gold-500" /> Staff AI Tools
              </h2>
              <div className="space-y-3">
                {['Generate official letter', 'Draft targeted announcement', 'Summarize discipline report', 'Export attendance risk CSV'].map((tool) => (
                  <button key={tool} className="w-full rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-left text-sm font-semibold text-kcs-blue-900 transition-colors hover:bg-kcs-blue-50 dark:border-kcs-blue-800 dark:bg-kcs-blue-800/30 dark:text-white dark:hover:bg-kcs-blue-800">
                    {tool}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <div className="rounded-2xl border border-gray-100 bg-white p-6 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <h2 className="mb-4 flex items-center gap-2 font-bold text-kcs-blue-900 dark:text-white">
                <FileText size={18} className="text-kcs-blue-500" /> Operational Workload
              </h2>
              <div className="space-y-3">
                {staffOperations.map((item) => (
                  <div key={item.function} className="rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-800/30">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-kcs-blue-900 dark:text-white">{item.function}</p>
                      <span className="font-bold text-kcs-blue-700 dark:text-kcs-blue-300">{item.value}</span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{item.metric}</p>
                    <p className="mt-2 text-xs font-semibold text-kcs-gold-600 dark:text-kcs-gold-300">{item.status}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-6 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <h2 className="mb-4 flex items-center gap-2 font-bold text-kcs-blue-900 dark:text-white">
                <Bell size={18} className="text-orange-500" /> Targeted Announcements
              </h2>
              <div className="space-y-3">
                {announcements.map((item) => (
                  <div key={item.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-kcs-blue-800 dark:bg-kcs-blue-800/30">
                    <p className="font-semibold text-kcs-blue-900 dark:text-white">{item.title}</p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{item.date} • {item.audience.join(', ')}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-6 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <h2 className="mb-4 flex items-center gap-2 font-bold text-kcs-blue-900 dark:text-white">
                <AlertTriangle size={18} className="text-red-500" /> AI Risk Signals
              </h2>
              <div className="space-y-3">
                {staffSignals.map((signal) => (
                  <div key={signal.title} className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-kcs-blue-800 dark:bg-kcs-blue-800/30">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-kcs-blue-900 dark:text-white">{signal.title}</p>
                      <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs font-semibold text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300">{signal.severity}</span>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-gray-600 dark:text-gray-300">{signal.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <div className="rounded-2xl border border-gray-100 bg-white p-6 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <h2 className="mb-4 font-bold text-kcs-blue-900 dark:text-white">Fee Tracking</h2>
              <div className="space-y-3">
                {feeAccounts.map((fee) => (
                  <div key={fee.invoice} className="rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-800/30">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-kcs-blue-900 dark:text-white">{fee.family}</p>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${fee.status === 'paid' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'}`}>
                        {fee.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{fee.student} • balance ${fee.balance} • {fee.invoice}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-6 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <h2 className="mb-4 font-bold text-kcs-blue-900 dark:text-white">Report Card Workflow</h2>
              <div className="space-y-3">
                {reportCards.map((card) => (
                  <div key={card.student} className="rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-800/30">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-kcs-blue-900 dark:text-white">{card.student}</p>
                      <span className="text-xs font-semibold text-kcs-blue-600 dark:text-kcs-blue-300">{card.principalStatus}</span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{card.term} • {card.download}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-6 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <h2 className="mb-4 font-bold text-kcs-blue-900 dark:text-white">Schedule Conflicts</h2>
              <div className="space-y-3">
                {scheduleConflicts.map((conflict) => (
                  <div key={conflict.title} className="rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-800/30">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-kcs-blue-900 dark:text-white">{conflict.title}</p>
                      <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-300">{conflict.severity}</span>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-gray-600 dark:text-gray-300">{conflict.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-2xl border border-gray-100 bg-white p-6 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <h2 className="mb-4 font-bold text-kcs-blue-900 dark:text-white">Cross-module Notifications</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {communicationFlows.map((flow) => (
                  <div key={flow.trigger} className="rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-800/30">
                    <p className="font-semibold text-kcs-blue-900 dark:text-white">{flow.trigger}</p>
                    <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">{flow.update}</p>
                    <p className="mt-2 text-xs font-semibold text-kcs-gold-600 dark:text-kcs-gold-300">{flow.notification}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-6 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <h2 className="mb-4 font-bold text-kcs-blue-900 dark:text-white">Payment Integration Readiness</h2>
              <div className="space-y-3">
                {financeReadiness.map((item) => (
                  <div key={item.feature} className="rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-800/30">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-kcs-blue-900 dark:text-white">{item.feature}</p>
                      <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-300">{item.status}</span>
                    </div>
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{item.note}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-2xl border border-gray-100 bg-white p-6 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <h2 className="mb-4 flex items-center gap-2 font-bold text-kcs-blue-900 dark:text-white">
                <MessageSquare size={18} className="text-purple-500" /> Messages Requiring Action
              </h2>
              <div className="space-y-3">
                {staffMessages.map((message) => (
                  <div key={message.subject} className="rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-800/30">
                    <p className="font-semibold text-kcs-blue-900 dark:text-white">{message.subject}</p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{message.from}</p>
                    <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{message.body}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-6 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <h2 className="mb-4 flex items-center gap-2 font-bold text-kcs-blue-900 dark:text-white">
                <ShieldCheck size={18} className="text-green-500" /> Permissions & Audit
              </h2>
              <div className="mb-4 flex flex-wrap gap-2">
                {rolePermissions.staff.map((permission) => (
                  <span key={permission} className="rounded-full bg-kcs-blue-50 px-3 py-1 text-xs font-semibold text-kcs-blue-700 dark:bg-kcs-blue-900/40 dark:text-kcs-blue-300">
                    {permission}
                  </span>
                ))}
              </div>
              <div className="space-y-3">
                {auditLogs.map((log) => (
                  <div key={`${log.actor}-${log.time}`} className="flex items-start gap-3 rounded-xl bg-gray-50 p-3 text-sm dark:bg-kcs-blue-800/30">
                    <TrendingUp size={15} className="mt-0.5 text-kcs-gold-500" />
                    <div>
                      <p className="font-semibold text-kcs-blue-900 dark:text-white">{log.action}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{log.actor} • {log.target} • {log.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}

export default StaffPortal
