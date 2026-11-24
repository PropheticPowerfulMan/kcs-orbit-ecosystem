import './portalSidebar.css'
import {useEarlyYearsContext} from '@/hooks/useEarlyYearsContext'
import {isMediaAccount,canUseStaffWorkspace,canUsePrincipalWorkspace,canUseSeniorWorkspace,workspaceRole} from '@/utils/accountScope'
import {loadPersonalAvatar} from '@/utils/personalAvatarCache'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, BookOpen, FileText, Calendar, Brain,
  Users, Settings, Bell, ChevronLeft, ChevronRight, Search,
  Clock3, GraduationCap, BarChart3, MessageSquare, LogOut,
  Shield, Home, UserCheck, UserPlus, ClipboardList, LibraryBig, Menu, X, Megaphone, FileSpreadsheet, WalletCards, ClipboardCheck, AlertTriangle, Ban, Archive, Moon, Sun, Globe, BookOpenCheck, GripHorizontal, SlidersHorizontal, Vote, Loader2
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { academyAPI, authAPI, lessonPlanAPI, electionsAPI } from '@/services/api'
import { useUIStore } from '@/store/uiStore'
import {alertPortalMessage} from '@/utils/portalActionDialogs'
import type { UserRole } from '@/types'
import { getAssetUrl } from '@/utils/assets'

interface NavItem {
  to: string
  label: string
  icon: React.ElementType
  badge?: number
}

type PortalSidebarProps = { badges?: Record<string, number> }

const getNavItems = (role: UserRole, t: (key: string) => string, language: string): NavItem[] => {
  const dashboardPath = role === 'admin' ? '/admin' : `/portal/${role}`
  const base: NavItem[] = [
    { to: dashboardPath, label: t("portalNav.dashboard"), icon: LayoutDashboard },
    { to: `${dashboardPath}/handbook`, label: language === 'fr' ? 'Manuel de l’école' : 'School Handbook', icon: BookOpen },
    ...(["teacher", "admin"].includes(role) ? [] : [{ to: role === "staff" ? "/portal/staff/incident-reports" : "/incident-reports", label: t("portalNav.incidentReport"), icon: ClipboardList }]),
    ...(["student", "parent", "admin"].includes(role) ? [{ to: "/shining-students", label: "Shining Student", icon: GraduationCap }] : []),
    ...(["student", "teacher"].includes(role) ? [{ to: role === "teacher" ? "/portal/teacher/electives" : "/electives", label: t("portalNav.electives"), icon: BookOpenCheck }] : []),
    ...(["student", "teacher"].includes(role) ? [{ to: role === "teacher" ? "/portal/teacher/course-syllabi" : "/course-syllabi", label: "Syllabus", icon: FileText }] : []),
  ]
  switch (role) {
    case 'student':
      return [
        ...base,
        { to: '/portal/student/grades', label: t('portalNav.myGrades'), icon: BarChart3 },
        { to: '/portal/student/assignments', label: t('portalNav.assignments'), icon: FileText },
        { to: '/portal/student/timetable', label: t('portalNav.timetable'), icon: Calendar },
        { to: '/portal/student/attendance', label: t('portalNav.attendance'), icon: ClipboardCheck },
        { to: '/portal/student/course-attendance', label: language==='fr'?'Présences par cours':'Course attendance', icon: Clock3 },
        { to: '/portal/student/ai-tutor', label: t('portalNav.aiTutor'), icon: Brain },
        { to: '/portal/student/forum', label: t('portalNav.studentForum'), icon: MessageSquare },
        { to: '/portal/student/messages', label: t('portalNav.messages'), icon: MessageSquare },
        { to: '/portal/student/profile', label: t('portalNav.myProfile'), icon: UserCheck },
        { to: '/portal/student/settings', label: t('portalNav.settings'), icon: Settings },
      ]
    case 'parent':
      return [
        ...base,
        { to: '/portal/parent/performance', label: t('portalNav.performance'), icon: BarChart3 },
        { to: '/portal/parent/forum', label: t('portalNav.parentForum'), icon: MessageSquare },
        { to: '/portal/parent/notifications', label: t('portalNav.notifications'), icon: Bell },
        { to: '/portal/parent/messages', label: t('portalNav.messages'), icon: MessageSquare },
        { to: '/portal/parent/calendar', label: t('portalNav.calendar'), icon: Calendar },
        { to: '/portal/parent/finance', label: t('portalNav.fees'), icon: WalletCards },
        { to: '/portal/parent/profile', label: t('portalNav.profile'), icon: UserCheck },
        { to: '/portal/parent/settings', label: t('portalNav.settings'), icon: Settings },
      ]
    case 'teacher':
      return [
        ...base,
        { to: '/portal/teacher/courses', label: t('portalNav.myCourses'), icon: BookOpen },
        { to: '/portal/teacher/students', label: t('portalNav.students'), icon: Users },
        { to: '/portal/teacher/attendance', label: t('portalNav.attendance'), icon: ClipboardCheck },
        { to: '/portal/teacher/pedagogy', label: language === 'fr' ? 'Curriculum et progression' : 'Curriculum & progress', icon: BookOpen },
        { to: '/portal/teacher/course-attendance', label: language === 'fr' ? 'Présences par cours' : 'Course attendance', icon: Clock3 },
        { to: '/portal/teacher/assignments', label: t('portalNav.assignments'), icon: FileText },
        { to: '/portal/teacher/grades', label: t('portalNav.gradebook'), icon: BarChart3 },
        { to: '/portal/teacher/report-card', label: t('portalNav.reportCards'), icon: GraduationCap },
        { to: '/portal/teacher/reports', label: t('portalNav.reports'), icon: FileSpreadsheet },
        { to: '/portal/teacher/timetable', label: t('portalNav.timetable'), icon: Calendar },
        { to: '/portal/teacher/settings', label: t('portalNav.settings'), icon: Settings },
      ]
    case 'staff':
      return [
        ...base,
        { to: '/portal/staff/shining-students', label: 'Shining Student', icon: GraduationCap },
        { to: '/portal/staff/records', label: t('portalNav.records'), icon: LibraryBig },
        { to: '/portal/staff/admissions', label: t('portalNav.admissions'), icon: ClipboardList },
        { to: '/portal/staff/attendance', label: t('portalNav.staffAttendance'), icon: ClipboardCheck },
        { to: '/portal/staff/announcements', label: t('portalNav.announcements'), icon: Megaphone },
        { to: '/portal/staff/reports', label: t('portalNav.reports'), icon: FileSpreadsheet },
        { to: '/portal/staff/finance', label: t('portalNav.feeTracking'), icon: WalletCards },
        { to: '/portal/staff/messages', label: t('portalNav.messages'), icon: MessageSquare },
        { to: '/portal/staff/permissions', label: t('portalNav.permissions'), icon: Shield },
        { to: '/portal/staff/settings', label: t('portalNav.settings'), icon: Settings },
      ]
    case 'admin':
      return [
        ...base,
        { to: '/admin/account-access', label: language === 'fr' ? 'Accès à l’écosystème' : 'Ecosystem access', icon: Ban },
        { to: '/admin/students', label: t('portalNav.students'), icon: GraduationCap },
        { to: '/admin/parents', label: t('portalNav.parents'), icon: Users },
        { to: '/admin/attendance', label: t('portalNav.staffAttendance'), icon: ClipboardCheck },
        { to: '/admin/transcripts', label: t('portalNav.transcripts'), icon: FileSpreadsheet },
        { to: '/admin/report-cards', label: t('portalNav.reportCards'), icon: GraduationCap },
        { to: '/admin/academic-visibility', label: language === 'fr' ? 'Visibilité des résultats' : 'Results visibility', icon: SlidersHorizontal },
        { to: '/admin/certificates', label: language === 'fr' ? 'Certificats' : 'Certificates', icon: Shield },
        { to: '/admin/communications', label: t('portalNav.communications'), icon: Megaphone },
        { to: '/admin/discipline', label: t('portalNav.discipline'), icon: AlertTriangle },
        { to: '/admin/suspensions', label: language === 'fr' ? 'Suspensions' : 'Suspensions', icon: Ban },
        { to: '/admin/school-history', label: language === 'fr' ? 'Historique scolaire' : 'School history', icon: LibraryBig },
        { to: '/admin/student-archives', label: language === 'fr' ? 'Archives élèves' : 'Learner Archives', icon: Archive },
        { to: '/admin/employees', label: t('portalNav.employees'), icon: Users },
        { to: '/admin/admissions', label: t('portalNav.admissions'), icon: ClipboardList },
        { to: '/admin/pre-enrollments', label: language === 'fr' ? 'Préinscriptions' : 'Pre-enrollment', icon: UserPlus },
        { to: '/admin/reports', label: t('portalNav.reports'), icon: FileSpreadsheet },
        { to: '/admin/teacher-reports', label: language === 'fr' ? 'Rapports des enseignants' : 'Teacher reports', icon: FileSpreadsheet },
        { to: '/admin/site', label: language === 'fr' ? 'Gestion du site web' : 'Website management', icon: FileText },
        { to: '/admin/forum-insights', label: t('portalNav.parentAiReport'), icon: Brain },
        { to: '/admin/student-forum-insights', label: t('portalNav.studentAiReport'), icon: Shield },
        { to: '/portal/parent/forum', label: t('portalNav.parentForum'), icon: MessageSquare },
        { to: '/portal/student/forum', label: t('portalNav.studentForum'), icon: MessageSquare },
        { to: '/admin/analytics', label: t('portalNav.aiAnalytics'), icon: Brain },
        { to: '/admin/academic-calendar', label: language === 'fr' ? 'Calendrier académique' : 'Academic Calendar', icon: Calendar },
        { to: '/admin/data-migration', label: 'Imports Excel / CSV', icon: FileSpreadsheet },
        { to: '/admin/settings', label: t('portalNav.settings'), icon: Settings },
      ]
    default:
      return base
  }
}

const PortalSidebar = ({ badges = {} }: PortalSidebarProps) => {
  const earlyYears=useEarlyYearsContext()
  const { t, i18n } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const mobileSidebarRef = useRef<HTMLElement>(null)
  const desktopNavigationRef = useRef<HTMLElement>(null)
  const mobileSidebarButtonRef = useRef<HTMLButtonElement>(null)
  const [menuQuery,setMenuQuery]=useState('')
  const [electionOpening,setElectionOpening]=useState(false)
  const electionLock=useRef(false)
  const [avatarLoadVersion, setAvatarLoadVersion] = useState(0)
  const [desktopActionHeight, setDesktopActionHeight] = useState(() => {
    const saved = Number(localStorage.getItem('kcs-nexus-sidebar-action-height'))
    return Number.isFinite(saved) && saved >= 170 ? saved : 300
  })
  const { user, logout, updateUser } = useAuthStore()
  const {
    sidebarCollapsed,
    sidebarOpen,
    theme,
    toggleTheme,
    language,
    setLanguage,
    toggleSidebar,
    toggleSidebarCollapse,
    setSidebarOpen,
  } = useUIStore()

  useEffect(() => {
    setSidebarOpen(false)
    setMenuQuery('')
  }, [location.pathname, language, user?.id, setSidebarOpen])

  useEffect(() => {
    if (!user?.id) return
    let active = true
    const apply=(avatar:string|null)=>{if(active&&avatar&&useAuthStore.getState().user?.id===user.id)updateUser({avatar})}
    void loadPersonalAvatar(user.id,async()=>{const response=await authAPI.avatar(user.id);return response.data},apply,avatarLoadVersion>0).then(apply)
    return () => { active = false }
  }, [user?.id, avatarLoadVersion, updateUser])

  const handleAvatarError = () => {
    if (!user?.id) return
    // Keep the last valid portrait through transient network or decoding errors.
    if (avatarLoadVersion === 0) setAvatarLoadVersion(1)
  }

  const beginSidebarResize = (event: React.PointerEvent<HTMLDivElement>) => {
    if (sidebarCollapsed) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    const startY = event.clientY
    const startHeight = desktopActionHeight
    const onMove = (moveEvent: PointerEvent) => {
      const maximum = Math.max(190, window.innerHeight - 250)
      const next = Math.min(maximum, Math.max(170, startHeight + startY - moveEvent.clientY))
      setDesktopActionHeight(next)
    }
    const onEnd = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onEnd)
      setDesktopActionHeight((current) => {
        localStorage.setItem('kcs-nexus-sidebar-action-height', String(Math.round(current)))
        return current
      })
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onEnd, { once: true })
  }

  useLayoutEffect(() => {
    const navigation = desktopNavigationRef.current
    if (!navigation) return

    const savedPosition = Number(sessionStorage.getItem('kcs-nexus-desktop-sidebar-scroll') || 0)
    navigation.scrollTop = savedPosition
  }, [location.pathname])

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
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const eventPath = event.composedPath()
      if (
        (mobileSidebarRef.current && eventPath.includes(mobileSidebarRef.current)) ||
        (mobileSidebarButtonRef.current && eventPath.includes(mobileSidebarButtonRef.current))
      ) {
        return
      }

      setSidebarOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSidebarOpen(false)
      }
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer, true)
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('pointerdown', closeOnOutsidePointer, true)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [sidebarOpen, setSidebarOpen])

  if (!user) return null
  const schoolLogoSrc = getAssetUrl('images/kcs.jpg')
  const accessRoles = user.accessRoles?.length ? user.accessRoles : [user.role]
  const activeRole = workspaceRole(user,location.pathname)!
  const principalWorkspace = canUsePrincipalWorkspace(user)

  const seniorWorkspace=/^\/portal\/senior(?:\/|$)/.test(location.pathname)&&canUseSeniorWorkspace(user)
  const mediaAccount=isMediaAccount(user)
  const electionViewer=user.id!=='configured-superadmin'&&(principalWorkspace||canUseSeniorWorkspace(user))
  const electionAudience=!mediaAccount?(user.id==='configured-superadmin'||electionViewer?'ADMIN':activeRole==='parent'?'PARENT':activeRole==='student'?'STUDENT':user.permissions?.some(p=>['nexus:elections-manage','nexus:elections-observe'].includes(p))?'ADMIN':null):null
  const electionLabel=electionAudience==='ADMIN'?(electionViewer?(language==='fr'?'Élections · consultation':'Elections · view only'):(language==='fr'?'Administration des scrutins':'Election administration')):electionAudience==='PARENT'?(language==='fr'?'Élections des parents':'Parent elections'):(language==='fr'?'Élections des élèves':'Student elections')
  const openElections=async()=>{
   if(!electionAudience||electionLock.current)return
   electionLock.current=true;setElectionOpening(true)
   try{const owner=user.id,response=await electionsAPI.launch(electionAudience);if(useAuthStore.getState().user?.id===owner)window.location.assign(response.data.data.url)}
   catch{await alertPortalMessage(language==='fr'?'L’accès électoral n’a pas pu être ouvert. Vérifiez votre connexion et vos droits, puis réessayez.':'The election workspace could not be opened. Check your connection and access rights, then retry.')}
   finally{electionLock.current=false;setElectionOpening(false)}
  }
  const navItems: NavItem[] = seniorWorkspace?[
   {to:'/portal/senior',label:language==='fr'?'Vue d’ensemble ST':'ST overview',icon:LayoutDashboard},
   {to:'/portal/senior/pedagogy',label:language==='fr'?'Pilotage pédagogique':'Pedagogical oversight',icon:BookOpen},
   {to:'/portal/senior/cohort',label:language==='fr'?'Cohorte Grade 12':'Grade 12 cohort',icon:Users},
   {to:'/portal/senior/applications',label:language==='fr'?'Candidatures universitaires':'University applications',icon:GraduationCap},
   {to:'/portal/senior/roadmap',label:language==='fr'?'Échéances et rendez-vous':'Deadlines & meetings',icon:Calendar},
   {to:'/portal/senior/reports',label:language==='fr'?'Rapports d’accompagnement':'Guidance reports',icon:BarChart3},
   {to:'/portal/senior/report-cards',label:language==='fr'?'Bulletins · lecture':'Report cards · view',icon:FileSpreadsheet},
   {to:'/portal/senior/transcripts',label:language==='fr'?'Transcripts · lecture':'Transcripts · view',icon:FileText},
   {to:'/portal/senior/handbook',label:language==='fr'?'Manuel de l’école':'School Handbook',icon:BookOpen},
   {to:'/portal/senior/settings',label:t('portalNav.settings'),icon:Settings},
  ]:mediaAccount?[
   {to:'/portal/media/site',label:language==='fr'?'Gestion du site web':'Website management',icon:FileText},
   {to:'/portal/media/news',label:language==='fr'?'Actualités et événements':'News & Events',icon:Megaphone},
   {to:'/portal/media/gallery',label:language==='fr'?'Galerie et vidéos':'Gallery & Videos',icon:LibraryBig},
   {to:'/portal/media/settings',label:t('portalNav.settings'),icon:Settings},
  ]:activeRole === 'admin' && user.id !== 'configured-superadmin' ? [
    { to: '/admin', label: t('portalNav.dashboard'), icon: LayoutDashboard },
    { to: '/admin/handbook', label: language === 'fr' ? 'Manuel de l’école' : 'School Handbook', icon: BookOpen },
    { to: '/admin/shining-students', label: 'Shining Student', icon: GraduationCap },
    { to: '/admin/incident-reports', label: t('portalNav.incidentReport'), icon: ClipboardList },
    { to: '/admin/electives', label: t('portalNav.electives'), icon: BookOpenCheck },
    { to: '/admin/main-teachers', label: t('portalNav.mainTeacherAssignment'), icon: UserCheck },
    { to: '/admin/report-cards', label: language === 'fr' ? 'Bulletins · lecture' : 'Report cards · view', icon: FileSpreadsheet },
    { to: '/admin/transcripts', label: language === 'fr' ? 'Transcripts · lecture' : 'Transcripts · view', icon: FileSpreadsheet },
    { to: '/admin/teaching-attendance', label: language === 'fr' ? 'Présences aux cours' : 'Teaching attendance', icon: Clock3 },
    { to: '/admin/students', label: t('portalNav.students'), icon: LibraryBig },
    { to: '/admin/parents', label: t('portalNav.parents'), icon: Users },
    { to: '/admin/admissions', label: t('portalNav.admissions'), icon: ClipboardList },
    { to: '/admin/announcements', label: t('portalNav.announcements'), icon: Megaphone },
    { to: '/admin/reports', label: t('portalNav.reports'), icon: FileSpreadsheet },
    { to: '/admin/finance', label: t('portalNav.feeTracking'), icon: WalletCards },
    { to: '/admin/messages', label: t('portalNav.messages'), icon: MessageSquare },
    { to: '/admin/permissions', label: t('portalNav.permissions'), icon: Shield },
    { to: '/admin/academic-calendar', label: language === 'fr' ? 'Calendrier académique' : 'Academic Calendar', icon: Calendar },
    { to: '/admin/settings', label: t('portalNav.settings'), icon: Settings },
  ] : getNavItems(activeRole, t, language)
  const navItemsWithBadges = (earlyYears.enabled&&activeRole==='teacher'?[navItems[0],{to:'/portal/teacher/early-years',label:language==='fr'?'Espace maternelle':'Early years studio',icon:BookOpen,badge:undefined},...navItems.slice(1)]:navItems).map((item) => ({ ...item, badge: badges[item.to] ?? item.badge }))
  const currentLanguage = (i18n.resolvedLanguage || i18n.language || language).startsWith('fr') ? 'fr' : 'en'
  const nextLanguage = currentLanguage === 'en' ? 'fr' : 'en'
  const toggleLanguage = () => {
    setLanguage(nextLanguage)
    void i18n.changeLanguage(nextLanguage)
  }
  const roleColor = {
    admin: 'bg-purple-600',
    staff: 'bg-slate-700',
    teacher: 'bg-green-600',
    student: 'bg-kcs-blue-600',
    parent: 'bg-orange-500',
  }[activeRole]

  const roleName = seniorWorkspace?'Senior Teacher · ST':mediaAccount?'Media':{
    admin: t('roles.admin'),
    staff: t('roles.staff'),
    teacher: t('roles.teacher'),
    student: t('roles.student'),
    parent: t('roles.parent'),
  }[activeRole]

  const menuWords=menuQuery.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().split(/\s+/).filter(Boolean)
  const visibleNavItems=navItemsWithBadges.filter(item=>menuWords.every(word=>item.label.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(word)))
  const menuText=(fr:string,en:string)=>language==='fr'?fr:en
  const renderNavigation = (isMobile = false) => (
    <>
      {(isMobile||!sidebarCollapsed)&&<div className="nexus-menu-finder" translate="no">
        <div className="nexus-menu-caption"><span>{menuText('Votre espace','Your workspace')}</span><span>{visibleNavItems.length} / {navItemsWithBadges.length}</span></div>
        <div className="nexus-menu-search"><Search size={16} aria-hidden="true"/><input type="search" value={menuQuery} onChange={event=>setMenuQuery(event.target.value)} placeholder={menuText('Trouver une rubrique…','Find a section…')} aria-label={menuText('Rechercher dans le menu','Search menu')} autoComplete="off"/>{menuQuery&&<button type="button" onClick={()=>setMenuQuery('')} aria-label={menuText('Effacer la recherche du menu','Clear menu search')}><X size={14}/></button>}</div>
      </div>}
      <nav
        aria-label={menuText('Navigation du tableau de bord','Dashboard navigation')}
        ref={isMobile ? undefined : desktopNavigationRef}
        onScroll={isMobile ? undefined : (event) => {
          sessionStorage.setItem('kcs-nexus-desktop-sidebar-scroll', String(event.currentTarget.scrollTop))
        }}
        className={isMobile ? 'min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-2' : 'min-h-0 flex-1 space-y-1 overflow-y-auto p-3'}
      >
        {visibleNavItems.map(({ to, label, icon: Icon, badge }) => (
          <NavLink
            key={to}
            to={to}
            end={to === (seniorWorkspace ? '/portal/senior' : activeRole === 'admin' ? '/admin' : `/portal/${activeRole}`)}
            onClick={() => {
              if (isMobile) {
                setSidebarOpen(false)
                document.body.style.overflow = ''
              }
            }}
            className={({ isActive }) =>
              `sidebar-link ${to === '/admin/academic-visibility' ? '!py-2.5 ring-1 ring-inset ring-indigo-300/20 shadow-sm transition-all duration-200 hover:ring-sky-300/40' : ''} ${isMobile ? 'sidebar-link-mobile' : ''} ${isActive ? 'active' : ''} ${!isMobile && sidebarCollapsed ? 'justify-center px-0' : ''}`
            }
            title={label}
          >
            <span className="nexus-menu-icon"><Icon size={18} strokeWidth={1.8}/></span>
            {(isMobile || !sidebarCollapsed) && (
              <span className="min-w-0 flex-1 truncate">{label}{to === '/admin/academic-visibility' && <small className="mt-0.5 block truncate text-[10px] font-medium leading-tight opacity-75">{language === 'fr' ? 'Contrôle des accès académiques' : 'Academic access controls'}</small>}</span>
            )}
            {badge && badge > 0 && (
              <span className="flex h-5 min-w-5 flex-shrink-0 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
                {badge > 99 ? '99+' : badge}
              </span>
            )}
          </NavLink>
        ))}
        {!visibleNavItems.length&&<div role="status" className="nexus-menu-empty" translate="no"><Search size={22}/><p>{menuText('Aucune rubrique trouvée.','No matching section.')}</p><button type="button" onClick={()=>setMenuQuery('')}>{menuText('Afficher tout le menu','Show all sections')}</button></div>}
      </nav>

      <div
        className={isMobile ? 'nexus-mobile-menu-actions nexus-sidebar-tools' : 'nexus-sidebar-tools min-h-0 space-y-1 overflow-y-auto border-t border-gray-100 p-3 dark:border-kcs-blue-800'}
        style={!isMobile ? { height: sidebarCollapsed ? 'auto' : desktopActionHeight, flex: sidebarCollapsed ? '0 0 auto' : `0 0 ${desktopActionHeight}px` } : undefined}
      >
        {!mediaAccount && (isMobile || !sidebarCollapsed) && (
          <div
            className={`mb-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-bold leading-4 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/35 dark:text-emerald-200 ${isMobile ? '' : 'touch-none cursor-ns-resize select-none'}`}
            onPointerDown={isMobile ? undefined : beginSidebarResize}
            role={isMobile ? undefined : 'separator'}
            aria-orientation={isMobile ? undefined : 'horizontal'}
            aria-label={isMobile ? undefined : (currentLanguage === 'fr' ? 'Redimensionner les deux zones du menu' : 'Resize the two menu areas')}
            title={isMobile ? undefined : (currentLanguage === 'fr' ? 'Glissez vers le haut ou le bas pour redimensionner le menu' : 'Drag up or down to resize the menu')}
          >
            <span className="flex items-center justify-center gap-1.5"><GripHorizontal size={15} aria-hidden="true" />{currentLanguage === 'fr' ? 'Règle KCS · réussite et passage ≥ 70 %' : 'KCS rule · success and promotion ≥ 70%'}</span>
          </div>
        )}
        {accessRoles.includes('teacher') && (activeRole !== 'teacher'||seniorWorkspace) && (
          <Link to="/portal/teacher" className={isMobile ? 'nexus-mobile-action' : `sidebar-link w-full ${!sidebarCollapsed ? '' : 'justify-center px-0'}`} title={!isMobile && sidebarCollapsed ? (currentLanguage === 'fr' ? 'Espace enseignant' : 'Teacher workspace') : undefined}>
            <BookOpen size={18} />
            {(isMobile || !sidebarCollapsed) && <span>{currentLanguage === 'fr' ? 'Espace enseignant' : 'Teacher workspace'}</span>}
          </Link>
        )}
        {!accessRoles.includes('teacher') && (activeRole !== user.role || seniorWorkspace) && !['admin','staff'].includes(user.role) && (
          <Link to={'/portal/'+user.role} className={isMobile ? 'nexus-mobile-action' : 'sidebar-link w-full'}>
            <UserCheck size={18}/>{(isMobile||!sidebarCollapsed)&&<span>{currentLanguage==='fr'?'Mon espace habituel':'My usual workspace'}</span>}
          </Link>
        )}
        {canUseSeniorWorkspace(user)&&!seniorWorkspace&&<Link to="/portal/senior" className={isMobile?'nexus-mobile-action':`sidebar-link w-full ${sidebarCollapsed?'justify-center px-0':''}`} title="Senior Teacher · ST"><GraduationCap size={18}/>{(isMobile||!sidebarCollapsed)&&<span>{currentLanguage==='fr'?'Espace Senior Teacher · ST':'Senior Teacher workspace'}</span>}</Link>}
        {canUsePrincipalWorkspace(user) && !/^\/admin(?:\/|$)/.test(location.pathname) && (
          <Link to="/admin" className={isMobile?'nexus-mobile-action':`sidebar-link w-full ${sidebarCollapsed?'justify-center px-0':''}`} title={currentLanguage==='fr'?'Espace Principal':'Principal workspace'}>
            <Shield size={18}/>{(isMobile||!sidebarCollapsed)&&<span>{currentLanguage==='fr'?'Espace Principal':'Principal workspace'}</span>}
          </Link>
        )}
        {canUseStaffWorkspace(user) && !/^\/portal\/staff(?:\/|$)/.test(location.pathname) && (
          <Link to="/portal/staff" className={isMobile?'nexus-mobile-action':`sidebar-link w-full ${sidebarCollapsed?'justify-center px-0':''}`} title={currentLanguage==='fr'?'Espace Staff':'Staff workspace'}>
            <UserCheck size={18}/>{(isMobile||!sidebarCollapsed)&&<span>{currentLanguage==='fr'?'Espace Staff':'Staff workspace'}</span>}
          </Link>
        )}
        {electionAudience&&<button type="button" onClick={()=>void openElections()} disabled={electionOpening} aria-busy={electionOpening} data-kcs-no-processing="true" data-election-launch={electionAudience} className={isMobile?'nexus-mobile-action':('sidebar-link w-full '+(sidebarCollapsed?'justify-center px-0':''))} title={!isMobile&&sidebarCollapsed?electionLabel:undefined}>
          {electionOpening?<Loader2 size={18} className="animate-spin"/>:<Vote size={18}/>}
          {(isMobile||!sidebarCollapsed)&&<span>{electionOpening?(language==='fr'?'Ouverture sécurisée…':'Opening securely…'):electionLabel}</span>}
        </button>}
        {(accessRoles.includes('teacher') || user.role === 'admin') && (
          <button type="button" onClick={async () => { const response = await academyAPI.launch(); window.location.assign(response.data.data.url) }}
            className={isMobile ? "nexus-mobile-action" : `sidebar-link w-full ${!sidebarCollapsed ? "" : "justify-center px-0"}`}
            title={!isMobile && sidebarCollapsed ? "KCS Nexus Academy" : undefined}>
            <GraduationCap size={18} />
            {(isMobile || !sidebarCollapsed) && <span>KCS Nexus Academy</span>}
          </button>
        )}
        {(accessRoles.includes('teacher') || user.role === 'admin') && (
          <button type="button" onClick={async () => { const response = await lessonPlanAPI.launch(); window.location.assign(response.data.data.url) }}
            className={isMobile ? "nexus-mobile-action" : `sidebar-link w-full ${!sidebarCollapsed ? "" : "justify-center px-0"}`}
            title={!isMobile && sidebarCollapsed ? "KCS EduPlanner" : undefined}>
            <BookOpenCheck size={18} />
            {(isMobile || !sidebarCollapsed) && <span>KCS EduPlanner</span>}
          </button>
        )}

        <button
          type="button"
          onClick={toggleLanguage}
          className={isMobile ? 'nexus-mobile-action' : `sidebar-link w-full ${!sidebarCollapsed ? '' : 'justify-center gap-1 px-0'}`}
          title={!isMobile && sidebarCollapsed ? (nextLanguage === 'fr' ? 'Français' : 'English') : undefined}
          aria-label={t('common.language')}
        >
          {!isMobile && sidebarCollapsed ? (
            <span className="text-xs font-bold">{nextLanguage.toUpperCase()}</span>
          ) : (
            <>
              <Globe size={18} className="flex-shrink-0" />
              <span>{nextLanguage.toUpperCase()}</span>
            </>
          )}
        </button>
        <button
          type="button"
          onClick={toggleTheme}
          className={isMobile ? 'nexus-mobile-action' : `sidebar-link w-full ${!sidebarCollapsed ? '' : 'justify-center px-0'}`}
          title={!isMobile && sidebarCollapsed ? (theme === 'dark' ? t('common.lightMode') : t('common.darkMode')) : undefined}
        >
          {theme === 'dark' ? <Sun size={18} className="flex-shrink-0" /> : <Moon size={18} className="flex-shrink-0" />}
          {(isMobile || !sidebarCollapsed) && <span>{theme === 'dark' ? t('common.lightMode') : t('common.darkMode')}</span>}
        </button>
        <Link
          to="/"
          onClick={() => isMobile && setSidebarOpen(false)}
          className={isMobile ? 'nexus-mobile-action' : `sidebar-link ${!sidebarCollapsed ? '' : 'justify-center px-0'}`}
          title={!isMobile && sidebarCollapsed ? t('common.mainWebsite') : undefined}
        >
          <Home size={18} className="flex-shrink-0" />
          {(isMobile || !sidebarCollapsed) && <span>{t('common.mainWebsite')}</span>}
        </Link>
        <button
          onClick={() => {
            setSidebarOpen(false)
            logout()
            navigate('/login', { replace: true })
          }}
          className={isMobile ? 'nexus-mobile-action nexus-mobile-action-danger' : `sidebar-link w-full text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 ${!sidebarCollapsed ? '' : 'justify-center px-0'}`}
          title={!isMobile && sidebarCollapsed ? t('nav.logout') : undefined}
        >
          <LogOut size={18} className="flex-shrink-0" />
          {(isMobile || !sidebarCollapsed) && <span>{t('nav.logout')}</span>}
        </button>
      </div>
    </>
  )

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-50 px-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] sm:px-4 lg:hidden">
        <div className="nexus-mobile-dashboard-bar nexus-sidebar-topbar flex min-h-14 items-center justify-between gap-2 rounded-[24px] border px-2.5 py-2 sm:rounded-[28px] sm:px-3">
        <Link data-nexus-mobile-brand to="/" onClick={() => setSidebarOpen(false)} className="flex min-w-0 flex-1 items-center gap-2.5">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-white p-0.5 shadow-kcs ring-2 ring-kcs-blue-100 dark:ring-kcs-blue-800">
            <img src={schoolLogoSrc} alt="Kinshasa Christian School" className="h-full w-full rounded-full object-contain" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-display text-[13px] font-bold leading-tight text-kcs-blue-900 dark:text-white sm:text-sm">
              KCS Nexus
            </p>
            <p className="truncate text-[11px] font-semibold leading-tight text-kcs-gold-700 dark:text-kcs-gold-300 sm:text-xs">
              {roleName}
            </p>
          </div>
        </Link>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            data-nexus-language-switch
            onClick={toggleLanguage}
            className="flex h-10 flex-shrink-0 items-center justify-center gap-1 rounded-full border border-kcs-blue-100 bg-white/70 px-2 text-kcs-blue-700 shadow-sm transition-colors hover:bg-kcs-blue-50 dark:border-white/10 dark:bg-kcs-blue-900/45 dark:text-kcs-blue-100 dark:hover:bg-kcs-blue-800"
            aria-label={t('common.language')}
            title={nextLanguage === 'fr' ? 'Français' : 'English'}
          >
            <Globe size={16} />
            <span className="text-xs font-bold">{nextLanguage.toUpperCase()}</span>
          </button>
          <button
            type="button"
            data-nexus-theme-switch
            onClick={toggleTheme}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-kcs-blue-100 bg-white/70 text-kcs-blue-700 shadow-sm transition-colors hover:bg-kcs-blue-50 dark:border-white/10 dark:bg-kcs-blue-900/45 dark:text-kcs-blue-100 dark:hover:bg-kcs-blue-800"
            aria-label={theme === 'dark' ? t('common.lightMode') : t('common.darkMode')}
            title={theme === 'dark' ? t('common.lightMode') : t('common.darkMode')}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            data-nexus-menu-trigger
            ref={mobileSidebarButtonRef}
            aria-expanded={sidebarOpen}
            aria-controls="nexus-sidebar-drawer"
            onClick={toggleSidebar}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-kcs-blue-700 text-white shadow-kcs transition-colors hover:bg-kcs-blue-800 dark:bg-kcs-gold-600 dark:text-kcs-blue-950 dark:hover:bg-kcs-gold-500"
            aria-label={sidebarOpen ? t('common.close') : t('nav.portal')}
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        </div>
      </div>

      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            className="nexus-mobile-menu-overlay fixed inset-x-0 bottom-0 z-[60] bg-kcs-blue-950/45 p-3 backdrop-blur-sm lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.08 }}
            onPointerDown={() => setSidebarOpen(false)}
            onClick={() => setSidebarOpen(false)}
          >
            <motion.aside
              ref={mobileSidebarRef}
              id="nexus-sidebar-drawer"
              data-nexus-sidebar="drawer"
              role="dialog"
              aria-modal="true"
              aria-label={menuText('Menu de votre espace','Workspace menu')}
              className="nexus-mobile-menu-panel nexus-sidebar-drawer nexus-glass-rail flex w-[min(calc(100vw-1.5rem),372px)] flex-col overflow-hidden rounded-[26px] border shadow-2xl shadow-kcs-blue-950/24"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="nexus-sidebar-drawer-profile sticky top-0 z-10 border-b border-gray-100 bg-white/42 p-3 backdrop-blur-xl dark:border-kcs-blue-800 dark:bg-kcs-blue-950/42">
                <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-kcs-blue-200 dark:bg-kcs-blue-700" aria-hidden="true" />
                <div className="rounded-[24px] border border-white/70 bg-white/60 p-3 shadow-inner shadow-white/40 backdrop-blur-xl dark:border-white/10 dark:bg-kcs-blue-900/40 dark:shadow-none">
                <div className="flex items-center gap-3">
                  {user.avatar ? <img src={user.avatar} alt={[user.lastName, user.middleName, user.firstName].filter(Boolean).join(' ')} className="h-12 w-12 flex-shrink-0 rounded-full object-cover ring-4 ring-white dark:ring-kcs-blue-950" onError={handleAvatarError}/> : <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full ${roleColor} text-sm font-bold text-white ring-4 ring-white dark:ring-kcs-blue-950`}>{user.firstName?.[0]}{user.lastName?.[0]}</div>}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                      {[user.lastName, user.middleName, user.firstName].filter(Boolean).join(' ')}
                    </p>
                    <p className="truncate text-xs capitalize text-gray-500 dark:text-gray-400">
                      {roleName}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(false)}
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-kcs-blue-100 bg-white/80 text-kcs-blue-700 shadow-sm transition hover:bg-kcs-blue-50 dark:border-white/10 dark:bg-kcs-blue-900/70 dark:text-kcs-blue-100 dark:hover:bg-kcs-blue-800"
                    aria-label={t('common.close')}
                  >
                    <X size={18} />
                  </button>
                </div>
                </div>
              </div>
              {renderNavigation(true)}
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        animate={{ width: sidebarCollapsed ? 80 : 272 }}
        initial={false}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="hidden shrink-0 lg:block"
        aria-hidden="true"
      />

      <AnimatePresence initial={false}>
        {(
    <motion.aside
      animate={{ width: sidebarCollapsed ? 80 : 272 }}
      initial={{ width: 0, opacity: 0 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      id="nexus-desktop-sidebar"
      data-nexus-sidebar="desktop"
      data-collapsed={sidebarCollapsed}
      className="nexus-sidebar-rail nexus-glass-rail fixed inset-y-0 left-0 z-40 hidden h-dvh flex-col overflow-hidden border-r lg:flex"
    >
      {/* Logo */}
      <div data-nexus-desktop-brand className={`${sidebarCollapsed ? 'px-3 py-4' : 'p-4'} border-b border-gray-100 dark:border-kcs-blue-800`}>
        <div className={`flex ${sidebarCollapsed ? 'flex-col items-center gap-3' : 'items-center gap-2'}`}>
        <Link
          to="/"
          className={`flex min-w-0 items-center gap-3 ${sidebarCollapsed ? 'flex-none justify-center' : 'flex-1'}`}
          title={sidebarCollapsed ? 'KCS Nexus' : undefined}
        >
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-white bg-white p-0.5 shadow-kcs ring-1 ring-kcs-blue-100 dark:ring-kcs-blue-800">
            <img src={schoolLogoSrc} alt="Kinshasa Christian School" className="h-full w-full rounded-lg object-contain" />
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
                <span className="nexus-brand-eyebrow">KCS ORBIT ECOSYSTEM</span><p className="font-bold text-xs leading-tight font-display text-kcs-blue-900 dark:text-white whitespace-nowrap">
                  KCS Nexus
                </p>
                <p className="text-xs text-kcs-gold-600 dark:text-kcs-gold-400 whitespace-nowrap">
                  {roleName}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </Link>
        <button
          type="button"
          onClick={toggleTheme}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-white/60 bg-white/70 text-kcs-blue-700 shadow-sm transition-colors hover:bg-kcs-blue-50 dark:border-white/10 dark:bg-kcs-blue-900/45 dark:text-kcs-blue-200 dark:hover:bg-kcs-blue-800"
          aria-label={theme === 'dark' ? 'Activer le mode clair' : 'Activer le mode sombre'}
          title={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        </div>
      </div>

      {/* User Profile */}
      <div className={`nexus-sidebar-profile border-b border-white/60 p-4 dark:border-white/10 ${sidebarCollapsed ? 'items-center' : ''}`}>
        <div className={`flex items-center gap-3 rounded-[22px] border border-white/60 bg-white/50 p-2.5 backdrop-blur-xl dark:border-white/10 dark:bg-kcs-blue-900/30 ${sidebarCollapsed ? 'justify-center' : ''}`}>
          {user.avatar ? <img src={user.avatar} alt={[user.lastName, user.middleName, user.firstName].filter(Boolean).join(' ')} className="h-10 w-10 min-h-10 min-w-10 flex-none aspect-square rounded-full object-cover" onError={handleAvatarError}/> : <div className={`h-10 w-10 min-h-10 min-w-10 flex-none aspect-square rounded-full ${roleColor} flex items-center justify-center text-white font-bold text-sm`}>{user.firstName?.[0]}{user.lastName?.[0]}</div>}
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="min-w-0 flex-1"
              >
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                  {[user.lastName, user.middleName, user.firstName].filter(Boolean).join(' ')}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 capitalize truncate">
                  {roleName}
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
        data-nexus-sidebar-collapse
        aria-expanded={!sidebarCollapsed}
        aria-label={menuText(sidebarCollapsed?'Déployer le menu':'Réduire le menu',sidebarCollapsed?'Expand menu':'Collapse menu')}
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
