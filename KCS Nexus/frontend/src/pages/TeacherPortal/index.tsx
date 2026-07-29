import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Bell, BookOpen, Brain, Calendar, CheckCircle2, ChevronRight,
  Clock, FileText, GraduationCap, MessageSquare, TrendingUp, Users, AlertTriangle, ClipboardCheck, Maximize2, X, Send, Eye, Award
} from 'lucide-react'
import PortalSidebar from '@/components/layout/PortalSidebar'
import PortalSectionPanel from '@/components/shared/PortalSectionPanel'
import SuggestionBox from '@/components/shared/SuggestionBox'
import AccountSettingsPanel from '@/components/shared/AccountSettingsPanel'
import AdvancedGradebook from '@/components/gradebook/AdvancedGradebook'
import { studentsAPI } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import { getLocalizedGreeting, getLocalizedPortalDate } from '@/utils/portalGreeting'
import { getAssetUrl } from '@/utils/assets'
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

const gradingQueue = [
  { id: 1, title: 'AP Biology Lab Reports', className: 'Grade 11', pending: 18, due: 'Today' },
  { id: 2, title: 'Genetics Quiz', className: 'Grade 10', pending: 27, due: 'Tomorrow' },
  { id: 3, title: 'Science Fair Proposal', className: 'Grade 9', pending: 11, due: 'Apr 24' },
]

const SCHOOL_NAME = 'Kinshasa Christian School'
const SCHOOL_LOGO_SRC = getAssetUrl('images/kcs-logo.png')
const reportCardPeriods = ['Trimestre 1', 'Trimestre 2', 'Semestre 1', 'Trimestre 3', 'Trimestre 4', 'Semestre 2', 'Final annuel']
const escapeHtml = (value: string | number | undefined | null) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] ?? char))
const buildVerificationCode = (value: string) => {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0
  }
  return `KCS-${Math.abs(hash).toString(36).toUpperCase().padStart(8, '0')}`
}

const studentAlerts = [
  { student: 'Naomi K.', note: 'Attendance dropped to 84% over the last 3 weeks.', severity: 'high' },
  { student: 'Jordan M.', note: 'Strong performance growth. Candidate for science fair coaching.', severity: 'positive' },
  { student: 'David K.', note: 'Needs intervention in algebra foundations impacting science assessments.', severity: 'medium' },
]

const messages = [
  { id: 1, from: 'Admissions Office', subject: 'Prospective Family Shadow Day', time: '35m ago' },
  { id: 2, from: 'Principal Carter', subject: 'Faculty meeting agenda for Friday', time: '2h ago' },
  { id: 3, from: 'Parent of Elise K.', subject: 'Question about AP exam preparation', time: '5h ago' },
]

const getTeacherSegment = (pathname: string) => {
  const segment = pathname.split('/').filter(Boolean).at(-1)
  return !segment || segment === 'teacher' || segment === 'dashboard' ? 'dashboard' : segment
}

const statusTone = (value: string) => {
  if (['high', 'absent', 'missing', 'Open'].includes(value)) return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
  if (['medium', 'late', 'pending', 'Pending confirmation'].includes(value)) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
  return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
}

const gradeOptions = ['K3', 'K4', 'K5', ...Array.from({ length: 12 }, (_item, index) => `Grade ${index + 1}`)]
const lessonPlanUrl = 'https://propheticpowerfulman.github.io/LessonPlanPowerfullyDone/'

const inferGradeLabel = (className: string) => {
  if (className.includes('12')) return 'Grade 12'
  if (className.includes('11')) return 'Grade 11'
  if (className.includes('10')) return 'Grade 10'
  if (className.includes('9')) return 'Grade 9'
  if (className.includes('8')) return 'Grade 8'
  if (className.includes('7')) return 'Grade 7'
  if (className.includes('6')) return 'Grade 6'
  if (className.includes('5')) return 'Grade 5'
  if (className.includes('4')) return 'Grade 4'
  if (className.includes('3')) return 'Grade 3'
  if (className.includes('2')) return 'Grade 2'
  if (className.includes('1')) return 'Grade 1'
  if (className.toUpperCase().includes('K5')) return 'K5'
  if (className.toUpperCase().includes('K4')) return 'K4'
  if (className.toUpperCase().includes('K3')) return 'K3'
  return className
}

const gradingScaleRows = [
  ['99', '100', 'A+'], ['94', '98', 'A'], ['92', '93', 'A-'], ['90', '91', 'B+'],
  ['84', '89', 'B'], ['82', '83', 'B-'], ['80', '81', 'C+'], ['72', '79', 'C'],
  ['70', '71', 'C-'], ['68', '69', 'D+'], ['62', '67', 'D'], ['60', '61', 'D-'], ['0', '60', 'F'],
]

type GradebookColumn = {
  id: string
  title: string
  type: string
  date: string
  maxPoints: number
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
}

type StudentProfileResponse = {
  id: string
  studentNumber?: string
  grade: string
  section?: string
  gpa?: number | null
  attendanceRate?: number | null
  status?: string
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
const normalizeGradeOnlyKey = (value: string) => inferGradeLabel(value).replace(/\s+/g, '').toLowerCase()

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
    advisor: 'School registry',
    average: Math.round((student.gpa ?? 0) * 20) || undefined,
    gpa: student.gpa ?? undefined,
    rank: index + 1,
    attendance: student.attendanceRate ?? undefined,
    risk: student.status === 'active' ? 'low' : 'medium',
    strengths: [],
    weaknesses: [],
    aiInsight: `${name} is loaded from the Super Admin student registry for ${student.grade}${student.section ?? ''}.`,
  }
}

const TeacherSectionView = ({ segment }: { segment: string }) => {
  const sectionTitles: Record<string, { title: string; subtitle: string; icon: React.ElementType }> = {
    courses: { title: 'My Courses', subtitle: 'Assigned classes, rooms, schedules, and teaching load.', icon: BookOpen },
    students: { title: 'Students', subtitle: 'Academic profile, risk level, strengths, and support needs for each learner.', icon: Users },
    attendance: { title: 'Attendance', subtitle: 'Daily attendance records, class trends, and follow-up signals.', icon: ClipboardCheck },
    assignments: { title: 'Assignments', subtitle: 'Homework status, priorities, missing work, and LMS resources.', icon: FileText },
    grades: { title: 'Gradebook', subtitle: 'Assignments, final grades, averages, medians, legend, and grading scale.', icon: TrendingUp },
    'report-card': { title: 'Gradebook', subtitle: 'Assignments, final grades, averages, medians, legend, and grading scale.', icon: TrendingUp },
    reports: { title: 'Reports', subtitle: 'Report cards, AI comments, exports, and principal approval status.', icon: GraduationCap },
    discipline: { title: 'Detailed Student Discipline Report', subtitle: 'Incident context, action taken, parent contact, and follow-up plan.', icon: AlertTriangle },
    messages: { title: 'Messages', subtitle: 'Teacher inbox, parent threads, and internal coordination messages.', icon: MessageSquare },
  }

  const meta = sectionTitles[segment] ?? sectionTitles.reports
  const Icon = meta.icon
  const [superAdminStudentPool, setSuperAdminStudentPool] = useState<RegistryStudent[]>([])
  const [registryStatus, setRegistryStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const rosterSourceStudents = superAdminStudentPool.length ? superAdminStudentPool : ecosystemStudents

  const getRosterForClass = (className: string) => {
    const selectedClassKey = toClassKey(className)
    const selectedGradeKey = normalizeGradeOnlyKey(className)

    return rosterSourceStudents.filter((student) => {
      const exactClassKey = toClassKey(student.grade, student.section)
      const gradeOnlyKey = normalizeGradeOnlyKey(student.grade)
      return exactClassKey === selectedClassKey || gradeOnlyKey === selectedGradeKey
    })
  }

  const [actionMessage, setActionMessage] = useState('')
  const [courses, setCourses] = useState(() =>
    subjects.map((subject, index) => {
      const gradeLevel = inferGradeLabel(subject.className)
      return {
        ...subject,
        abbreviation: subject.name.split(' ').map((word) => word[0]).join('').slice(0, 6).toUpperCase(),
        creditHours: index === 1 ? 4 : index === 0 ? 3 : 2,
        gradeLevels: [gradeLevel],
        studentIds: ecosystemStudents.filter((student) => normalizeGradeOnlyKey(student.grade) === normalizeGradeOnlyKey(gradeLevel)).map((student) => student.id),
        status: 'active',
      }
    }),
  )
  const [courseTab, setCourseTab] = useState<'setup' | 'enrollment'>('setup')
  const [courseSearch, setCourseSearch] = useState('')
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null)
  const [rosterModalCourseId, setRosterModalCourseId] = useState<string | null>(null)
  const [selectedClassRoster, setSelectedClassRoster] = useState<string | null>(null)
  const [selectedEnrollmentCourseId, setSelectedEnrollmentCourseId] = useState(subjects[0].id)
  const [selectedGradebookCourseId, setSelectedGradebookCourseId] = useState(subjects[1].id)
  const [gradebookColumnsByCourse, setGradebookColumnsByCourse] = useState<Record<string, GradebookColumn[]>>({})
  const [gradebookScores, setGradebookScores] = useState<Record<string, string>>({})
  const [teacherStudents, setTeacherStudents] = useState<RegistryStudent[]>(() => ecosystemStudents)
  const [attendanceEntries, setAttendanceEntries] = useState(() => ecosystemAttendance)
  const [selectedAttendanceClass, setSelectedAttendanceClass] = useState('')
  const [assignmentList, setAssignmentList] = useState(() => ecosystemAssignments)
  const [assignmentAudience, setAssignmentAudience] = useState<'student' | 'class' | 'group'>('class')
  const [assignmentClass, setAssignmentClass] = useState('Grade 11 A')
  const [assignmentGroupIds, setAssignmentGroupIds] = useState<string[]>([])
  const [assignmentScores, setAssignmentScores] = useState<Record<string, number>>({})
  const [gradeEntries, setGradeEntries] = useState(() => ecosystemGrades)
  const [reportList, setReportList] = useState(() => reportCards)
  const [disciplineList, setDisciplineList] = useState(() => disciplineReports)
  const [reportCardClass, setReportCardClass] = useState('')
  const [reportCardStudentId, setReportCardStudentId] = useState('')
  const [reportCardTerm, setReportCardTerm] = useState('Trimestre 3')
  const [reportCardPreviewOpen, setReportCardPreviewOpen] = useState(false)
  const reportCardPreviewRef = useRef<HTMLIFrameElement>(null)
  const [reportCardRows, setReportCardRows] = useState(() =>
    subjects.slice(0, 4).map((subject, index) => ({
      id: subject.id,
      course: subject.name,
      teacher: subject.teacher,
      coefficient: index === 1 ? 2 : 1,
      points: index === 0 ? 89 : index === 1 ? 95 : index === 2 ? 91 : 76,
      comment: index === 1 ? 'Excellent lab reasoning' : index === 3 ? 'Needs steady homework rhythm' : 'Good progress',
      source: 'Submitted from teacher gradebook',
    })),
  )
  const [mainTeacherComment, setMainTeacherComment] = useState('')
  const [mainTeacherCommentEdited, setMainTeacherCommentEdited] = useState(false)
  const [generatedReportCards, setGeneratedReportCards] = useState<Array<{
    id: string
    student: string
    term: string
    average: number
    mention: string
    rows: typeof reportCardRows
    summary: string
  }>>([])
  const [inbox, setInbox] = useState(() => [
    ...messages.map((message) => ({ ...message, body: message.subject, requiresResponse: message.id === 3 })),
    ...ecosystemMessages.filter((message) => message.toRole === 'teacher').map((message, index) => ({
      id: index + 10,
      from: message.from,
      subject: message.subject,
      body: message.body,
      time: message.requiresResponse ? 'Response needed' : 'FYI',
      requiresResponse: message.requiresResponse,
    })),
  ])

  const [courseDraft, setCourseDraft] = useState({
    name: 'Integrated Science Lab',
    abbreviation: 'ISL',
    creditHours: 1,
    className: 'Grade 10',
    room: 'Lab 2',
    gradeLevels: ['Grade 10'],
    studentId: '',
  })
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [attendanceDraft, setAttendanceDraft] = useState({
    studentId: '',
    date: 'Apr 29',
    status: 'present',
    className: 'Grade 11A',
  })
  const [assignmentDraft, setAssignmentDraft] = useState({
    studentId: '',
    title: 'Exit ticket reflection',
    subject: 'AP Biology',
    due: '2026-05-12',
    status: 'pending',
    priority: 'medium',
  })
  const [gradeDraft, setGradeDraft] = useState({
    studentId: '',
    subject: 'AP Biology',
    assessment: 'Quick Check',
    score: 88,
    max: 100,
    date: 'Apr 29',
  })
  const [reportDraft, setReportDraft] = useState({
    student: '',
    period: 'Trimestre 3',
    reportType: 'Academic progress report',
    recipient: 'Direction / Academic Office',
    priority: 'Normal',
    average: 88,
    conduct: 'Good',
    actionRequested: 'Review and approve for official follow-up.',
    recommendation: 'Maintain current supports and verify the next gradebook update before publication.',
    teacherComment: 'Shows steady progress and responds well to targeted feedback.',
  })
  const [reportPreviewOpen, setReportPreviewOpen] = useState(false)
  const [officialPreviewHtml, setOfficialPreviewHtml] = useState('')
  const [officialPreviewTitle, setOfficialPreviewTitle] = useState('Official teacher document')
  const reportPreviewRef = useRef<HTMLIFrameElement>(null)
  const [disciplineDraft, setDisciplineDraft] = useState({
    studentId: '',
    category: 'Classroom conduct',
    incident: 'Needs a documented follow-up after repeated disruption during group activity.',
    actionTaken: 'Teacher conference completed and behavior target assigned.',
    followUp: 'Review progress in one week with advisor.',
    level: 'medium',
  })
  const [messageDraft, setMessageDraft] = useState({
    to: 'Academic Coordinator',
    subject: 'Student support update',
    body: 'Please review the new intervention note and confirm next steps.',
  })
  const [messageChannel, setMessageChannel] = useState<'Email' | 'Text' | 'Letter' | 'Call'>('Email')
  const [gradebookColumnDraft, setGradebookColumnDraft] = useState({
    title: 'Homework',
    type: 'Assignment',
    date: '04/30/2026',
    maxPoints: 100,
  })

  const findStudent = (studentId: string) => rosterSourceStudents.find((student) => student.id === studentId)
  const runAction = (message: string) => setActionMessage(message)

  useEffect(() => {
    let active = true

    const loadStudents = async () => {
      setRegistryStatus('loading')
      try {
        const response = await studentsAPI.getAll()
        const registryStudents = (response.data?.data ?? []).map(mapRegistryStudent)
        if (!active) return
        setSuperAdminStudentPool(registryStudents)
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
    if (!superAdminStudentPool.length) return

    const enrolledStudentIds = Array.from(new Set(courses.flatMap((course) => course.studentIds)))
    const controlledStudents = enrolledStudentIds
      .map((studentId) => superAdminStudentPool.find((student) => student.id === studentId))
      .filter((student): student is RegistryStudent => Boolean(student))

    setTeacherStudents(controlledStudents.length ? controlledStudents : rosterSourceStudents)
  }, [courses, superAdminStudentPool])

  useEffect(() => {
    const firstStudent = superAdminStudentPool[0]
    if (!firstStudent) return

    setSelectedStudentId((current) => current || firstStudent.id)
    setReportCardClass((current) => current || `${firstStudent.grade}${firstStudent.section}`)
    setReportCardStudentId((current) => current || firstStudent.id)
    setAttendanceDraft((draft) => ({ ...draft, studentId: draft.studentId || firstStudent.id }))
    setAssignmentDraft((draft) => ({ ...draft, studentId: draft.studentId || firstStudent.id }))
    setGradeDraft((draft) => ({ ...draft, studentId: draft.studentId || firstStudent.id }))
    setReportDraft((draft) => ({ ...draft, student: draft.student || firstStudent.name }))
    setDisciplineDraft((draft) => ({ ...draft, studentId: draft.studentId || superAdminStudentPool[1]?.id || firstStudent.id }))
    setCourseDraft((draft) => ({ ...draft, studentId: draft.studentId || firstStudent.id }))
  }, [superAdminStudentPool])
  const reportCardClasses = useMemo(() => {
    const classes = Array.from(new Set(teacherStudents.map((student) => `${student.grade}${student.section}`).filter(Boolean)))
    return classes.length ? classes : Array.from(new Set(rosterSourceStudents.map((student) => `${student.grade}${student.section}`).filter(Boolean)))
  }, [rosterSourceStudents, teacherStudents])
  const reportCardClassStudents = useMemo(() => {
    const source = teacherStudents.length ? teacherStudents : rosterSourceStudents
    return reportCardClass ? source.filter((student) => `${student.grade}${student.section}` === reportCardClass) : source
  }, [reportCardClass, rosterSourceStudents, teacherStudents])

  useEffect(() => {
    if (!reportCardClasses.length) return
    setReportCardClass((current) => current || reportCardClasses[0])
  }, [reportCardClasses])

  useEffect(() => {
    if (!reportCardClassStudents.length) return
    if (!reportCardClassStudents.some((student) => student.id === reportCardStudentId)) {
      setReportCardStudentId(reportCardClassStudents[0].id)
      setMainTeacherCommentEdited(false)
    }
  }, [reportCardClassStudents, reportCardStudentId])
  const reportCardStudent = findStudent(reportCardStudentId)
  const reportCardAverage = useMemo(() => {
    const totalWeightedPoints = reportCardRows.reduce((sum, row) => sum + Math.max(0, Math.min(100, row.points)) * row.coefficient, 0)
    const totalCoefficient = reportCardRows.reduce((sum, row) => sum + row.coefficient, 0)
    return totalCoefficient ? Number((totalWeightedPoints / totalCoefficient).toFixed(2)) : 0
  }, [reportCardRows])
  const reportCardMention = reportCardAverage >= 90 ? 'Excellent' : reportCardAverage >= 80 ? 'Very Good' : reportCardAverage >= 70 ? 'Satisfactory' : reportCardAverage >= 60 ? 'Needs Support' : 'Intervention Required'
  const reportCardDecision = reportCardAverage >= 70 ? 'Promote academic momentum' : 'Create support plan before final approval'
  const reportCardStudentName = reportCardStudent?.name ?? reportCardClassStudents[0]?.name ?? 'Selected student'
  const suggestedMainTeacherComment = `${reportCardStudentName} completed ${reportCardRows.length} course evaluation(s) for ${reportCardTerm} with a weighted average of ${reportCardAverage}%. ${reportCardStudentName} should maintain the strongest subject habits through consistent class participation, while the main teacher monitors the lowest course score and coordinates support with the concerned subject teacher.`

  useEffect(() => {
    if (!mainTeacherCommentEdited) setMainTeacherComment(suggestedMainTeacherComment)
  }, [mainTeacherCommentEdited, suggestedMainTeacherComment])

  const updateReportCardRow = (rowId: string, field: 'course' | 'points' | 'coefficient' | 'comment', value: string | number) => {
    setReportCardRows((current) => current.map((row) => {
      if (row.id !== rowId) return row
      if (field === 'points') return { ...row, points: Math.max(0, Math.min(100, Number(value) || 0)) }
      if (field === 'coefficient') return { ...row, coefficient: Math.max(1, Number(value) || 1) }
      return { ...row, [field]: value }
    }))
  }

  const addReportCardCourse = () => {
    setReportCardRows((current) => [
      ...current,
      {
        id: `rc-${Date.now()}`,
        course: 'New Course',
        teacher: 'Dr. Mukendi',
        coefficient: 1,
        points: 0,
        comment: 'Teacher comment pending',
        source: 'Pending gradebook submission',
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
      name: 'Integrated Science Lab',
      abbreviation: 'ISL',
      creditHours: 1,
      className: 'Grade 10',
      room: 'Lab 2',
      gradeLevels: ['Grade 10'],
      studentId: firstStudentId,
    })
  }

  const generateReportCard = () => {
    const studentName = reportCardStudent?.name ?? 'Selected student'
    const summary = `${studentName} earned ${reportCardAverage}% for ${reportCardTerm}. Mention: ${reportCardMention}. Decision: ${reportCardDecision}. Main teacher comment: ${mainTeacherComment}`
    const nextReport = {
      id: `rc-final-${Date.now()}`,
      student: studentName,
      term: reportCardTerm,
      average: reportCardAverage,
      mention: reportCardMention,
      rows: reportCardRows,
      summary,
    }
    setGeneratedReportCards((current) => [nextReport, ...current])
    setReportList((current) => [{
      student: studentName,
      term: reportCardTerm,
      average: reportCardAverage,
      conduct: reportCardMention,
      teacherComment: summary,
      principalStatus: 'Pending review',
      download: 'Report card draft',
    }, ...current])
    runAction(`${studentName}'s report card was generated with an automatic ${reportCardAverage}% average.`)
  }

  const reportCardDocumentHtml = () => {
    const studentName = reportCardStudent?.name ?? 'Selected student'
    const grade = reportCardStudent ? `${reportCardStudent.grade}${reportCardStudent.section}` : 'Grade pending'
    const logoUrl = typeof window === 'undefined' ? SCHOOL_LOGO_SRC : new URL(SCHOOL_LOGO_SRC, window.location.origin).href
    const documentId = `KCS-RC-${Date.now()}`
    const verificationCode = buildVerificationCode(`${studentName}|${grade}|${reportCardTerm}|${reportCardAverage}|${reportCardRows.map((row) => `${row.course}:${row.points}:${row.coefficient}`).join('|')}`)
    const verificationUrl = typeof window === 'undefined'
      ? `https://propheticpowerfulman.github.io/kcs-nexus-demo/#verify=${verificationCode}`
      : `${window.location.origin}${window.location.pathname}#verify=${verificationCode}`
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=138x138&data=${encodeURIComponent(verificationUrl)}`
    const rows = reportCardRows.map((row) => {
      const score = Math.max(0, Math.min(100, row.points))
      const remark = score >= 90 ? 'Excellent' : score >= 80 ? 'Very good' : score >= 70 ? 'Satisfactory' : score >= 60 ? 'Needs support' : 'Intervention'
      return `<tr><td><strong>${escapeHtml(row.course)}</strong><br><span>${escapeHtml(row.source)}</span></td><td>${escapeHtml(row.teacher)}</td><td class="num">${escapeHtml(row.coefficient)}</td><td class="num">${score.toFixed(1)}%</td><td>${escapeHtml(remark)}</td><td>${escapeHtml(row.comment)}</td></tr>`
    }).join('')

    return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(SCHOOL_NAME)} Report Card</title><style>
      @page{size:A4;margin:10mm}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}body{margin:0;background:#eef3fb;color:#10233f;font-family:Arial,Helvetica,sans-serif}.sheet{position:relative;width:210mm;min-height:297mm;margin:0 auto;background:#fff;border:1px solid #d6dfec;padding:13mm;overflow:hidden}.watermark{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;opacity:.06;pointer-events:none}.watermark img{width:198mm;max-width:96%}header{position:relative;display:flex;align-items:center;justify-content:space-between;gap:18px;border-bottom:5px solid #0b3b73;padding-bottom:14px}.brand{display:flex;align-items:center;gap:22px}.logo{height:178px;width:178px;object-fit:contain}.school{margin:0;color:#0b3b73;font-size:28px;font-weight:900;letter-spacing:.02em}.tag{margin:6px 0 0;color:#b8872c;font-size:13px;font-weight:900;text-transform:uppercase;letter-spacing:.14em}.badge{border:1px solid #d8b66b;background:#fff8e6;border-radius:12px;padding:12px 14px;text-align:right;font-size:12px;color:#5c420b}.title{margin:20px 0 14px;text-align:center}.title h1{margin:0;color:#0b3b73;font-size:31px}.title p{margin:6px 0 0;color:#526172}.info{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin-bottom:14px}.info div,.summary div{border:1px solid #dbe4f0;border-radius:10px;padding:9px;background:#f8fafc}.label{display:block;color:#64748b;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.08em}.value{display:block;margin-top:4px;font-weight:900;color:#10233f}table{width:100%;border-collapse:collapse;margin-top:10px;font-size:11px}th{background:#0b3b73;color:#fff;text-align:left;padding:8px;border:1px solid #0b3b73}td{padding:8px;border:1px solid #dbe4f0;vertical-align:top}td span{color:#64748b;font-size:9px}.num{text-align:right;font-weight:900}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin-top:14px}.average{font-size:24px;color:#0b3b73}.comment{margin-top:14px;border-left:5px solid #d8a536;background:#fff8e6;padding:13px;color:#3f3215;min-height:34mm}.auth{display:grid;grid-template-columns:1fr 148px;gap:14px;align-items:center;margin-top:14px;border:1px dashed #9ab0cb;background:#f8fafc;padding:10px}.qr{height:138px;width:138px;border:6px solid #fff;box-shadow:0 0 0 1px #dbe4f0}.auth p{margin:4px 0;font-size:11px}.mono{font-family:Consolas,monospace;font-weight:900;color:#0b3b73}.signatures{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:30px}.sig{border-top:1px solid #718096;padding-top:8px;text-align:center;font-size:11px;color:#64748b}footer{margin-top:18px;display:flex;justify-content:space-between;color:#64748b;font-size:10px}@media print{body{background:#fff}.sheet{border:0;margin:0;padding:0;width:auto;min-height:auto}.actions{display:none}}
    </style></head><body><main class="sheet"><div class="watermark"><img src="${escapeHtml(logoUrl)}" alt=""></div><header><section class="brand"><img class="logo" src="${escapeHtml(logoUrl)}" alt="KCS logo"><div><p class="school">${escapeHtml(SCHOOL_NAME)}</p><p class="tag">Excellence in Education, Rooted in Faith</p></div></section><aside class="badge"><strong>Official Report Card</strong><br>${escapeHtml(documentId)}<br>${escapeHtml(new Date().toLocaleString())}</aside></header><section class="title"><h1>Academic Report Card</h1><p>${escapeHtml(reportCardTerm)} - 2026 Academic Year - A4 official school copy</p></section><section class="info"><div><span class="label">Student</span><span class="value">${escapeHtml(studentName)}</span></div><div><span class="label">Class</span><span class="value">${escapeHtml(grade)}</span></div><div><span class="label">Main teacher</span><span class="value">${escapeHtml(reportCardStudent?.advisor ?? 'Homeroom teacher')}</span></div><div><span class="label">Status</span><span class="value">Teacher draft</span></div></section><table><thead><tr><th>Course / gradebook source</th><th>Teacher</th><th>Coef.</th><th>Final score</th><th>Mention</th><th>Teacher comment</th></tr></thead><tbody>${rows}</tbody></table><section class="summary"><div><span class="label">General average</span><span class="value average">${escapeHtml(reportCardAverage)}%</span></div><div><span class="label">Mention</span><span class="value">${escapeHtml(reportCardMention)}</span></div><div><span class="label">Decision</span><span class="value">${escapeHtml(reportCardDecision)}</span></div><div><span class="label">Publication</span><span class="value">After approval and fee clearance</span></div></section><section class="comment"><strong>Main teacher final comment</strong><br>${escapeHtml(mainTeacherComment)}</section><section class="auth"><div><span class="label">Digital authenticity markers</span><p>Verification code: <span class="mono">${escapeHtml(verificationCode)}</span></p><p>Document ID: <span class="mono">${escapeHtml(documentId)}</span></p><p>Scan the QR code to open the Nexus verification address for this report-card copy.</p><p class="mono">${escapeHtml(verificationUrl)}</p></div><img class="qr" src="${escapeHtml(qrUrl)}" alt="Report card verification QR code"></section><section class="signatures"><div class="sig">Main Teacher Comment / Signature</div><div class="sig">Academic Coordinator</div><div class="sig">Super Admin / Principal</div></section><footer><span>${escapeHtml(SCHOOL_NAME)} - KCS Nexus official academic document</span><span>${escapeHtml(documentId)} - ${escapeHtml(verificationCode)}</span></footer></main></body></html>`
  }

  const openReportCardDocument = (printNow = false) => {
    setReportCardPreviewOpen(true)
    if (printNow) {
      setTimeout(() => {
        reportCardPreviewRef.current?.contentWindow?.focus()
        reportCardPreviewRef.current?.contentWindow?.print()
      }, 350)
    }
  }

  const reportDocumentHtml = () => {
    const logoUrl = typeof window === 'undefined' ? SCHOOL_LOGO_SRC : new URL(SCHOOL_LOGO_SRC, window.location.origin).href
    const student = teacherStudents.find((item) => item.name === reportDraft.student) ?? teacherStudents[0]
    const documentId = `KCS-TR-${Date.now()}`
    const verificationCode = buildVerificationCode(`${reportDraft.student}|${reportDraft.period}|${reportDraft.reportType}|${reportDraft.recipient}|${reportDraft.average}`)
    const verificationUrl = typeof window === 'undefined'
      ? `https://propheticpowerfulman.github.io/kcs-nexus-demo/#teacher-report=${verificationCode}`
      : `${window.location.origin}${window.location.pathname}#teacher-report=${verificationCode}`
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=132x132&data=${encodeURIComponent(verificationUrl)}`

    return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(SCHOOL_NAME)} Teacher Report</title><style>
      @page{size:A4;margin:12mm}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}body{margin:0;background:#edf3fb;color:#10233f;font-family:Arial,Helvetica,sans-serif}.sheet{position:relative;width:210mm;min-height:297mm;margin:0 auto;background:#fff;border:1px solid #d6dfec;padding:13mm;overflow:hidden}.watermark{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;opacity:.06;pointer-events:none}.watermark img{width:198mm;max-width:96%}header{position:relative;display:flex;align-items:center;justify-content:space-between;gap:18px;border-bottom:5px solid #0b3b73;padding-bottom:14px}.brand{display:flex;align-items:center;gap:22px}.logo{height:172px;width:172px;object-fit:contain}.school{margin:0;color:#0b3b73;font-size:27px;font-weight:900}.tag{margin:6px 0 0;color:#b8872c;font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.14em}.badge{border:1px solid #d8b66b;background:#fff8e6;border-radius:12px;padding:12px 14px;text-align:right;font-size:12px;color:#5c420b}.title{text-align:center;margin:22px 0 16px}.title h1{margin:0;color:#0b3b73;font-size:30px}.title p{margin:6px 0 0;color:#526172}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.box{border:1px solid #dbe4f0;border-radius:10px;background:#f8fafc;padding:10px}.label{display:block;color:#64748b;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.08em}.value{display:block;margin-top:5px;font-weight:900;color:#10233f}.section{position:relative;margin-top:16px;border:1px solid #dbe4f0;border-radius:12px;padding:14px;background:#fff}.section h2{margin:0 0 8px;color:#0b3b73;font-size:16px}.section p{margin:0;line-height:1.55}.priority{display:inline-block;border-radius:999px;background:${reportDraft.priority === 'Urgent' ? '#fee2e2' : '#dbeafe'};color:${reportDraft.priority === 'Urgent' ? '#991b1b' : '#1d4ed8'};padding:6px 10px;font-weight:900;font-size:11px}.auth{display:grid;grid-template-columns:1fr 144px;gap:12px;align-items:center;margin-top:16px;border:1px dashed #9ab0cb;background:#f8fafc;padding:10px}.qr{height:132px;width:132px;border:6px solid #fff;box-shadow:0 0 0 1px #dbe4f0}.auth p{margin:4px 0;font-size:11px}.mono{font-family:Consolas,monospace;font-weight:900;color:#0b3b73}.signatures{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:44px}.sig{border-top:1px solid #718096;padding-top:8px;text-align:center;font-size:11px;color:#64748b}footer{margin-top:22px;display:flex;justify-content:space-between;color:#64748b;font-size:10px}@media print{body{background:#fff}.sheet{border:0;margin:0;padding:0;width:auto;min-height:auto}}
    </style></head><body><main class="sheet"><div class="watermark"><img src="${escapeHtml(logoUrl)}" alt=""></div><header><section class="brand"><img class="logo" src="${escapeHtml(logoUrl)}" alt="KCS logo"><div><p class="school">${escapeHtml(SCHOOL_NAME)}</p><p class="tag">Official teacher report</p></div></section><aside class="badge"><strong>${escapeHtml(reportDraft.recipient)}</strong><br>${escapeHtml(documentId)}<br>${escapeHtml(new Date().toLocaleString())}</aside></header><section class="title"><h1>${escapeHtml(reportDraft.reportType)}</h1><p>${escapeHtml(reportDraft.period)} - ${escapeHtml(reportDraft.priority)} priority</p></section><section class="grid"><div class="box"><span class="label">Student</span><span class="value">${escapeHtml(reportDraft.student)}</span></div><div class="box"><span class="label">Class</span><span class="value">${escapeHtml(student ? `${student.grade}${student.section}` : 'Class pending')}</span></div><div class="box"><span class="label">Average</span><span class="value">${escapeHtml(reportDraft.average)}%</span></div><div class="box"><span class="label">Conduct</span><span class="value">${escapeHtml(reportDraft.conduct)}</span></div></section><section class="section"><h2>Teacher observation</h2><p>${escapeHtml(reportDraft.teacherComment)}</p></section><section class="section"><h2>Recommendation</h2><p>${escapeHtml(reportDraft.recommendation)}</p></section><section class="section"><h2>Requested action</h2><p><span class="priority">${escapeHtml(reportDraft.priority)}</span> ${escapeHtml(reportDraft.actionRequested)}</p></section><section class="section"><h2>Delivery logic</h2><p>This official report is prepared for ${escapeHtml(reportDraft.recipient)}. Parent-facing copies require school approval and finance/obligation clearance before portal publication.</p></section><section class="auth"><div><span class="label">Digital authenticity markers</span><p>Verification code: <span class="mono">${escapeHtml(verificationCode)}</span></p><p>Document ID: <span class="mono">${escapeHtml(documentId)}</span></p><p>Scan the QR code to verify this teacher report package in KCS Nexus.</p><p class="mono">${escapeHtml(verificationUrl)}</p></div><img class="qr" src="${escapeHtml(qrUrl)}" alt="Teacher report verification QR code"></section><section class="signatures"><div class="sig">Teacher</div><div class="sig">Academic Direction</div><div class="sig">Parent / Guardian if applicable</div></section><footer><span>${escapeHtml(SCHOOL_NAME)} - KCS Nexus official teacher report</span><span>${escapeHtml(documentId)} - ${escapeHtml(verificationCode)}</span></footer></main></body></html>`
  }

  const openReportDocument = (printNow = false) => {
    setOfficialPreviewTitle(`${reportDraft.student} - ${reportDraft.reportType}`)
    setOfficialPreviewHtml(reportDocumentHtml())
    setReportPreviewOpen(true)
    if (printNow) {
      setTimeout(() => {
        reportPreviewRef.current?.contentWindow?.focus()
        reportPreviewRef.current?.contentWindow?.print()
      }, 350)
    }
  }

  const openSavedReportDocument = (card: any, recipient: string, printNow = false) => {
    setReportDraft((draft) => ({
      ...draft,
      student: card.student,
      period: card.term ?? draft.period,
      reportType: card.reportType ?? 'Academic progress report',
      recipient,
      average: Number(card.average) || draft.average,
      conduct: card.conduct ?? draft.conduct,
      teacherComment: card.teacherComment ?? draft.teacherComment,
      actionRequested: recipient.includes('Parent') ? 'Parent review requested through the portal after school approval.' : 'Administrative approval requested for official follow-up.',
      recommendation: card.recommendation ?? draft.recommendation,
    }))
    const html = reportDocumentHtml()
      .replace(escapeHtml(reportDraft.student), escapeHtml(card.student))
      .replace(escapeHtml(reportDraft.recipient), escapeHtml(recipient))
    setOfficialPreviewTitle(`${card.student} - ${recipient}`)
    setOfficialPreviewHtml(html)
    setReportPreviewOpen(true)
    if (printNow) {
      setTimeout(() => {
        reportPreviewRef.current?.contentWindow?.focus()
        reportPreviewRef.current?.contentWindow?.print()
      }, 350)
    }
  }

  const officialMemoHtml = (title: string, subtitle: string, sections: Array<[string, string]>) => {
    const logoUrl = typeof window === 'undefined' ? SCHOOL_LOGO_SRC : new URL(SCHOOL_LOGO_SRC, window.location.origin).href
    const documentId = `KCS-DOC-${Date.now()}`
    const verificationCode = buildVerificationCode(`${title}|${subtitle}|${sections.map(([label, value]) => `${label}:${value}`).join('|')}`)
    const verificationUrl = typeof window === 'undefined'
      ? `https://propheticpowerfulman.github.io/kcs-nexus-demo/#document=${verificationCode}`
      : `${window.location.origin}${window.location.pathname}#document=${verificationCode}`
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=132x132&data=${encodeURIComponent(verificationUrl)}`
    const sectionHtml = sections.map(([label, value]) => `<section class="section"><h2>${escapeHtml(label)}</h2><p>${escapeHtml(value)}</p></section>`).join('')

    return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(SCHOOL_NAME)} ${escapeHtml(title)}</title><style>
      @page{size:A4;margin:12mm}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}body{margin:0;background:#edf3fb;color:#10233f;font-family:Arial,Helvetica,sans-serif}.sheet{position:relative;width:210mm;min-height:297mm;margin:0 auto;background:#fff;border:1px solid #d6dfec;padding:13mm;overflow:hidden}.watermark{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;opacity:.06;pointer-events:none}.watermark img{width:198mm;max-width:96%}header{position:relative;display:flex;align-items:center;justify-content:space-between;gap:18px;border-bottom:5px solid #0b3b73;padding-bottom:14px}.brand{display:flex;align-items:center;gap:22px}.logo{height:172px;width:172px;object-fit:contain}.school{margin:0;color:#0b3b73;font-size:27px;font-weight:900}.tag{margin:6px 0 0;color:#b8872c;font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.14em}.badge{border:1px solid #d8b66b;background:#fff8e6;border-radius:12px;padding:12px 14px;text-align:right;font-size:12px;color:#5c420b}.title{text-align:center;margin:22px 0 16px}.title h1{margin:0;color:#0b3b73;font-size:30px}.title p{margin:6px 0 0;color:#526172}.section{position:relative;margin-top:14px;border:1px solid #dbe4f0;border-radius:12px;padding:14px;background:#fff}.section h2{margin:0 0 8px;color:#0b3b73;font-size:16px}.section p{margin:0;line-height:1.55}.auth{display:grid;grid-template-columns:1fr 144px;gap:12px;align-items:center;margin-top:16px;border:1px dashed #9ab0cb;background:#f8fafc;padding:10px}.qr{height:132px;width:132px;border:6px solid #fff;box-shadow:0 0 0 1px #dbe4f0}.auth p{margin:4px 0;font-size:11px}.mono{font-family:Consolas,monospace;font-weight:900;color:#0b3b73}.signatures{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:44px}.sig{border-top:1px solid #718096;padding-top:8px;text-align:center;font-size:11px;color:#64748b}footer{margin-top:22px;display:flex;justify-content:space-between;color:#64748b;font-size:10px}@media print{body{background:#fff}.sheet{border:0;margin:0;padding:0;width:auto;min-height:auto}}
    </style></head><body><main class="sheet"><div class="watermark"><img src="${escapeHtml(logoUrl)}" alt=""></div><header><section class="brand"><img class="logo" src="${escapeHtml(logoUrl)}" alt="KCS logo"><div><p class="school">${escapeHtml(SCHOOL_NAME)}</p><p class="tag">Official school document</p></div></section><aside class="badge"><strong>${escapeHtml(title)}</strong><br>${escapeHtml(documentId)}<br>${escapeHtml(new Date().toLocaleString())}</aside></header><section class="title"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(subtitle)}</p></section>${sectionHtml}<section class="auth"><div><span class="label">Digital authenticity markers</span><p>Verification code: <span class="mono">${escapeHtml(verificationCode)}</span></p><p>Document ID: <span class="mono">${escapeHtml(documentId)}</span></p><p class="mono">${escapeHtml(verificationUrl)}</p></div><img class="qr" src="${escapeHtml(qrUrl)}" alt="Verification QR code"></section><section class="signatures"><div class="sig">Teacher</div><div class="sig">Academic Direction</div><div class="sig">Parent / Office</div></section><footer><span>${escapeHtml(SCHOOL_NAME)} - KCS Nexus official document</span><span>${escapeHtml(documentId)} - ${escapeHtml(verificationCode)}</span></footer></main></body></html>`
  }

  const openOfficialMemo = (title: string, subtitle: string, sections: Array<[string, string]>, printNow = false) => {
    setOfficialPreviewTitle(`${title} - ${subtitle}`)
    setOfficialPreviewHtml(officialMemoHtml(title, subtitle, sections))
    setReportPreviewOpen(true)
    if (printNow) {
      setTimeout(() => {
        reportPreviewRef.current?.contentWindow?.focus()
        reportPreviewRef.current?.contentWindow?.print()
      }, 350)
    }
  }

  const createCourse = () => {
    const selectedGrade = courseDraft.gradeLevels[0] ?? 'Grade 10'
    const roster = getRosterForClass(courseDraft.className || selectedGrade)
    const nextCourse = {
      id: editingCourseId ?? `course-${Date.now()}`,
      name: courseDraft.name,
      abbreviation: courseDraft.abbreviation,
      creditHours: courseDraft.creditHours,
      teacher: 'Dr. Mukendi',
      className: selectedGrade,
      room: courseDraft.room,
      gradeLevels: [selectedGrade],
      studentIds: roster.map((student) => student.id),
      status: editingCourseId ? 'updated' : 'draft',
    }
    setCourses((current) => editingCourseId ? current.map((course) => course.id === editingCourseId ? { ...course, ...nextCourse } : course) : [nextCourse, ...current])
    setSelectedEnrollmentCourseId(nextCourse.id)
    setSelectedGradebookCourseId(nextCourse.id)
    runAction(`${nextCourse.name} ${editingCourseId ? 'updated' : 'created'} for ${selectedGrade}; ${roster.length} official student(s) were enrolled and sent to Grade Book.`)
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
    setCourseTab('setup')
    runAction(`${course.name} loaded for editing.`)
  }

  const deleteCourse = (courseId: string) => {
    const course = courses.find((item) => item.id === courseId)
    setCourses((current) => current.filter((item) => item.id !== courseId))
    if (editingCourseId === courseId) resetCourseDraft()
    if (selectedEnrollmentCourseId === courseId) setSelectedEnrollmentCourseId(courses.find((item) => item.id !== courseId)?.id ?? '')
    runAction(`${course?.name ?? 'Subject'} removed from this teacher workspace.`)
  }

  const filteredCourses = courses.filter((course) => {
    const searchable = `${course.gradeLevels.join(' ')} ${course.name} ${course.abbreviation} ${course.room}`.toLowerCase()
    return searchable.includes(courseSearch.toLowerCase())
  })
  const selectedEnrollmentCourse = courses.find((course) => course.id === selectedEnrollmentCourseId) ?? courses[0]
  const rosterModalCourse = rosterModalCourseId ? courses.find((course) => course.id === rosterModalCourseId) ?? null : null
  const rosterModalEnrolledStudents = rosterModalCourse?.studentIds
    .map((studentId) => rosterSourceStudents.find((student) => student.id === studentId))
    .filter((student): student is RegistryStudent => Boolean(student)) ?? []
  const rosterModalAvailableStudents = rosterModalCourse
    ? rosterSourceStudents.filter((student) => !rosterModalCourse.studentIds.includes(student.id))
    : []
  const totalEnrollment = courses.reduce((sum, course) => sum + course.studentIds.length, 0)
  const totalCreditHours = courses.reduce((sum, course) => sum + course.creditHours, 0)
  const coveredGrades = Array.from(new Set(courses.flatMap((course) => course.gradeLevels))).length

  const openCourseEnrollment = (courseId: string) => {
    const course = courses.find((item) => item.id === courseId)
    setSelectedEnrollmentCourseId(courseId)
    setCourseTab('enrollment')
    runAction(`${course?.name ?? 'Subject'} enrollment opened.`)
  }

  const openCourseRosterDialog = (courseId: string) => {
    const course = courses.find((item) => item.id === courseId)
    setRosterModalCourseId(courseId)
    setSelectedEnrollmentCourseId(courseId)
    runAction(`${course?.name ?? 'Subject'} roster editor opened with central registry students.`)
  }

  const toggleCourseStudent = (courseId: string, studentId: string) => {
    const course = courses.find((item) => item.id === courseId)
    const student = rosterSourceStudents.find((item) => item.id === studentId)
    if (!course || !student) return
    const enrolled = course.studentIds.includes(studentId)
    setCourses((current) => current.map((item) => (
      item.id === courseId
        ? { ...item, studentIds: enrolled ? item.studentIds.filter((id) => id !== studentId) : [...item.studentIds, studentId] }
        : item
    )))
    runAction(`${student.name} ${enrolled ? 'removed from' : 'added to'} ${course.name}.`)
  }

  const selectedGradebookCourse = courses.find((course) => course.id === selectedGradebookCourseId) ?? courses[0]
  const gradebookColumns = selectedGradebookCourse ? gradebookColumnsByCourse[selectedGradebookCourse.id] ?? [] : []
  const gradebookStudents = selectedGradebookCourse?.studentIds
    .map((studentId) => findStudent(studentId))
    .filter((student): student is NonNullable<typeof student> => Boolean(student)) ?? []

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
      .filter((score): score is number => score !== null)
    if (!countedScores.length) return null
    return Math.round(countedScores.reduce((sum, score) => sum + score, 0) / countedScores.length)
  }

  const gradebookValues = gradebookStudents
    .map((student) => getFinalGrade(student.id))
    .filter((score): score is number => score !== null)
  const gradebookAverage = gradebookValues.length ? Math.round(gradebookValues.reduce((sum, score) => sum + score, 0) / gradebookValues.length) : 0
  const gradebookMedian = gradebookValues.length ? [...gradebookValues].sort((a, b) => a - b)[Math.floor(gradebookValues.length / 2)] : 0

  const updateGradebookScore = (columnId: string, studentId: string, score: string) => {
    setGradebookScores((current) => ({ ...current, [getGradebookScoreKey(columnId, studentId)]: score }))
  }

  const createGradebookColumn = () => {
    const title = gradebookColumnDraft.title.trim()
    if (!title) {
      runAction('Add a column name before creating a gradebook column.')
      return
    }
    const nextColumn = {
      id: `gb-${Date.now()}`,
      title,
      type: gradebookColumnDraft.type.trim() || 'Assignment',
      date: gradebookColumnDraft.date.trim() || '04/30/2026',
      maxPoints: Math.max(1, Number(gradebookColumnDraft.maxPoints) || 100),
    }
    setGradebookColumnsByCourse((current) => ({
      ...current,
      [selectedGradebookCourse.id]: [...(current[selectedGradebookCourse.id] ?? []), nextColumn],
    }))
    setGradebookColumnDraft((draft) => ({ ...draft, title: '', maxPoints: 100 }))
    runAction(`${nextColumn.title} column added. Final grades will recalculate automatically.`)
  }

  const deleteGradebookColumn = (columnId: string) => {
    setGradebookColumnsByCourse((current) => ({
      ...current,
      [selectedGradebookCourse.id]: (current[selectedGradebookCourse.id] ?? []).filter((column) => column.id !== columnId),
    }))
    setGradebookScores((current) => {
      const next = { ...current }
      Object.keys(next).forEach((key) => {
        if (key.includes(`-${columnId}-`)) delete next[key]
      })
      return next
    })
    runAction('Gradebook column removed and final grades recalculated.')
  }

  const importStudent = () => {
    const student = findStudent(selectedStudentId)
    if (!student) return
    const targetCourseId = selectedEnrollmentCourseId || courses[0]?.id
    const targetCourse = courses.find((course) => course.id === targetCourseId) ?? courses[0]
    if (!targetCourse) return
    setCourses((current) => current.map((course) => (
      course.id === targetCourse.id && !course.studentIds.includes(student.id)
        ? { ...course, studentIds: [...course.studentIds, student.id] }
        : course
    )))
    setSelectedEnrollmentCourseId(targetCourse.id)
    runAction(`${student.name} enrolled in ${targetCourse.name}; Students updated automatically from course enrollment.`)
  }

  const addAttendance = () => {
    const student = findStudent(attendanceDraft.studentId)
    setAttendanceEntries((current) => [{ ...attendanceDraft }, ...current])
    runAction(`${student?.name ?? 'Student'} marked ${attendanceDraft.status}; parent/admin visibility queued.`)
  }

  const markClassAttendance = (studentId: string, status: string) => {
    const student = findStudent(studentId)
    const nextRecord = {
      studentId,
      date: attendanceDate,
      className: selectedAttendanceClassName,
      status,
    }
    setAttendanceEntries((current) => [
      nextRecord,
      ...current.filter((entry) => !(entry.studentId === studentId && entry.date === attendanceDate && entry.className === selectedAttendanceClassName)),
    ])
    runAction(`${student?.name ?? 'Student'} marked ${status} for ${selectedAttendanceClassName}; attendance analytics recalculated.`)
  }

  const createAssignment = () => {
    const recipients = assignmentRecipients.length ? assignmentRecipients : teacherStudents.slice(0, 1)
    const createdAt = Date.now()
    const nextAssignments = recipients.map((student, index) => ({
      id: `asg-${createdAt}-${index}`,
      ...assignmentDraft,
      studentId: student.id,
      subject: assignmentDraft.subject,
      status: 'pending',
      audience: assignmentAudience,
      parentVisible: true,
      studentVisible: true,
      gradebookSynced: false,
    }))

    setAssignmentList((current) => [...nextAssignments, ...current])
    runAction(`${assignmentDraft.title} sent to ${recipients.length} student(s); student dashboards and parent visibility were queued.`)
  }

  const toggleAssignmentGroupStudent = (studentId: string) => {
    setAssignmentGroupIds((current) => current.includes(studentId) ? current.filter((id) => id !== studentId) : [...current, studentId])
  }

  const gradeAssignment = (assignment: (typeof assignmentList)[number]) => {
    const score = Math.max(0, Math.min(100, Number(assignmentScores[assignment.id]) || 0))
    const student = findStudent(assignment.studentId)
    const gradebookColumnId = `assignment-${assignment.id}`

    setGradeEntries((current) => [{
      studentId: assignment.studentId,
      subject: assignment.subject,
      assessment: assignment.title,
      score,
      max: 100,
      date: 'Today',
      teacher: 'Dr. Mukendi',
    }, ...current])

    setGradebookColumnsByCourse((current) => ({
      ...current,
      [selectedGradebookCourse.id]: [
        ...(current[selectedGradebookCourse.id] ?? []).filter((column) => column.id !== gradebookColumnId),
        { id: gradebookColumnId, title: assignment.title, type: 'Assignment', date: 'Today', maxPoints: 100 },
      ],
    }))
    setGradebookScores((current) => ({ ...current, [`${selectedGradebookCourse.id}-${gradebookColumnId}-${assignment.studentId}`]: String(score) }))
    setAssignmentList((current) => current.map((item) => item.id === assignment.id ? { ...item, status: 'submitted', gradebookSynced: true, score } : item))
    runAction(`${student?.name ?? 'Student'} received ${score}/100 for ${assignment.title}; gradebook, student dashboard, and parent view were updated.`)
  }

  const addGrade = () => {
    const student = findStudent(gradeDraft.studentId)
    setGradeEntries((current) => [{ ...gradeDraft, teacher: 'Dr. Mukendi' }, ...current])
    runAction(`${gradeDraft.assessment} saved for ${student?.name ?? 'selected student'} and ready for report cards.`)
  }

  const createReport = () => {
    setReportList((current) => [{ ...reportDraft, term: reportDraft.period, principalStatus: 'Pending review', download: `${reportDraft.recipient} package ready` }, ...current])
    runAction(`${reportDraft.student}'s ${reportDraft.reportType.toLowerCase()} was prepared for ${reportDraft.recipient}.`)
  }

  const createDisciplineReport = () => {
    const student = findStudent(disciplineDraft.studentId)
    setDisciplineList((current) => [{
      id: `disc-${String(current.length + 1).padStart(3, '0')}`,
      studentId: disciplineDraft.studentId,
      student: student?.name ?? 'Selected student',
      date: 'Apr 29',
      level: disciplineDraft.level,
      category: disciplineDraft.category,
      incident: disciplineDraft.incident,
      context: 'Teacher-created record from classroom observation and linked student data.',
      actionTaken: disciplineDraft.actionTaken,
      followUp: disciplineDraft.followUp,
      parentContact: 'Draft message prepared',
      status: 'Open',
    }, ...current])
    runAction(`Detailed discipline report opened for ${student?.name ?? 'selected student'}.`)
  }

  const sendMessage = () => {
    setInbox((current) => [{
      id: Date.now(),
      from: `${messageChannel} to ${messageDraft.to}`,
      subject: messageDraft.subject,
      body: messageDraft.body,
      time: 'Just now',
      requiresResponse: false,
    }, ...current])
    runAction(`${messageChannel} message sent to ${messageDraft.to}, logged in the thread, and queued for portal audit.`)
  }

  const inputClass = 'input-kcs py-2 text-sm'
  const panelClass = 'rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50'
  const compactButton = 'rounded-xl bg-kcs-blue-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-kcs-blue-800'
  const studentsByClass = teacherStudents.reduce<Record<string, RegistryStudent[]>>((groups, student) => {
    const className = `${student.grade}${student.section ? ` ${student.section}` : ''}`
    groups[className] = [...(groups[className] ?? []), student]
    return groups
  }, {})
  const sortedStudentClassEntries = Object.entries(studentsByClass).sort(([left], [right]) => normalizeGradeOnlyKey(left).localeCompare(normalizeGradeOnlyKey(right)) || left.localeCompare(right))
  const selectedClassStudents = selectedClassRoster ? studentsByClass[selectedClassRoster] ?? [] : []
  const attendanceClassOptions = sortedStudentClassEntries
  const selectedAttendanceClassName = selectedAttendanceClass || attendanceClassOptions[0]?.[0] || ''
  const attendanceClassStudents = selectedAttendanceClassName ? studentsByClass[selectedAttendanceClassName] ?? [] : []
  const attendanceDate = attendanceDraft.date
  const attendanceClassRecords = attendanceClassStudents.map((student) => {
    const record = attendanceEntries.find((entry) => entry.studentId === student.id && entry.date === attendanceDate && entry.className === selectedAttendanceClassName)
    return { student, status: record?.status ?? 'unmarked' }
  })
  const attendanceMarkedCount = attendanceClassRecords.filter((record) => record.status !== 'unmarked').length
  const attendancePresentCount = attendanceClassRecords.filter((record) => record.status === 'present').length
  const attendanceLateCount = attendanceClassRecords.filter((record) => record.status === 'late').length
  const attendanceAbsentCount = attendanceClassRecords.filter((record) => record.status === 'absent').length
  const attendanceExcusedCount = attendanceClassRecords.filter((record) => record.status === 'excused').length
  const attendanceDenominator = Math.max(attendanceClassStudents.length, 1)
  const dailyPresenceRate = Math.round(((attendancePresentCount + attendanceLateCount * 0.5 + attendanceExcusedCount) / attendanceDenominator) * 100)
  const punctualityRate = Math.round((attendancePresentCount / attendanceDenominator) * 100)
  const absenceRate = Math.round((attendanceAbsentCount / attendanceDenominator) * 100)
  const assignmentClassName = assignmentClass || sortedStudentClassEntries[0]?.[0] || ''
  const assignmentClassStudents = assignmentClassName ? studentsByClass[assignmentClassName] ?? [] : []
  const assignmentRecipients = assignmentAudience === 'student'
    ? [findStudent(assignmentDraft.studentId)].filter((student): student is RegistryStudent => Boolean(student))
    : assignmentAudience === 'class'
      ? assignmentClassStudents
      : assignmentGroupIds.map((studentId) => findStudent(studentId)).filter((student): student is RegistryStudent => Boolean(student))
  const assignmentParentVisibility = assignmentRecipients.length
  const assignmentStudentVisibility = assignmentRecipients.length

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
              <button onClick={() => runAction(`${selectedGradebookCourse.name} saved with ${gradebookColumns.length} assessment column(s) and ${gradebookStudents.length} selected student(s).`)} className="btn-primary flex items-center gap-2 py-2 text-sm"><CheckCircle2 size={16} /> Save updates</button>
              <button onClick={() => openOfficialMemo('Official Gradebook Export', `${selectedGradebookCourse.name} - ${selectedGradebookCourse.gradeLevels.join(', ')}`, [
                ['Course', selectedGradebookCourse.name],
                ['Class level', selectedGradebookCourse.gradeLevels.join(', ')],
                ['Selected students', String(gradebookStudents.length)],
                ['Assessment columns', gradebookColumns.map((column) => `${column.title} (${column.maxPoints} pts)`).join(', ') || 'No assessment column yet'],
                ['Report-card sync', 'Final scores are ready to be submitted to the student report-card subject line.'],
              ], true)} className="btn-gold flex items-center gap-2 py-2 text-sm"><FileText size={16} /> Export PDF</button>
            </div>
          </div>
        </div>

        {actionMessage && (
          <div className="rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700 dark:border-green-900/40 dark:bg-green-900/20 dark:text-green-300">
            {actionMessage}
          </div>
        )}

        <AdvancedGradebook
          courses={courses}
          students={rosterSourceStudents}
          selectedCourseId={selectedGradebookCourseId}
          onSelectCourse={setSelectedGradebookCourseId}
          onAction={runAction}
        />
      </section>
    )
  }

  if (segment === 'settings') {
    return <AccountSettingsPanel roleLabel="Teacher account" />
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
            <button onClick={() => runAction(`${meta.title} workspace saved with current teacher data and queued for central sync.`)} className="btn-primary flex items-center gap-2 py-2 text-sm"><CheckCircle2 size={16} /> Save updates</button>
            <button onClick={() => openOfficialMemo(`${meta.title} Official Export`, 'Teacher workspace document', [
              ['Section', meta.title],
              ['Prepared for', 'Direction / Academic Office'],
              ['Teacher action', 'Current records saved and exported for review.'],
              ['Generated from', 'KCS Nexus teacher dashboard'],
              ['Generated on', new Date().toLocaleString()],
            ], true)} className="btn-gold flex items-center gap-2 py-2 text-sm"><FileText size={16} /> Export PDF</button>
          </div>
        </div>
      </div>

      {actionMessage && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700 dark:border-green-900/40 dark:bg-green-900/20 dark:text-green-300">
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
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">2025-2026, Second Semester Q4. Tell the system what subjects you teach and which grades are enrolled.</p>
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
                        <div className="space-y-4">
                          <div>
                            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-kcs-blue-600 dark:text-kcs-blue-300">Kindergarten</p>
                            <div className="grid grid-cols-3 gap-2">
                              {gradeOptions.slice(0, 3).map((grade) => (
                                <label key={grade} className={`flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${courseDraft.gradeLevels[0] === grade ? 'border-kcs-blue-500 bg-kcs-blue-50 text-kcs-blue-800 dark:border-kcs-blue-400 dark:bg-kcs-blue-900/40 dark:text-kcs-blue-100' : 'border-gray-100 text-gray-700 hover:border-kcs-blue-200 dark:border-kcs-blue-800 dark:text-gray-300'}`}>
                                  <input className="h-4 w-4 flex-shrink-0 border-gray-300 text-kcs-blue-700 focus:ring-kcs-blue-500" type="radio" name="course-grade" checked={courseDraft.gradeLevels[0] === grade} onChange={() => toggleCourseGrade(grade)} />
                                  <span>{grade}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-kcs-blue-600 dark:text-kcs-blue-300">Elementary to High School</p>
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                              {gradeOptions.slice(3).map((grade) => (
                                <label key={grade} className={`flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${courseDraft.gradeLevels[0] === grade ? 'border-kcs-blue-500 bg-kcs-blue-50 text-kcs-blue-800 dark:border-kcs-blue-400 dark:bg-kcs-blue-900/40 dark:text-kcs-blue-100' : 'border-gray-100 text-gray-700 hover:border-kcs-blue-200 dark:border-kcs-blue-800 dark:text-gray-300'}`}>
                                  <input className="h-4 w-4 flex-shrink-0 border-gray-300 text-kcs-blue-700 focus:ring-kcs-blue-500" type="radio" name="course-grade" checked={courseDraft.gradeLevels[0] === grade} onChange={() => toggleCourseGrade(grade)} />
                                  <span className="min-w-0 break-words leading-snug">{grade}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={createCourse} className={compactButton}>{editingCourseId ? 'Save subject' : 'Add subject'}</button>
                      {editingCourseId && <button onClick={resetCourseDraft} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 dark:border-kcs-blue-700 dark:text-gray-300 dark:hover:bg-kcs-blue-800/40">Cancel edit</button>}
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
                              <button onClick={() => openCourseRosterDialog(subject.id)} className="rounded-full bg-kcs-blue-50 px-3 py-1 text-xs font-bold text-kcs-blue-700 transition-colors hover:bg-kcs-blue-700 hover:text-white dark:bg-kcs-blue-900/40 dark:text-kcs-blue-200">
                                {subject.studentIds.length} enrolled
                              </button>
                            </td>
                            <td className="px-3 py-3">
                              <button onClick={() => openCourseRosterDialog(subject.id)} className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-700 transition-colors hover:bg-kcs-blue-100 hover:text-kcs-blue-800 dark:bg-kcs-blue-800/40 dark:text-gray-200">
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
                        <p className="text-xs text-gray-600 dark:text-gray-300">{selectedEnrollmentCourse.gradeLevels.join(', ')} - {selectedEnrollmentCourse.studentIds.length} enrolled - {rosterSourceStudents.length - selectedEnrollmentCourse.studentIds.length} available</p>
                      </div>
                      <button onClick={() => openCourseRosterDialog(selectedEnrollmentCourse.id)} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-kcs-blue-700 shadow-sm hover:bg-kcs-blue-100 dark:bg-kcs-blue-950 dark:text-kcs-blue-200">
                        Edit selected subject
                      </button>
                    </div>
                  </div>
                )}
                {courses.map((subject) => (
                  <div key={subject.id} className={`rounded-xl border p-4 ${selectedEnrollmentCourse?.id === subject.id ? 'border-kcs-blue-300 bg-white shadow-sm dark:border-kcs-blue-600 dark:bg-kcs-blue-900/40' : 'border-gray-100 bg-gray-50 dark:border-kcs-blue-800 dark:bg-kcs-blue-800/30'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase text-kcs-blue-500">{subject.gradeLevels.join(', ')}</p>
                        <h4 className="mt-1 font-bold text-kcs-blue-900 dark:text-white">{subject.name}</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{subject.abbreviation} - {subject.creditHours} credit hour(s) - {subject.room}</p>
                      </div>
                      <span className="badge-blue text-xs">{subject.studentIds.length} enrolled</span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {rosterSourceStudents.map((student) => {
                        const enrolled = subject.studentIds.includes(student.id)
                        return (
                          <button
                            key={student.id}
                            onClick={() => toggleCourseStudent(subject.id, student.id)}
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

      {rosterModalCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-kcs-blue-950/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Edit course enrollment">
          <section className="max-h-[94vh] w-full max-w-[min(96vw,96rem)] overflow-y-auto rounded-2xl border border-gray-100 bg-white p-5 shadow-2xl dark:border-kcs-blue-800 dark:bg-kcs-blue-900 sm:p-7">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-kcs-blue-600 dark:text-kcs-blue-300">Central student database</p>
                <h3 className="mt-1 font-display text-2xl font-bold text-kcs-blue-900 dark:text-white">{rosterModalCourse.name}</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {rosterModalCourse.gradeLevels.join(', ')} - {rosterModalCourse.studentIds.length} enrolled - {rosterModalAvailableStudents.length} available from the school registry.
                </p>
              </div>
              <button type="button" onClick={() => setRosterModalCourseId(null)} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-kcs-blue-700 hover:bg-kcs-blue-50 dark:border-kcs-blue-700 dark:text-kcs-blue-100 dark:hover:bg-kcs-blue-800">
                Close
              </button>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <div className="rounded-2xl border border-kcs-blue-100 bg-kcs-blue-50 p-4 dark:border-kcs-blue-800 dark:bg-kcs-blue-950/40">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h4 className="font-bold text-kcs-blue-900 dark:text-white">Enrolled students</h4>
                  <span className="rounded-full bg-kcs-blue-700 px-3 py-1 text-xs font-bold text-white">{rosterModalEnrolledStudents.length}</span>
                </div>
                <div className="space-y-2">
                  {rosterModalEnrolledStudents.map((student) => (
                    <div key={student.id} className="flex items-center justify-between gap-3 rounded-xl bg-white p-3 dark:bg-kcs-blue-900/70">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-kcs-blue-900 dark:text-white">{student.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{student.grade}{student.section ? ` ${student.section}` : ''} - {student.risk ?? 'low'} risk</p>
                      </div>
                      <button type="button" onClick={() => toggleCourseStudent(rosterModalCourse.id, student.id)} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-900/20">
                        Remove
                      </button>
                    </div>
                  ))}
                  {rosterModalEnrolledStudents.length === 0 && (
                    <p className="rounded-xl bg-white p-4 text-sm font-semibold text-gray-500 dark:bg-kcs-blue-900/70 dark:text-gray-300">No student enrolled yet.</p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-kcs-blue-800 dark:bg-kcs-blue-800/30">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h4 className="font-bold text-kcs-blue-900 dark:text-white">Available students</h4>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-kcs-blue-200">{rosterModalAvailableStudents.length}</span>
                </div>
                <div className="space-y-2">
                  {rosterModalAvailableStudents.map((student) => (
                    <div key={student.id} className="flex items-center justify-between gap-3 rounded-xl bg-white p-3 dark:bg-kcs-blue-900/70">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-kcs-blue-900 dark:text-white">{student.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{student.grade}{student.section ? ` ${student.section}` : ''} - official registry</p>
                      </div>
                      <button type="button" onClick={() => toggleCourseStudent(rosterModalCourse.id, student.id)} className="rounded-lg bg-kcs-blue-700 px-3 py-2 text-xs font-bold text-white hover:bg-kcs-blue-800">
                        Add
                      </button>
                    </div>
                  ))}
                  {rosterModalAvailableStudents.length === 0 && (
                    <p className="rounded-xl bg-white p-4 text-sm font-semibold text-gray-500 dark:bg-kcs-blue-900/70 dark:text-gray-300">All central registry students are already enrolled in this subject.</p>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {segment === 'students' && (
        <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <div className={panelClass}>
            <h3 className="font-bold text-kcs-blue-900 dark:text-white">Automatic student control</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">This list is controlled by course enrollment. The teacher sees official students first, then every grade, attendance, assignment, report and discipline action follows that student record.</p>
            <div className="mt-4 grid gap-3">
              <select className={inputClass} value={selectedStudentId} onChange={(event) => setSelectedStudentId(event.target.value)}>
                {rosterSourceStudents.map((student) => <option key={student.id} value={student.id}>{student.name} - {student.grade}{student.section ? ` ${student.section}` : ''} - {student.risk} risk</option>)}
              </select>
              <button onClick={importStudent} className={compactButton}>Enroll selected student</button>
            </div>
            <div className="mt-5 grid gap-3">
              {[
                ['Official registry', `${superAdminStudentPool.length} verified student(s)`],
                ['Controlled by teacher courses', `${teacherStudents.length} active student(s)`],
                ['Parent link', 'Indirect through each student profile'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-kcs-blue-50 p-4 text-sm text-kcs-blue-800 dark:bg-kcs-blue-900/30 dark:text-kcs-blue-200">
                  <p className="text-xs font-bold uppercase tracking-wide opacity-70">{label}</p>
                  <p className="mt-1 font-semibold">{value}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-4 2xl:grid-cols-2">
          {sortedStudentClassEntries.map(([className, classStudents]) => (
            <section key={className} className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-kcs-blue-600 dark:text-kcs-blue-300">Class roster</p>
                  <h3 className="font-display text-xl font-bold text-kcs-blue-900 dark:text-white">{className}</h3>
                </div>
                <span className="rounded-full bg-kcs-blue-50 px-3 py-1 text-xs font-bold text-kcs-blue-700 dark:bg-kcs-blue-900/40 dark:text-kcs-blue-200">{classStudents.length} student{classStudents.length > 1 ? 's' : ''}</span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 rounded-xl bg-gray-50 p-3 text-sm dark:bg-kcs-blue-800/30">
                <div><p className="font-bold text-kcs-blue-900 dark:text-white">{Math.round(classStudents.reduce((sum, student) => sum + (student.average ?? 0), 0) / Math.max(classStudents.length, 1))}%</p><p className="text-xs text-gray-500">Avg</p></div>
                <div><p className="font-bold text-kcs-blue-900 dark:text-white">{Math.round(classStudents.reduce((sum, student) => sum + (student.attendance ?? 0), 0) / Math.max(classStudents.length, 1))}%</p><p className="text-xs text-gray-500">Attendance</p></div>
                <div><p className="font-bold text-kcs-blue-900 dark:text-white">{classStudents.filter((student) => student.risk !== 'low').length}</p><p className="text-xs text-gray-500">To watch</p></div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {classStudents.slice(0, 5).map((student) => (
                  <span key={student.id} className="rounded-full bg-kcs-blue-50 px-2.5 py-1 text-xs font-semibold text-kcs-blue-700 dark:bg-kcs-blue-900/40 dark:text-kcs-blue-200">{student.name}</span>
                ))}
                {classStudents.length > 5 && <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-500 dark:bg-kcs-blue-800 dark:text-gray-300">+{classStudents.length - 5}</span>}
              </div>
              <button type="button" onClick={() => setSelectedClassRoster(className)} className="mt-4 w-full rounded-xl bg-kcs-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-kcs-blue-800">
                Open class window
              </button>
            </section>
          ))}
          </div>
        </div>
      )}

      {selectedClassRoster && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-kcs-blue-950/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Class student list">
          <section className="max-h-[94vh] w-full max-w-[min(96vw,100rem)] overflow-y-auto rounded-2xl border border-gray-100 bg-white p-5 shadow-2xl dark:border-kcs-blue-800 dark:bg-kcs-blue-900 sm:p-7">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-kcs-blue-600 dark:text-kcs-blue-300">Dedicated class window</p>
                <h3 className="mt-1 font-display text-2xl font-bold text-kcs-blue-900 dark:text-white">{selectedClassRoster}</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{selectedClassStudents.length} student{selectedClassStudents.length > 1 ? 's' : ''} controlled by this teacher workspace.</p>
              </div>
              <button type="button" onClick={() => setSelectedClassRoster(null)} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-kcs-blue-700 hover:bg-kcs-blue-50 dark:border-kcs-blue-700 dark:text-kcs-blue-100 dark:hover:bg-kcs-blue-800">
                Close
              </button>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-kcs-blue-800">
              <table className="min-w-[900px] w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:bg-kcs-blue-800/40 dark:text-gray-300">
                  <tr>
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3">Average</th>
                    <th className="px-4 py-3">Attendance</th>
                    <th className="px-4 py-3">Rank</th>
                    <th className="px-4 py-3">Risk</th>
                    <th className="px-4 py-3">Insight</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-kcs-blue-800">
                  {selectedClassStudents.map((student) => (
                    <tr key={student.id} className="align-top">
                      <td className="px-4 py-3">
                        <p className="font-bold text-kcs-blue-900 dark:text-white">{student.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Advisor {student.advisor}</p>
                      </td>
                      <td className="px-4 py-3 font-bold text-kcs-blue-900 dark:text-white">{student.average ?? '-'}%</td>
                      <td className="px-4 py-3 font-bold text-kcs-blue-900 dark:text-white">{student.attendance ?? '-'}%</td>
                      <td className="px-4 py-3 font-bold text-kcs-blue-900 dark:text-white">#{student.rank ?? '-'}</td>
                      <td className="px-4 py-3"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(student.risk ?? 'low')}`}>{student.risk ?? 'low'}</span></td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{student.aiInsight}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {segment === 'attendance' && (
        <div className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="font-bold text-kcs-blue-900 dark:text-white">Homeroom Daily Register</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Mark the daily presence for every student in the class where this teacher is responsible.</p>
                </div>
                <span className="rounded-full bg-kcs-blue-50 px-3 py-1 text-xs font-bold text-kcs-blue-700 dark:bg-kcs-blue-900/30 dark:text-kcs-blue-200">
                  {attendanceMarkedCount}/{attendanceClassStudents.length} marked
                </span>
              </div>

              <div className="mt-5 grid gap-3 rounded-xl bg-gray-50 p-3 dark:bg-kcs-blue-800/30 sm:grid-cols-2">
                <label className="grid gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
                  Homeroom class
                  <select className={inputClass} value={selectedAttendanceClassName} onChange={(event) => setSelectedAttendanceClass(event.target.value)}>
                    {attendanceClassOptions.map(([className, classStudents]) => (
                      <option key={className} value={className}>{className} - {classStudents.length} students</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
                  Attendance date
                  <input className={inputClass} type="date" value={attendanceDate} onChange={(event) => setAttendanceDraft((draft) => ({ ...draft, date: event.target.value }))} />
                </label>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {[
                  ['Presence index', `${dailyPresenceRate}%`, 'Present + excused + half late'],
                  ['Punctuality', `${punctualityRate}%`, 'Present on time only'],
                  ['Absence pressure', `${absenceRate}%`, 'Absent students today'],
                ].map(([label, value, detail]) => (
                  <div key={label} className="rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-800/30">
                    <p className="font-display text-2xl font-bold text-kcs-blue-900 dark:text-white">{value}</p>
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">{label}</p>
                    <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">{detail}</p>
                  </div>
                ))}
              </div>

              <div className="mt-5 grid gap-2">
                {attendanceClassRecords.map(({ student, status }) => (
                  <div key={student.id} className="rounded-xl border border-gray-100 bg-white p-3 dark:border-kcs-blue-800 dark:bg-kcs-blue-950/40">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <p className="font-semibold text-kcs-blue-900 dark:text-white">{student.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {student.grade}{student.section ? ` ${student.section}` : ''} - attendance history {student.attendance ?? 'pending'}% - {student.risk ?? 'low'} risk
                        </p>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5 sm:flex sm:flex-wrap">
                        {['present', 'late', 'absent', 'excused'].map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => markClassAttendance(student.id, option)}
                            className={`rounded-lg px-2.5 py-2 text-xs font-bold capitalize transition-colors ${status === option ? 'bg-kcs-blue-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-kcs-blue-50 hover:text-kcs-blue-700 dark:bg-kcs-blue-800/50 dark:text-gray-300'}`}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
                {!attendanceClassRecords.length && (
                  <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500 dark:bg-kcs-blue-800/30 dark:text-gray-300">No students are attached to this homeroom class yet.</p>
                )}
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
                <h3 className="font-bold text-kcs-blue-900 dark:text-white">Scientific Attendance Analytics</h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-4">
                  {[
                    ['Present', attendancePresentCount, 'green'],
                    ['Late', attendanceLateCount, 'yellow'],
                    ['Absent', attendanceAbsentCount, 'red'],
                    ['Excused', attendanceExcusedCount, 'blue'],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl bg-gray-50 p-4 text-center dark:bg-kcs-blue-800/30">
                      <p className="font-display text-3xl font-bold text-kcs-blue-900 dark:text-white">{value}</p>
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{label}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-5 space-y-3 text-sm text-gray-600 dark:text-gray-300">
                  <div className="rounded-xl bg-kcs-blue-50 p-4 dark:bg-kcs-blue-900/30">
                    <p className="font-bold text-kcs-blue-900 dark:text-white">Formula</p>
                    <p className="mt-1">Presence index = ((present + excused + 0.5 x late) / class size) x 100.</p>
                  </div>
                  <div className="rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-800/30">
                    <p className="font-bold text-kcs-blue-900 dark:text-white">Automatic decision support</p>
                    <p className="mt-1">
                      {absenceRate >= 20
                        ? 'High absence pressure: parent notifications and admin review should be triggered today.'
                        : dailyPresenceRate < 85
                          ? 'Moderate attendance concern: review late arrivals and verify transportation or health notes.'
                          : 'Attendance is mathematically stable for today; keep monitoring punctuality.'}
                    </p>
                  </div>
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
          </div>
        </div>
      )}

      {segment === 'assignments' && (
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className={panelClass}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-kcs-blue-900 dark:text-white">Assignment Dispatch Center</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Send homework to one student, a whole class, or a selected group. Student and parent dashboards receive the correct visibility.</p>
              </div>
              <span className="rounded-full bg-kcs-blue-50 px-3 py-1 text-xs font-bold text-kcs-blue-700 dark:bg-kcs-blue-900/30 dark:text-kcs-blue-200">{assignmentRecipients.length} recipient(s)</span>
            </div>
            <div className="mt-4 grid gap-3">
              <div className="grid gap-2 sm:grid-cols-3">
                {[
                  ['student', 'One student'],
                  ['class', 'Whole class'],
                  ['group', 'Selected group'],
                ].map(([id, label]) => (
                  <button key={id} type="button" onClick={() => setAssignmentAudience(id as typeof assignmentAudience)} className={`rounded-xl px-3 py-2 text-sm font-bold transition-colors ${assignmentAudience === id ? 'bg-kcs-blue-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-kcs-blue-50 hover:text-kcs-blue-700 dark:bg-kcs-blue-800/40 dark:text-gray-300'}`}>
                    {label}
                  </button>
                ))}
              </div>

              {assignmentAudience === 'student' && (
                <select className={inputClass} value={assignmentDraft.studentId} onChange={(event) => setAssignmentDraft((draft) => ({ ...draft, studentId: event.target.value }))}>
                  {teacherStudents.map((student) => <option key={student.id} value={student.id}>{student.name} - {student.grade}{student.section ? ` ${student.section}` : ''}</option>)}
                </select>
              )}

              {assignmentAudience !== 'student' && (
                <select className={inputClass} value={assignmentClassName} onChange={(event) => setAssignmentClass(event.target.value)}>
                  {sortedStudentClassEntries.map(([className, classStudents]) => <option key={className} value={className}>{className} - {classStudents.length} students</option>)}
                </select>
              )}

              {assignmentAudience === 'group' && (
                <div className="grid max-h-56 gap-2 overflow-y-auto rounded-xl bg-gray-50 p-3 dark:bg-kcs-blue-800/30 sm:grid-cols-2">
                  {assignmentClassStudents.map((student) => (
                    <label key={student.id} className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-kcs-blue-900 dark:bg-kcs-blue-950/50 dark:text-white">
                      <input type="checkbox" checked={assignmentGroupIds.includes(student.id)} onChange={() => toggleAssignmentGroupStudent(student.id)} className="h-4 w-4 rounded border-gray-300 text-kcs-blue-700 focus:ring-kcs-blue-500" />
                      {student.name}
                    </label>
                  ))}
                </div>
              )}

              <label className="grid gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
                Homework title
                <input className={inputClass} value={assignmentDraft.title} onChange={(event) => setAssignmentDraft((draft) => ({ ...draft, title: event.target.value }))} />
              </label>
              <div className="grid gap-2 sm:grid-cols-3">
                <label className="grid gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
                  Subject
                  <input className={inputClass} value={assignmentDraft.subject} onChange={(event) => setAssignmentDraft((draft) => ({ ...draft, subject: event.target.value }))} />
                </label>
                <label className="grid gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
                  Due date
                  <input className={`${inputClass} dark:[color-scheme:dark]`} type="date" value={assignmentDraft.due} onChange={(event) => setAssignmentDraft((draft) => ({ ...draft, due: event.target.value }))} />
                </label>
                <label className="grid gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
                  Priority
                <select className={inputClass} value={assignmentDraft.priority} onChange={(event) => setAssignmentDraft((draft) => ({ ...draft, priority: event.target.value }))}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
                </label>
              </div>
              <div className="grid gap-3 rounded-xl bg-gray-50 p-3 text-sm dark:bg-kcs-blue-800/30 sm:grid-cols-3">
                <div><p className="font-bold text-kcs-blue-900 dark:text-white">{assignmentStudentVisibility}</p><p className="text-xs text-gray-500">student dashboard updates</p></div>
                <div><p className="font-bold text-kcs-blue-900 dark:text-white">{assignmentParentVisibility}</p><p className="text-xs text-gray-500">parent dashboard notices</p></div>
                <div><p className="font-bold text-kcs-blue-900 dark:text-white">Gradebook</p><p className="text-xs text-gray-500">auto-sync after grading</p></div>
              </div>
              <button onClick={createAssignment} className="inline-flex items-center justify-center gap-2 rounded-xl bg-kcs-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-kcs-blue-800"><Send size={16} /> Send assignment</button>
            </div>
          </div>
          <div className="grid gap-4">
          {assignmentList.map((assignment) => {
            const student = findStudent(assignment.studentId)
            return (
              <div key={assignment.id} className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h3 className="font-bold text-kcs-blue-900 dark:text-white">{assignment.title}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{assignment.subject} - {student?.name}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusTone(assignment.status)}`}>{assignment.status}</span>
                </div>
                <div className="mt-4 grid gap-3 rounded-xl bg-gray-50 p-3 text-xs text-gray-600 dark:bg-kcs-blue-800/30 dark:text-gray-300 sm:grid-cols-3">
                  <span className="inline-flex items-center gap-1"><Clock size={13} /> Due: {assignment.due}</span>
                  <span className="inline-flex items-center gap-1"><Eye size={13} /> Parent/student visible</span>
                  <span className="inline-flex items-center gap-1"><Award size={13} /> {(assignment as any).gradebookSynced ? 'Synced to gradebook' : 'Waiting for grade'}</span>
                </div>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    className={`${inputClass} sm:max-w-40`}
                    type="number"
                    min={0}
                    max={100}
                    value={assignmentScores[assignment.id] ?? ''}
                    onChange={(event) => setAssignmentScores((current) => ({ ...current, [assignment.id]: Number(event.target.value) }))}
                    placeholder="Score /100"
                  />
                  <button type="button" onClick={() => gradeAssignment(assignment)} className="rounded-xl bg-kcs-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-kcs-blue-800">
                    Grade and sync
                  </button>
                </div>
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
                <select className={inputClass} defaultValue="2025-2026, SECOND SEMESTER Q4 2025-2026">
                  <option>2025-2026, SECOND SEMESTER Q4 2025-2026</option>
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
                  {gradebookStudents.map((student) => {
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
              <h3 className="font-bold text-kcs-blue-900 dark:text-white">Bulletin officiel</h3>
              <div className="mt-4 grid gap-3">
                <label className="grid gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
                  Classe du main teacher
                  <select
                    className={inputClass}
                    value={reportCardClass}
                    onChange={(event) => {
                      setReportCardClass(event.target.value)
                      setMainTeacherCommentEdited(false)
                    }}
                  >
                    {reportCardClasses.map((className) => <option key={className} value={className}>{className} - {reportCardClass === className ? reportCardClassStudents.length : teacherStudents.filter((student) => `${student.grade}${student.section}` === className).length} eleve(s)</option>)}
                  </select>
                </label>
                <label className="grid gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
                  Eleve concerne
                  <select
                    className={inputClass}
                    value={reportCardStudentId}
                    onChange={(event) => {
                      setReportCardStudentId(event.target.value)
                      setMainTeacherCommentEdited(false)
                    }}
                  >
                    {reportCardClassStudents.map((student) => <option key={student.id} value={student.id}>{student.name} - {student.grade}{student.section}</option>)}
                  </select>
                </label>
                <label className="grid gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
                  Periode academique
                  <select className={inputClass} value={reportCardTerm} onChange={(event) => setReportCardTerm(event.target.value)}>
                    {reportCardPeriods.map((period) => <option key={period} value={period}>{period}</option>)}
                  </select>
                </label>
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
                <div className="grid gap-2 sm:grid-cols-2">
                  <button onClick={generateReportCard} className="rounded-xl bg-kcs-blue-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-kcs-blue-800 dark:bg-kcs-blue-500 dark:text-white dark:hover:bg-kcs-blue-400">Save draft</button>
                  <button onClick={addReportCardCourse} className="rounded-xl border border-kcs-blue-300 bg-white px-4 py-2.5 text-sm font-bold text-kcs-blue-800 shadow-sm hover:bg-kcs-blue-50 dark:border-kcs-blue-500 dark:bg-kcs-blue-950 dark:text-white dark:hover:bg-kcs-blue-800">Add course</button>
                  <button onClick={() => openReportCardDocument(false)} className="rounded-xl border border-kcs-gold-400 bg-kcs-gold-50 px-4 py-2.5 text-sm font-bold text-kcs-blue-950 shadow-sm hover:bg-kcs-gold-100 dark:border-kcs-gold-500 dark:bg-kcs-gold-500 dark:text-kcs-blue-950 dark:hover:bg-kcs-gold-400">Preview</button>
                  <button onClick={() => openReportCardDocument(true)} className="rounded-xl bg-green-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-green-800 dark:bg-green-500 dark:text-white dark:hover:bg-green-400">Print / Download PDF</button>
                </div>
              </div>
            </div>

            <div className={panelClass}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="font-bold text-kcs-blue-900 dark:text-white">{reportCardStudent?.name} report card</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{reportCardTerm} - scores are evaluated directly on 100% with weighted coefficients.</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(reportCardAverage >= 70 ? 'low' : 'high')}`}>{reportCardDecision}</span>
              </div>

              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-kcs-blue-800">
                      <th className="pb-3 pr-3">Course</th>
                      <th className="pb-3 pr-3">Score / 100%</th>
                      <th className="pb-3 pr-3">Coef.</th>
                      <th className="pb-3 pr-3">Average</th>
                      <th className="pb-3">Comment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-kcs-blue-800">
                    {reportCardRows.map((row) => {
                      const courseAverage = Math.max(0, Math.min(100, row.points))
                      return (
                        <tr key={row.id}>
                          <td className="py-3 pr-3">
                            <input className={inputClass} value={row.course} onChange={(event) => updateReportCardRow(row.id, 'course', event.target.value)} />
                          </td>
                          <td className="py-3 pr-3">
                            <input className={inputClass} type="number" min={0} max={100} value={row.points} onChange={(event) => updateReportCardRow(row.id, 'points', Number(event.target.value))} />
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
              <p className="text-xs font-semibold uppercase text-gray-400">Main teacher final comment</p>
              <textarea
                className={`${inputClass} mt-2 min-h-36 w-full`}
                value={mainTeacherComment}
                onChange={(event) => {
                  setMainTeacherCommentEdited(true)
                  setMainTeacherComment(event.target.value)
                }}
              />
              <button
                type="button"
                onClick={() => {
                  setMainTeacherCommentEdited(false)
                  setMainTeacherComment(suggestedMainTeacherComment)
                }}
                className="mt-3 rounded-xl border border-kcs-blue-200 px-3 py-2 text-xs font-bold text-kcs-blue-700 hover:bg-kcs-blue-50 dark:border-kcs-blue-700 dark:text-kcs-blue-200 dark:hover:bg-kcs-blue-900/40"
              >
                Regenerate AI comment
              </button>
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

          {reportCardPreviewOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-kcs-blue-950/75 p-3 backdrop-blur-sm sm:p-5" role="dialog" aria-modal="true" aria-label="Report card preview window">
              <section className="flex max-h-[95vh] w-full max-w-[min(98vw,88rem)] flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl dark:border-kcs-blue-800 dark:bg-kcs-blue-900">
                <div className="flex flex-col gap-3 border-b border-gray-100 p-4 dark:border-kcs-blue-800 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-kcs-blue-600 dark:text-kcs-blue-300">A4 official report card preview</p>
                    <h3 className="font-display text-xl font-bold text-kcs-blue-900 dark:text-white">{reportCardStudentName} - {reportCardTerm}</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => reportCardPreviewRef.current?.contentWindow?.print()}
                      className="rounded-xl bg-green-700 px-4 py-2 text-sm font-bold text-white hover:bg-green-800 dark:bg-green-500 dark:hover:bg-green-400"
                    >
                      Print / Save PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => setReportCardPreviewOpen(false)}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-kcs-blue-800 hover:bg-kcs-blue-50 dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white dark:hover:bg-kcs-blue-800"
                    >
                      <X size={16} /> Close
                    </button>
                  </div>
                </div>
                <div className="min-h-0 flex-1 bg-gray-100 p-3 dark:bg-kcs-blue-950">
                  <iframe
                    ref={reportCardPreviewRef}
                    title="Official report card preview"
                    srcDoc={reportCardDocumentHtml()}
                    className="h-[78vh] w-full rounded-xl border border-gray-200 bg-white dark:border-kcs-blue-800"
                  />
                </div>
              </section>
            </div>
          )}
        </div>
      )}

      {segment === 'reports' && (
        <div className="space-y-6">
          <div className="grid gap-3 md:grid-cols-4">
            {[
              ['Drafts', reportList.length, 'teacher-created'],
              ['Ready for approval', reportList.filter((card) => String(card.principalStatus).toLowerCase().includes('pending')).length, 'principal review'],
              ['Parent portal', reportList.length, 'after approval'],
              ['Report cards', generatedReportCards.length, 'generated live'],
            ].map(([label, value, detail]) => (
              <div key={label} className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
                <p className="font-display text-2xl font-bold text-kcs-blue-900 dark:text-white">{value}</p>
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">{label}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">{detail}</p>
              </div>
            ))}
          </div>
        <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
          <div className={panelClass}>
            <h3 className="font-bold text-kcs-blue-900 dark:text-white">Official report draft</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Prepare a printable report for parents or school direction with approval, portal, and PDF logic.</p>
            <div className="mt-4 grid gap-3">
              <label className="grid gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
                Report recipient
                <select className={inputClass} value={reportDraft.recipient} onChange={(event) => setReportDraft((draft) => ({ ...draft, recipient: event.target.value }))}>
                  <option>Direction / Academic Office</option>
                  <option>Parents / Guardians</option>
                  <option>Super Admin approval</option>
                  <option>Finance and obligations office</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
                Report type
                <select className={inputClass} value={reportDraft.reportType} onChange={(event) => setReportDraft((draft) => ({ ...draft, reportType: event.target.value }))}>
                  <option>Academic progress report</option>
                  <option>Parent conference report</option>
                  <option>Direction intervention report</option>
                  <option>End-of-period academic report</option>
                  <option>Student support recommendation</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
                Student concerned
                <select className={inputClass} value={reportDraft.student} onChange={(event) => setReportDraft((draft) => ({ ...draft, student: event.target.value }))}>
                  {teacherStudents.map((student) => <option key={student.id} value={student.name}>{student.name} - {student.grade}{student.section}</option>)}
                </select>
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="grid gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
                  Academic period
                  <select className={inputClass} value={reportDraft.period} onChange={(event) => setReportDraft((draft) => ({ ...draft, period: event.target.value }))}>
                    {reportCardPeriods.map((period) => <option key={period}>{period}</option>)}
                  </select>
                </label>
                <label className="grid gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
                  Current average / 100%
                  <input className={inputClass} type="number" min={0} max={100} value={reportDraft.average} onChange={(event) => setReportDraft((draft) => ({ ...draft, average: Math.max(0, Math.min(100, Number(event.target.value))) }))} />
                </label>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="grid gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
                  Conduct / behavior summary
                  <input className={inputClass} value={reportDraft.conduct} onChange={(event) => setReportDraft((draft) => ({ ...draft, conduct: event.target.value }))} />
                </label>
                <label className="grid gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
                  Priority
                  <select className={inputClass} value={reportDraft.priority} onChange={(event) => setReportDraft((draft) => ({ ...draft, priority: event.target.value }))}>
                    <option>Normal</option>
                    <option>Important</option>
                    <option>Urgent</option>
                  </select>
                </label>
              </div>
              <label className="grid gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
                Teacher observation
                <textarea className={`${inputClass} min-h-28`} value={reportDraft.teacherComment} onChange={(event) => setReportDraft((draft) => ({ ...draft, teacherComment: event.target.value }))} rows={4} />
              </label>
              <label className="grid gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
                Recommendation
                <textarea className={`${inputClass} min-h-20`} value={reportDraft.recommendation} onChange={(event) => setReportDraft((draft) => ({ ...draft, recommendation: event.target.value }))} />
              </label>
              <label className="grid gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
                Requested action
                <textarea className={`${inputClass} min-h-20`} value={reportDraft.actionRequested} onChange={(event) => setReportDraft((draft) => ({ ...draft, actionRequested: event.target.value }))} />
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                <button onClick={createReport} className="rounded-xl bg-kcs-blue-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-kcs-blue-800">Save draft</button>
                <button onClick={() => runAction(`${reportDraft.reportType} queued for ${reportDraft.recipient}.`)} className="rounded-xl bg-green-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-green-800">Send package</button>
                <button onClick={() => openReportDocument(false)} className="rounded-xl border border-kcs-gold-400 bg-kcs-gold-50 px-4 py-2.5 text-sm font-bold text-kcs-blue-950 hover:bg-kcs-gold-100 dark:bg-kcs-gold-500">Preview official PDF</button>
                <button onClick={() => openReportDocument(true)} className="rounded-xl bg-kcs-gold-500 px-4 py-2.5 text-sm font-bold text-kcs-blue-950 hover:bg-kcs-gold-400">Print / Download PDF</button>
              </div>
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
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <button onClick={() => {
                  setReportList((current) => current.map((item) => item === card ? { ...item, principalStatus: 'Pending direction approval', download: 'Approval package ready' } : item))
                  runAction(`${card.student} report sent to principal approval queue with audit trail.`)
                }} className="rounded-lg bg-kcs-blue-700 px-3 py-2 text-xs font-bold text-white hover:bg-kcs-blue-800">Approve flow</button>
                <button onClick={() => openSavedReportDocument(card, 'Parents / Guardians', false)} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-kcs-blue-700 hover:bg-kcs-blue-50 dark:border-kcs-blue-700 dark:text-kcs-blue-200">Parent preview</button>
                <button onClick={() => openSavedReportDocument(card, 'Direction / Academic Office', true)} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-kcs-blue-700 hover:bg-kcs-blue-50 dark:border-kcs-blue-700 dark:text-kcs-blue-200">PDF</button>
              </div>
            </div>
          ))}
          </div>
        </div>
        {reportPreviewOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-kcs-blue-950/75 p-3 backdrop-blur-sm sm:p-5" role="dialog" aria-modal="true" aria-label="Official teacher report preview">
            <section className="flex max-h-[95vh] w-full max-w-[min(98vw,88rem)] flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl dark:border-kcs-blue-800 dark:bg-kcs-blue-900">
              <div className="flex flex-col gap-3 border-b border-gray-100 p-4 dark:border-kcs-blue-800 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-kcs-blue-600 dark:text-kcs-blue-300">Official teacher report preview</p>
                  <h3 className="font-display text-xl font-bold text-kcs-blue-900 dark:text-white">{officialPreviewTitle}</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => reportPreviewRef.current?.contentWindow?.print()} className="rounded-xl bg-green-700 px-4 py-2 text-sm font-bold text-white hover:bg-green-800 dark:bg-green-500 dark:hover:bg-green-400">Print / Save PDF</button>
                  <button type="button" onClick={() => setReportPreviewOpen(false)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-kcs-blue-800 hover:bg-kcs-blue-50 dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white dark:hover:bg-kcs-blue-800">
                    <X size={16} /> Close
                  </button>
                </div>
              </div>
              <div className="min-h-0 flex-1 bg-gray-100 p-3 dark:bg-kcs-blue-950">
                <iframe ref={reportPreviewRef} title="Official teacher document PDF preview" srcDoc={officialPreviewHtml || reportDocumentHtml()} className="h-[78vh] w-full rounded-xl border border-gray-200 bg-white dark:border-kcs-blue-800" />
              </div>
            </section>
          </div>
        )}
        </div>
      )}

      {segment === 'discipline' && (
        <div className="space-y-6">
          <div className="grid gap-3 md:grid-cols-4">
            {[
              ['Open cases', disciplineList.filter((report) => report.status !== 'Resolved').length],
              ['Parent notices', disciplineList.filter((report) => report.parentContact).length],
              ['High severity', disciplineList.filter((report) => report.level === 'high').length],
              ['Follow-ups', disciplineList.length],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
                <p className="font-display text-2xl font-bold text-kcs-blue-900 dark:text-white">{value}</p>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{label}</p>
              </div>
            ))}
          </div>
        <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <div className={panelClass}>
            <h3 className="font-bold text-kcs-blue-900 dark:text-white">Open discipline report</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Document incident, context, action, parent/student communication, grading impact, and resolution path.</p>
            <div className="mt-4 grid gap-3">
              <label className="grid gap-1 text-xs font-bold uppercase text-gray-500 dark:text-gray-400">
                Student concerned by this report
                <select className={inputClass} value={disciplineDraft.studentId} onChange={(event) => setDisciplineDraft((draft) => ({ ...draft, studentId: event.target.value }))}>
                  {teacherStudents.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-bold uppercase text-gray-500 dark:text-gray-400">
                Official incident category
                <input className={inputClass} value={disciplineDraft.category} onChange={(event) => setDisciplineDraft((draft) => ({ ...draft, category: event.target.value }))} />
              </label>
              <label className="grid gap-1 text-xs font-bold uppercase text-gray-500 dark:text-gray-400">
                Precise description of observed facts
                <textarea className={inputClass} value={disciplineDraft.incident} onChange={(event) => setDisciplineDraft((draft) => ({ ...draft, incident: event.target.value }))} rows={3} />
              </label>
              <label className="grid gap-1 text-xs font-bold uppercase text-gray-500 dark:text-gray-400">
                Teacher action already taken
                <textarea className={inputClass} value={disciplineDraft.actionTaken} onChange={(event) => setDisciplineDraft((draft) => ({ ...draft, actionTaken: event.target.value }))} rows={3} />
              </label>
              <label className="grid gap-1 text-xs font-bold uppercase text-gray-500 dark:text-gray-400">
                Resolution plan and parent/direction follow-up
                <textarea className={inputClass} value={disciplineDraft.followUp} onChange={(event) => setDisciplineDraft((draft) => ({ ...draft, followUp: event.target.value }))} rows={3} />
              </label>
              <label className="grid gap-1 text-xs font-bold uppercase text-gray-500 dark:text-gray-400">
                Severity level and treatment priority
                <select className={inputClass} value={disciplineDraft.level} onChange={(event) => setDisciplineDraft((draft) => ({ ...draft, level: event.target.value }))}>
                  <option value="low">Low - classroom correction</option>
                  <option value="medium">Medium - parent follow-up</option>
                  <option value="high">High - direction approval required</option>
                </select>
              </label>
              <button onClick={createDisciplineReport} className={compactButton}>Create detailed report</button>
              <button onClick={() => openOfficialMemo('Official Discipline Report', 'Parent/student communication package', [
                ['Student', findStudent(disciplineDraft.studentId)?.name ?? 'Selected student'],
                ['Category', disciplineDraft.category],
                ['Incident', disciplineDraft.incident],
                ['Action taken', disciplineDraft.actionTaken],
                ['Follow-up', disciplineDraft.followUp],
                ['Severity', disciplineDraft.level],
              ], false)} className="rounded-xl border border-kcs-blue-200 px-4 py-2 text-sm font-semibold text-kcs-blue-700 hover:bg-kcs-blue-50 dark:border-kcs-blue-700 dark:text-kcs-blue-200 dark:hover:bg-kcs-blue-900/40">Prepare communication</button>
              <button onClick={() => openOfficialMemo('Official Discipline Report', 'Printable archive and parent notice', [
                ['Student', findStudent(disciplineDraft.studentId)?.name ?? 'Selected student'],
                ['Category', disciplineDraft.category],
                ['Incident', disciplineDraft.incident],
                ['Action taken', disciplineDraft.actionTaken],
                ['Follow-up', disciplineDraft.followUp],
                ['Severity', disciplineDraft.level],
              ], true)} className="rounded-xl bg-kcs-gold-500 px-4 py-2 text-sm font-bold text-kcs-blue-950 hover:bg-kcs-gold-400">Print / PDF</button>
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
              <div className="mt-4 grid gap-2 sm:grid-cols-4">
                <button onClick={() => {
                  setDisciplineList((current) => current.map((item) => item.id === report.id ? { ...item, parentContact: 'Parent notified through portal, email/text package prepared', status: item.status === 'Resolved' ? item.status : 'Parent notified' } : item))
                  openOfficialMemo('Official Discipline Parent Notice', `${report.student} - ${report.date}`, [
                  ['Incident', report.incident],
                  ['Context', report.context],
                  ['Action taken', report.actionTaken],
                  ['Follow-up plan', report.followUp],
                  ['Parent contact', 'Parent notified through portal, email/text package prepared'],
                ], false)
                }} className="rounded-lg bg-kcs-blue-700 px-3 py-2 text-xs font-bold text-white hover:bg-kcs-blue-800">Notify parent</button>
                <button onClick={() => {
                  setDisciplineList((current) => current.map((item) => item.id === report.id ? { ...item, status: 'Resolved', followUp: `${item.followUp} Resolution checkpoint completed by teacher.` } : item))
                  openOfficialMemo('Discipline Resolution Plan', `${report.student} - Resolved`, [
                  ['Incident', report.incident],
                  ['Resolution path', report.followUp],
                  ['Action already taken', report.actionTaken],
                  ['Next review', 'Teacher, student, and academic direction review required.'],
                  ['Status update', 'Resolved and ready for direction review.'],
                ], false)
                }} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-kcs-blue-700 hover:bg-kcs-blue-50 dark:border-kcs-blue-700 dark:text-kcs-blue-200">Resolution</button>
                <button onClick={() => {
                  runAction(`Grade-impact review prepared for ${report.student}; participation, homework, and assessment readiness are flagged for the gradebook.`)
                  openOfficialMemo('Discipline Grade Impact Review', `${report.student} - ${report.category}`, [
                  ['Academic impact', report.incident],
                  ['Teacher action', report.actionTaken],
                  ['Follow-up', report.followUp],
                  ['Gradebook note', 'Review whether conduct affected participation, homework, or assessment readiness.'],
                  ['Action required', 'Teacher must confirm whether a conduct note should be attached to the student gradebook record.'],
                ], false)
                }} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-kcs-blue-700 hover:bg-kcs-blue-50 dark:border-kcs-blue-700 dark:text-kcs-blue-200">Grade impact</button>
                <button onClick={() => {
                  setDisciplineList((current) => current.map((item) => item.id === report.id ? { ...item, status: item.status === 'Resolved' ? 'Resolved' : 'Exported' } : item))
                  openOfficialMemo('Official Discipline Archive Copy', `${report.student} - ${report.id}`, [
                  ['Incident', report.incident],
                  ['Context', report.context],
                  ['Action taken', report.actionTaken],
                  ['Follow-up plan', report.followUp],
                  ['Status', report.status],
                  ['Archive action', 'Official PDF generated and discipline log marked as exported.'],
                ], true)
                }} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-kcs-blue-700 hover:bg-kcs-blue-50 dark:border-kcs-blue-700 dark:text-kcs-blue-200">Export</button>
              </div>
            </article>
          ))}
          </div>
        </div>
        </div>
      )}

      {segment === 'messages' && (
        <div className="space-y-6">
          <div className="grid gap-3 md:grid-cols-4">
            {[
              ['Inbox', inbox.length],
              ['Needs response', inbox.filter((message) => message.requiresResponse).length],
              ['Threads', internalThreads.length],
              ['Channels', 4],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
                <p className="font-display text-2xl font-bold text-kcs-blue-900 dark:text-white">{value}</p>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{label}</p>
              </div>
            ))}
          </div>
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
              <div className="grid gap-2 sm:grid-cols-4">
                {(['Email', 'Text', 'Letter', 'Call'] as const).map((channel) => (
                  <button key={channel} type="button" onClick={() => {
                    setMessageChannel(channel)
                    runAction(`${channel} channel selected and audit metadata prepared.`)
                  }} className={`rounded-lg px-3 py-2 text-xs font-bold transition-colors ${messageChannel === channel ? 'bg-kcs-blue-700 text-white shadow-sm dark:bg-kcs-gold-400 dark:text-kcs-blue-950' : 'bg-white text-kcs-blue-700 hover:bg-kcs-blue-50 dark:bg-kcs-blue-950/50 dark:text-kcs-blue-200'}`}>
                    {channel}
                  </button>
                ))}
              </div>
              <label className="grid gap-1 text-xs font-bold uppercase text-gray-500 dark:text-gray-400">
                Official recipient
                <input className={inputClass} value={messageDraft.to} onChange={(event) => setMessageDraft((draft) => ({ ...draft, to: event.target.value }))} />
              </label>
              <label className="grid gap-1 text-xs font-bold uppercase text-gray-500 dark:text-gray-400">
                Message subject
                <input className={inputClass} value={messageDraft.subject} onChange={(event) => setMessageDraft((draft) => ({ ...draft, subject: event.target.value }))} />
              </label>
              <label className="grid gap-1 text-xs font-bold uppercase text-gray-500 dark:text-gray-400">
                Content to send, print, or archive
                <textarea className={inputClass} value={messageDraft.body} onChange={(event) => setMessageDraft((draft) => ({ ...draft, body: event.target.value }))} rows={3} />
              </label>
              <div className="grid gap-2 sm:grid-cols-3">
                <button onClick={sendMessage} className={compactButton}>Send message</button>
                <button onClick={() => openOfficialMemo('Official School Correspondence', messageDraft.to, [
                  ['Recipient', messageDraft.to],
                  ['Channel', messageChannel],
                  ['Subject', messageDraft.subject],
                  ['Message', messageDraft.body],
                  ['Delivery channels', `${messageChannel}, portal inbox, audit trail, and parent/student visibility rules.`],
                ], false)} className="rounded-xl border border-kcs-blue-200 px-3 py-2 text-xs font-bold text-kcs-blue-700 hover:bg-kcs-blue-50 dark:border-kcs-blue-700 dark:text-kcs-blue-200">Preview letter</button>
                <button onClick={() => openOfficialMemo('Official School Correspondence', messageDraft.to, [
                  ['Recipient', messageDraft.to],
                  ['Channel', messageChannel],
                  ['Subject', messageDraft.subject],
                  ['Message', messageDraft.body],
                  ['Delivery channels', `${messageChannel}, portal inbox, audit trail, and parent/student visibility rules.`],
                ], true)} className="rounded-xl bg-kcs-gold-500 px-3 py-2 text-xs font-bold text-kcs-blue-950 hover:bg-kcs-gold-400">Print / PDF</button>
              </div>
            </div>
            <div className="space-y-3">
              {internalThreads.map((thread) => (
                <div key={thread.subject} className="rounded-xl bg-gray-50 p-3 dark:bg-kcs-blue-800/30">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-kcs-blue-900 dark:text-white">{thread.subject}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{thread.channel} - {thread.unread} unread</p>
                    </div>
                    <button onClick={() => openOfficialMemo('Official Message Thread Summary', thread.subject, [
                      ['Thread', thread.subject],
                      ['Channel', thread.channel],
                      ['Unread items', String(thread.unread)],
                      ['Visibility', 'Participant visibility rules and audit trail prepared.'],
                    ], false)} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-kcs-blue-700 hover:bg-kcs-blue-50 dark:border-kcs-blue-700 dark:text-kcs-blue-200">Open</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        </div>
      )}
    </section>
  )
}

const TeacherDashboardHome = () => {
  const [dashboardWindow, setDashboardWindow] = useState<'schedule' | 'actions' | 'risk' | 'sync' | 'communication' | null>(null)

  const adminAssignedTeacherSchedule = useMemo(() => (
    ecosystemSchedules
      .filter((item) => item.role === 'teacher')
      .map((item) => {
        const scheduleItem = item as typeof item & {
          students?: number
          linkedStudentIds?: string[]
          parentOwnerIds?: string[]
          assignedBy?: string
        }

        const linkedStudentCount = Array.isArray(scheduleItem.linkedStudentIds) ? scheduleItem.linkedStudentIds.length : 0
        const parentPortalCount = Array.isArray(scheduleItem.parentOwnerIds) ? scheduleItem.parentOwnerIds.length : 0

        return {
          ...scheduleItem,
          course: scheduleItem.title,
          students: scheduleItem.students ?? linkedStudentCount,
          studentPortalCount: linkedStudentCount,
          parentPortalCount,
        }
      })
  ), [])

  const metricCards = [
    { label: 'Assigned Students', value: '83', sub: 'Across 4 active classes', icon: Users, tone: 'bg-kcs-blue-50 text-kcs-blue-700 dark:bg-kcs-blue-900/30 dark:text-kcs-blue-300' },
    { label: 'Pending Actions', value: '56', sub: 'Grades, comments, follow-ups', icon: FileText, tone: 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
    { label: 'Risk Alerts', value: '3', sub: 'AI intervention required', icon: AlertTriangle, tone: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
    { label: 'Class Average', value: '87%', sub: '+4% vs last month', icon: TrendingUp, tone: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  ]

  const quickActions = [
    { to: '/portal/teacher/attendance', label: 'Take Attendance', icon: ClipboardCheck },
    { to: '/portal/teacher/grades', label: 'Open Gradebook', icon: TrendingUp },
    { to: '/portal/teacher/assignments', label: 'Create Assignment', icon: FileText },
    { to: '/portal/teacher/messages', label: 'Notify Parents', icon: MessageSquare },
  ]

  const aiTools = [
    ['Lesson plan', 'Create a differentiated 45-minute lesson from today schedule.'],
    ['Quiz builder', 'Generate questions from the current subject and class level.'],
    ['Smart feedback', 'Improve comments for report cards and parent meetings.'],
    ['Risk intervention', 'Suggest support plans for struggling students.'],
    ['Meeting summary', 'Prepare parent-teacher conference notes.'],
  ]

  const expandButton = (id: NonNullable<typeof dashboardWindow>, label = 'Open window') => (
    <button
      type="button"
      onClick={() => setDashboardWindow(id)}
      className="inline-flex items-center gap-1.5 rounded-lg border border-kcs-blue-100 px-3 py-2 text-xs font-semibold text-kcs-blue-700 transition-colors hover:bg-kcs-blue-50 dark:border-kcs-blue-700 dark:text-kcs-blue-100 dark:hover:bg-kcs-blue-800"
    >
      <Maximize2 size={14} /> {label}
    </button>
  )

  const scheduleCards = (
    <div className="space-y-3">
      {adminAssignedTeacherSchedule.map((item, index) => (
        <div key={`${item.ownerId}-${item.time}-${item.title}`} className={`rounded-xl border p-4 ${index === 0 ? 'border-kcs-blue-300 bg-kcs-blue-50 dark:border-kcs-blue-600 dark:bg-kcs-blue-800/40' : 'border-gray-100 bg-gray-50 dark:border-kcs-blue-800 dark:bg-kcs-blue-800/20'}`}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500">{item.day ?? 'School day'} - {item.time}</p>
            <span className="text-xs font-semibold text-kcs-blue-700 dark:text-kcs-blue-300">{item.students} students</span>
          </div>
          <p className="mt-1 font-semibold text-kcs-blue-900 dark:text-white">{item.course}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{item.room} - assigned by {item.assignedBy ?? 'Super Admin'}</p>
          <div className="mt-3 grid gap-2 text-xs text-gray-600 dark:text-gray-300 sm:grid-cols-2">
            <span className="rounded-lg bg-white px-3 py-2 dark:bg-kcs-blue-950/50">{item.studentPortalCount} student portal link{item.studentPortalCount > 1 ? 's' : ''}</span>
            <span className="rounded-lg bg-white px-3 py-2 dark:bg-kcs-blue-950/50">{item.parentPortalCount} parent portal link{item.parentPortalCount > 1 ? 's' : ''}</span>
          </div>
        </div>
      ))}
    </div>
  )

  const actionQueueCards = (
    <div className="space-y-3">
      {gradingQueue.map((task) => (
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
      {ecosystemAssignments.filter((item) => item.status === 'missing').map((item) => (
        <div key={item.id} className="rounded-xl border border-red-100 bg-red-50 p-4 dark:border-red-900/30 dark:bg-red-900/20">
          <p className="font-semibold text-red-700 dark:text-red-300">{item.title}</p>
          <p className="text-xs text-red-600/80 dark:text-red-200/80">Missing assignment detection - {item.subject}</p>
        </div>
      ))}
    </div>
  )

  const riskCards = (
    <div className="space-y-3">
      {studentAlerts.map((alert) => (
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
  )

  const syncCards = (
    <div className="space-y-3">
      {[
        ['Schedule', 'Super Admin assignments feed teacher, student, and parent dashboards with the matching portion only.', 'Admin source'],
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
  )

  const communicationCards = (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3">
        {messages.map((message) => (
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
  )

  const dashboardWindowContent = {
    schedule: { title: 'Daily And Weekly Schedule', eyebrow: 'Loaded from Super Admin assignments', body: scheduleCards },
    actions: { title: 'Action Queue', eyebrow: 'Teacher workflow window', body: actionQueueCards },
    risk: { title: 'Student Risk Radar', eyebrow: 'Student-centered intervention window', body: riskCards },
    sync: { title: 'Ecosystem Sync', eyebrow: 'Cross-dashboard data coherence', body: syncCards },
    communication: { title: 'Communication, Audit, And Security', eyebrow: 'Messages, permissions, and logs', body: communicationCards },
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
                <span>Automation coverage</span>
                <span>91%</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-white dark:bg-kcs-blue-950">
                <div className="h-full rounded-full bg-kcs-gold-400" style={{ width: '91%' }} />
              </div>
            </div>
            <div className="mt-5 grid gap-2 text-xs text-gray-600 dark:text-gray-300">
              {['3 students need intervention', '18 grades can be batch-entered', '4 parent updates are ready', '2 schedule conflicts prevented'].map((item) => (
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
            {gradebookCategories.map((category) => (
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
            {aiTools.map(([title, detail]) => (
              <button key={title} className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-left transition-colors hover:border-kcs-blue-200 hover:bg-kcs-blue-50 dark:border-kcs-blue-800 dark:bg-kcs-blue-800/30 dark:hover:bg-kcs-blue-800">
                <p className="text-sm font-semibold text-kcs-blue-900 dark:text-white">{title}</p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{detail}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-bold text-kcs-blue-900 dark:text-white">
              <Calendar size={18} className="text-kcs-blue-500" /> Daily And Weekly Schedule
            </h2>
            {expandButton('schedule')}
          </div>
          {scheduleCards}
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-bold text-kcs-blue-900 dark:text-white">
              <CheckCircle2 size={18} className="text-green-500" /> Action Queue
            </h2>
            {expandButton('actions')}
          </div>
          {actionQueueCards}
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-bold text-kcs-blue-900 dark:text-white">
              <AlertTriangle size={18} className="text-red-500" /> Student Risk Radar
            </h2>
            {expandButton('risk')}
          </div>
          {riskCards}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-bold text-kcs-blue-900 dark:text-white">Ecosystem Sync</h2>
            {expandButton('sync')}
          </div>
          {syncCards}
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-bold text-kcs-blue-900 dark:text-white">Communication, Audit, And Security</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Teacher-only access, logged actions, and cross-role communication.</p>
            </div>
            {expandButton('communication')}
          </div>
          {communicationCards}
        </div>
      </div>

      {dashboardWindow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-kcs-blue-950/75 p-3 backdrop-blur-sm sm:p-5" role="dialog" aria-modal="true" aria-label={dashboardWindowContent[dashboardWindow].title}>
          <section className="max-h-[94vh] w-full max-w-[min(96vw,96rem)] overflow-y-auto rounded-2xl border border-gray-100 bg-white p-5 shadow-2xl dark:border-kcs-blue-800 dark:bg-kcs-blue-900 sm:p-7">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-kcs-blue-600 dark:text-kcs-blue-300">{dashboardWindowContent[dashboardWindow].eyebrow}</p>
                <h3 className="mt-1 font-display text-2xl font-bold text-kcs-blue-900 dark:text-white sm:text-3xl">{dashboardWindowContent[dashboardWindow].title}</h3>
              </div>
              <button type="button" onClick={() => setDashboardWindow(null)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-kcs-blue-700 hover:bg-kcs-blue-50 dark:border-kcs-blue-700 dark:text-kcs-blue-100 dark:hover:bg-kcs-blue-800">
                <X size={16} /> Close
              </button>
            </div>
            {dashboardWindowContent[dashboardWindow].body}
          </section>
        </div>
      )}

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
  const { language } = useUIStore()
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
              <Link to="/portal/teacher/diagnostic" className="inline-flex items-center rounded-xl border border-kcs-blue-200 bg-white px-4 py-2 text-sm font-bold text-kcs-blue-800 shadow-sm ring-1 ring-white/40 transition-colors hover:bg-kcs-blue-50 dark:border-white/70 dark:bg-white dark:text-kcs-blue-950 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.22)] dark:hover:bg-kcs-blue-50">
                Diagnostic Test
              </Link>
              <a href={lessonPlanUrl} target="_blank" rel="noreferrer" className="inline-flex items-center rounded-xl border border-kcs-gold-300 bg-kcs-gold-50 px-4 py-2 text-sm font-bold text-kcs-blue-950 shadow-sm ring-1 ring-kcs-gold-100 transition-colors hover:bg-kcs-gold-100 dark:border-kcs-gold-200 dark:bg-kcs-gold-300 dark:text-kcs-blue-950 dark:shadow-[0_0_0_1px_rgba(250,204,21,0.28)] dark:hover:bg-kcs-gold-200">
                Lesson Plan
              </a>
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
                {gradebookCategories.map((category) => (
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
                {ecosystemSchedules.filter((item) => item.role === 'teacher').map((item, index) => (
                  <div key={`${item.ownerId}-${item.time}-${item.title}`} className={`rounded-xl border p-4 ${index === 0 ? 'border-kcs-blue-300 bg-kcs-blue-50 dark:border-kcs-blue-600 dark:bg-kcs-blue-800/40' : 'border-gray-100 bg-gray-50 dark:border-kcs-blue-800 dark:bg-kcs-blue-800/20'}`}>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{item.time}</p>
                    <p className="mt-1 font-semibold text-kcs-blue-900 dark:text-white">{item.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{item.room}</p>
                    <p className="mt-2 text-xs font-medium text-kcs-blue-700 dark:text-kcs-blue-300">{(item as typeof item & { students?: number }).students ?? 0} students</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <h2 className="mb-4 flex items-center gap-2 font-bold text-kcs-blue-900 dark:text-white">
                <MessageSquare size={18} className="text-kcs-gold-500" /> Messages
              </h2>
              <div className="space-y-3">
                {messages.map((message) => (
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
                {gradingQueue.map((task) => (
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
                {studentAlerts.map((alert) => (
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
