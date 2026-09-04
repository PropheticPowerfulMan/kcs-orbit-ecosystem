import DateSelect from '@/components/shared/DateSelect'
import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Bell, BookOpen, Brain, Calendar, CheckCircle2, ChevronRight,
  Clock, Download, FileText, GraduationCap, LibraryBig, MessageSquare, Printer, Settings, TrendingUp, Upload, Users, AlertTriangle, ClipboardCheck, X
} from 'lucide-react'
import PortalSidebar from '@/components/layout/PortalSidebar'
import PortalSectionPanel from '@/components/shared/PortalSectionPanel'
import SuggestionBox from '@/components/shared/SuggestionBox'
import AccountSettingsPanel from '@/components/shared/AccountSettingsPanel'
import AdvancedGradebook from '@/components/gradebook/AdvancedGradebook'
import TeacherAcademicOperations from '@/components/teacher/TeacherAcademicOperations'
import TeacherHomeroomAttendance from '@/components/teacher/TeacherHomeroomAttendance'
import { aiAPI, authAPI, messagesAPI, teacherWorkspaceAPI } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import { getLocalizedGreeting, getLocalizedPortalDate } from '@/utils/portalGreeting'
import { printOfficialPdf } from '@/utils/officialPdf'
import {
  aiSignals,
  aiRecommendations,
  assignments as ecosystemAssignments,
  attendance as ecosystemAttendance,
  attendanceAnalytics,
  disciplineReports,
  grades as ecosystemGrades,
  gradebookCategories,
  gradingScales,
  internalThreads,
  lmsResources,
  messages as ecosystemMessages,
  reportCards,
  schedules as ecosystemSchedules,
  students as ecosystemStudents,
  subjects,
} from '@/data/schoolEcosystem'

const todayClasses: any[] = []
const gradingQueue: any[] = []
const studentAlerts: any[] = []
const messages: any[] = []

const getTeacherSegment = (pathname: string) => {
  const segment = pathname.split('/').filter(Boolean).at(-1)
  return !segment || segment === 'teacher' || segment === 'dashboard' ? 'dashboard' : segment
}

const statusTone = (value: string) => {
  if (['high', 'absent', 'missing', 'Open'].includes(value)) return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
  if (['medium', 'late', 'pending', 'Pending confirmation'].includes(value)) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
  return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
}

const gradeOptions = ['K4', 'K3', 'K5', 'Kindergarten', '1st Grade', '2nd Grade', '3rd Grade', '4th Grade', '5th Grade', '6th Grade', '7th Grade', '8th Grade', '9th Grade', '10th Grade', '11th Grade', '12th Grade']

const inferGradeLabel = (className: string) => {
  if (className.includes('12')) return '12th Grade'
  if (className.includes('11')) return '11th Grade'
  if (className.includes('10')) return '10th Grade'
  if (className.includes('9')) return '9th Grade'
  if (className.includes('8')) return '8th Grade'
  return className
}

const gradingScaleRows = [
  ['99', '100', 'A+'], ['94', '98', 'A'], ['92', '93', 'A-'], ['90', '91', 'B+'],
  ['84', '89', 'B'], ['82', '83', 'B-'], ['80', '81', 'C+'], ['72', '79', 'C'],
  ['70', '71', 'C-'], ['68', '69', 'D+'], ['62', '67', 'D'], ['60', '61', 'D-'], ['0', '60', 'F'],
]

const downloadTeacherFile = (fileName: string, content: string, type = 'text/plain;charset=utf-8') => {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

type GradebookColumn = {
  id: string
  title: string
  type: string
  date: string
  maxPoints: number
}

type ProfileDraft = {
  firstName: string
  middleName: string
  lastName: string
  email: string
  phone: string
  avatar: string
}

type TeacherAiTask = 'lesson-plan' | 'quiz' | 'feedback' | 'intervention' | 'meeting-summary'

type TeacherAiTool = {
  task: TeacherAiTask
  title: string
  detail: string
}

type RegistryStudent = {
  id: string
  name: string
  grade: string
  section: string
  parentId?: string
  advisor?: string
  average?: number
  gpa?: number
  rank?: number
  attendance?: number
  risk?: string
  strengths?: string[]
  weaknesses?: string[]
  aiInsight?: string
  gradedItems?: number
  attendanceRecords?: number
  missingAssignments?: number
}

type StudentProfileResponse = {
  id: string
  studentNumber?: string
  grade: string
  section?: string
  gpa?: number | null
  attendanceRate?: number | null
  status?: string
  analytics?: {
    average?: number | null
    attendanceRate?: number | null
    rank?: number | null
    risk?: string
    strengths?: string[]
    weaknesses?: string[]
    gradedItems?: number
    attendanceRecords?: number
    missingAssignments?: number
  }
  user?: {
    firstName?: string
    lastName?: string
    email?: string
  }
  parentLinks?: Array<{
    parentId?: string
    parent?: {
      id?: string
    }
  }>
}

const toClassKey = (grade: string, section = '') => `${grade}${section}`.replace(/\s+/g, '').toLowerCase()

const mapRegistryStudent = (student: StudentProfileResponse, index: number): RegistryStudent => {
  const firstName = student.user?.firstName?.trim() ?? ''
  const lastName = student.user?.lastName?.trim() ?? ''
  const name = `${firstName} ${lastName}`.trim() || student.studentNumber || `Student ${index + 1}`

  return {
    id: student.id,
    name,
    grade: student.grade,
    section: student.section ?? '',
    parentId: student.parentLinks?.[0]?.parentId ?? student.parentLinks?.[0]?.parent?.id,
    advisor: 'Official assigned-course roster',
    average: student.analytics?.average ?? undefined,
    rank: student.analytics?.rank ?? undefined,
    attendance: student.analytics?.attendanceRate ?? undefined,
    risk: student.analytics?.risk ?? 'unassessed',
    strengths: student.analytics?.strengths ?? [],
    weaknesses: student.analytics?.weaknesses ?? [],
    gradedItems: student.analytics?.gradedItems ?? 0,
    attendanceRecords: student.analytics?.attendanceRecords ?? 0,
    missingAssignments: student.analytics?.missingAssignments ?? 0,
    aiInsight: student.analytics?.average == null && student.analytics?.attendanceRate == null
      ? 'No verified academic or attendance evidence has been recorded yet for ' + name + '.'
      : 'Verified indicators: ' + (student.analytics?.gradedItems ?? 0) + ' graded item(s), ' + (student.analytics?.attendanceRecords ?? 0) + ' attendance record(s), and ' + (student.analytics?.missingAssignments ?? 0) + ' overdue assignment(s).',

  }
}

const TeacherSectionView = ({ segment }: { segment: string }) => {
  const { user, updateUser } = useAuthStore()
  const sectionTitles: Record<string, { title: string; subtitle: string; icon: React.ElementType }> = {
    courses: { title: 'My Courses', subtitle: 'Assigned classes, rooms, schedules, and teaching load.', icon: BookOpen },
    students: { title: 'Students', subtitle: 'Academic profile, risk level, strengths, and support needs for each learner.', icon: Users },
    attendance: { title: 'Attendance', subtitle: 'Daily attendance records, class trends, and follow-up signals.', icon: ClipboardCheck },
    assignments: { title: 'Assignments', subtitle: 'Homework status, priorities, missing work, and LMS resources.', icon: FileText },
    grades: { title: 'Gradebook', subtitle: 'Assignments, final grades, averages, medians, legend, and grading scale.', icon: TrendingUp },
    'report-card': { title: 'Gradebook', subtitle: 'Assignments, final grades, averages, medians, legend, and grading scale.', icon: TrendingUp },
    reports: { title: 'Reports', subtitle: 'Report cards, AI comments, exports, and principal approval status.', icon: GraduationCap },
    diagnostics: { title: 'AI Diagnostics', subtitle: 'Actionable academic and attendance signals based on your assigned learners.', icon: Brain },
    timetable: { title: 'Timetable', subtitle: 'Your synchronized teaching schedule, rooms, and class details.', icon: Calendar },
    resources: { title: 'Learning Resources', subtitle: 'Search, review, and manage resources shared with your classes.', icon: LibraryBig },
    discipline: { title: 'Detailed Student Discipline Report', subtitle: 'Incident context, action taken, parent contact, and follow-up plan.', icon: AlertTriangle },
    messages: { title: 'Messages', subtitle: 'Teacher inbox, parent threads, and internal coordination messages.', icon: MessageSquare },
    settings: { title: 'Settings', subtitle: 'Manage your teacher profile, contact details, and profile photo.', icon: Settings },
  }

  const meta = sectionTitles[segment] ?? sectionTitles.reports
  const Icon = meta.icon
  const [superAdminStudentPool, setSuperAdminStudentPool] = useState<RegistryStudent[]>([])
  const [registryStatus, setRegistryStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  const getRosterForClass = (className: string) => superAdminStudentPool.filter((student) => (
    toClassKey(student.grade, student.section) === toClassKey(className) || inferGradeLabel(`${student.grade}${student.section}`) === className
  ))

  const [actionMessage, setActionMessage] = useState('')
  const [actionIsError, setActionIsError] = useState(false)
  const [resourceQuery, setResourceQuery] = useState('')
  const [selectedResource, setSelectedResource] = useState<(typeof lmsResources)[number] | null>(null)
  const [selectedSchedule, setSelectedSchedule] = useState<(typeof ecosystemSchedules)[number] | null>(null)
  const [profileDraft, setProfileDraft] = useState<ProfileDraft>(() => ({ firstName: user?.firstName ?? '', middleName: user?.middleName ?? '', lastName: user?.lastName ?? '', email: user?.email ?? '', phone: user?.phone ?? '', avatar: user?.avatar ?? '' }))
  const [profileDialog, setProfileDialog] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [twoFactorSecret, setTwoFactorSecret] = useState('')
  const [twoFactorCode, setTwoFactorCode] = useState('')
  const [twoFactorSetupUrl, setTwoFactorSetupUrl] = useState('')
  const [workspaceRevision, setWorkspaceRevision] = useState<number | undefined>()
  const [workspaceStatus, setWorkspaceStatus] = useState<'loading' | 'ready' | 'saving' | 'error'>('loading')
  const [reportPeriod, setReportPeriod] = useState<'Daily' | 'Weekly' | 'Annual'>('Daily')
  const [selectedAiStudent, setSelectedAiStudent] = useState<RegistryStudent | null>(null)
  const [studentQuery, setStudentQuery] = useState('')
  const [studentClassFilter, setStudentClassFilter] = useState('All')
  const [studentDetail, setStudentDetail] = useState<RegistryStudent | null>(null)
  const [courses, setCourses] = useState(() =>
    subjects.map((subject: any, index: number) => {
      const gradeLevel = inferGradeLabel(subject.className)
      return {
        ...subject,
        abbreviation: subject.name.split(' ').map((word: string) => word[0]).join('').slice(0, 6).toUpperCase(),
        creditHours: index === 1 ? 4 : index === 0 ? 3 : 2,
        gradeLevels: [gradeLevel],
        studentIds: [] as string[],
        status: 'active',
      }
    }).slice(0, 0),
  )
  const [courseTab, setCourseTab] = useState<'setup' | 'enrollment'>('setup')
  const [courseSearch, setCourseSearch] = useState('')
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null)
  const [selectedEnrollmentCourseId, setSelectedEnrollmentCourseId] = useState('')
  const [selectedGradebookCourseId, setSelectedGradebookCourseId] = useState('')
  const [gradebookColumnsByCourse, setGradebookColumnsByCourse] = useState<Record<string, GradebookColumn[]>>({})
  const [gradebookScores, setGradebookScores] = useState<Record<string, string>>({})
  const [teacherStudents, setTeacherStudents] = useState<RegistryStudent[]>([])
  const [attendanceEntries, setAttendanceEntries] = useState(() => ecosystemAttendance.slice(0, 0))
  const [assignmentList, setAssignmentList] = useState(() => ecosystemAssignments.slice(0, 0))
  const [gradeEntries, setGradeEntries] = useState(() => ecosystemGrades.slice(0, 0))
  const [reportList, setReportList] = useState(() => reportCards.slice(0, 0))
  const [disciplineList, setDisciplineList] = useState(() => disciplineReports.slice(0, 0))
  const [reportCardStudentId, setReportCardStudentId] = useState('')
  const [reportCardTerm, setReportCardTerm] = useState('')
  const [reportCardRows, setReportCardRows] = useState(() =>
    subjects.slice(0, 4).map((subject, index) => ({
      id: subject.id,
      course: subject.name,
      teacher: subject.teacher,
      coefficient: index === 1 ? 2 : 1,
      points: index === 0 ? 89 : index === 1 ? 95 : index === 2 ? 91 : 76,
      maxPoints: 100,
      comment: index === 1 ? 'Excellent lab reasoning' : index === 3 ? 'Needs steady homework rhythm' : 'Good progress',
    })).slice(0, 0),
  )
  const [generatedReportCards, setGeneratedReportCards] = useState<Array<{
    id: string
    student: string
    term: string
    average: number
    mention: string
    rows: typeof reportCardRows
    summary: string
  }>>([])
  const [inbox, setInbox] = useState<any[]>([])
  const [messageContacts, setMessageContacts] = useState<Array<{ id: string; firstName: string; lastName: string; role: string }>>([])
  const [submittedTeacherReports, setSubmittedTeacherReports] = useState<Array<Record<string, unknown>>>([])

  const [courseDraft, setCourseDraft] = useState({
    name: '',
    abbreviation: '',
    creditHours: 1,
    className: '',
    room: '',
    gradeLevels: [] as string[],
    studentId: '',
  })
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [attendanceDraft, setAttendanceDraft] = useState({
    studentId: '',
    date: new Date().toISOString().slice(0, 10),
    status: 'present',
    className: '',
  })
  const [assignmentDraft, setAssignmentDraft] = useState({
    studentId: '',
    title: '',
    subject: '',
    due: '',
    status: 'pending',
    priority: 'medium',
  })
  const [gradeDraft, setGradeDraft] = useState({
    studentId: '',
    subject: '',
    assessment: '',
    score: 0,
    max: 100,
    date: new Date().toISOString().slice(0, 10),
  })
  const [reportDraft, setReportDraft] = useState({
    student: '',
    term: '',
    average: 0,
    conduct: '',
    teacherComment: '',
  })
  const [disciplineDraft, setDisciplineDraft] = useState({
    studentId: '',
    category: '',
    incident: '',
    actionTaken: '',
    followUp: '',
    level: 'medium',
  })
  const [messageDraft, setMessageDraft] = useState({
    to: '',
    subject: '',
    body: '',
  })
  const [gradebookColumnDraft, setGradebookColumnDraft] = useState({
    title: '',
    type: '',
    date: '',
    maxPoints: 100,
  })

  useEffect(() => {
    if (!user?.id) return
    let active = true
    setWorkspaceStatus('loading')
    teacherWorkspaceAPI.get().then((response) => {
      if (!active) return
      const workspace = response.data?.data
      const state = workspace?.state as Record<string, any> | undefined
      if (state) {
        if (Array.isArray(state.courses) && state.courses.length) setCourses(state.courses)
        if (Array.isArray(state.teacherStudents) && state.teacherStudents.length) setTeacherStudents(state.teacherStudents)
        if (Array.isArray(state.attendanceEntries)) setAttendanceEntries(state.attendanceEntries)
        if (Array.isArray(state.assignmentList)) setAssignmentList(state.assignmentList)
        if (Array.isArray(state.gradeEntries)) setGradeEntries(state.gradeEntries)
        if (Array.isArray(state.reportList)) setReportList(state.reportList)
        if (Array.isArray(state.disciplineList)) setDisciplineList(state.disciplineList)
        if (Array.isArray(state.reportCardRows)) setReportCardRows(state.reportCardRows)
        if (Array.isArray(state.generatedReportCards)) setGeneratedReportCards(state.generatedReportCards)
        if (Array.isArray(state.inbox)) setInbox(state.inbox)
        if (Array.isArray(state.submittedTeacherReports)) setSubmittedTeacherReports(state.submittedTeacherReports)
        if (state.gradebookColumnsByCourse && typeof state.gradebookColumnsByCourse === 'object') setGradebookColumnsByCourse(state.gradebookColumnsByCourse)
        if (state.gradebookScores && typeof state.gradebookScores === 'object') setGradebookScores(state.gradebookScores)
      }
      setWorkspaceRevision(workspace?.revision)
      setWorkspaceStatus('ready')
    }).catch(() => {
      if (active) setWorkspaceStatus('error')
    })
    return () => { active = false }
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) return
    let active = true
    Promise.all([messagesAPI.getContacts(), messagesAPI.getAll({ box: 'all' })]).then(([contactsResponse, messagesResponse]) => {
      if (!active) return
      const contacts = contactsResponse.data?.data ?? []
      setMessageContacts(contacts)
      setMessageDraft((draft) => ({ ...draft, to: draft.to || contacts[0]?.id || '' }))
      const liveMessages = (messagesResponse.data?.data ?? []).map((message: any) => ({
        id: message.id,
        from: message.senderId === user.id ? `To ${message.recipient?.firstName ?? ''} ${message.recipient?.lastName ?? ''}`.trim() : `${message.sender?.firstName ?? ''} ${message.sender?.lastName ?? ''}`.trim(),
        subject: message.subject,
        body: message.body,
        time: new Date(message.createdAt).toLocaleString(),
        requiresResponse: !message.readAt && message.recipientId === user.id,
      }))
      setInbox(liveMessages)
    }).catch(() => undefined)
    return () => { active = false }
  }, [user?.id])

  const findStudent = (studentId: string) => superAdminStudentPool.find((student) => student.id === studentId)
  const runAction = (message: string, isError = false) => { setActionMessage(message); setActionIsError(isError) }

  useEffect(() => {
    let active = true

    const loadStudents = async () => {
      setRegistryStatus('loading')
      try {
        const response = await teacherWorkspaceAPI.overview()
        const overview = response.data?.data ?? {}
        const registryStudents = (overview.students ?? []).map(mapRegistryStudent)
        const officialCourses = (overview.courses ?? []).map((course: any) => ({
          id: course.id,
          name: course.name,
          className: course.grade,
          room: course.schedules?.[0]?.room ?? '—',
          teacher: 'Assigned teacher',
          abbreviation: course.code,
          creditHours: course.credits ?? 1,
          gradeLevels: [course.grade],
          studentIds: (course.enrollments ?? []).map((enrollment: any) => enrollment.studentId),
          status: 'active',
        }))
        if (!active) return
        setSuperAdminStudentPool(registryStudents)
        setTeacherStudents(registryStudents)
        setCourses((current) => current.length ? current : officialCourses)
        setSelectedEnrollmentCourseId((current) => current || officialCourses[0]?.id || '')
        setSelectedGradebookCourseId((current) => current || officialCourses[0]?.id || '')
        setRegistryStatus('ready')
      } catch {
        if (!active) return
        setSuperAdminStudentPool([])
        setRegistryStatus('error')
      }
    }

    loadStudents()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    setCourses((current) => current.map((course) => ({
      ...course,
      studentIds: getRosterForClass(course.className || course.gradeLevels[0]).map((student) => student.id),
    })))
  }, [superAdminStudentPool])

  useEffect(() => {
    const firstStudent = superAdminStudentPool[0]
    if (!firstStudent) return

    setSelectedStudentId((current) => current || firstStudent.id)
    setReportCardStudentId((current) => current || firstStudent.id)
    setTeacherStudents((current) => current.length ? current : superAdminStudentPool)
    setAttendanceDraft((draft) => ({ ...draft, studentId: draft.studentId || firstStudent.id }))
    setAssignmentDraft((draft) => ({ ...draft, studentId: draft.studentId || firstStudent.id }))
    setGradeDraft((draft) => ({ ...draft, studentId: draft.studentId || firstStudent.id }))
    setReportDraft((draft) => ({ ...draft, student: draft.student || firstStudent.name }))
    setDisciplineDraft((draft) => ({ ...draft, studentId: draft.studentId || superAdminStudentPool[1]?.id || firstStudent.id }))
    setCourseDraft((draft) => ({ ...draft, studentId: draft.studentId || firstStudent.id }))
  }, [superAdminStudentPool])
  const reportCardStudent = findStudent(reportCardStudentId)
  const reportCardAverage = useMemo(() => {
    const totalWeightedPoints = reportCardRows.reduce((sum, row) => sum + (row.points / Math.max(row.maxPoints, 1)) * 100 * row.coefficient, 0)
    const totalCoefficient = reportCardRows.reduce((sum, row) => sum + row.coefficient, 0)
    return totalCoefficient ? Number((totalWeightedPoints / totalCoefficient).toFixed(2)) : 0
  }, [reportCardRows])
  const reportCardMention = reportCardAverage >= 90 ? 'Excellent' : reportCardAverage >= 80 ? 'Very Good' : reportCardAverage >= 70 ? 'Satisfactory' : reportCardAverage >= 60 ? 'Needs Support' : 'Intervention Required'
  const reportCardDecision = reportCardAverage >= 70 ? 'Promote academic momentum' : 'Create support plan before final approval'

  const updateReportCardRow = (rowId: string, field: 'course' | 'points' | 'maxPoints' | 'coefficient' | 'comment', value: string | number) => {
    setReportCardRows((current) => current.map((row) => row.id === rowId ? { ...row, [field]: value } : row))
  }

  const getWorkspaceState = (overrides: Record<string, unknown> = {}) => ({
    courses, teacherStudents, attendanceEntries, assignmentList, gradeEntries, reportList, disciplineList,
    reportCardRows, generatedReportCards, inbox, submittedTeacherReports, gradebookColumnsByCourse, gradebookScores, ...overrides,
  })

  const persistWorkspace = async (overrides: Record<string, unknown> = {}, successMessage?: string) => {
    setWorkspaceStatus('saving')
    try {
      const response = await teacherWorkspaceAPI.save(getWorkspaceState(overrides), workspaceRevision)
      setWorkspaceRevision(response.data?.data?.revision)
      setWorkspaceStatus('ready')
      if (successMessage) runAction(successMessage)
      return true
    } catch (error: any) {
      setWorkspaceStatus('error')
      runAction(error?.response?.data?.message || 'The operation was not saved. Check your session and connection, then try again.', true)
      return false
    }
  }

  const readProfilePhoto = (file?: File) => {
    if (!file || !file.type.startsWith('image/')) return setProfileDialog('Please select a valid image file.')
    if (file.size > 1024 * 1024) return setProfileDialog('The profile photo must be smaller than 1 MB.')
    const reader = new FileReader()
    reader.onload = () => { setProfileDraft((draft) => ({ ...draft, avatar: String(reader.result) })); setProfileDialog('Profile photo loaded. Save changes to confirm this update.') }
    reader.readAsDataURL(file)
  }

  const saveTeacherProfile = async () => {
    if (!profileDraft.firstName.trim() || !profileDraft.lastName.trim()) return setProfileDialog('First name and last name are required.')
    if (!/^\S+@\S+\.\S+$/.test(profileDraft.email)) return setProfileDialog('Enter a valid email address.')
    setProfileSaving(true)
    try {
      let updatedUser = user
      if (profileDraft.email.trim().toLowerCase() !== user?.email?.toLowerCase()) {
        const emailResponse = await authAPI.updateEmail({ newEmail: profileDraft.email.trim(), currentPassword })
        updatedUser = emailResponse.data?.data
      }
      const profileResponse = await authAPI.updateProfile({ firstName: profileDraft.firstName.trim(), middleName: profileDraft.middleName.trim() || null, lastName: profileDraft.lastName.trim(), phone: profileDraft.phone.trim(), avatar: profileDraft.avatar })
      updatedUser = { ...updatedUser, ...profileResponse.data?.data }
      updateUser(updatedUser ?? profileDraft)
      setCurrentPassword('')
      window.dispatchEvent(new CustomEvent('kcs-profile-updated', { detail: { userId: user?.id, profile: updatedUser } }))
      setProfileDialog('Your profile was saved to KCS Nexus and will remain available after refresh or reconnection.')
    } catch (error: any) {
      setProfileDialog(error?.response?.data?.message || 'The profile could not be saved. No success was recorded.')
    } finally {
      setProfileSaving(false)
    }
  }

  const startTwoFactorSetup = async () => {
    try {
      const response = await authAPI.setup2FA()
      setTwoFactorSecret(response.data?.data?.secret ?? '')
      setTwoFactorSetupUrl(response.data?.data?.otpauthUrl ?? '')
      setProfileDialog('A new authenticator secret was created. Add it to your authenticator app, then verify a current code.')
    } catch (error: any) {
      setProfileDialog(error?.response?.data?.message || 'Two-factor authentication setup failed.')
    }
  }

  const verifyTwoFactorSetup = async () => {
    try {
      await authAPI.verify2FA(twoFactorCode)
      updateUser({ twoFactorEnabled: true })
      setTwoFactorCode('')
      setTwoFactorSecret('')
      setTwoFactorSetupUrl('')
      setProfileDialog('Two-factor authentication is enabled and will be required at the next sign-in.')
    } catch (error: any) {
      setProfileDialog(error?.response?.data?.message || 'The authenticator code could not be verified.')
    }
  }

  const disableTwoFactor = async () => {
    try {
      await authAPI.toggle2FA(false)
      updateUser({ twoFactorEnabled: false })
      setProfileDialog('Two-factor authentication was disabled on your account.')
    } catch (error: any) {
      setProfileDialog(error?.response?.data?.message || 'Two-factor authentication could not be disabled.')
    }
  }

  const printTeacherReport = () => window.print()
  const saveWorkspace = () => { void persistWorkspace({}, `${meta.title} changes were saved to KCS Nexus.`) }
  const exportWorkspacePdf = () => {
    const exportData = (() => {
      if (segment === 'courses') return { columns: ['Subject', 'Class', 'Room', 'Credit hours', 'Enrolled'], rows: courses.map((course) => [course.name, course.gradeLevels.join(', '), course.room, course.creditHours, course.studentIds.length]), narrative: 'Official teaching-load and subject-enrolment register.' }
      if (segment === 'attendance') return { columns: ['Student', 'Date', 'Class', 'Status'], rows: attendanceEntries.map((record) => [findStudent(record.studentId)?.name ?? 'Student', record.date, record.className, record.status]), narrative: 'Homeroom daily attendance register, generated from the current teacher record.' }
      if (segment === 'assignments') return { columns: ['Assignment', 'Student', 'Subject', 'Due date', 'Status', 'Priority'], rows: assignmentList.map((item) => [item.title, findStudent(item.studentId)?.name ?? 'Student', item.subject, item.due, item.status, item.priority]), narrative: 'Assignment register and learner follow-up status.' }
      if (segment === 'reports' || segment === 'report-card') return { columns: ['Student', 'Cycle', 'Average', 'Conduct', 'Approval'], rows: reportList.map((item) => [item.student, item.term, `${item.average}%`, item.conduct, item.principalStatus]), narrative: 'Teacher report-card register for administrative review.' }
      if (segment === 'discipline') return { columns: ['Reference', 'Student', 'Date', 'Category', 'Level', 'Status'], rows: disciplineList.map((item) => [item.id, item.student, item.date, item.category, item.level, item.status]), narrative: 'Confidential discipline-report register. Distribution is restricted to authorized staff.' }
      if (segment === 'messages') return { columns: ['From / To', 'Subject', 'Time', 'Response'], rows: inbox.map((item) => [item.from, item.subject, item.time, item.requiresResponse ? 'Required' : 'No']), narrative: 'Confidential teacher communication register.' }
      if (segment === 'settings') return { columns: ['Field', 'Recorded value'], rows: [['Teacher', `${profileDraft.lastName} ${profileDraft.middleName} ${profileDraft.firstName}`.replace(/\s+/g, ' ').trim()], ['Email', profileDraft.email], ['Phone', profileDraft.phone]], narrative: 'Teacher profile record. This document does not include the profile photo.' }
      return { columns: ['Student', 'Class', 'Average', 'Attendance', 'Risk'], rows: teacherStudents.map((student) => [student.name, `${student.grade}${student.section}`, `${student.average ?? '—'}%`, `${student.attendance ?? '—'}%`, student.risk ?? 'low']), narrative: 'Current teacher student-support register.' }
    })()
    if (!printOfficialPdf({ title: `Teacher ${meta.title} Export`, subtitle: 'KCS Nexus AI — Kinshasa Christian School', metadata: [['Document', meta.title], ['Teacher', `${profileDraft.lastName} ${profileDraft.middleName} ${profileDraft.firstName}`.replace(/\s+/g, ' ').trim() || 'Teacher'], ['Academic year', '2025–2026'], ['Records', exportData.rows.length]], ...exportData, orientation: exportData.columns.length > 5 ? 'landscape' : 'portrait' })) return runAction('Allow pop-ups to generate the official printable PDF.')
    runAction(`${meta.title} contextual official PDF was generated.`)
  }
  const submitTeacherReport = async () => {
    const report = { id: `TR-${Date.now()}`, period: reportPeriod, teacher: `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim(), submittedAt: new Date().toISOString(), students: teacherStudents.length, attendance: Math.round(teacherStudents.reduce((sum, student) => sum + (student.attendance ?? 0), 0) / Math.max(teacherStudents.length, 1)), status: 'Submitted to administrative staff' }
    const nextReports = [report, ...submittedTeacherReports]
    if (await persistWorkspace({ submittedTeacherReports: nextReports }, `${reportPeriod} report submitted to Administrative Staff.`)) {
      setSubmittedTeacherReports(nextReports)
      downloadTeacherFile(`kcs-${reportPeriod.toLowerCase()}-teacher-report-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(report, null, 2), 'application/json')
    }
  }

  const addReportCardCourse = () => {
    setReportCardRows((current) => [
      ...current,
      {
        id: `rc-${Date.now()}`,
        course: 'New Course',
        teacher: [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Teacher',
        coefficient: 1,
        points: 0,
        maxPoints: 100,
        comment: 'Teacher comment pending',
      },
    ])
    runAction('New report-card course row added.')
  }

  const toggleCourseGrade = (grade: string) => {
    setCourseDraft((draft) => ({ ...draft, gradeLevels: [grade], className: grade }))
  }

  const resetCourseDraft = () => {
    const firstStudentId = superAdminStudentPool[0]?.id ?? ''
    setEditingCourseId(null)
    setCourseDraft({
      name: '',
      abbreviation: '',
      creditHours: 1,
      className: '',
      room: '',
      gradeLevels: [] as string[],
      studentId: firstStudentId,
    })
  }

  const generateReportCard = async () => {
    const studentName = reportCardStudent?.name ?? 'Selected student'
    const summary = `${studentName} earned ${reportCardAverage}% for ${reportCardTerm}. Mention: ${reportCardMention}. Decision: ${reportCardDecision}.`
    const nextReport = {
      id: `rc-final-${Date.now()}`,
      student: studentName,
      term: reportCardTerm,
      average: reportCardAverage,
      mention: reportCardMention,
      rows: reportCardRows,
      summary,
    }
    const nextGenerated = [nextReport, ...generatedReportCards]
    const nextReportList = [{
      student: studentName,
      term: reportCardTerm,
      average: reportCardAverage,
      conduct: reportCardMention,
      teacherComment: summary,
      principalStatus: 'Pending review',
      download: 'Report card draft',
    }, ...reportList]
    if (await persistWorkspace({ generatedReportCards: nextGenerated, reportList: nextReportList }, `${studentName}'s report card was generated and saved with an automatic ${reportCardAverage}% average.`)) {
      setGeneratedReportCards(nextGenerated)
      setReportList(nextReportList)
    }
  }

  const createCourse = async () => {
    const selectedGrade = courseDraft.gradeLevels[0] ?? '10th Grade'
    const roster = getRosterForClass(courseDraft.className || selectedGrade)
    const nextCourse = {
      id: editingCourseId ?? `course-${Date.now()}`,
      name: courseDraft.name,
      abbreviation: courseDraft.abbreviation,
      creditHours: courseDraft.creditHours,
      teacher: [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Teacher',
      className: selectedGrade,
      room: courseDraft.room,
      gradeLevels: [selectedGrade],
      studentIds: roster.map((student) => student.id),
      status: editingCourseId ? 'updated' : 'draft',
    }
    const nextCourses = editingCourseId ? courses.map((course) => course.id === editingCourseId ? { ...course, ...nextCourse } : course) : [nextCourse, ...courses]
    const existingIds = new Set(teacherStudents.map((student) => student.id))
    const nextStudents = [...roster.filter((student) => !existingIds.has(student.id)), ...teacherStudents]
    if (!await persistWorkspace({ courses: nextCourses, teacherStudents: nextStudents }, `${nextCourse.name} ${editingCourseId ? 'updated' : 'created'} for ${selectedGrade}; ${roster.length} official student(s) enrolled.`)) return
    setCourses(nextCourses)
    setTeacherStudents(nextStudents)
    setSelectedGradebookCourseId(nextCourse.id)
    setEditingCourseId(null)
  }

  const editCourse = (courseId: string) => {
    const course = courses.find((item) => item.id === courseId)
    if (!course) return
    setEditingCourseId(course.id)
    setCourseDraft({
      name: course.name,
      abbreviation: course.abbreviation,
      creditHours: course.creditHours,
      className: course.className,
      room: course.room,
      gradeLevels: course.gradeLevels,
      studentId: course.studentIds[0] ?? superAdminStudentPool[0]?.id ?? '',
    })
    runAction(`${course.name} loaded for editing.`)
  }

  const deleteCourse = async (courseId: string) => {
    const course = courses.find((item) => item.id === courseId)
    const nextCourses = courses.filter((item) => item.id !== courseId)
    if (!await persistWorkspace({ courses: nextCourses }, `${course?.name ?? 'Subject'} removed and saved.`)) return
    setCourses(nextCourses)
    if (editingCourseId === courseId) resetCourseDraft()
    if (selectedEnrollmentCourseId === courseId) setSelectedEnrollmentCourseId(courses.find((item) => item.id !== courseId)?.id ?? '')
  }

  const filteredCourses = courses.filter((course) => {
    const searchable = `${course.gradeLevels.join(' ')} ${course.name} ${course.abbreviation} ${course.room}`.toLowerCase()
    return searchable.includes(courseSearch.toLowerCase())
  })
  const selectedEnrollmentCourse = courses.find((course) => course.id === selectedEnrollmentCourseId) ?? courses[0]
  const totalEnrollment = courses.reduce((sum, course) => sum + course.studentIds.length, 0)
  const totalCreditHours = courses.reduce((sum, course) => sum + course.creditHours, 0)
  const coveredGrades = Array.from(new Set(courses.flatMap((course) => course.gradeLevels))).length

  const openCourseEnrollment = (courseId: string) => {
    const course = courses.find((item) => item.id === courseId)
    setSelectedEnrollmentCourseId(courseId)
    setCourseTab('enrollment')
    runAction(`${course?.name ?? 'Subject'} enrollment opened.`)
  }

  const toggleCourseEnrollment = async (courseId: string, student: RegistryStudent) => {
    const course = courses.find((item) => item.id === courseId)
    if (!course) return
    const enrolled = course.studentIds.includes(student.id)
    const nextCourses = courses.map((item) => item.id === courseId ? { ...item, studentIds: enrolled ? item.studentIds.filter((id: string) => id !== student.id) : [...item.studentIds, student.id] } : item)
    const nextStudents = !enrolled && !teacherStudents.some((item) => item.id === student.id) ? [student, ...teacherStudents] : teacherStudents
    if (!await persistWorkspace({ courses: nextCourses, teacherStudents: nextStudents }, `${student.name} ${enrolled ? 'removed from' : 'enrolled in'} ${course.name}; enrollment saved.`)) return
    setCourses(nextCourses)
    setTeacherStudents(nextStudents)
  }

  const selectedGradebookCourse = courses.find((course) => course.id === selectedGradebookCourseId) ?? courses[0]
  const gradebookColumns = selectedGradebookCourse ? gradebookColumnsByCourse[selectedGradebookCourse.id] ?? [] : []
  const gradebookStudents = selectedGradebookCourse?.studentIds
    .map((studentId: string) => findStudent(studentId))
    .filter((student: RegistryStudent | undefined): student is RegistryStudent => Boolean(student)) ?? []

  const getGradebookScoreKey = (columnId: string, studentId: string) => `${selectedGradebookCourse?.id}-${columnId}-${studentId}`
  const normalizeGradebookEntry = (value: string, maxPoints: number) => {
    const normalized = value.trim().toUpperCase()
    if (!normalized || normalized === 'E' || normalized === 'I') return null
    if (normalized === 'U') return 0
    const numeric = Number(normalized)
    if (!Number.isFinite(numeric)) return null
    return Math.max(0, Math.min(100, (numeric / Math.max(maxPoints, 1)) * 100))
  }

  const getFinalGrade = (studentId: string) => {
    const countedScores = gradebookColumns
      .map((column) => normalizeGradebookEntry(gradebookScores[getGradebookScoreKey(column.id, studentId)] ?? '', column.maxPoints))
      .filter((score: number | null): score is number => score !== null)
    if (!countedScores.length) return null
    return Math.round(countedScores.reduce((sum: number, score: number) => sum + score, 0) / countedScores.length)
  }

  const gradebookValues = gradebookStudents
    .map((student: RegistryStudent) => getFinalGrade(student.id))
    .filter((score: number | null): score is number => score !== null)
  const gradebookAverage = gradebookValues.length ? Math.round(gradebookValues.reduce((sum: number, score: number) => sum + score, 0) / gradebookValues.length) : 0
  const gradebookMedian = gradebookValues.length ? [...gradebookValues].sort((a, b) => a - b)[Math.floor(gradebookValues.length / 2)] : 0

  const updateGradebookScore = (columnId: string, studentId: string, score: string) => {
    setGradebookScores((current) => ({ ...current, [getGradebookScoreKey(columnId, studentId)]: score }))
  }

  const createGradebookColumn = async () => {
    const title = gradebookColumnDraft.title.trim()
    if (!title) {
      runAction('Add a column name before creating a gradebook column.', true)
      return
    }
    const nextColumn = {
      id: `gb-${Date.now()}`,
      title,
      type: gradebookColumnDraft.type.trim() || 'Assignment',
      date: gradebookColumnDraft.date.trim() || '04/30/2026',
      maxPoints: Math.max(1, Number(gradebookColumnDraft.maxPoints) || 100),
    }
    const nextColumns = {
      ...gradebookColumnsByCourse,
      [selectedGradebookCourse.id]: [...(gradebookColumnsByCourse[selectedGradebookCourse.id] ?? []), nextColumn],
    }
    if (!await persistWorkspace({ gradebookColumnsByCourse: nextColumns }, `${nextColumn.title} column added and saved. Final grades recalculated.`)) return
    setGradebookColumnsByCourse(nextColumns)
    setGradebookColumnDraft((draft) => ({ ...draft, title: '', maxPoints: 100 }))
  }

  const deleteGradebookColumn = async (columnId: string) => {
    const nextColumns = { ...gradebookColumnsByCourse, [selectedGradebookCourse.id]: (gradebookColumnsByCourse[selectedGradebookCourse.id] ?? []).filter((column) => column.id !== columnId) }
    const nextScores = { ...gradebookScores }
      Object.keys(nextScores).forEach((key) => {
        if (key.includes(`-${columnId}-`)) delete nextScores[key]
      })
    if (!await persistWorkspace({ gradebookColumnsByCourse: nextColumns, gradebookScores: nextScores }, 'Gradebook column removed, saved, and final grades recalculated.')) return
    setGradebookColumnsByCourse(nextColumns)
    setGradebookScores(nextScores)
  }

  const importStudent = async () => {
    const student = findStudent(selectedStudentId)
    if (!student) return
    const nextStudents = teacherStudents.some((item) => item.id === student.id) ? teacherStudents : [student, ...teacherStudents]
    if (!await persistWorkspace({ teacherStudents: nextStudents }, `${student.name} imported from the Super Admin registry and saved.`)) return
    setTeacherStudents(nextStudents)
  }

  const addAttendance = async () => {
    const student = findStudent(attendanceDraft.studentId)
    const nextEntries = [{ ...attendanceDraft, date: attendanceDraft.date || new Date().toISOString().slice(0, 10) }, ...attendanceEntries]
    if (!await persistWorkspace({ attendanceEntries: nextEntries }, `${student?.name ?? 'Student'} marked ${attendanceDraft.status}; the saved workspace is available to authorized staff.`)) return
    setAttendanceEntries(nextEntries)
  }

  const createAssignment = async () => {
    const student = findStudent(assignmentDraft.studentId)
    const nextAssignments = [{ id: `asg-${Date.now()}`, ...assignmentDraft }, ...assignmentList]
    if (!await persistWorkspace({ assignmentList: nextAssignments }, `${assignmentDraft.title} assigned to ${student?.name ?? 'selected student'} and saved.`)) return
    setAssignmentList(nextAssignments)
  }

  const addGrade = async () => {
    const student = findStudent(gradeDraft.studentId)
    const nextGrades = [{ ...gradeDraft, teacher: `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || 'Teacher' }, ...gradeEntries]
    if (!await persistWorkspace({ gradeEntries: nextGrades }, `${gradeDraft.assessment} saved for ${student?.name ?? 'selected student'} and synchronized with report data.`)) return
    setGradeEntries(nextGrades)
  }

  const createReport = async () => {
    const nextReports = [{ ...reportDraft, createdAt: new Date().toISOString(), principalStatus: 'Pending review', download: 'Draft' }, ...reportList]
    if (!await persistWorkspace({ reportList: nextReports }, `${reportDraft.student}'s report draft saved for principal approval.`)) return
    setReportList(nextReports)
  }

  const createDisciplineReport = async () => {
    const student = findStudent(disciplineDraft.studentId)
    const timestamp = new Date()
    const nextReport = {
      id: `disc-${String(disciplineList.length + 1).padStart(3, '0')}`,
      studentId: disciplineDraft.studentId,
      student: student?.name ?? 'Selected student',
      date: timestamp.toLocaleDateString(),
      time: timestamp.toLocaleTimeString(),
      createdAt: timestamp.toISOString(),
      level: disciplineDraft.level,
      category: disciplineDraft.category,
      incident: disciplineDraft.incident,
      context: 'Teacher-created record from classroom observation and linked student data.',
      actionTaken: disciplineDraft.actionTaken,
      followUp: disciplineDraft.followUp,
      parentContact: 'Draft message prepared',
      status: 'Open',
    }
    const nextReports = [nextReport, ...disciplineList]
    if (!await persistWorkspace({ disciplineList: nextReports }, `Detailed discipline report saved for ${student?.name ?? 'selected student'}.`)) return
    setDisciplineList(nextReports)
  }

  const sendMessage = async () => {
    const recipient = messageContacts.find((contact) => contact.id === messageDraft.to)
    if (!recipient) return runAction('Select a valid recipient from the KCS Nexus directory.', true)
    try {
      const response = await messagesAPI.send({ recipientId: recipient.id, subject: messageDraft.subject, body: messageDraft.body })
      const message = response.data?.data
      setInbox((current) => [{ id: message.id, from: `To ${recipient.firstName} ${recipient.lastName}`, subject: message.subject, body: message.body, time: new Date(message.createdAt).toLocaleString(), requiresResponse: false }, ...current])
      runAction(`Message sent to ${recipient.firstName} ${recipient.lastName} and stored in KCS Nexus.`)
    } catch (error: any) {
      runAction(error?.response?.data?.message || 'The message was not sent.', true)
    }
  }

  const inputClass = 'input-kcs py-2 text-sm'
  const panelClass = 'rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50'
  const compactButton = 'rounded-xl bg-kcs-blue-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-kcs-blue-800'

  if (segment === 'attendance') return <TeacherHomeroomAttendance />

  if (segment === 'assignments') return <TeacherAcademicOperations segment={segment} />

  if (segment === 'grades') {
    return (
      <section className="space-y-6">
        <div className="rounded-2xl border border-kcs-blue-100 bg-white p-5 shadow-sm dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-kcs-blue-50 text-kcs-blue-700 dark:bg-kcs-blue-900/40 dark:text-kcs-blue-300">
                <Icon size={22} />
              </div>
              <div>
                <h2 className="font-display text-xl font-bold text-kcs-blue-900 dark:text-white">{meta.title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                  AI-powered grade entry, weighted calculations, predictive risk, parent/student sync, and report-card automation.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={saveWorkspace} className="btn-primary flex items-center gap-2 py-2 text-sm"><CheckCircle2 size={16} /> Save updates</button>
              <button onClick={exportWorkspacePdf} className="btn-gold flex items-center gap-2 py-2 text-sm"><FileText size={16} /> Export PDF</button>
            </div>
          </div>
        </div>

        {actionMessage && (
          <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${actionIsError ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300' : 'border-green-100 bg-green-50 text-green-700 dark:border-green-900/40 dark:bg-green-900/20 dark:text-green-300'}`}>
            {actionMessage}
          </div>
        )}

        <AdvancedGradebook
          courses={courses}
          students={superAdminStudentPool}
          selectedCourseId={selectedGradebookCourseId}
          onSelectCourse={setSelectedGradebookCourseId}
          onAction={runAction}
        />
      </section>
    )
  }

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-kcs-blue-100 bg-white p-5 shadow-sm dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-kcs-blue-50 text-kcs-blue-700 dark:bg-kcs-blue-900/40 dark:text-kcs-blue-300">
              <Icon size={22} />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-kcs-blue-900 dark:text-white">{meta.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{meta.subtitle}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={saveWorkspace} className="btn-primary flex items-center gap-2 py-2 text-sm"><CheckCircle2 size={16} /> Save updates</button>
            <button onClick={exportWorkspacePdf} className="btn-gold flex items-center gap-2 py-2 text-sm"><FileText size={16} /> Export PDF</button>
          </div>
        </div>
      </div>

      {actionMessage && (
        <div className={`rounded-xl border px-4 py-3 text-sm font-medium ${actionIsError ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300' : 'border-green-200 bg-green-50 text-green-700 dark:border-green-900/40 dark:bg-green-900/20 dark:text-green-300'}`}>
          {actionMessage}
        </div>
      )}

      {segment === 'courses' && (
        <div className="space-y-6">
          <div className="overflow-hidden rounded-2xl border border-kcs-blue-100 bg-white shadow-sm dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
            <div className="border-b border-gray-100 px-5 pt-5 dark:border-kcs-blue-800">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-kcs-blue-500">Kinshasa Christian School</p>
                  <h3 className="font-display text-xl font-bold text-kcs-blue-900 dark:text-white">Subject Setup</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Current production academic cycle. Add only subjects you actually teach and grades officially enrolled.</p>
                </div>
                <div className="flex rounded-xl bg-gray-100 p-1 dark:bg-kcs-blue-800/40">
                  {[
                    { id: 'setup', label: 'Subject Setup' },
                    { id: 'enrollment', label: 'Subject Enrollment' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setCourseTab(tab.id as 'setup' | 'enrollment')}
                      className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${courseTab === tab.id ? 'bg-white text-kcs-blue-800 shadow-sm dark:bg-kcs-blue-950 dark:text-white' : 'text-gray-500 hover:text-kcs-blue-700 dark:text-gray-300'}`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-5 grid gap-3 pb-5 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  { label: 'Subjects', value: courses.length, sub: 'active workspace' },
                  { label: 'Enrollment', value: totalEnrollment, sub: 'student seats' },
                  { label: 'Credit Hours', value: totalCreditHours, sub: 'teaching load' },
                  { label: 'Grade Coverage', value: coveredGrades, sub: 'grade levels' },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl bg-gray-50 px-4 py-3 dark:bg-kcs-blue-800/30">
                    <p className="font-display text-2xl font-bold text-kcs-blue-900 dark:text-white">{item.value}</p>
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">{item.label}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{item.sub}</p>
                  </div>
                ))}
              </div>
            </div>

            {courseTab === 'setup' && (
              <div className="grid gap-6 p-5 xl:grid-cols-[0.8fr_1.2fr]">
                <div className="rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-800/30">
                  <h4 className="font-bold text-kcs-blue-900 dark:text-white">{editingCourseId ? 'Edit subject' : 'Add a subject that you teach'}</h4>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Fill in the fields below. Grades can be selected in bulk like a school SIS.</p>
                  <div className="mt-4 grid gap-3">
                    <label className="grid gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
                      Subject name
                      <input className={inputClass} value={courseDraft.name} onChange={(event) => setCourseDraft((draft) => ({ ...draft, name: event.target.value }))} />
                    </label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="grid gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
                        Abbreviation
                        <input className={inputClass} value={courseDraft.abbreviation} onChange={(event) => setCourseDraft((draft) => ({ ...draft, abbreviation: event.target.value }))} />
                      </label>
                      <label className="grid gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
                        Credit Hours
                        <input className={inputClass} type="number" min={0} value={courseDraft.creditHours} onChange={(event) => setCourseDraft((draft) => ({ ...draft, creditHours: Number(event.target.value) }))} />
                      </label>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="grid gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
                        Room
                        <input className={inputClass} value={courseDraft.room} onChange={(event) => setCourseDraft((draft) => ({ ...draft, room: event.target.value }))} />
                      </label>
                      <div className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-gray-600 dark:bg-kcs-blue-950/40 dark:text-gray-300">
                        Auto enrollment
                        <p className="mt-1 text-lg font-bold text-kcs-blue-900 dark:text-white">{getRosterForClass(courseDraft.className || courseDraft.gradeLevels[0]).length}</p>
                        <p className="font-normal text-gray-400">official student(s) in selected class</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Which class do you teach the subject for?</p>
                      <div className="mt-2 rounded-xl border border-gray-100 bg-white p-3 dark:border-kcs-blue-800 dark:bg-kcs-blue-950/30">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                        {gradeOptions.map((grade) => (
                          <label key={grade} className="flex min-w-0 items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-300">
                            <input className="h-4 w-4 flex-shrink-0 border-gray-300 text-kcs-blue-700 focus:ring-kcs-blue-500" type="radio" name="course-grade" checked={courseDraft.gradeLevels[0] === grade} onChange={() => toggleCourseGrade(grade)} />
                            <span className="min-w-0 break-words leading-snug">{grade}</span>
                          </label>
                        ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={createCourse} className="rounded-xl bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700">{editingCourseId ? 'Save subject' : 'Add subject'}</button>
                      {editingCourseId && <button onClick={resetCourseDraft} className="rounded-xl border-2 border-kcs-blue-600 bg-white px-4 py-2 text-sm font-bold text-kcs-blue-800 hover:bg-kcs-blue-50 dark:border-kcs-gold-400 dark:bg-kcs-blue-950 dark:text-kcs-gold-300 dark:hover:bg-kcs-blue-800">Cancel edit</button>}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <label className="relative block sm:w-72">
                      <input className={inputClass} value={courseSearch} onChange={(event) => setCourseSearch(event.target.value)} placeholder="Search" />
                    </label>
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{filteredCourses.length} subject(s)</span>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-kcs-blue-800">
                    <table className="w-full min-w-[820px] text-left text-sm">
                      <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-kcs-blue-800/40 dark:text-gray-300">
                        <tr>
                          <th className="px-3 py-3">Grade</th>
                          <th className="px-3 py-3">Subject</th>
                          <th className="px-3 py-3">Abbreviation</th>
                          <th className="px-3 py-3">Cr. Hours</th>
                          <th className="px-3 py-3">Enrollment</th>
                          <th className="px-3 py-3">Edit</th>
                          <th className="px-3 py-3">Delete</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-kcs-blue-800">
                        {filteredCourses.map((subject) => (
                          <tr key={subject.id} className="text-gray-700 dark:text-gray-300">
                            <td className="px-3 py-3">{subject.gradeLevels.join(', ')}</td>
                            <td className="px-3 py-3 font-semibold text-kcs-blue-900 dark:text-white">{subject.name}</td>
                            <td className="px-3 py-3">{subject.abbreviation}</td>
                            <td className="px-3 py-3">{subject.creditHours}</td>
                            <td className="px-3 py-3">
                              <button onClick={() => openCourseEnrollment(subject.id)} className="rounded-full bg-kcs-blue-50 px-3 py-1 text-xs font-bold text-kcs-blue-700 transition-colors hover:bg-kcs-blue-700 hover:text-white dark:bg-kcs-blue-900/40 dark:text-kcs-blue-200">
                                {subject.studentIds.length} enrolled
                              </button>
                            </td>
                            <td className="px-3 py-3">
                              <button onClick={() => editCourse(subject.id)} className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-700 transition-colors hover:bg-kcs-blue-100 hover:text-kcs-blue-800 dark:bg-kcs-blue-800/40 dark:text-gray-200">
                                Edit
                              </button>
                            </td>
                            <td className="px-3 py-3">
                              <button onClick={() => deleteCourse(subject.id)} className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-600 transition-colors hover:bg-red-600 hover:text-white dark:bg-red-900/20 dark:text-red-300">
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {courseTab === 'enrollment' && (
              <div className="grid gap-4 p-5 lg:grid-cols-2">
                {selectedEnrollmentCourse && (
                  <div className="lg:col-span-2 rounded-xl border border-kcs-blue-100 bg-kcs-blue-50 p-4 dark:border-kcs-blue-700 dark:bg-kcs-blue-900/30">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase text-kcs-blue-500">Selected subject enrollment</p>
                        <h4 className="font-bold text-kcs-blue-900 dark:text-white">{selectedEnrollmentCourse.name}</h4>
                        <p className="text-xs text-gray-600 dark:text-gray-300">{selectedEnrollmentCourse.gradeLevels.join(', ')} - {selectedEnrollmentCourse.studentIds.length} enrolled - {superAdminStudentPool.length - selectedEnrollmentCourse.studentIds.length} available</p>
                      </div>
                      <button onClick={() => editCourse(selectedEnrollmentCourse.id)} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-kcs-blue-700 shadow-sm hover:bg-kcs-blue-100 dark:bg-kcs-blue-950 dark:text-kcs-blue-200">
                        Edit selected subject
                      </button>
                    </div>
                  </div>
                )}
                {courses.map((subject) => (
                  <div role="button" tabIndex={0} onClick={() => setSelectedEnrollmentCourseId(subject.id)} key={subject.id} className={`cursor-pointer rounded-xl border p-4 ${selectedEnrollmentCourse?.id === subject.id ? 'border-kcs-blue-300 bg-white shadow-sm dark:border-kcs-blue-600 dark:bg-kcs-blue-900/40' : 'border-gray-100 bg-gray-50 dark:border-kcs-blue-800 dark:bg-kcs-blue-800/30'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase text-kcs-blue-500">{subject.gradeLevels.join(', ')}</p>
                        <h4 className="mt-1 font-bold text-kcs-blue-900 dark:text-white">{subject.name}</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{subject.abbreviation} - {subject.creditHours} credit hour(s) - {subject.room}</p>
                      </div>
                      <span className="badge-blue text-xs">{subject.studentIds.length} enrolled</span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button type="button" onClick={(event) => { event.stopPropagation(); editCourse(subject.id); setCourseTab('setup') }} className="rounded-full bg-kcs-gold-100 px-3 py-1 text-xs font-bold text-kcs-blue-800">Modify subject</button>
                      <button type="button" onClick={(event) => { event.stopPropagation(); deleteCourse(subject.id); setCourseTab('setup') }} className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">Delete subject</button>
                      {superAdminStudentPool.map((student) => {
                        const enrolled = subject.studentIds.includes(student.id)
                        return (
                          <button
                            key={student.id}
                            onClick={() => void toggleCourseEnrollment(subject.id, student)}
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${enrolled ? 'bg-kcs-blue-700 text-white' : 'bg-white text-gray-700 hover:bg-kcs-blue-50 hover:text-kcs-blue-700 dark:bg-kcs-blue-950/50 dark:text-gray-300'}`}
                          >
                            {enrolled ? '✓' : '+'} {student.name}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {segment === 'students' && (
        <div className="space-y-6">
          <div className={panelClass}><h3 className="font-bold text-kcs-blue-900 dark:text-white">Detailed student search</h3><div className="mt-4 grid gap-3 md:grid-cols-[1fr_220px]"><input className={inputClass} value={studentQuery} onChange={(event) => setStudentQuery(event.target.value)} placeholder="Search name, class, advisor, risk, strengths, weaknesses..."/><select className={inputClass} value={studentClassFilter} onChange={(event) => setStudentClassFilter(event.target.value)}><option>All</option>{Array.from(new Set(teacherStudents.map((student) => `${student.grade}${student.section}`))).sort().map((className) => <option key={className}>{className}</option>)}</select></div></div>
        <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <div className={panelClass}>
            <h3 className="font-bold text-kcs-blue-900 dark:text-white">Import from Super Admin registry</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Teacher-created rosters must be based on official school records.</p>
            <div className="mt-4 grid gap-3">
              <select className={inputClass} value={selectedStudentId} onChange={(event) => setSelectedStudentId(event.target.value)}>
                {superAdminStudentPool.map((student) => <option key={student.id} value={student.id}>{student.name} - {student.grade}{student.section} - {student.risk} risk</option>)}
              </select>
              <button onClick={importStudent} className={compactButton}>Add to my students</button>
            </div>
            <div className="mt-5 rounded-xl bg-kcs-blue-50 p-4 text-sm text-kcs-blue-800 dark:bg-kcs-blue-900/30 dark:text-kcs-blue-200">
              {superAdminStudentPool.length} verified students available from the school registry.
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
          {teacherStudents.filter((student) => { const text = `${student.name} ${student.grade}${student.section} ${student.advisor} ${student.risk} ${student.strengths?.join(' ')} ${student.weaknesses?.join(' ')}`.toLowerCase(); return (studentClassFilter === 'All' || `${student.grade}${student.section}` === studentClassFilter) && text.includes(studentQuery.toLowerCase()) }).map((student) => (
            <button type="button" onClick={() => setStudentDetail(student)} key={student.id} className="rounded-2xl border border-gray-100 bg-white p-5 text-left transition hover:border-kcs-blue-300 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-kcs-blue-900 dark:text-white">{student.name}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{student.grade}{student.section} - advisor {student.advisor}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(student.risk ?? 'low')}`}>{student.risk ?? 'low'} risk</span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                <div><p className="font-bold text-kcs-blue-900 dark:text-white">{student.average == null ? 'N/A' : student.average + '%'}</p><p className="text-xs text-gray-500">Verified average</p></div>
                <div><p className="font-bold text-kcs-blue-900 dark:text-white">{student.attendance == null ? 'N/A' : student.attendance + '%'}</p><p className="text-xs text-gray-500">Teacher attendance</p></div>
                <div><p className="font-bold text-kcs-blue-900 dark:text-white">{student.rank == null ? 'N/A' : '#' + student.rank}</p><p className="text-xs text-gray-500">Measured rank</p></div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{student.aiInsight}</p>
            </button>
          ))}
          </div>
        </div>
        {studentDetail && <div className="fixed inset-0 z-50 flex items-center justify-center bg-kcs-blue-950/65 p-4"><div className="w-full max-w-2xl rounded-3xl bg-white p-6 dark:bg-kcs-blue-900"><div className="flex justify-between"><div><p className="text-xs font-bold uppercase text-kcs-gold-600">Official student profile</p><h3 className="mt-1 text-xl font-bold text-kcs-blue-900 dark:text-white">{studentDetail.name}</h3></div><button onClick={() => setStudentDetail(null)}><X size={18}/></button></div><div className="mt-5 grid gap-3 sm:grid-cols-3">{[['Class', `${studentDetail.grade}${studentDetail.section}`], ['Average', `${studentDetail.average ?? 'N/A'}%`], ['Attendance', `${studentDetail.attendance ?? 'N/A'}%`], ['Rank', `#${studentDetail.rank ?? 'N/A'}`], ['Risk', studentDetail.risk ?? 'low'], ['Advisor', studentDetail.advisor ?? 'Pending']].map(([label, value]) => <div key={label} className="rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-800/30"><p className="text-xs text-gray-400">{label}</p><p className="mt-1 font-bold text-kcs-blue-900 dark:text-white">{value}</p></div>)}</div><p className="mt-4 rounded-xl bg-kcs-blue-50 p-4 text-sm dark:bg-kcs-blue-800/30 dark:text-white">{studentDetail.aiInsight}</p></div></div>}
        </div>
      )}

      {segment === 'attendance' && (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
            <h3 className="mb-4 font-bold text-kcs-blue-900 dark:text-white">Daily Register</h3>
            <div className="mb-4 grid gap-3 rounded-xl bg-gray-50 p-3 dark:bg-kcs-blue-800/30">
              <select className={inputClass} value={attendanceDraft.studentId} onChange={(event) => setAttendanceDraft((draft) => ({ ...draft, studentId: event.target.value }))}>
                {teacherStudents.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}
              </select>
              <div className="grid gap-2 sm:grid-cols-3">
                <DateSelect className={`${inputClass} attendance-date-field`} value={attendanceDraft.date} onChange={(event) => setAttendanceDraft((draft) => ({ ...draft, date: event.target.value }))} />
                <select className={inputClass} value={attendanceDraft.status} onChange={(event) => setAttendanceDraft((draft) => ({ ...draft, status: event.target.value }))}>
                  <option value="present">Present</option>
                  <option value="late">Late</option>
                  <option value="absent">Absent</option>
                </select>
                <button onClick={addAttendance} className={compactButton}>Mark</button>
              </div>
            </div>
            <div className="space-y-3">
              {attendanceEntries.map((record, index) => {
                const student = findStudent(record.studentId)
                return (
                  <div key={`${record.studentId}-${record.date}-${index}`} className="flex items-center justify-between rounded-xl bg-gray-50 p-3 dark:bg-kcs-blue-800/30">
                    <div>
                      <p className="text-sm font-semibold text-kcs-blue-900 dark:text-white">{student?.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{record.date} - {record.className}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusTone(record.status)}`}>{record.status}</span>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {attendanceAnalytics.map((item) => (
              <div key={item.scope} className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
                <p className="text-sm font-semibold text-kcs-blue-900 dark:text-white">{item.scope}</p>
                <p className="mt-3 font-display text-3xl font-bold text-kcs-blue-900 dark:text-white">{item.present}%</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{item.late}% late - {item.absent}% absent</p>
                <p className="mt-3 text-xs font-semibold capitalize text-kcs-blue-600 dark:text-kcs-blue-300">{item.trend}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {segment === 'assignments' && (
        <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
          <div className={panelClass}>
            <h3 className="font-bold text-kcs-blue-900 dark:text-white">Create assignment</h3>
            <div className="mt-4 grid gap-3">
              <select className={inputClass} value={assignmentDraft.studentId} onChange={(event) => setAssignmentDraft((draft) => ({ ...draft, studentId: event.target.value }))}>
                {teacherStudents.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}
              </select>
              <input className={inputClass} value={assignmentDraft.title} onChange={(event) => setAssignmentDraft((draft) => ({ ...draft, title: event.target.value }))} />
              <input className={inputClass} value={assignmentDraft.subject} onChange={(event) => setAssignmentDraft((draft) => ({ ...draft, subject: event.target.value }))} />
              <div className="grid gap-2 sm:grid-cols-3">
                <input className={inputClass} value={assignmentDraft.due} onChange={(event) => setAssignmentDraft((draft) => ({ ...draft, due: event.target.value }))} />
                <select className={inputClass} value={assignmentDraft.priority} onChange={(event) => setAssignmentDraft((draft) => ({ ...draft, priority: event.target.value }))}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
                <button onClick={createAssignment} className={compactButton}>Assign</button>
              </div>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
          {assignmentList.map((assignment) => {
            const student = findStudent(assignment.studentId)
            return (
              <div key={assignment.id} className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-kcs-blue-900 dark:text-white">{assignment.title}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{assignment.subject} - {student?.name}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusTone(assignment.status)}`}>{assignment.status}</span>
                </div>
                <p className="mt-4 text-sm text-gray-600 dark:text-gray-300">Due: {assignment.due} - Priority: {assignment.priority}</p>
              </div>
            )
          })}
          </div>
        </div>
      )}

      {segment === 'grades' && (
        <div className="space-y-6">
          <div className={panelClass}>
            <h3 className="font-display text-xl font-bold text-kcs-blue-900 dark:text-white">Gradebook</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Learn more about Useful Tools, Copying Grades and General Setup for the Gradebook.</p>
            <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1.4fr_0.6fr]">
              <label className="grid gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
                Semester
                <select className={inputClass} value="">
                  <option value="">Current production academic cycle</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
                Subject
                <select className={inputClass} value={selectedGradebookCourse?.id} onChange={(event) => setSelectedGradebookCourseId(event.target.value)}>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      ({course.gradeLevels[0]}) {course.name} - {course.abbreviation}
                    </option>
                  ))}
                </select>
              </label>
              <div className="rounded-xl bg-gray-50 px-4 py-3 text-center dark:bg-kcs-blue-800/30">
                <p className="font-display text-2xl font-bold text-kcs-blue-900 dark:text-white">{gradebookStudents.length}</p>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Students</p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 rounded-xl bg-gray-50 p-3 dark:bg-kcs-blue-800/30 lg:grid-cols-[1fr_0.8fr_0.8fr_0.5fr_auto]">
              <input
                className={inputClass}
                value={gradebookColumnDraft.title}
                onChange={(event) => setGradebookColumnDraft((draft) => ({ ...draft, title: event.target.value }))}
                placeholder="Column name"
              />
              <input
                className={inputClass}
                value={gradebookColumnDraft.type}
                onChange={(event) => setGradebookColumnDraft((draft) => ({ ...draft, type: event.target.value }))}
                placeholder="Assignment"
              />
              <input
                className={inputClass}
                value={gradebookColumnDraft.date}
                onChange={(event) => setGradebookColumnDraft((draft) => ({ ...draft, date: event.target.value }))}
                placeholder="04/30/2026"
              />
              <input
                className={inputClass}
                type="number"
                min={1}
                value={gradebookColumnDraft.maxPoints}
                onChange={(event) => setGradebookColumnDraft((draft) => ({ ...draft, maxPoints: Number(event.target.value) }))}
                placeholder="100"
              />
              <button onClick={createGradebookColumn} className={compactButton}>Add column</button>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
            <div className="flex flex-col gap-3 border-b border-gray-100 p-4 dark:border-kcs-blue-800 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-kcs-blue-500">Students</p>
                <h4 className="font-bold text-kcs-blue-900 dark:text-white">
                  {selectedGradebookCourse ? `(${selectedGradebookCourse.gradeLevels[0]}) ${selectedGradebookCourse.name} - ${selectedGradebookCourse.abbreviation}` : 'Select a course'}
                </h4>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Students are loaded from the class selected when the course is created.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-semibold text-gray-500 dark:text-gray-300">
                <span className="rounded-full bg-gray-100 px-3 py-1 dark:bg-kcs-blue-800/50">Show full name</span>
                <span className="rounded-full bg-gray-100 px-3 py-1 dark:bg-kcs-blue-800/50">Show columns</span>
                <span className="rounded-full bg-gray-100 px-3 py-1 dark:bg-kcs-blue-800/50">Hide columns</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1040px] text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-kcs-blue-800/40 dark:text-gray-300">
                  <tr>
                    <th className="px-4 py-3">Student</th>
                    {gradebookColumns.map((column) => (
                      <th key={column.id} className="px-3 py-3 text-center">
                        <span className="block font-bold text-kcs-blue-900 dark:text-white">{column.title}</span>
                        <span className="block normal-case text-gray-400">({column.type})</span>
                        <span className="block normal-case text-gray-400">{column.date}</span>
                        <button onClick={() => deleteGradebookColumn(column.id)} className="mt-2 text-[11px] font-semibold normal-case text-red-500 hover:text-red-600">
                          Remove
                        </button>
                      </th>
                    ))}
                    <th className="px-4 py-3 text-center">
                      <span className="block font-bold text-kcs-blue-900 dark:text-white">Final Grade</span>
                      <span className="block normal-case text-gray-400">(Final Grade)</span>
                    </th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-kcs-blue-800">
                  {gradebookStudents.map((student: RegistryStudent) => {
                    const finalGrade = getFinalGrade(student.id)
                    return (
                      <tr key={student.id} className="text-gray-700 dark:text-gray-300">
                        <td className="max-w-[190px] truncate px-4 py-3 font-semibold text-kcs-blue-900 dark:text-white" title={student.name}>{student.name}</td>
                        {gradebookColumns.map((column) => {
                          const score = gradebookScores[getGradebookScoreKey(column.id, student.id)] ?? ''
                          return (
                            <td key={`${student.id}-${column.id}`} className="px-3 py-3">
                              <input
                                className="mx-auto block w-20 rounded-lg border border-gray-200 bg-white px-2 py-2 text-center text-sm font-semibold text-kcs-blue-900 focus:border-kcs-blue-500 focus:outline-none focus:ring-2 focus:ring-kcs-blue-100 dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white"
                                value={score}
                                onChange={(event) => updateGradebookScore(column.id, student.id, event.target.value)}
                                placeholder="I"
                              />
                            </td>
                          )
                        })}
                        <td className="px-4 py-3">
                          <div className="mx-auto w-24 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-center text-sm font-bold text-kcs-blue-900 dark:border-kcs-blue-700 dark:bg-kcs-blue-900 dark:text-white">
                            {finalGrade === null ? 'I' : `${finalGrade} / 100`}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs">{finalGrade === null ? 'No counted grades' : 'Auto-calculated'}</td>
                      </tr>
                    )
                  })}
                  {!gradebookStudents.length && (
                    <tr>
                      <td colSpan={gradebookColumns.length + 3} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                        Select or create a course with a class roster to populate the Gradebook.
                      </td>
                    </tr>
                  )}
                  {gradebookStudents.length > 0 && gradebookColumns.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                        Create the first grade column above. Final Grade will calculate automatically after scores are entered.
                      </td>
                    </tr>
                  )}
                  <tr className="bg-gray-50 font-bold text-kcs-blue-900 dark:bg-kcs-blue-800/30 dark:text-white">
                    <td className="px-4 py-3">Average / Total</td>
                    {gradebookColumns.map((column) => <td key={`avg-${column.id}`} className="px-3 py-3 text-center">I</td>)}
                    <td className="px-4 py-3 text-center">{gradebookAverage} / 100</td>
                    <td className="px-4 py-3" />
                  </tr>
                  <tr className="bg-gray-50 font-bold text-kcs-blue-900 dark:bg-kcs-blue-800/30 dark:text-white">
                    <td className="px-4 py-3">Median / Total</td>
                    {gradebookColumns.map((column) => <td key={`median-${column.id}`} className="px-3 py-3 text-center">I</td>)}
                    <td className="px-4 py-3 text-center">{gradebookMedian} / 100</td>
                    <td className="px-4 py-3" />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className={panelClass}>
              <h4 className="font-bold text-kcs-blue-900 dark:text-white">Legend</h4>
              <div className="mt-3 grid gap-2 text-sm text-gray-600 dark:text-gray-300">
                {['<Leave Blank> - Grade will not be counted.', '0 (zero) - Grade will be counted as zero.', 'E - Excused absence, grade will not be counted.', 'U - Unexcused absence, grade will be counted as zero.', 'I - Incomplete, grade will not be counted.'].map((item) => (
                  <p key={item}>{item}</p>
                ))}
              </div>
            </div>
            <div className={panelClass}>
              <h4 className="font-bold text-kcs-blue-900 dark:text-white">Grading scale</h4>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-gray-600 dark:text-gray-300">
                {gradingScaleRows.map(([from, to, letter]) => (
                  <p key={`${from}-${to}-${letter}`}>{from} to {to} gets <span className="font-bold text-kcs-blue-900 dark:text-white">{letter}</span></p>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {segment === 'report-card' && (
        <div className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
            <div className={panelClass}>
              <h3 className="font-bold text-kcs-blue-900 dark:text-white">Bulletin setup</h3>
              <div className="mt-4 grid gap-3">
                <select className={inputClass} value={reportCardStudentId} onChange={(event) => setReportCardStudentId(event.target.value)}>
                  {teacherStudents.map((student) => <option key={student.id} value={student.id}>{student.name} - {student.grade}{student.section}</option>)}
                </select>
                <input className={inputClass} value={reportCardTerm} onChange={(event) => setReportCardTerm(event.target.value)} />
                <div className="grid grid-cols-3 gap-3 rounded-xl bg-gray-50 p-4 text-center dark:bg-kcs-blue-800/30">
                  <div>
                    <p className="font-display text-3xl font-bold text-kcs-blue-900 dark:text-white">{reportCardAverage}%</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Average</p>
                  </div>
                  <div>
                    <p className="font-display text-lg font-bold text-kcs-blue-900 dark:text-white">{reportCardMention}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Mention</p>
                  </div>
                  <div>
                    <p className="font-display text-lg font-bold text-kcs-blue-900 dark:text-white">{reportCardRows.length}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Courses</p>
                  </div>
                </div>
                <button onClick={generateReportCard} className={compactButton}>Generate report card</button>
                <button onClick={addReportCardCourse} className="rounded-xl border border-kcs-blue-200 px-4 py-2 text-sm font-semibold text-kcs-blue-700 hover:bg-kcs-blue-50 dark:border-kcs-blue-700 dark:text-kcs-blue-200 dark:hover:bg-kcs-blue-900/40">Add course row</button>
              </div>
            </div>

            <div className={panelClass}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="font-bold text-kcs-blue-900 dark:text-white">{reportCardStudent?.name} report card</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{reportCardTerm} - weighted automatic calculation</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(reportCardAverage >= 70 ? 'low' : 'high')}`}>{reportCardDecision}</span>
              </div>

              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-kcs-blue-800">
                      <th className="pb-3 pr-3">Course</th>
                      <th className="pb-3 pr-3">Points</th>
                      <th className="pb-3 pr-3">Max</th>
                      <th className="pb-3 pr-3">Coef.</th>
                      <th className="pb-3 pr-3">Average</th>
                      <th className="pb-3">Comment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-kcs-blue-800">
                    {reportCardRows.map((row) => {
                      const courseAverage = Number(((row.points / Math.max(row.maxPoints, 1)) * 100).toFixed(1))
                      return (
                        <tr key={row.id}>
                          <td className="py-3 pr-3">
                            <input className={inputClass} value={row.course} onChange={(event) => updateReportCardRow(row.id, 'course', event.target.value)} />
                          </td>
                          <td className="py-3 pr-3">
                            <input className={inputClass} type="number" min={0} value={row.points} onChange={(event) => updateReportCardRow(row.id, 'points', Number(event.target.value))} />
                          </td>
                          <td className="py-3 pr-3">
                            <input className={inputClass} type="number" min={1} value={row.maxPoints} onChange={(event) => updateReportCardRow(row.id, 'maxPoints', Number(event.target.value))} />
                          </td>
                          <td className="py-3 pr-3">
                            <input className={inputClass} type="number" min={1} value={row.coefficient} onChange={(event) => updateReportCardRow(row.id, 'coefficient', Number(event.target.value))} />
                          </td>
                          <td className="py-3 pr-3">
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(courseAverage >= 70 ? 'low' : 'high')}`}>{courseAverage}%</span>
                          </td>
                          <td className="py-3">
                            <input className={inputClass} value={row.comment} onChange={(event) => updateReportCardRow(row.id, 'comment', event.target.value)} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className={panelClass}>
              <p className="text-xs font-semibold uppercase text-gray-400">Teacher narrative</p>
              <p className="mt-2 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                {reportCardStudent?.name} is currently at {reportCardAverage}% with a {reportCardMention.toLowerCase()} standing. The next step is to keep the strongest courses visible while targeting the lowest course for intervention.
              </p>
            </div>
            <div className={panelClass}>
              <p className="text-xs font-semibold uppercase text-gray-400">Parent-ready summary</p>
              <p className="mt-2 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                Overall average: {reportCardAverage}%. Mention: {reportCardMention}. Decision: {reportCardDecision}.
              </p>
            </div>
            <div className={panelClass}>
              <p className="text-xs font-semibold uppercase text-gray-400">Approval flow</p>
              <p className="mt-2 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                Teacher draft to academic coordinator review to Super Admin approval to parent/student publication.
              </p>
            </div>
          </div>

          {generatedReportCards.length > 0 && (
            <div className={panelClass}>
              <h3 className="font-bold text-kcs-blue-900 dark:text-white">Generated report cards</h3>
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {generatedReportCards.map((card) => (
                  <div key={card.id} className="rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-800/30">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-kcs-blue-900 dark:text-white">{card.student}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{card.term} - {card.rows.length} courses</p>
                      </div>
                      <span className="badge-blue text-xs">{card.average}%</span>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{card.summary}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {segment === 'reports' && (
        <div className="space-y-6">
          <div className={panelClass}><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-bold uppercase tracking-wide text-kcs-gold-600">Operational report generator</p><h3 className="mt-1 text-xl font-bold text-kcs-blue-900 dark:text-white">Administrative Staff submission</h3></div><div className="flex flex-wrap gap-2"><select value={reportPeriod} onChange={(event) => setReportPeriod(event.target.value as 'Daily' | 'Weekly' | 'Annual')} className={inputClass}><option>Daily</option><option>Weekly</option><option>Annual</option></select><button type="button" onClick={printTeacherReport} className={compactButton}><Printer size={16}/> Print / PDF</button><button type="button" onClick={submitTeacherReport} className={compactButton}><Upload size={16}/> Submit to staff</button></div></div><div className="mt-5 grid gap-3 md:grid-cols-4">{[['Period', reportPeriod], ['Students', teacherStudents.length], ['Classes', courses.length], ['Generated', new Date().toLocaleDateString()]].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-800/30"><p className="text-xs uppercase text-gray-400">{label}</p><p className="mt-1 font-bold text-kcs-blue-900 dark:text-white">{value}</p></div>)}</div>{actionMessage && <p className="mt-4 rounded-xl bg-green-50 p-3 text-sm font-semibold text-green-700 dark:bg-green-900/20 dark:text-green-300">{actionMessage}</p>}</div>
          <div className={panelClass}><h3 className="font-bold text-kcs-blue-900 dark:text-white">AI student reports and recommendations</h3><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Select a learner to generate an individual analysis.</p><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{teacherStudents.map((student) => <button type="button" key={student.id} onClick={() => setSelectedAiStudent(student)} className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-left hover:border-kcs-blue-300 hover:bg-kcs-blue-50 dark:border-kcs-blue-800 dark:bg-kcs-blue-800/30"><p className="font-semibold text-kcs-blue-900 dark:text-white">{student.name}</p><p className="mt-1 text-xs text-gray-500">{student.grade}{student.section} · Average {student.average ?? 'N/A'} · Attendance {student.attendance ?? 'N/A'}%</p></button>)}</div></div>
          <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
          <div className={panelClass}>
            <h3 className="font-bold text-kcs-blue-900 dark:text-white">Draft report card</h3>
            <div className="mt-4 grid gap-3">
              <select className={inputClass} value={reportDraft.student} onChange={(event) => setReportDraft((draft) => ({ ...draft, student: event.target.value }))}>
                {teacherStudents.map((student) => <option key={student.id} value={student.name}>{student.name}</option>)}
              </select>
              <div className="grid gap-2 sm:grid-cols-2">
                <input className={inputClass} value={reportDraft.term} onChange={(event) => setReportDraft((draft) => ({ ...draft, term: event.target.value }))} />
                <input className={inputClass} type="number" value={reportDraft.average} onChange={(event) => setReportDraft((draft) => ({ ...draft, average: Number(event.target.value) }))} />
              </div>
              <input className={inputClass} value={reportDraft.conduct} onChange={(event) => setReportDraft((draft) => ({ ...draft, conduct: event.target.value }))} />
              <textarea className={inputClass} value={reportDraft.teacherComment} onChange={(event) => setReportDraft((draft) => ({ ...draft, teacherComment: event.target.value }))} rows={4} />
              <button onClick={createReport} className={compactButton}>Create report draft</button>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
          {reportList.map((card, index) => (
            <div key={card.student} className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-kcs-blue-900 dark:text-white">{card.student}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{card.term} - Average {card.average}% - Conduct {card.conduct}</p>
                </div>
                <span className="badge-blue text-xs">{card.principalStatus}</span>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{card.teacherComment}</p>
              <p className="mt-3 text-xs font-semibold text-kcs-blue-600 dark:text-kcs-blue-300">{card.download}</p>
            </div>
          ))}
          </div>
          </div>
          {selectedAiStudent && <div className="fixed inset-0 z-50 flex items-center justify-center bg-kcs-blue-950/65 p-4"><div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl dark:bg-kcs-blue-900"><div className="flex justify-between gap-3"><div><p className="text-xs font-bold uppercase text-kcs-gold-600">AI learner report</p><h3 className="mt-1 text-xl font-bold text-kcs-blue-900 dark:text-white">{selectedAiStudent.name}</h3></div><button onClick={() => setSelectedAiStudent(null)}><X size={18}/></button></div><div className="mt-5 grid gap-3 sm:grid-cols-3">{[['Average', `${selectedAiStudent.average ?? 'N/A'}%`], ['Attendance', `${selectedAiStudent.attendance ?? 'N/A'}%`], ['Risk', selectedAiStudent.risk ?? 'Not classified']].map(([label, value]) => <div key={label} className="rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-800/30"><p className="text-xs text-gray-400">{label}</p><p className="mt-1 font-bold text-kcs-blue-900 dark:text-white">{value}</p></div>)}</div><div className="mt-4 rounded-xl bg-kcs-blue-50 p-4 dark:bg-kcs-blue-800/30"><p className="font-semibold text-kcs-blue-900 dark:text-white">AI analysis</p><p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{selectedAiStudent.aiInsight || `${selectedAiStudent.name} requires continued monitoring based on academic performance and attendance trends.`}</p><p className="mt-3 text-sm font-semibold text-kcs-blue-700 dark:text-kcs-blue-300">Recommendation: reinforce {selectedAiStudent.weaknesses?.join(', ') || 'the lowest-performing competencies'}, maintain family follow-up, and review progress within two weeks.</p></div><button type="button" onClick={printTeacherReport} className={`${compactButton} mt-5`}><Download size={16}/> Print / Download PDF</button></div></div>}
        </div>
      )}

      {segment === 'diagnostics' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className={panelClass}>
            <h3 className="font-bold text-kcs-blue-900 dark:text-white">Learner signals</h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {registryStatus === 'loading' ? 'Loading the official student registry...' : `${teacherStudents.length} learner(s) available for diagnostic review.`}
            </p>
            <div className="mt-4 space-y-3">
              {teacherStudents.slice(0, 8).map((student) => (
                <button key={student.id} type="button" onClick={() => setSelectedAiStudent(student)} className="flex w-full items-center justify-between rounded-xl bg-gray-50 p-3 text-left dark:bg-kcs-blue-800/30">
                  <span><strong className="text-kcs-blue-900 dark:text-white">{student.name}</strong><span className="block text-xs text-gray-500">{student.grade}{student.section} - {student.attendance ?? 'N/A'}% attendance</span></span>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(student.risk ?? 'low')}`}>{student.risk ?? 'low'} risk</span>
                </button>
              ))}
            </div>
          </div>
          <div className={panelClass}><h3 className="font-bold text-kcs-blue-900 dark:text-white">Diagnostic summary</h3><p className="mt-3 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{selectedAiStudent?.aiInsight ?? 'Select a learner to review the available academic, attendance, and support indicators.'}</p></div>
        </div>
      )}

      {segment === 'timetable' && (
        <div className="grid gap-4 md:grid-cols-2">
          {ecosystemSchedules.filter((item) => item.role === 'teacher').map((item) => (
            <button type="button" key={`${item.time}-${item.title}`} onClick={() => setSelectedSchedule(item)} className={`${panelClass} text-left transition hover:-translate-y-0.5 hover:border-kcs-blue-300 hover:shadow-lg`}>
              <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wide text-kcs-gold-600">{item.time}</p><h3 className="mt-1 font-bold text-kcs-blue-900 dark:text-white">{item.title}</h3><p className="mt-2 text-sm text-gray-500 dark:text-gray-300">{item.room} · {item.teacher}</p></div><Calendar className="text-kcs-blue-600 dark:text-kcs-blue-300"/></div>
              <p className="mt-4 text-xs font-semibold text-kcs-blue-600 dark:text-kcs-blue-300">Open class window →</p>
            </button>
          ))}
          {selectedSchedule && <div className="fixed inset-0 z-50 flex items-center justify-center bg-kcs-blue-950/65 p-4"><div className="w-full max-w-lg rounded-3xl bg-kcs-blue-50 p-6 shadow-2xl dark:bg-kcs-blue-900"><div className="flex justify-between"><div><p className="text-xs font-bold uppercase text-kcs-gold-600">Teaching period</p><h3 className="mt-1 text-xl font-bold text-kcs-blue-900 dark:text-white">{selectedSchedule.title}</h3></div><button type="button" onClick={() => setSelectedSchedule(null)} aria-label="Close"><X/></button></div><div className="mt-5 grid gap-3 sm:grid-cols-2">{[['Time', selectedSchedule.time], ['Room', selectedSchedule.room], ['Teacher', selectedSchedule.teacher], ['Synchronization', 'Administrative timetable']].map(([label,value]) => <div key={label} className="rounded-xl bg-white/80 p-4 dark:bg-kcs-blue-800/50"><p className="text-xs text-gray-500">{label}</p><p className="mt-1 font-semibold text-kcs-blue-900 dark:text-white">{value}</p></div>)}</div></div></div>}
        </div>
      )}

      {segment === 'resources' && (
        <div className="space-y-5"><div className={panelClass}><label className="text-sm font-semibold text-kcs-blue-900 dark:text-white" htmlFor="resource-search">Search learning resources</label><input id="resource-search" value={resourceQuery} onChange={(event) => setResourceQuery(event.target.value)} className={`${inputClass} mt-3 w-full`} placeholder="Title, subject, type or status..." /></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{lmsResources.filter((resource) => `${resource.title} ${resource.subject} ${resource.type} ${resource.status}`.toLowerCase().includes(resourceQuery.toLowerCase())).map((resource) => <button type="button" key={resource.title} onClick={() => setSelectedResource(resource)} className={`${panelClass} text-left transition hover:border-kcs-blue-300 hover:shadow-lg`}><div className="flex justify-between gap-3"><LibraryBig className="text-kcs-blue-600 dark:text-kcs-blue-300"/><span className="badge-blue capitalize">{resource.type}</span></div><h3 className="mt-4 font-bold text-kcs-blue-900 dark:text-white">{resource.title}</h3><p className="mt-2 text-sm text-gray-500 dark:text-gray-300">{resource.subject} · {resource.status}</p><p className="mt-4 text-xs font-semibold text-kcs-blue-600 dark:text-kcs-blue-300">View resource →</p></button>)}</div>{selectedResource && <div className="fixed inset-0 z-50 flex items-center justify-center bg-kcs-blue-950/65 p-4"><div className="w-full max-w-lg rounded-3xl bg-kcs-blue-50 p-6 shadow-2xl dark:bg-kcs-blue-900"><div className="flex justify-between"><div><p className="text-xs font-bold uppercase text-kcs-gold-600">{selectedResource.type}</p><h3 className="mt-1 text-xl font-bold text-kcs-blue-900 dark:text-white">{selectedResource.title}</h3></div><button type="button" onClick={() => setSelectedResource(null)} aria-label="Close"><X/></button></div><p className="mt-5 text-sm text-gray-600 dark:text-gray-300">Subject: {selectedResource.subject}</p><p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Visibility: {selectedResource.audience.join(', ')}</p><button type="button" onClick={() => { setActionMessage(`${selectedResource.title} opened successfully.`); setSelectedResource(null) }} className={`${compactButton} mt-5 w-full`}><BookOpen size={16}/> Open resource</button></div></div>}</div>
      )}

      {segment === 'settings' && <AccountSettingsPanel roleLabel="Teacher account" />}

      {segment === 'discipline' && (
        <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <div className={panelClass}>
            <h3 className="font-bold text-kcs-blue-900 dark:text-white">Open discipline report</h3>
            <div className="mt-4 grid gap-3">
              <select className={inputClass} value={disciplineDraft.studentId} onChange={(event) => setDisciplineDraft((draft) => ({ ...draft, studentId: event.target.value }))}>
                {teacherStudents.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}
              </select>
              <input className={inputClass} value={disciplineDraft.category} onChange={(event) => setDisciplineDraft((draft) => ({ ...draft, category: event.target.value }))} />
              <textarea className={inputClass} value={disciplineDraft.incident} onChange={(event) => setDisciplineDraft((draft) => ({ ...draft, incident: event.target.value }))} rows={3} />
              <textarea className={inputClass} value={disciplineDraft.actionTaken} onChange={(event) => setDisciplineDraft((draft) => ({ ...draft, actionTaken: event.target.value }))} rows={3} />
              <textarea className={inputClass} value={disciplineDraft.followUp} onChange={(event) => setDisciplineDraft((draft) => ({ ...draft, followUp: event.target.value }))} rows={3} />
              <select className={inputClass} value={disciplineDraft.level} onChange={(event) => setDisciplineDraft((draft) => ({ ...draft, level: event.target.value }))}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              <button onClick={createDisciplineReport} className={compactButton}>Create detailed report</button>
            </div>
          </div>
          <div className="space-y-4">
          {disciplineList.map((report) => (
            <article key={report.id} className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-kcs-blue-500">{report.id} - {report.date}</p>
                  <h3 className="mt-1 font-display text-xl font-bold text-kcs-blue-900 dark:text-white">{report.student}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{report.category}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusTone(report.level)}`}>{report.level}</span>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(report.status)}`}>{report.status}</span>
                </div>
              </div>
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                {[
                  ['Incident', report.incident],
                  ['Context', report.context],
                  ['Action taken', report.actionTaken],
                  ['Follow-up plan', report.followUp],
                  ['Parent contact', report.parentContact],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-800/30">
                    <p className="text-xs font-semibold uppercase text-gray-400">{label}</p>
                    <p className="mt-1 text-sm leading-relaxed text-gray-700 dark:text-gray-300">{value}</p>
                  </div>
                ))}
              </div>
            </article>
          ))}
          </div>
        </div>
      )}

      {segment === 'messages' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
            <h3 className="mb-4 font-bold text-kcs-blue-900 dark:text-white">Teacher Inbox</h3>
            <div className="space-y-3">
              {inbox.map((message) => (
                <div key={`${message.id}-${message.subject}`} className="rounded-xl bg-gray-50 p-3 dark:bg-kcs-blue-800/30">
                  <p className="text-sm font-semibold text-kcs-blue-900 dark:text-white">{message.from}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{message.subject} - {message.time}</p>
                  <p className="mt-2 text-xs leading-relaxed text-gray-600 dark:text-gray-300">{message.body}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
            <h3 className="mb-4 font-bold text-kcs-blue-900 dark:text-white">Compose and active threads</h3>
            <div className="mb-4 grid gap-3 rounded-xl bg-gray-50 p-3 dark:bg-kcs-blue-800/30">
              <select className={inputClass} value={messageDraft.to} onChange={(event) => setMessageDraft((draft) => ({ ...draft, to: event.target.value }))}>
                <option value="">Select a recipient…</option>
                {messageContacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.firstName} {contact.lastName} · {contact.role.toLowerCase()}</option>)}
              </select>
              <input className={inputClass} value={messageDraft.subject} onChange={(event) => setMessageDraft((draft) => ({ ...draft, subject: event.target.value }))} />
              <textarea className={inputClass} value={messageDraft.body} onChange={(event) => setMessageDraft((draft) => ({ ...draft, body: event.target.value }))} rows={3} />
              <button onClick={sendMessage} className={compactButton}>Send message</button>
            </div>
            <div className="space-y-3">
              {internalThreads.map((thread) => (
                <div key={thread.subject} className="rounded-xl bg-gray-50 p-3 dark:bg-kcs-blue-800/30">
                  <p className="text-sm font-semibold text-kcs-blue-900 dark:text-white">{thread.subject}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{thread.channel} - {thread.unread} unread</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

const TeacherDashboardHome = () => {
  const [activeAiTool, setActiveAiTool] = useState<TeacherAiTool | null>(null)
  const [aiResult, setAiResult] = useState('')
  const [aiInstruction, setAiInstruction] = useState('')
  const [isAiGenerating, setIsAiGenerating] = useState(false)
  const [aiError, setAiError] = useState('')
  const [overview, setOverview] = useState<any>(null)
  const [dashboardMessages, setDashboardMessages] = useState<any[]>([])
  const [dashboardStatus, setDashboardStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    let active = true
    Promise.all([teacherWorkspaceAPI.overview(), messagesAPI.getAll({ box: 'all' })])
      .then(([overviewResponse, messagesResponse]) => {
        if (!active) return
        setOverview(overviewResponse.data?.data ?? {})
        setDashboardMessages((messagesResponse.data?.data ?? []).slice(0, 4))
        setDashboardStatus('ready')
      })
      .catch(() => active && setDashboardStatus('error'))
    return () => { active = false }
  }, [])

  const assignedStudents = overview?.students ?? []
  const assignedCourses = overview?.courses ?? []
  const assignedAssignments = overview?.assignments ?? []
  const assignedGrades = overview?.grades ?? []
  const classAverage = assignedGrades.length ? Math.round(assignedGrades.reduce((sum: number, grade: any) => sum + Number(grade.percentage || 0), 0) / assignedGrades.length) : 0
  const pendingActions = assignedAssignments.reduce((sum: number, assignment: any) => sum + (assignment.submissions ?? []).filter((submission: any) => submission.status === 'PENDING').length, 0)
  const atRiskStudents = assignedStudents.filter((student: any) => (student.attendanceRate != null && student.attendanceRate < 80) || (student.gpa != null && student.gpa < 2))
  const todayClasses = (overview?.timetable ?? []).slice(0, 6).map((item: any) => ({ time: item.startTime + '–' + item.endTime, course: item.courseName, room: item.room, students: item.studentCount }))
  const gradingQueue = assignedAssignments.filter((assignment: any) => (assignment.submissions ?? []).some((submission: any) => submission.status === 'PENDING')).slice(0, 5).map((assignment: any) => ({ id: assignment.id, title: assignment.title, className: assignment.courseName, due: new Date(assignment.dueDate).toLocaleDateString(), pending: (assignment.submissions ?? []).filter((submission: any) => submission.status === 'PENDING').length }))
  const studentAlerts = atRiskStudents.slice(0, 5).map((student: any) => ({ student: ((student.user?.firstName ?? '') + ' ' + (student.user?.lastName ?? '')).trim(), severity: student.attendanceRate < 70 || student.gpa < 1.5 ? 'high' : 'medium', note: 'Attendance: ' + (student.attendanceRate ?? '—') + '% · GPA: ' + (student.gpa ?? '—') }))
  const gradebookCategories = assignedCourses.slice(0, 4).map((course: any) => {
    const courseGrades = assignedGrades.filter((grade: any) => grade.courseId === course.id)
    const average = courseGrades.length ? Math.round(courseGrades.reduce((sum: number, grade: any) => sum + Number(grade.percentage || 0), 0) / courseGrades.length) : 0
    return { name: course.name, weight: course.credits ?? 1, average, visibility: courseGrades.length ? courseGrades.length + ' grades' : 'No grades' }
  })
  const messages = dashboardMessages.map((message: any) => ({ id: message.id, from: ((message.sender?.firstName ?? '') + ' ' + (message.sender?.lastName ?? '')).trim() || 'KCS Nexus', subject: message.subject, time: new Date(message.createdAt).toLocaleString() }))
  const metricCards = [
    { label: 'Assigned Students', value: String(assignedStudents.length), sub: assignedCourses.length + ' assigned course(s)', icon: Users, tone: 'bg-kcs-blue-50 text-kcs-blue-700 dark:bg-kcs-blue-900/30 dark:text-kcs-blue-300' },
    { label: 'Pending Actions', value: String(pendingActions), sub: pendingActions ? 'Submissions to review' : 'No pending action', icon: FileText, tone: 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
    { label: 'Risk Alerts', value: String(atRiskStudents.length), sub: atRiskStudents.length ? 'Attendance or GPA signal' : 'No active alert', icon: AlertTriangle, tone: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
    { label: 'Class Average', value: classAverage + '%', sub: assignedGrades.length ? assignedGrades.length + ' registered grades' : 'No registered grade', icon: TrendingUp, tone: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  ]

  const quickActions = [
    { to: '/portal/teacher/attendance', label: 'Take Attendance', icon: ClipboardCheck },
    { to: '/portal/teacher/grades', label: 'Open Gradebook', icon: TrendingUp },
    { to: '/portal/teacher/assignments', label: 'Create Assignment', icon: FileText },
    { to: '/portal/teacher/messages', label: 'Notify Parents', icon: MessageSquare },
  ]

  const aiTools: TeacherAiTool[] = [
    { task: 'lesson-plan', title: 'Lesson plan', detail: 'Create a differentiated 45-minute lesson from today’s schedule.' },
    { task: 'quiz', title: 'Quiz builder', detail: 'Generate questions from the current subject and class level.' },
    { task: 'feedback', title: 'Smart feedback', detail: 'Improve comments for report cards and parent meetings.' },
    { task: 'intervention', title: 'Risk intervention', detail: 'Suggest support plans for struggling students.' },
    { task: 'meeting-summary', title: 'Meeting summary', detail: 'Prepare parent-teacher conference notes.' },
  ]

  const generateTeacherAi = async (tool: TeacherAiTool, context = '') => {
    setActiveAiTool(tool)
    setAiInstruction(context)
    setAiResult('')
    setAiError('')
    setIsAiGenerating(true)
    try {
      const response = await aiAPI.teacherAssistant(tool.task, context)
      const result = response.data?.data?.response
      if (!result) throw new Error('The AI assistant returned no draft.')
      setAiResult(result)
    } catch {
      setAiError('The AI assistant could not generate a draft. Check your connection and try again.')
    } finally {
      setIsAiGenerating(false)
    }
  }

  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-kcs-blue-100 bg-white shadow-sm dark:border-kcs-blue-800 dark:bg-kcs-blue-950">
        <div className="grid gap-6 p-6 xl:grid-cols-[1.35fr_0.65fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-kcs-gold-600 dark:text-kcs-gold-400">AI Teacher Command Center</p>
            <h2 className="mt-3 font-display text-3xl font-bold text-kcs-blue-950 dark:text-white">
              Manage classes, grades, attendance, assignments, parents, and interventions from one intelligent cockpit.
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-gray-600 dark:text-gray-300">
              KCS Nexus connects every teacher action to student, parent, staff, and Super Admin dashboards while surfacing predictive academic risk and next-best actions.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {quickActions.map((action) => {
                const Icon = action.icon
                return (
                  <Link key={action.to} to={action.to} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm font-semibold text-kcs-blue-900 transition-colors hover:border-kcs-blue-200 hover:bg-kcs-blue-50 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/40 dark:text-white dark:hover:bg-kcs-blue-800">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-kcs-blue-700 shadow-sm dark:bg-kcs-blue-950 dark:text-kcs-blue-200">
                      <Icon size={17} />
                    </span>
                    {action.label}
                  </Link>
                )
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-kcs-blue-100 bg-kcs-blue-50 p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/40">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-kcs-blue-700 text-white">
                <Brain size={22} />
              </div>
              <div>
                <p className="font-bold text-kcs-blue-950 dark:text-white">AI readiness score</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Live classroom intelligence</p>
              </div>
            </div>
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between text-xs font-semibold text-kcs-blue-900 dark:text-kcs-blue-100">
                <span>Official data synchronization</span>
                <span>{dashboardStatus === 'ready' ? 'Live' : dashboardStatus}</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-white dark:bg-kcs-blue-950">
                <div className="h-full rounded-full bg-kcs-gold-400" style={{ width: '91%' }} />
              </div>
            </div>
            <div className="mt-5 grid gap-2 text-xs text-gray-600 dark:text-gray-300">
              {[assignedCourses.length + ' assigned course(s)', assignedStudents.length + ' assigned student(s)', assignedAssignments.length + ' assignment(s)', assignedGrades.length + ' recorded grade(s)'].map((item) => (
                <div key={item} className="flex items-center gap-2 rounded-lg bg-white/80 px-3 py-2 dark:bg-kcs-blue-950/50">
                  <CheckCircle2 size={14} className="text-green-500" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {metricCards.map((item, index) => {
          const Icon = item.icon
          return (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
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

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-bold text-kcs-blue-900 dark:text-white">Live Class Performance</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Distribution by grading category with parent/student sync status.</p>
            </div>
            <Link to="/portal/teacher/grades" className="btn-primary flex items-center gap-2 py-2 text-sm">
              Gradebook <ChevronRight size={15} />
            </Link>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {gradebookCategories.map((category: any) => (
              <div key={category.name} className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-kcs-blue-800 dark:bg-kcs-blue-800/30">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-kcs-blue-900 dark:text-white">{category.name}</p>
                  <span className="text-xs font-bold text-kcs-blue-700 dark:text-kcs-blue-300">{category.weight}% weight</span>
                </div>
                <div className="mt-3 h-3 overflow-hidden rounded-full bg-white dark:bg-kcs-blue-950">
                  <div className="h-full rounded-full bg-kcs-blue-600" style={{ width: `${category.average}%` }} />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>{category.average}% class average</span>
                  <span>{category.visibility}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-kcs-blue-900 dark:text-white">AI Teacher Assistant</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Generate and improve teaching work instantly.</p>
            </div>
            <Brain size={20} className="text-kcs-gold-500" />
          </div>
          <div className="grid gap-2">
            {aiTools.map((tool) => (
              <button type="button" onClick={() => void generateTeacherAi(tool)} key={tool.task} className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-left transition-colors hover:border-kcs-blue-200 hover:bg-kcs-blue-50 dark:border-kcs-blue-800 dark:bg-kcs-blue-800/30 dark:hover:bg-kcs-blue-800">
                <p className="text-sm font-semibold text-kcs-blue-900 dark:text-white">{tool.title}</p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{tool.detail}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
      {activeAiTool && <div className="fixed inset-0 z-50 flex items-center justify-center bg-kcs-blue-950/65 p-4"><div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl dark:bg-kcs-blue-900"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase text-kcs-gold-600">AI Teacher Assistant</p><h3 className="mt-1 text-xl font-bold text-kcs-blue-900 dark:text-white">{activeAiTool.title}</h3></div><button type="button" onClick={() => setActiveAiTool(null)} aria-label="Close AI teacher assistant"><X size={18}/></button></div><p className="mt-3 text-sm text-gray-500 dark:text-gray-400">{activeAiTool.detail}</p><div className="mt-4 min-h-24 rounded-xl bg-kcs-blue-50 p-4 text-sm leading-relaxed text-kcs-blue-900 dark:bg-kcs-blue-800/30 dark:text-kcs-blue-100" style={{ whiteSpace: 'pre-line' }}>{isAiGenerating ? 'Generating a teacher-review draft…' : aiError || aiResult}</div><textarea value={aiInstruction} onChange={(event) => setAiInstruction(event.target.value)} className="input-kcs mt-4 min-h-24" placeholder="Add class context or instructions to refine this output..." disabled={isAiGenerating}/><p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Review the draft before sharing it with students or families.</p><div className="mt-4 flex justify-end gap-2"><button type="button" disabled={isAiGenerating} onClick={() => void generateTeacherAi(activeAiTool, aiInstruction)} className="rounded-xl bg-kcs-blue-700 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">{isAiGenerating ? 'Generating…' : 'Regenerate and improve'}</button></div></div></div>}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
          <h2 className="mb-4 flex items-center gap-2 font-bold text-kcs-blue-900 dark:text-white">
            <Calendar size={18} className="text-kcs-blue-500" /> Daily And Weekly Schedule
          </h2>
          <div className="space-y-3">
            {todayClasses.map((item: any, index: number) => (
              <div key={item.time} className={`rounded-xl border p-4 ${index === 0 ? 'border-kcs-blue-300 bg-kcs-blue-50 dark:border-kcs-blue-600 dark:bg-kcs-blue-800/40' : 'border-gray-100 bg-gray-50 dark:border-kcs-blue-800 dark:bg-kcs-blue-800/20'}`}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-gray-400 dark:text-gray-500">{item.time}</p>
                  <span className="text-xs font-semibold text-kcs-blue-700 dark:text-kcs-blue-300">{item.students} students</span>
                </div>
                <p className="mt-1 font-semibold text-kcs-blue-900 dark:text-white">{item.course}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{item.room} - no conflict detected</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-bold text-kcs-blue-900 dark:text-white">
              <CheckCircle2 size={18} className="text-green-500" /> Action Queue
            </h2>
            <Link to="/portal/teacher/assignments" className="text-xs font-semibold text-kcs-blue-600 dark:text-kcs-blue-400">Open tasks</Link>
          </div>
          <div className="space-y-3">
            {gradingQueue.map((task: any) => (
              <div key={task.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-kcs-blue-800 dark:bg-kcs-blue-800/20">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-kcs-blue-900 dark:text-white">{task.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{task.className} - due {task.due}</p>
                  </div>
                  <span className="badge-gold text-xs">{task.pending}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-bold text-kcs-blue-900 dark:text-white">
              <AlertTriangle size={18} className="text-red-500" /> Student Risk Radar
            </h2>
            <Link to="/portal/teacher/students" className="text-xs font-semibold text-kcs-blue-600 dark:text-kcs-blue-400">Student profiles</Link>
          </div>
          <div className="space-y-3">
            {studentAlerts.map((alert: any) => (
              <div key={alert.student} className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-kcs-blue-800 dark:bg-kcs-blue-800/20">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="font-semibold text-kcs-blue-900 dark:text-white">{alert.student}</p>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${alert.severity === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : alert.severity === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'}`}>
                    {alert.severity}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-300">{alert.note}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
          <h2 className="mb-4 font-bold text-kcs-blue-900 dark:text-white">Ecosystem Sync</h2>
          <div className="space-y-3">
            {[
              ['Grades', 'Student and parent dashboards update after teacher release.', 'Ready'],
              ['Attendance', 'Absent and late statuses trigger parent notifications.', 'Live'],
              ['Assignments', 'Class tasks sync across student portals and reports.', 'Synced'],
              ['Comments', 'Teacher notes follow permission rules before publishing.', 'Protected'],
            ].map(([label, detail, status]) => (
              <div key={label} className="rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-800/30">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-kcs-blue-900 dark:text-white">{label}</p>
                  <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-300">{status}</span>
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-bold text-kcs-blue-900 dark:text-white">Communication, Audit, And Security</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Teacher-only access, logged actions, and cross-role communication.</p>
            </div>
            <Link to="/portal/teacher/messages" className="btn-gold flex items-center gap-2 py-2 text-sm">
              Messages <ChevronRight size={15} />
            </Link>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              {messages.map((message: any) => (
                <div key={message.id} className="rounded-xl bg-gray-50 p-3 dark:bg-kcs-blue-800/40">
                  <p className="text-sm font-semibold text-kcs-blue-900 dark:text-white">{message.from}</p>
                  <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">{message.subject}</p>
                  <p className="mt-1 text-xs text-gray-400">{message.time}</p>
                </div>
              ))}
            </div>
            <div className="space-y-3">
              {[
                'Teacher can access assigned classes only',
                'Grade changes are recorded in audit logs',
                'Parent-visible updates require release status',
                'AI suggestions never overwrite teacher judgment',
              ].map((item) => (
                <div key={item} className="flex items-start gap-2 rounded-xl bg-gray-50 p-3 text-xs text-gray-600 dark:bg-kcs-blue-800/40 dark:text-gray-300">
                  <CheckCircle2 size={15} className="mt-0.5 flex-shrink-0 text-green-500" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-gradient-to-r from-kcs-blue-900 to-kcs-blue-700 p-6 text-white dark:border-kcs-blue-800">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="mb-2 text-sm font-semibold text-kcs-gold-300">Next-generation teaching layer</p>
            <h2 className="font-display text-2xl font-bold">Generate interventions, grade faster, detect risk earlier, and keep families informed.</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/portal/teacher/grades" className="btn-gold whitespace-nowrap text-sm py-2.5">Open Gradebook</Link>
            <Link to="/portal/teacher/reports" className="rounded-xl border border-white/20 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10">Build Reports</Link>
          </div>
        </div>
      </div>
    </>
  )
}

const TeacherPortal = () => {
  const { user } = useAuthStore()
  const language = useUIStore((state) => state.language)
  const location = useLocation()
  const activeSegment = getTeacherSegment(location.pathname)
  const isDashboard = activeSegment === 'dashboard'

  return (
    <div className="portal-shell flex">
      <PortalSidebar />

      <main>
        <div className="portal-dashboard-topbar sticky top-0 z-20 border-b px-4 py-3 backdrop-blur-2xl sm:px-6 sm:py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <h1 className="portal-dashboard-title font-display text-xl font-bold leading-tight sm:text-2xl">
                {getLocalizedGreeting(language)}, {user?.firstName}
              </h1>
              <p className="mt-1 text-sm font-medium text-kcs-blue-700 dark:text-kcs-blue-100">
                {getLocalizedPortalDate(language)} - Today&apos;s overview for teaching, assessment, and student support.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <Link to="/portal/teacher/messages" className="btn-primary text-sm py-2">
                Inbox
              </Link>
              <Link to="/portal/teacher/assignments" className="btn-gold text-sm py-2 flex items-center gap-2">
                <Brain size={16} /> AI Insights
              </Link>
            </div>
          </div>
        </div>

        <div className="space-y-6 p-6">
          {isDashboard && <PortalSectionPanel />}
          {isDashboard && <SuggestionBox />}

          {!isDashboard && <TeacherSectionView segment={activeSegment} />}

          {isDashboard && <TeacherDashboardHome />}

          {false && isDashboard && (
            <>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <h2 className="mb-3 font-bold text-kcs-blue-900 dark:text-white">Teacher Command Center</h2>
              <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                Attendance, grades, assignments, behavior notes, parent communication, and AI support are connected to parent, student, staff, and Super Admin dashboards.
              </p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <h2 className="mb-3 font-bold text-kcs-blue-900 dark:text-white">AI Teaching Assistant</h2>
              <div className="grid gap-2 text-sm">
                {['Generate lesson plan', 'Create quiz', 'Detect struggling students', 'Draft report-card comments'].map((item) => (
                  <button key={item} className="rounded-xl bg-gray-50 px-3 py-2 text-left font-semibold text-kcs-blue-900 hover:bg-kcs-blue-50 dark:bg-kcs-blue-800/30 dark:text-white">
                    {item}
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <h2 className="mb-3 font-bold text-kcs-blue-900 dark:text-white">Cross-role Alerts</h2>
              <div className="space-y-2">
                {aiSignals.filter((signal) => signal.roles.includes('teacher')).map((signal) => (
                  <div key={signal.title} className="rounded-xl bg-gray-50 p-3 dark:bg-kcs-blue-800/30">
                    <p className="text-sm font-semibold text-kcs-blue-900 dark:text-white">{signal.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{signal.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { label: 'Classes Today', value: '4', sub: '83 students total', icon: Calendar, tone: 'bg-kcs-blue-50 text-kcs-blue-700 dark:bg-kcs-blue-900/30 dark:text-kcs-blue-300' },
              { label: 'Pending Grades', value: '56', sub: 'Across 3 assessments', icon: FileText, tone: 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
              { label: 'At-Risk Students', value: '3', sub: 'Require follow-up', icon: Bell, tone: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
              { label: 'Average Class Score', value: '87%', sub: '+4% vs last month', icon: TrendingUp, tone: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
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

          <div className="grid gap-6 lg:grid-cols-4">
            <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <h2 className="mb-4 font-bold text-kcs-blue-900 dark:text-white">Attendance Taken</h2>
              <div className="space-y-3">
                {ecosystemAttendance.map((record) => {
                  const student = ecosystemStudents.find((item) => item.id === record.studentId)
                  return (
                    <div key={`${record.studentId}-${record.date}`} className="rounded-xl bg-gray-50 p-3 dark:bg-kcs-blue-800/30">
                      <p className="text-sm font-semibold text-kcs-blue-900 dark:text-white">{student?.name}</p>
                      <p className="text-xs capitalize text-gray-500 dark:text-gray-400">{record.status} • visible to parents and admin</p>
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <h2 className="mb-4 font-bold text-kcs-blue-900 dark:text-white">Recent Grade Entries</h2>
              <div className="space-y-3">
                {ecosystemGrades.slice(0, 4).map((grade) => (
                  <div key={`${grade.studentId}-${grade.assessment}`} className="rounded-xl bg-gray-50 p-3 dark:bg-kcs-blue-800/30">
                    <p className="text-sm font-semibold text-kcs-blue-900 dark:text-white">{grade.subject}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{grade.assessment} • {grade.score}% • parent/student updated</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <h2 className="mb-4 font-bold text-kcs-blue-900 dark:text-white">Submitted Work</h2>
              <div className="space-y-3">
                {ecosystemAssignments.filter((item) => item.status === 'submitted' || item.status === 'missing').map((item) => (
                  <div key={item.id} className="rounded-xl bg-gray-50 p-3 dark:bg-kcs-blue-800/30">
                    <p className="text-sm font-semibold text-kcs-blue-900 dark:text-white">{item.title}</p>
                    <p className="text-xs capitalize text-gray-500 dark:text-gray-400">{item.status} • {item.subject}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <h2 className="mb-4 font-bold text-kcs-blue-900 dark:text-white">Schedule Alerts</h2>
              <div className="space-y-3">
                {ecosystemSchedules.filter((item) => item.role === 'teacher').map((item) => (
                  <div key={`${item.time}-${item.title}`} className="rounded-xl bg-gray-50 p-3 dark:bg-kcs-blue-800/30">
                    <p className="text-sm font-semibold text-kcs-blue-900 dark:text-white">{item.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{item.time} • {item.room}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <h2 className="mb-4 font-bold text-kcs-blue-900 dark:text-white">Gradebook Categories</h2>
              <div className="space-y-3">
                {gradebookCategories.map((category: any) => (
                  <div key={category.name} className="rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-800/30">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-kcs-blue-900 dark:text-white">{category.name}</p>
                      <span className="text-xs font-bold text-kcs-blue-700 dark:text-kcs-blue-300">{category.weight}%</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-kcs-blue-900">
                      <div className="h-full rounded-full bg-kcs-blue-600" style={{ width: `${category.average}%` }} />
                    </div>
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{category.visibility}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <h2 className="mb-4 font-bold text-kcs-blue-900 dark:text-white">LMS Resources</h2>
              <div className="space-y-3">
                {lmsResources.map((resource) => (
                  <div key={resource.title} className="rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-800/30">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-kcs-blue-900 dark:text-white">{resource.title}</p>
                      <span className="rounded-full bg-kcs-gold-100 px-2 py-1 text-xs font-semibold capitalize text-kcs-blue-800 dark:bg-kcs-gold-900/30 dark:text-kcs-gold-300">{resource.type}</span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{resource.subject} • {resource.status}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <h2 className="mb-4 font-bold text-kcs-blue-900 dark:text-white">AI Report Comments</h2>
              <div className="space-y-3">
                {reportCards.map((card) => (
                  <div key={card.student} className="rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-800/30">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-kcs-blue-900 dark:text-white">{card.student}</p>
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{card.principalStatus}</span>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-gray-600 dark:text-gray-300">{card.teacherComment}</p>
                  </div>
                ))}
                {aiRecommendations.filter((item) => item.owner === 'Teacher').map((item) => (
                  <div key={item.title} className="rounded-xl border border-kcs-blue-200 bg-kcs-blue-50 p-4 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/30">
                    <p className="text-sm font-semibold text-kcs-blue-900 dark:text-white">{item.title}</p>
                    <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">{item.action}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-bold text-kcs-blue-900 dark:text-white">Custom Grading Scale</h2>
              <span className="badge-blue text-xs">Export PDF • Excel • CSV</span>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              {gradingScales.map((scale) => (
                <div key={scale.letter} className="rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-800/30">
                  <p className="font-display text-2xl font-bold text-kcs-blue-900 dark:text-white">{scale.letter}</p>
                  <p className="text-xs font-semibold text-kcs-blue-600 dark:text-kcs-blue-300">{scale.range} • GPA {scale.gpa.toFixed(1)}</p>
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{scale.descriptor}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 rounded-2xl border border-gray-100 bg-white p-6 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-bold text-kcs-blue-900 dark:text-white">
                  <Calendar size={18} className="text-kcs-blue-500" /> Today&apos;s Schedule
                </h2>
                <span className="badge-blue text-xs">Biology Department</span>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {todayClasses.map((item: any, index: number) => (
                  <div key={item.time} className={`rounded-xl border p-4 ${index === 0 ? 'border-kcs-blue-300 bg-kcs-blue-50 dark:border-kcs-blue-600 dark:bg-kcs-blue-800/40' : 'border-gray-100 bg-gray-50 dark:border-kcs-blue-800 dark:bg-kcs-blue-800/20'}`}>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{item.time}</p>
                    <p className="mt-1 font-semibold text-kcs-blue-900 dark:text-white">{item.course}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{item.room}</p>
                    <p className="mt-2 text-xs font-medium text-kcs-blue-700 dark:text-kcs-blue-300">{item.students} students</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <h2 className="mb-4 flex items-center gap-2 font-bold text-kcs-blue-900 dark:text-white">
                <MessageSquare size={18} className="text-kcs-gold-500" /> Messages
              </h2>
              <div className="space-y-3">
                {messages.map((message: any) => (
                  <div key={message.id} className="rounded-xl bg-gray-50 p-3 dark:bg-kcs-blue-800/40">
                    <p className="text-sm font-semibold text-kcs-blue-900 dark:text-white">{message.from}</p>
                    <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">{message.subject}</p>
                    <p className="mt-1 text-xs text-gray-400">{message.time}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-gray-100 bg-white p-6 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-bold text-kcs-blue-900 dark:text-white">
                  <CheckCircle2 size={18} className="text-green-500" /> Grading Queue
                </h2>
                <Link to="/portal/teacher/grades" className="flex items-center gap-1 text-xs font-semibold text-kcs-blue-600 dark:text-kcs-blue-400">
                  Grade Book <ChevronRight size={14} />
                </Link>
              </div>
              <div className="space-y-3">
                {gradingQueue.map((task: any) => (
                  <div key={task.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-kcs-blue-800 dark:bg-kcs-blue-800/20">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-kcs-blue-900 dark:text-white">{task.title}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{task.className}</p>
                      </div>
                      <span className="badge-gold text-xs">{task.pending} pending</span>
                    </div>
                    <div className="mt-2 flex items-center gap-1 text-xs text-gray-400">
                      <Clock size={12} /> Due {task.due}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-6 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-bold text-kcs-blue-900 dark:text-white">
                  <Users size={18} className="text-purple-500" /> Student Support Alerts
                </h2>
                <Link to="/portal/teacher/students" className="flex items-center gap-1 text-xs font-semibold text-kcs-blue-600 dark:text-kcs-blue-400">
                  Student List <ChevronRight size={14} />
                </Link>
              </div>
              <div className="space-y-3">
                {studentAlerts.map((alert: any) => (
                  <div key={alert.student} className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-kcs-blue-800 dark:bg-kcs-blue-800/20">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="font-semibold text-kcs-blue-900 dark:text-white">{alert.student}</p>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${alert.severity === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : alert.severity === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'}`}>
                        {alert.severity}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-300">{alert.note}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-gradient-to-r from-kcs-blue-900 to-kcs-blue-700 p-6 text-white dark:border-kcs-blue-800">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="mb-2 text-sm font-semibold text-kcs-gold-300">AI Classroom Assistant</p>
                <h2 className="font-display text-2xl font-bold">Generate intervention plans, revision exercises, and parent summaries faster.</h2>
              </div>
              <Link to="/portal/teacher/assignments" className="btn-gold whitespace-nowrap text-sm py-2.5">
                Open AI Assistant
              </Link>
            </div>
          </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}

export default TeacherPortal
