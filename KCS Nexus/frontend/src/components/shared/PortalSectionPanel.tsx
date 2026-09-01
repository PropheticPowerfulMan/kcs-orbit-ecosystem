import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { Bell, BookOpen, Brain, Calendar, ClipboardList, FileText, MessageSquare, Settings, Shield, UserCheck, Users } from 'lucide-react'

type SectionConfig = {
  title: string
  description: string
  icon: React.ElementType
}

const sectionMap: Record<string, SectionConfig> = {
  students: { title: 'Student Management', description: 'Student records are loaded exclusively from the official Orbit registry.', icon: Users },
  teachers: { title: 'Teacher Management', description: 'Employee and teacher records are loaded exclusively from the synchronized HR registry.', icon: UserCheck },
  courses: { title: 'Classes, Subjects & Schedules', description: 'Only classes, subjects and schedules saved by authorized staff are displayed.', icon: BookOpen },
  admissions: { title: 'Admissions Operations', description: 'Only applications submitted through the official admissions workflow are displayed.', icon: ClipboardList },
  news: { title: 'Announcements & Events', description: 'Only announcements and events saved in the production database are displayed.', icon: Bell },
  media: { title: 'Media Library', description: 'Only uploaded and approved production media are displayed.', icon: FileText },
  analytics: { title: 'System Analytics', description: 'Analytics remain empty until sufficient verified production activity exists.', icon: Brain },
  settings: { title: 'Permissions & Platform Settings', description: 'Permissions are enforced by the server and the authenticated user role.', icon: Settings },
  'forum-insights': { title: 'Parent Forum Report', description: 'Insights are generated only from real parent forum activity.', icon: Brain },
  'student-forum-insights': { title: 'Student Forum Report', description: 'Insights are generated only from real student forum activity.', icon: Shield },
  grades: { title: 'Grades & Performance', description: 'No grade or percentage is displayed until an authorized teacher records it.', icon: BookOpen },
  assignments: { title: 'Assignments & Homework', description: 'Only assignments published by authorized teachers are displayed.', icon: FileText },
  timetable: { title: 'Timetable & Schedule', description: 'Only official schedule entries stored in Nexus are displayed.', icon: Calendar },
  messages: { title: 'Messages & Responses', description: 'Only messages stored in the authenticated mailbox are displayed.', icon: MessageSquare },
  profile: { title: 'Profile & Documents', description: 'Profile data comes from the authenticated institutional account.', icon: UserCheck },
  performance: { title: 'Child Performance', description: 'No academic result is inferred or invented before teachers submit official records.', icon: Brain },
  calendar: { title: 'Calendar & Meetings', description: 'Only official academic calendar entries and confirmed meetings are displayed.', icon: Calendar },
  records: { title: 'Administrative Records', description: 'Records come exclusively from the synchronized production registry.', icon: FileText },
  reports: { title: 'Reports & Exports', description: 'Reports are generated exclusively from verified production records.', icon: FileText },
  finance: { title: 'Fee Tracking & Payments', description: 'Financial information is read from EduPay; Nexus does not invent balances.', icon: FileText },
  permissions: { title: 'Staff Permissions', description: 'Effective permissions are enforced by the production API.', icon: Shield },
  announcements: { title: 'Communication Center', description: 'Only saved and delivered production communications are displayed.', icon: Bell },
}

const getSegment = (pathname: string) => pathname.split('/').filter(Boolean).at(-1) ?? ''

const PortalSectionPanel = () => {
  const location = useLocation()
  const section = useMemo(() => {
    const segment = getSegment(location.pathname)
    if (['admin', 'student', 'parent', 'teacher', 'staff', 'dashboard'].includes(segment)) return null
    return sectionMap[segment] ?? null
  }, [location.pathname])

  if (!section) return null
  const Icon = section.icon

  return (
    <section className="nexus-glass-card rounded-2xl p-5">
      <div className="flex gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/70 bg-white/60 text-kcs-blue-700 dark:border-white/10 dark:bg-kcs-blue-900/40 dark:text-kcs-blue-300">
          <Icon size={22} />
        </div>
        <div>
          <h2 className="font-display text-xl font-bold text-kcs-blue-900 dark:text-white">{section.title}</h2>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-gray-600 dark:text-gray-300">{section.description}</p>
        </div>
      </div>
      <div className="mt-5 rounded-2xl border border-kcs-blue-100 bg-kcs-blue-50/70 p-5 dark:border-kcs-blue-700 dark:bg-kcs-blue-950/40">
        <p className="font-semibold text-kcs-blue-900 dark:text-white">No verified production record is available in this section yet.</p>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">The page will populate automatically when an authorized workflow saves real data. Demonstration records are disabled.</p>
      </div>
    </section>
  )
}

export default PortalSectionPanel
