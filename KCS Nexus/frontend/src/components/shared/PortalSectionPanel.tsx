import { useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  Bell, BookOpen, Brain, Calendar, CheckCircle2, ClipboardList,
  Download, FileText, MessageSquare, Search, Settings, Shield,
  UserCheck, Users
} from 'lucide-react'

type SectionConfig = {
  title: string
  description: string
  icon: React.ElementType
  primaryAction: string
  secondaryAction: string
  items: string[]
}

const sectionMap: Record<string, SectionConfig> = {
  students: {
    title: 'Student Management',
    description: 'Create, edit, suspend, and review student accounts, class placement, risks, attendance, and family links.',
    icon: Users,
    primaryAction: 'Create student',
    secondaryAction: 'Export students',
    items: ['Elise Kabongo - Grade 11A - active', 'David Kabongo - Grade 8B - intervention watch', 'Grace Mwamba - Grade 10A - active'],
  },
  teachers: {
    title: 'Teacher Management',
    description: 'Manage teacher profiles, assigned classes, subjects, schedules, workload, and activity monitoring.',
    icon: UserCheck,
    primaryAction: 'Add teacher',
    secondaryAction: 'Review workload',
    items: ['Dr. Mukendi - AP Biology - 5 sections', 'Mr. Belanger - Mathematics - schedule conflict check', 'Mrs. Diallo - English - report comments pending'],
  },
  courses: {
    title: 'Classes, Subjects & Schedules',
    description: 'Configure academic years, terms, classes, sections, subjects, periods, rooms, and timetable conflicts.',
    icon: BookOpen,
    primaryAction: 'Create subject',
    secondaryAction: 'Check conflicts',
    items: ['Grade 11A - AP Calculus - Room 204', 'Grade 8B - Pre-Algebra - Room 202', 'Grade 11A - AP Biology - Lab 3'],
  },
  admissions: {
    title: 'Admissions Operations',
    description: 'Track applications, interviews, missing documents, acceptance decisions, and family onboarding.',
    icon: ClipboardList,
    primaryAction: 'Review application',
    secondaryAction: 'Export queue',
    items: ['Amani M. - Interview scheduled', 'Lydia T. - Under review', 'Joel B. - Documents missing'],
  },
  news: {
    title: 'Announcements & Events',
    description: 'Publish targeted school announcements, emergency alerts, events, policy updates, and communications.',
    icon: Bell,
    primaryAction: 'Publish announcement',
    secondaryAction: 'Schedule alert',
    items: ['Exam schedules published - parents/students/teachers', 'Parent duties policy updated - parents', 'Emergency drill reminder - all users'],
  },
  media: {
    title: 'Media Library',
    description: 'Manage photos, videos, galleries, homepage media, and communication assets.',
    icon: FileText,
    primaryAction: 'Upload media',
    secondaryAction: 'Organize gallery',
    items: ['Science fair gallery - 24 assets', 'Campus life video - ready for review', 'Admissions hero image - published'],
  },
  analytics: {
    title: 'System Analytics & AI Usage',
    description: 'Monitor AI usage, academic trends, risk indicators, engagement, admissions, attendance, and teacher activity.',
    icon: Brain,
    primaryAction: 'Generate AI report',
    secondaryAction: 'Export analytics',
    items: ['AI tutor sessions +38%', 'Grade 8 attendance risk cluster', 'Parent conference completion 82%'],
  },
  settings: {
    title: 'Permissions & Platform Settings',
    description: 'Configure role permissions, sensitive action approvals, security rules, finance settings, and audit policies.',
    icon: Settings,
    primaryAction: 'Update permissions',
    secondaryAction: 'View audit log',
    items: ['Super Admin - full access', 'Staff - records and communication permissions', 'Sensitive updates require approval'],
  },
  registry: {
    title: 'Family Registry',
    description: 'Link parents to children, verify documents, and maintain household communication records.',
    icon: Users,
    primaryAction: 'Link family',
    secondaryAction: 'Export registry',
    items: ['Kabongo family - 2 children linked', 'Mwamba family - documents verified', 'Admissions family - pending link'],
  },
  'forum-insights': {
    title: 'Parent AI Report',
    description: 'AI summary of parent forum sentiment, urgent issues, duties, policy questions, and response needs.',
    icon: Brain,
    primaryAction: 'Review report',
    secondaryAction: 'Assign follow-up',
    items: ['Safety supervision question - urgent', 'Weekly communication digest requested', 'Transport policy clarity needed'],
  },
  'student-forum-insights': {
    title: 'Student AI Report',
    description: 'AI summary of student voice, academic concerns, discipline signals, support needs, and wellbeing patterns.',
    icon: Shield,
    primaryAction: 'Review signal',
    secondaryAction: 'Notify coordinator',
    items: ['Study group request - Grade 10/11', 'Exam stress trend rising', 'Counselor check-in recommended'],
  },
  grades: {
    title: 'Grades & Performance',
    description: 'Review scores, averages, teacher feedback, strengths, weaknesses, trends, and policy-based ranking.',
    icon: CheckCircle2,
    primaryAction: 'Open report',
    secondaryAction: 'Download PDF',
    items: ['AP Biology - 95%', 'AP Calculus - 89%', 'English Literature - 91%'],
  },
  assignments: {
    title: 'Assignments & Homework',
    description: 'Track pending, submitted, graded, and missing work with deadlines and teacher feedback.',
    icon: FileText,
    primaryAction: 'Create assignment',
    secondaryAction: 'Export tasks',
    items: ['AP Calculus Problem Set #8 - due tomorrow', 'Biology Lab Report - submitted', 'Fraction Fluency Practice - missing'],
  },
  timetable: {
    title: 'Timetable & Schedule',
    description: 'Daily and weekly schedule with class periods, rooms, teachers, conflicts, and affected-user notifications.',
    icon: Calendar,
    primaryAction: 'View week',
    secondaryAction: 'Notify changes',
    items: ['8:15 AM - AP Calculus - Room 204', '10:15 AM - AP Biology - Lab 3', '2:30 PM - AI Tutor block - Library'],
  },
  messages: {
    title: 'Messages & Responses',
    description: 'Read internal messages, parent replies, student communications, and items requiring a response.',
    icon: MessageSquare,
    primaryAction: 'Compose message',
    secondaryAction: 'Mark all read',
    items: ['Parent follow-up required', 'Principal meeting agenda', 'Admissions office shadow day'],
  },
  profile: {
    title: 'Profile & Documents',
    description: 'Manage personal profile, required documents, contact details, security, and notification preferences.',
    icon: UserCheck,
    primaryAction: 'Update profile',
    secondaryAction: 'Upload document',
    items: ['Emergency contact verified', 'Medical form pending', 'Notification preference: email and portal'],
  },
  performance: {
    title: 'Child Performance',
    description: 'Parent view of child progress, grades, attendance, teacher comments, obligations, and AI recommendations.',
    icon: Brain,
    primaryAction: 'Ask Parent AI',
    secondaryAction: 'Book meeting',
    items: ['Elise - strong AP Biology progress', 'David - math intervention recommended', 'Parent response required tonight'],
  },
  calendar: {
    title: 'Calendar & Meetings',
    description: 'Academic calendar, exam schedules, events, parent-teacher meetings, and school deadlines.',
    icon: Calendar,
    primaryAction: 'Book slot',
    secondaryAction: 'Sync calendar',
    items: ['Apr 25 - Parent-teacher conferences', 'May 3 - AP exams begin', 'May 12 - Spring music concert'],
  },
  records: {
    title: 'Administrative Records',
    description: 'Manage student, parent, teacher, document, attendance, discipline, and official school records.',
    icon: FileText,
    primaryAction: 'Create record',
    secondaryAction: 'Export CSV',
    items: ['18 student records updated', '4 discipline cases monitored', '9 fee follow-ups pending'],
  },
  reports: {
    title: 'Reports & Exports',
    description: 'Generate official reports, PDF letters, Excel/CSV exports, summaries, and AI operational recommendations.',
    icon: Download,
    primaryAction: 'Generate report',
    secondaryAction: 'Export data',
    items: ['School-wide attendance summary', 'Admission statistics', 'Parent engagement report'],
  },
  finance: {
    title: 'Fee Tracking & Payments',
    description: 'Track invoices, balances, receipts, payment status, parent obligations, exports, and future mobile money or card integration.',
    icon: FileText,
    primaryAction: 'Create invoice',
    secondaryAction: 'Export finance report',
    items: ['Kabongo Family - partial balance', 'Mbuyi Family - payment pending', 'Mobile money integration prepared'],
  },
  permissions: {
    title: 'Staff Permissions',
    description: 'Review allowed operations for office functions and sensitive workflows requiring approval.',
    icon: Shield,
    primaryAction: 'Request approval',
    secondaryAction: 'View policy',
    items: ['records:read', 'announcements:write', 'reports:export'],
  },
  announcements: {
    title: 'Communication Center',
    description: 'Send announcements to parents, students, teachers, staff, selected classes, or emergency groups.',
    icon: Bell,
    primaryAction: 'Send announcement',
    secondaryAction: 'Preview recipients',
    items: ['Emergency drill reminder', 'Exam schedule update', 'Parent duties policy notice'],
  },
}

const getSegment = (pathname: string) => pathname.split('/').filter(Boolean).at(-1) ?? ''

const PortalSectionPanel = () => {
  const location = useLocation()
  const [actionMessage, setActionMessage] = useState('')

  const section = useMemo(() => {
    const segment = getSegment(location.pathname)
    if (['admin', 'student', 'parent', 'teacher', 'staff', 'dashboard'].includes(segment)) return null
    return sectionMap[segment] ?? null
  }, [location.pathname])

  if (!section) return null

  const Icon = section.icon
  const runAction = (label: string) => {
    setActionMessage(`${label} prepared. In production this action is secured, logged, and synced to the affected dashboards.`)
  }

  return (
    <section className="rounded-2xl border border-kcs-blue-100 bg-white p-5 shadow-sm dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-kcs-blue-50 text-kcs-blue-700 dark:bg-kcs-blue-900/40 dark:text-kcs-blue-300">
            <Icon size={22} />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold text-kcs-blue-900 dark:text-white">{section.title}</h2>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-gray-600 dark:text-gray-300">{section.description}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => runAction(section.primaryAction)} className="btn-primary flex items-center gap-2 py-2 text-sm">
            <CheckCircle2 size={16} /> {section.primaryAction}
          </button>
          <button onClick={() => runAction(section.secondaryAction)} className="btn-gold flex items-center gap-2 py-2 text-sm">
            <Download size={16} /> {section.secondaryAction}
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <label className="relative block">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input-kcs pl-10" placeholder={`Search ${section.title.toLowerCase()}`} />
        </label>
        <div className="grid gap-2 sm:grid-cols-3">
          {['Loading state ready', 'Error handling ready', 'Audit trail ready'].map((status) => (
            <div key={status} className="rounded-xl bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600 dark:bg-kcs-blue-800/30 dark:text-gray-300">
              {status}
            </div>
          ))}
        </div>
      </div>

      {actionMessage && (
        <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-900/40 dark:bg-green-900/20 dark:text-green-300">
          {actionMessage}
        </div>
      )}

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {section.items.map((item) => (
          <div key={item} className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-700 dark:border-kcs-blue-800 dark:bg-kcs-blue-800/30 dark:text-gray-300">
            {item}
          </div>
        ))}
      </div>
    </section>
  )
}

export default PortalSectionPanel
