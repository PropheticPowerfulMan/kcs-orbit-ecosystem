import { useEffect } from 'react'
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, BookOpen, FileText, Calendar, Brain,
  Users, Settings, Bell, ChevronLeft, ChevronRight,
  GraduationCap, BarChart3, MessageSquare, LogOut,
  Shield, Home, UserCheck, ClipboardList, Image, LibraryBig, Menu, X, Megaphone, FileSpreadsheet, WalletCards, ClipboardCheck, AlertTriangle
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import type { UserRole } from '@/types'

interface NavItem {
  to: string
  label: string
  icon: React.ElementType
  badge?: number
}

const getNavItems = (role: UserRole, t: (key: string) => string): NavItem[] => {
  const dashboardPath = role === 'admin' ? '/admin' : `/portal/${role}`
  const base: NavItem[] = [
    { to: dashboardPath, label: 'Dashboard', icon: LayoutDashboard },
  ]

  switch (role) {
    case 'student':
      return [
        ...base,
        { to: '/portal/student/grades', label: 'My Grades', icon: BarChart3 },
        { to: '/portal/student/assignments', label: 'Assignments', icon: FileText },
        { to: '/portal/student/timetable', label: 'Timetable', icon: Calendar },
        { to: '/portal/student/ai-tutor', label: 'AI Tutor', icon: Brain },
        { to: '/portal/student/forum', label: 'Student Forum', icon: MessageSquare },
        { to: '/portal/student/messages', label: 'Messages', icon: MessageSquare },
        { to: '/portal/student/profile', label: 'My Profile', icon: UserCheck },
      ]
    case 'parent':
      return [
        ...base,
        { to: '/portal/parent/performance', label: 'Performance', icon: BarChart3 },
        { to: '/portal/parent/forum', label: 'Parent Forum', icon: MessageSquare },
        { to: '/portal/parent/messages', label: 'Messages', icon: MessageSquare },
        { to: '/portal/parent/calendar', label: 'Calendar', icon: Calendar },
        { to: '/portal/parent/finance', label: 'Fees', icon: WalletCards },
        { to: '/portal/parent/profile', label: 'Profile', icon: UserCheck },
      ]
    case 'teacher':
      return [
        ...base,
        { to: '/portal/teacher/courses', label: 'My Courses', icon: BookOpen },
        { to: '/portal/teacher/students', label: 'Students', icon: Users },
        { to: '/portal/teacher/attendance', label: 'Attendance', icon: ClipboardCheck },
        { to: '/portal/teacher/assignments', label: 'Assignments', icon: FileText },
        { to: '/portal/teacher/grades', label: 'Gradebook', icon: BarChart3 },
        { to: '/portal/teacher/reports', label: 'Reports', icon: FileSpreadsheet },
        { to: '/portal/teacher/discipline', label: 'Discipline Report', icon: AlertTriangle },
        { to: '/portal/teacher/messages', label: 'Messages', icon: MessageSquare },
      ]
    case 'staff':
      return [
        ...base,
        { to: '/portal/staff/records', label: 'Records', icon: LibraryBig },
        { to: '/portal/staff/admissions', label: 'Admissions', icon: ClipboardList },
        { to: '/portal/staff/announcements', label: 'Announcements', icon: Megaphone },
        { to: '/portal/staff/reports', label: 'Reports', icon: FileSpreadsheet },
        { to: '/portal/staff/finance', label: 'Fee Tracking', icon: WalletCards },
        { to: '/portal/staff/messages', label: 'Messages', icon: MessageSquare, badge: 12 },
        { to: '/portal/staff/permissions', label: 'Permissions', icon: Shield },
      ]
    case 'admin':
      return [
        ...base,
        { to: '/admin/students', label: 'Students', icon: GraduationCap },
        { to: '/admin/registry', label: 'Family Registry', icon: LibraryBig },
        { to: '/admin/transcripts', label: 'Transcripts', icon: FileSpreadsheet },
        { to: '/admin/communications', label: 'Communications', icon: Megaphone },
        { to: '/admin/staff-attendance', label: 'Staff Attendance', icon: ClipboardCheck },
        { to: '/admin/discipline', label: 'Discipline', icon: AlertTriangle },
        { to: '/admin/teachers', label: 'Teachers', icon: Users },
        { to: '/admin/courses', label: 'Courses', icon: BookOpen },
        { to: '/admin/admissions', label: 'Admissions', icon: ClipboardList },
        { to: '/admin/finance', label: 'Finance', icon: WalletCards },
        { to: '/admin/reports', label: 'Reports', icon: FileSpreadsheet },
        { to: '/admin/news', label: 'News & Events', icon: FileText },
        { to: '/admin/media', label: 'Media', icon: Image },
        { to: '/admin/forum-insights', label: 'Parent AI Report', icon: Brain },
        { to: '/admin/student-forum-insights', label: 'Student AI Report', icon: Shield },
        { to: '/admin/analytics', label: 'AI Analytics', icon: Brain },
        { to: '/admin/settings', label: 'Settings', icon: Settings },
      ]
    default:
      return base
  }
}

const PortalSidebar = () => {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const {
    sidebarCollapsed,
    sidebarOpen,
    toggleSidebar,
    toggleSidebarCollapse,
    setSidebarOpen,
  } = useUIStore()

  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname, setSidebarOpen])

  useEffect(() => {
    return () => {
      setSidebarOpen(false)
      document.body.style.overflow = ''
    }
  }, [setSidebarOpen])

  useEffect(() => {
    if (!sidebarOpen) {
      document.body.style.overflow = ''
      return
    }

    document.body.style.overflow = 'hidden'
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSidebarOpen(false)
      }
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [sidebarOpen, setSidebarOpen])

  if (!user) return null

  const navItems = getNavItems(user.role, t)
  const roleColor = {
    admin: 'bg-purple-600',
    staff: 'bg-slate-700',
    teacher: 'bg-green-600',
    student: 'bg-kcs-blue-600',
    parent: 'bg-orange-500',
  }[user.role]

  const roleName = {
    admin: 'Administrator',
    staff: 'Administrative Staff',
    teacher: 'Teacher',
    student: 'Student',
    parent: 'Parent',
  }[user.role]

  const renderNavigation = (isMobile = false) => (
    <>
      <nav className={`flex-1 space-y-1 overflow-y-auto ${isMobile ? 'px-3 py-2' : 'p-3'}`}>
        {navItems.map(({ to, label, icon: Icon, badge }) => (
          <NavLink
            key={to}
            to={to}
            end={to === (user.role === 'admin' ? '/admin' : `/portal/${user.role}`)}
            onClick={() => isMobile && setSidebarOpen(false)}
            className={({ isActive }) =>
              `sidebar-link ${isMobile ? 'sidebar-link-mobile' : ''} ${isActive ? 'active' : ''} ${!isMobile && sidebarCollapsed ? 'justify-center px-0' : ''}`
            }
            title={!isMobile && sidebarCollapsed ? label : undefined}
          >
            <Icon size={18} className="flex-shrink-0" />
            {(isMobile || !sidebarCollapsed) && (
              <span className="min-w-0 flex-1 truncate">{label}</span>
            )}
            {badge && badge > 0 && (isMobile || !sidebarCollapsed) && (
              <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-red-500 text-xs text-white">
                {badge > 99 ? '99+' : badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className={`${isMobile ? 'mx-3 mb-3 rounded-[22px] border border-gray-100 bg-gray-50/70 p-2 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/30' : 'space-y-1 border-t border-gray-100 p-3 dark:border-kcs-blue-800'}`}>
        <Link
          to="/"
          onClick={() => isMobile && setSidebarOpen(false)}
          className={`sidebar-link ${isMobile ? 'sidebar-link-mobile' : ''} ${!isMobile && sidebarCollapsed ? 'justify-center px-0' : ''}`}
          title={!isMobile && sidebarCollapsed ? 'Main Website' : undefined}
        >
          <Home size={18} className="flex-shrink-0" />
          {(isMobile || !sidebarCollapsed) && <span>Main Website</span>}
        </Link>
        <button
          onClick={() => {
            setSidebarOpen(false)
            logout()
            navigate('/login', { replace: true })
          }}
          className={`sidebar-link ${isMobile ? 'sidebar-link-mobile' : ''} w-full text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 ${!isMobile && sidebarCollapsed ? 'justify-center px-0' : ''}`}
          title={!isMobile && sidebarCollapsed ? 'Sign Out' : undefined}
        >
          <LogOut size={18} className="flex-shrink-0" />
          {(isMobile || !sidebarCollapsed) && <span>Sign Out</span>}
        </button>
      </div>
    </>
  )

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-50 px-3 pt-3 lg:hidden">
        <div className="flex h-14 items-center justify-between rounded-[28px] border border-white/70 bg-white/95 px-3 shadow-lg shadow-kcs-blue-950/5 backdrop-blur-md dark:border-kcs-blue-800/80 dark:bg-kcs-blue-950/95">
        <Link to="/" onClick={() => setSidebarOpen(false)} className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full kcs-gradient shadow-kcs ring-4 ring-white dark:ring-kcs-blue-900">
            <span className="font-display text-sm font-bold text-white">KCS</span>
          </div>
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-bold text-kcs-blue-900 dark:text-white">
              KCS Nexus
            </p>
            <p className="truncate text-xs text-kcs-gold-600 dark:text-kcs-gold-400">
              {roleName} Portal
            </p>
          </div>
        </Link>
        <button
          onClick={toggleSidebar}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-kcs-blue-50 text-kcs-blue-700 transition-colors hover:bg-kcs-blue-100 dark:bg-kcs-blue-900/40 dark:text-kcs-blue-200 dark:hover:bg-kcs-blue-800"
          aria-label={sidebarOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
        >
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        </div>
      </div>

      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            className="fixed inset-0 z-40 bg-kcs-blue-950/45 p-3 pt-[76px] backdrop-blur-sm lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.08 }}
            onClick={() => setSidebarOpen(false)}
          >
            <motion.aside
              className="flex max-h-[calc(100dvh-88px)] w-[min(88vw,360px)] flex-col overflow-hidden rounded-[30px] border border-white/80 bg-white shadow-2xl shadow-kcs-blue-950/20 dark:border-kcs-blue-800/80 dark:bg-kcs-blue-950"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="border-b border-gray-100 p-3 dark:border-kcs-blue-800">
                <div className="rounded-[24px] bg-gray-50 p-3 dark:bg-kcs-blue-900/35">
                <div className="flex items-center gap-3">
                  <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full ${roleColor} text-sm font-bold text-white ring-4 ring-white dark:ring-kcs-blue-950`}>
                    {user.firstName?.[0]}{user.lastName?.[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                      {user.firstName} {user.lastName}
                    </p>
                    <p className="truncate text-xs capitalize text-gray-500 dark:text-gray-400">
                      {user.role}
                    </p>
                  </div>
                </div>
                </div>
              </div>
              {renderNavigation(true)}
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {(
    <motion.aside
      animate={{ width: sidebarCollapsed ? 72 : 260 }}
      initial={{ width: 0, opacity: 0 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="sticky top-0 z-30 hidden h-screen flex-col overflow-hidden border-r border-gray-100 bg-white dark:border-kcs-blue-800 dark:bg-kcs-blue-950 lg:flex"
    >
      {/* Logo */}
      <div className="p-4 border-b border-gray-100 dark:border-kcs-blue-800">
        <div className="flex items-center gap-2">
        <Link to="/" className="flex min-w-0 flex-1 items-center gap-3">
          <div className="w-10 h-10 rounded-xl kcs-gradient flex items-center justify-center flex-shrink-0 shadow-kcs">
            <span className="text-white font-bold text-sm font-display">KCS</span>
          </div>
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <p className="font-bold text-xs leading-tight font-display text-kcs-blue-900 dark:text-white whitespace-nowrap">
                  KCS Nexus
                </p>
                <p className="text-xs text-kcs-gold-600 dark:text-kcs-gold-400 whitespace-nowrap">
                  {roleName} Portal
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </Link>
        </div>
      </div>

      {/* User Profile */}
      <div className={`p-4 border-b border-gray-100 dark:border-kcs-blue-800 ${sidebarCollapsed ? 'items-center' : ''}`}>
        <div className={`flex items-center gap-3 ${sidebarCollapsed ? 'justify-center' : ''}`}>
          <div className={`w-10 h-10 rounded-xl ${roleColor} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
            {user.firstName?.[0]}{user.lastName?.[0]}
          </div>
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="min-w-0 flex-1"
              >
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 capitalize truncate">
                  {user.role}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {renderNavigation()}

      {/* Collapse Toggle */}
      <button
        onClick={toggleSidebarCollapse}
        className="absolute top-1/2 -right-3 transform -translate-y-1/2 w-6 h-6 bg-white dark:bg-kcs-blue-800 border border-gray-200 dark:border-kcs-blue-700 rounded-full flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-kcs-blue-600 dark:hover:text-kcs-blue-300 transition-all duration-200 shadow-sm z-10"
      >
        {sidebarCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </motion.aside>
        )}
      </AnimatePresence>
    </>
  )
}

export default PortalSidebar
