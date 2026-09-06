import { useEffect, useMemo, useState } from 'react'
import {
  TrendingUp,
  CheckCircle2,
  Clock3,
  Eye,
  FileCheck2,
  GraduationCap,
  LockKeyhole,
  MessageSquareText,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from 'lucide-react'
import { academicRecordsAPI, teacherWorkspaceAPI } from '@/services/api'
import { printOfficialPdf } from '@/utils/officialPdf'
import { canonicalClassLabel, compareClassLabels } from '@/utils/classLabels'
import TeacherWholeSchoolReportCards from './TeacherWholeSchoolReportCards'

type Student = {
  id: string
  studentNumber: string
  grade: string
  section?: string
  user: { firstName: string; middleName?: string | null; lastName: string }
  analytics?: {
    attendanceRate?: number | null
    attendanceSummary?: {
      total: number
      present: number
      absent: number
      late: number
      excused: number
      sick: number
      suspended: number
      attendanceRate?: number | null
    }
  }
}

type Grade = {
  id: string
  studentId: string
  assignmentId?: string | null
  percentage: number
  letterGrade: string
  period: string
  createdAt: string
}

type Course = {
  id: string
  name: string
  code: string
  grade: string
  enrollments: Array<{ studentId: string; student: Student }>
  grades: Grade[]
  source: 'official' | 'workspace'
  gradebookSnapshot?: WorkspaceGradebookSnapshot
}

type Submission = Grade & {
  courseId: string
  cycle: { academicYear: string; term: string; status: string }
}

type ReportCard = {
  id: string
  studentId: string
  term: string
  average: number
  principalStatus: string
  publicationStatus: string
  approvedAt?: string | null
  portalPostedAt?: string | null
}

type DraftEntry = {
  teacherComment: string
  conduct: string
  recommendation: string
  overrideValue: string
  overrideReason: string
}

type DraftStore = Record<string, Record<string, DraftEntry>>

const sessions = [
  'Semester 1 · Trimester 1',
  'Semester 1 · Trimester 2',
  'Semester 2 · Trimester 3',
  'Annual final',
]

const commentBank = [
  'Demonstrates strong mastery and applies concepts independently.',
  'Progress is steady; regular practice should continue.',
  'Participation is positive and supports collaborative learning.',
  'Requires targeted support and closer family follow-up.',
  'Should complete missing work and ask for help earlier.',
]

const panel = 'rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50'
const field = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-kcs-blue-950 outline-none focus:border-kcs-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white dark:disabled:bg-kcs-blue-900'
const primary = 'inline-flex items-center justify-center gap-2 rounded-xl bg-kcs-blue-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-kcs-blue-800 disabled:cursor-not-allowed disabled:opacity-45'

const emptyEntry = (): DraftEntry => ({
  teacherComment: '',
  conduct: '',
  recommendation: '',
  overrideValue: '',
  overrideReason: '',
})
type WorkspaceCourse = {
  id: string
  name: string
  abbreviation?: string
  code?: string
  className?: string
  gradeLevels?: string[]
  studentIds?: string[]
  enrollmentMode?: 'class' | 'custom'
}

type WorkspaceGradebookColumn = {
  id: string
  maxPoints: number
}

type WorkspaceGradebookSnapshot = {
  assignments?: Array<WorkspaceGradebookColumn & { category: string; term: string }>
  categories?: Array<{ id: string; weight: number }>
  scores?: Record<string, string>
}

type TeacherReportWorkspace = {
  courses?: WorkspaceCourse[]
  teacherStudents?: Array<Record<string, any>>
  attendanceEntries?: Array<{ studentId?: string; status?: string }>
  gradebookColumnsByCourse?: Record<string, WorkspaceGradebookColumn[]>
  gradebookScores?: Record<string, string>
  advancedGradebookByCourse?: Record<string, WorkspaceGradebookSnapshot>
  reportCardWorkflow?: DraftStore
}

const normalizeStudent = (raw: Record<string, any>, fallbackIndex: number, existing?: Student): Student => {
  const explicitName = String(raw.name ?? '').trim()
  const rawUser = raw.user ?? {}
  const studentNumber = String(raw.studentNumber ?? existing?.studentNumber ?? raw.id ?? `STUDENT-${fallbackIndex + 1}`)
  return {
    id: String(raw.id ?? existing?.id ?? studentNumber),
    studentNumber,
    grade: canonicalClassLabel(raw.grade ?? raw.className ?? existing?.grade, raw.section ?? existing?.section),
    section: '',
    user: {
      firstName: String(rawUser.firstName ?? existing?.user.firstName ?? ''),
      middleName: rawUser.middleName ?? existing?.user.middleName ?? null,
      lastName: String(rawUser.lastName ?? existing?.user.lastName ?? explicitName ?? studentNumber),
    },
    analytics: {
      ...(existing?.analytics ?? {}),
      ...(raw.analytics ?? {}),
      attendanceRate: raw.analytics?.attendanceRate ?? raw.attendance ?? existing?.analytics?.attendanceRate ?? null,
    },
  }
}

const normalizedScore = (value: unknown, maxPoints: number) => {
  const entry = String(value ?? '').trim().toUpperCase()
  if (!entry || entry === 'E' || entry === 'I') return null
  if (entry === 'U') return 0
  const numeric = Number(entry)
  if (!Number.isFinite(numeric)) return null
  return Math.max(0, Math.min(100, (numeric / Math.max(Number(maxPoints) || 1, 1)) * 100))
}

const weightedSnapshotAverage = (snapshot: WorkspaceGradebookSnapshot | undefined, studentId: string, term: string) => {
  const assignments = (snapshot?.assignments ?? []).filter((assignment) => term === 'Annual final' || assignment.term === term)
  const categories = snapshot?.categories ?? []
  let weightedTotal = 0
  let activeWeight = 0
  for (const category of categories) {
    const values = assignments
      .filter((assignment) => assignment.category === category.id)
      .map((assignment) => normalizedScore(snapshot?.scores?.[`${assignment.id}:${studentId}`], assignment.maxPoints))
      .filter((value): value is number => value !== null)
    if (!values.length || category.weight <= 0) continue
    weightedTotal += (values.reduce((sum, value) => sum + value, 0) / values.length) * category.weight
    activeWeight += category.weight
  }
  return activeWeight ? Number((weightedTotal / activeWeight).toFixed(2)) : null
}

const buildReportCourses = (overview: Record<string, any>, state?: TeacherReportWorkspace): Course[] => {
  const studentsById = new Map<string, Student>()
  const studentsByNumber = new Map<string, Student>()

  const registerStudent = (raw: Record<string, any>, index: number) => {
    const id = String(raw.id ?? '')
    const number = String(raw.studentNumber ?? '').trim().toLowerCase()
    const existing = (id && studentsById.get(id)) || (number && studentsByNumber.get(number)) || undefined
    const student = normalizeStudent(raw, index, existing)
    studentsById.set(student.id, student)
    if (existing && existing.id !== student.id) {
      studentsById.set(existing.id, { ...student, id: existing.id })
    }
    if (student.studentNumber) studentsByNumber.set(student.studentNumber.trim().toLowerCase(), student)
  }

  const directoryRecords = (overview.studentDirectory?.length ? overview.studentDirectory : (overview.students ?? [])) as Array<Record<string, any>>
  directoryRecords.forEach((student, index) => registerStudent(student, index))
  ;(overview.students ?? []).forEach((student: Record<string, any>, index: number) => registerStudent(student, index))
  ;(state?.teacherStudents ?? []).forEach((student, index) => registerStudent(student, index))
  const directoryRoster = directoryRecords
    .map((student) => studentsById.get(String(student.id)))
    .filter((student): student is Student => Boolean(student))
  const attendanceByStudent = new Map<string, string[]>()
  ;(state?.attendanceEntries ?? []).forEach((entry) => {
    if (!entry.studentId || !entry.status) return
    attendanceByStudent.set(entry.studentId, [...(attendanceByStudent.get(entry.studentId) ?? []), entry.status.toUpperCase()])
  })
  attendanceByStudent.forEach((statuses, studentId) => {
    const student = studentsById.get(studentId)
    if (!student || student.analytics?.attendanceSummary?.total) return
    const count = (status: string) => statuses.filter((item) => item === status).length
    const attended = statuses.filter((item) => ['PRESENT', 'LATE', 'EXCUSED'].includes(item)).length
    student.analytics = {
      ...(student.analytics ?? {}),
      attendanceRate: statuses.length ? Number(((attended * 100) / statuses.length).toFixed(1)) : null,
      attendanceSummary: {
        total: statuses.length,
        present: count('PRESENT'),
        absent: count('ABSENT'),
        late: count('LATE'),
        excused: count('EXCUSED'),
        sick: count('SICK'),
        suspended: count('SUSPENDED'),
        attendanceRate: statuses.length ? Number(((attended * 100) / statuses.length).toFixed(1)) : null,
      },
    }
  })

  const officialCourses: Course[] = (overview.courses ?? []).map((rawCourse: Record<string, any>): Course => ({
    id: String(rawCourse.id),
    name: String(rawCourse.name ?? 'Subject'),
    code: String(rawCourse.code ?? ''),
    grade: canonicalClassLabel(rawCourse.grade),
    enrollments: (rawCourse.enrollments ?? []).map((enrollment: Record<string, any>, index: number) => {
      const student = normalizeStudent(enrollment.student ?? { id: enrollment.studentId }, index, studentsById.get(String(enrollment.studentId)))
      registerStudent(student as unknown as Record<string, any>, index)
      return { studentId: student.id, student }
    }),
    grades: (rawCourse.grades ?? []) as Grade[],
    source: 'official',
  }))

  const usedOfficialIds = new Set<string>()
  const workspaceCourses = (state?.courses ?? []).map((workspaceCourse): Course => {
    const grade = canonicalClassLabel(workspaceCourse.className ?? workspaceCourse.gradeLevels?.[0])
    const abbreviation = String(workspaceCourse.abbreviation ?? workspaceCourse.code ?? '').trim()
    const officialMatch = officialCourses.find((candidate) => (
      candidate.id === workspaceCourse.id
      || (candidate.grade === grade && (
        candidate.name.localeCompare(workspaceCourse.name, 'fr', { sensitivity: 'base' }) === 0
        || (abbreviation && candidate.code.localeCompare(abbreviation, 'fr', { sensitivity: 'base' }) === 0)
      ))
    ))
    if (officialMatch) usedOfficialIds.add(officialMatch.id)

    const requestedIds = workspaceCourse.enrollmentMode === 'custom'
      ? (workspaceCourse.studentIds ?? [])
      : directoryRoster.filter((student) => canonicalClassLabel(student.grade, student.section) === grade).map((student) => student.id)
    const enrolledStudents = [...new Set(requestedIds)]
      .map((studentId) => studentsById.get(studentId))
      .filter((student): student is Student => Boolean(student))
      .sort((left, right) => studentName(left).localeCompare(studentName(right), 'fr', { sensitivity: 'base' }))

    const columns = state?.gradebookColumnsByCourse?.[workspaceCourse.id] ?? []
    const gradebookGrades = enrolledStudents.flatMap((student) => columns.flatMap((column) => {
      const percentage = normalizedScore(state?.gradebookScores?.[`${workspaceCourse.id}-${column.id}-${student.id}`], column.maxPoints)
      return percentage === null ? [] : [{
        id: `workspace-${workspaceCourse.id}-${column.id}-${student.id}`,
        studentId: student.id,
        assignmentId: column.id,
        percentage,
        letterGrade: letterGrade(percentage),
        period: 'WORKSPACE_GRADEBOOK',
        createdAt: new Date(0).toISOString(),
      }]
    }))

    return {
      id: officialMatch?.id ?? workspaceCourse.id,
      name: workspaceCourse.name,
      code: abbreviation || officialMatch?.code || 'COURSE',
      grade,
      enrollments: enrolledStudents.map((student) => ({ studentId: student.id, student })),
      grades: gradebookGrades.length ? gradebookGrades : (officialMatch?.grades ?? []),
      source: officialMatch ? 'official' : 'workspace',
      gradebookSnapshot: state?.advancedGradebookByCourse?.[workspaceCourse.id],
    }
  })

  return [
    ...workspaceCourses,
    ...officialCourses.filter((course) => !usedOfficialIds.has(course.id)),
  ].sort((left, right) => compareClassLabels(left.grade, right.grade)
    || left.name.localeCompare(right.name, 'fr', { sensitivity: 'base' }))
}

function studentName(student: Student) {
  return [student.user.lastName, student.user.middleName, student.user.firstName].filter(Boolean).join(' ').trim() || student.studentNumber
}

function letterGrade(value: number | null) {
  if (value === null) return 'I'
  if (value >= 97) return 'A+'
  if (value >= 93) return 'A'
  if (value >= 90) return 'A-'
  if (value >= 87) return 'B+'
  if (value >= 83) return 'B'
  if (value >= 80) return 'B-'
  if (value >= 77) return 'C+'
  if (value >= 73) return 'C'
  if (value >= 70) return 'C-'
  if (value >= 67) return 'D+'
  if (value >= 63) return 'D'
  if (value >= 60) return 'D-'
  return 'F'
}

const statusLabel = (card?: ReportCard, submitted = false) => {
  if (card?.publicationStatus === 'POSTED_TO_PORTAL') return 'Published to portals'
  if (card?.publicationStatus === 'EMAILED') return 'Emailed'
  if (card?.publicationStatus === 'APPROVED') return 'Approved and locked'
  if (card?.publicationStatus === 'READY_FOR_REVIEW') return 'Under academic review'
  return submitted ? 'Submitted to administration' : 'Editable draft'
}

function SubjectGradeSubmission() {
  const [courses, setCourses] = useState<Course[]>([])
  const [courseId, setCourseId] = useState('')
  const [academicYear, setAcademicYear] = useState('2026-2027')
  const [term, setTerm] = useState(sessions[0])
  const [drafts, setDrafts] = useState<DraftStore>({})
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [reportCards, setReportCards] = useState<ReportCard[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [viewMode, setViewMode] = useState<'spreadsheet' | 'cards'>('spreadsheet')
  const [rowFilter, setRowFilter] = useState<'all' | 'incomplete' | 'ready' | 'submitted'>('all')
  const [bulkComment, setBulkComment] = useState('')

  const cycleKey = `${academicYear}::${term}::${courseId}`
  const course = courses.find((item) => item.id === courseId) ?? courses[0]
  const cycleDrafts = drafts[cycleKey] ?? {}
  const officialTerm = `${academicYear} · ${term}`

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [overviewResponse, workspaceResponse, workflowResponse] = await Promise.all([
        teacherWorkspaceAPI.overview(),
        teacherWorkspaceAPI.get(),
        academicRecordsAPI.myFinalGrades(),
      ])
      const overview = (overviewResponse.data?.data ?? {}) as Record<string, any>
      const state = workspaceResponse.data?.data?.state as TeacherReportWorkspace | undefined
      const nextCourses = buildReportCourses(overview, state)
      setCourses(nextCourses)
      setCourseId((current) => nextCourses.some((item) => item.id === current) ? current : (nextCourses[0]?.id ?? ''))
      setDrafts(state?.reportCardWorkflow ?? {})
      setSubmissions(workflowResponse.data?.data?.submissions ?? [])
      setReportCards(workflowResponse.data?.data?.reportCards ?? [])
    } catch (reason: any) {
      setError(reason?.response?.data?.message ?? 'The official report-card workspace could not be loaded.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const allRows = useMemo(() => {
    if (!course) return []
    return course.enrollments
      .map(({ student }) => {
        const snapshotAverage = weightedSnapshotAverage(course.gradebookSnapshot, student.id, term)
        const assessmentGrades = course.grades.filter((grade) => grade.studentId === student.id && grade.assignmentId && (grade.period === term || grade.period === 'CURRENT' || grade.period === 'WORKSPACE_GRADEBOOK'))
        const calculated = snapshotAverage ?? (assessmentGrades.length
          ? Number((assessmentGrades.reduce((sum, grade) => sum + grade.percentage, 0) / assessmentGrades.length).toFixed(2))
          : null)
        const draft = cycleDrafts[student.id] ?? emptyEntry()
        const override = draft.overrideValue.trim() === '' ? null : Number(draft.overrideValue)
        const submission = submissions.find((item) => item.courseId === course.id && item.studentId === student.id && item.cycle.academicYear === academicYear && item.cycle.term === term)
        const card = reportCards.find((item) => item.studentId === student.id && item.term === officialTerm)
        const draftFinal = override !== null && Number.isFinite(override) ? Math.max(0, Math.min(100, override)) : calculated
        const finalGrade = submission?.percentage ?? draftFinal
        return { student, calculated, draft, finalGrade, submission, card }
      })
      .sort((left, right) => studentName(left.student).localeCompare(studentName(right.student), 'fr', { sensitivity: 'base' }))
  }, [academicYear, course, cycleDrafts, officialTerm, reportCards, submissions, term])

  const rows = useMemo(() => allRows.filter((row) => {
    const matchesQuery = !query.trim()
      || `${studentName(row.student)} ${row.student.studentNumber}`.toLowerCase().includes(query.toLowerCase())
    const matchesStatus = rowFilter === 'all'
      || (rowFilter === 'incomplete' && row.finalGrade === null)
      || (rowFilter === 'ready' && row.finalGrade !== null && !row.submission)
      || (rowFilter === 'submitted' && Boolean(row.submission))
    return matchesQuery && matchesStatus
  }), [allRows, query, rowFilter])
  const submittedCount = allRows.filter((row) => row.submission).length
  const locked = allRows.length > 0 && (submittedCount === allRows.length || allRows.some((row) => ['APPROVED', 'EMAILED', 'POSTED_TO_PORTAL'].includes(row.card?.publicationStatus ?? '')))
  const readyCount = allRows.filter((row) => row.finalGrade !== null).length
  const attendanceTotals = allRows.reduce((totals, row) => {
    const summary = row.student.analytics?.attendanceSummary
    return {
      present: totals.present + (summary?.present ?? 0),
      absent: totals.absent + (summary?.absent ?? 0),
      late: totals.late + (summary?.late ?? 0),
    }
  }, { present: 0, absent: 0, late: 0 })
  const gradedRows = allRows.filter((row) => row.finalGrade !== null)
  const classAverage = gradedRows.length
    ? Number((gradedRows.reduce((sum, row) => sum + (row.finalGrade ?? 0), 0) / gradedRows.length).toFixed(1))
    : null
  const passingCount = gradedRows.filter((row) => (row.finalGrade ?? 0) >= 70).length

  const updateEntry = (studentId: string, patch: Partial<DraftEntry>) => {
    setDrafts((current) => ({
      ...current,
      [cycleKey]: {
        ...(current[cycleKey] ?? {}),
        [studentId]: { ...(current[cycleKey]?.[studentId] ?? emptyEntry()), ...patch },
      },
    }))
  }


  const resetRowFilters = () => {
    setQuery('')
    setRowFilter('all')
  }

  const applyBulkComment = () => {
    if (locked || !bulkComment || !rows.length) return
    setDrafts((current) => {
      const nextCycle = { ...(current[cycleKey] ?? {}) }
      rows.forEach((row) => {
        nextCycle[row.student.id] = {
          ...(nextCycle[row.student.id] ?? emptyEntry()),
          teacherComment: bulkComment,
        }
      })
      return { ...current, [cycleKey]: nextCycle }
    })
    setNotice(`Comment applied to ${rows.length} visible learner(s). Save the draft to persist it.`)
  }
  const persistDrafts = async (successMessage = 'Report-card draft saved in KCS Nexus.') => {
    setSaving(true)
    setError('')
    try {
      const latest = await teacherWorkspaceAPI.get()
      const workspace = latest.data?.data
      await teacherWorkspaceAPI.save({ ...(workspace?.state ?? {}), reportCardWorkflow: drafts }, workspace?.revision)
      setNotice(successMessage)
      return true
    } catch (reason: any) {
      setError(reason?.response?.data?.message ?? 'The report-card draft could not be saved.')
      return false
    } finally {
      setSaving(false)
    }
  }

  const submit = async () => {
    if (!course || !allRows.length) return
    const incomplete = allRows.filter((row) => row.finalGrade === null)
    if (incomplete.length) {
      setError(`Submission blocked: ${incomplete.length} learner(s) have no calculated grade or approved override.`)
      return
    }
    const unexplained = allRows.filter((row) => row.draft.overrideValue.trim() !== '' && row.finalGrade !== row.calculated && !row.draft.overrideReason.trim())
    if (unexplained.length) {
      setError(`Submission blocked: explain every manual override before submission (${unexplained.length} learner(s)).`)
      return
    }
    setSaving(true)
    setError('')
    try {
      if (!await persistDrafts('Draft saved before controlled submission.')) return
      await academicRecordsAPI.submitFinalGrades({
        courseId: course.id,
        academicYear,
        term,
        results: allRows.map((row) => ({
          studentId: row.student.id,
          percentage: row.finalGrade,
          comment: [
            row.draft.teacherComment && `Academic: ${row.draft.teacherComment}`,
            row.draft.conduct && `Conduct: ${row.draft.conduct}`,
            row.draft.recommendation && `Recommendation: ${row.draft.recommendation}`,
            row.draft.overrideReason && `Override audit: ${row.calculated ?? 'no source'}% -> ${row.finalGrade}% · ${row.draft.overrideReason}`,
          ].filter(Boolean).join(' | ').slice(0, 1000),
        })),
      })
      setNotice(`${allRows.length} final grade(s) submitted. The session is now read-only pending administrative review.`)
      await load()
    } catch (reason: any) {
      setError(reason?.response?.data?.message ?? 'Final grades could not be submitted.')
    } finally {
      setSaving(false)
    }
  }

  const exportPreview = () => {
    if (!course) return
    const created = printOfficialPdf({
      title: 'DRAFT — NOT OFFICIAL',
      subtitle: `${course.code} · ${course.name} · ${academicYear} · ${term}`,
      metadata: [
        ['Workflow', locked ? 'Submitted for administrative review' : 'Teacher draft'],
        ['Learners', allRows.length],
        ['Attendance', `${attendanceTotals.present} present · ${attendanceTotals.absent} absent · ${attendanceTotals.late} late`],
      ],
      columns: ['Student', 'Gradebook', 'Final', 'Letter', 'Attendance', 'Teacher comment'],
      rows: allRows.map((row) => [
        studentName(row.student),
        row.calculated === null ? 'Incomplete' : `${row.calculated}%`,
        row.finalGrade === null ? 'Incomplete' : `${row.finalGrade}%`,
        letterGrade(row.finalGrade),
        `${row.student.analytics?.attendanceSummary?.present ?? 0} P / ${row.student.analytics?.attendanceSummary?.absent ?? 0} A / ${row.student.analytics?.attendanceSummary?.late ?? 0} L`,
        row.draft.teacherComment || 'Pending',
      ]),
      orientation: 'landscape',
    })
    if (!created) setError('Allow pop-ups to open the controlled report-card preview.')
  }

  if (loading) return <div className={panel}><Clock3 className='mr-2 inline animate-spin' />Loading official report-card data...</div>

  return <section className='space-y-6'>
    <div className='rounded-3xl bg-gradient-to-br from-kcs-blue-950 via-kcs-blue-800 to-kcs-blue-700 p-6 text-white shadow-xl'>
      <div className='flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between'>
        <div>
          <p className='flex items-center gap-2 text-xs font-black uppercase tracking-[.18em] text-kcs-gold-300'><ShieldCheck size={17} />KCS official academic workflow</p>
          <h2 className='mt-2 font-display text-2xl font-bold sm:text-3xl'>Report Card Command Center</h2>
          <p className='mt-2 max-w-3xl text-sm leading-relaxed text-blue-100'>Gradebook results flow into an auditable draft. Attendance is synchronized automatically; teachers add professional comments, then administration reviews, locks and publishes the official record.</p>
        </div>
        <button className='inline-flex items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-bold hover:bg-white/20' onClick={() => void load()}><RefreshCw size={16} />Refresh official data</button>
      </div>
      <div className='mt-6 grid gap-2 sm:grid-cols-5'>
        {[
          ['1', 'Gradebook', true],
          ['2', 'Teacher draft', !locked],
          ['3', 'Submitted', submittedCount > 0],
          ['4', 'Admin approval', rows.some((row) => row.card?.publicationStatus === 'APPROVED')],
          ['5', 'Portal publication', rows.some((row) => row.card?.publicationStatus === 'POSTED_TO_PORTAL')],
        ].map(([step, label, active]) => <div key={String(step)} className={`rounded-xl border p-3 ${active ? 'border-kcs-gold-300 bg-white/15' : 'border-white/15 bg-black/10'}`}><span className='text-xs font-black text-kcs-gold-300'>{step}</span><p className='mt-1 text-xs font-semibold'>{label}</p></div>)}
      </div>
    </div>

    {(notice || error) && <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${error ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200' : 'border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-200'}`}>{error || notice}</div>}

    <div className={panel}>
      <div className='grid gap-3 lg:grid-cols-[1.25fr_.7fr_.9fr_1fr]'>
        <label className='text-xs font-bold uppercase text-gray-400'>My assigned subject<select className={`${field} mt-1 normal-case`} value={course?.id ?? ''} onChange={(event) => setCourseId(event.target.value)}>{courses.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name} · {item.grade}</option>)}</select></label>
        <label className='text-xs font-bold uppercase text-gray-400'>Academic year<input className={`${field} mt-1 normal-case`} value={academicYear} onChange={(event) => setAcademicYear(event.target.value)} pattern='\d{4}-\d{4}' /></label>
        <label className='text-xs font-bold uppercase text-gray-400'>Report session<select className={`${field} mt-1 normal-case`} value={term} onChange={(event) => setTerm(event.target.value)}>{sessions.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className='text-xs font-bold uppercase text-gray-400'>Search<input className={`${field} mt-1 normal-case`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder='Name or student number' /></label>
      </div>
        <div className='mt-4 grid gap-3 border-t border-gray-100 pt-4 lg:grid-cols-[auto_220px_1fr_auto] dark:border-kcs-blue-800'>
          <div className='flex rounded-xl bg-gray-100 p-1 dark:bg-kcs-blue-800/60'>
            <button type='button' onClick={() => setViewMode('spreadsheet')} className={`rounded-lg px-3 py-2 text-xs font-bold ${viewMode === 'spreadsheet' ? 'bg-white text-kcs-blue-900 shadow dark:bg-kcs-blue-950 dark:text-white' : 'text-gray-500 dark:text-gray-300'}`}>Quick entry grid</button>
            <button type='button' onClick={() => setViewMode('cards')} className={`rounded-lg px-3 py-2 text-xs font-bold ${viewMode === 'cards' ? 'bg-white text-kcs-blue-900 shadow dark:bg-kcs-blue-950 dark:text-white' : 'text-gray-500 dark:text-gray-300'}`}>Detailed cards</button>
          </div>
          <label className='text-[10px] font-bold uppercase text-gray-400'>Row status
            <select className={`${field} mt-1 normal-case`} value={rowFilter} onChange={(event) => setRowFilter(event.target.value as typeof rowFilter)}>
              <option value='all'>All learners</option><option value='incomplete'>Incomplete</option><option value='ready'>Ready to submit</option><option value='submitted'>Submitted</option>
            </select>
          </label>
          <label className='text-[10px] font-bold uppercase text-gray-400'>Apply a professional comment to visible rows
            <select className={`${field} mt-1 normal-case`} value={bulkComment} onChange={(event) => setBulkComment(event.target.value)}>
              <option value=''>Choose from the comment bank</option>{commentBank.map((comment) => <option key={comment} value={comment}>{comment}</option>)}
            </select>
          </label>
          <button type='button' disabled={locked || !bulkComment || !rows.length} onClick={applyBulkComment} className='self-end rounded-xl bg-kcs-gold-400 px-4 py-2.5 text-sm font-bold text-kcs-blue-950 hover:bg-kcs-gold-300 disabled:cursor-not-allowed disabled:opacity-40'>Apply to {rows.length}</button>
        </div>
        <p className='mt-3 text-xs text-gray-500 dark:text-gray-400'>Quick entry provides spreadsheet-style work; detailed cards preserve conduct, recommendations, comment bank, override audit and attendance details.</p>
      {!courses.length && <p className='mt-4 rounded-xl bg-amber-50 p-4 text-sm font-semibold text-amber-800 dark:bg-amber-950/30 dark:text-amber-200'>No subject exists in My Courses or in the official teacher assignment yet.</p>}
      {course && <p className='mt-4 flex items-center gap-2 rounded-xl bg-kcs-blue-50 px-4 py-3 text-xs font-semibold text-kcs-blue-800 dark:bg-kcs-blue-900/40 dark:text-kcs-blue-200'><ShieldCheck size={15} />Live sources: My Courses, Orbit student registry, Teacher Gradebook and Attendance. No sample roster is used.</p>}
    </div>

    <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-6'>
      {[
        [Users, 'Learners', allRows.length],
        [FileCheck2, 'Grades ready', `${readyCount}/${allRows.length}`],
        [CheckCircle2, 'Submitted', `${submittedCount}/${allRows.length}`],
        [TrendingUp, 'Class average', classAverage === null ? 'N/A' : `${classAverage}%`],
        [ShieldCheck, 'Passing ≥70%', `${passingCount}/${gradedRows.length}`],
        [GraduationCap, 'Present', attendanceTotals.present],
      ].map(([Icon, label, value]) => {
        const CardIcon = Icon as typeof Users
        return <div key={String(label)} className={panel}><CardIcon size={19} className='text-kcs-blue-600 dark:text-kcs-blue-300' /><p className='mt-3 font-display text-2xl font-bold text-kcs-blue-950 dark:text-white'>{String(value)}</p><p className='text-xs font-semibold text-gray-500'>{String(label)}</p></div>
      })}
    </div>

    <div className={panel}>
      <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
        <div><h3 className='font-bold text-kcs-blue-950 dark:text-white'>Learner report-card drafts</h3><p className='mt-1 text-sm text-gray-500'>Only students enrolled in the selected assigned subject are shown.</p></div>
        {locked && <span className='inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200'><LockKeyhole size={14} />Submitted · read-only</span>}
      </div>

      {viewMode === 'cards' ? <div className='mt-5 space-y-4'>
        {rows.map((row) => {
          const attendance = row.student.analytics?.attendanceSummary
          const overrideChanged = row.draft.overrideValue.trim() !== '' && row.finalGrade !== row.calculated
          return <article key={row.student.id} className='rounded-2xl border border-gray-100 bg-gray-50/70 p-4 dark:border-kcs-blue-800 dark:bg-kcs-blue-950/40'>
            <div className='flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between'>
              <div><p className='font-bold text-kcs-blue-950 dark:text-white'>{studentName(row.student)}</p><p className='text-xs text-gray-500'>{row.student.studentNumber} · {row.student.grade}{row.student.section ?? ''}</p></div>
              <div className='flex flex-wrap gap-2 text-xs font-bold'>
                <span className='rounded-full bg-white px-3 py-1.5 text-kcs-blue-700 shadow-sm dark:bg-kcs-blue-900 dark:text-kcs-blue-200'>Gradebook: {row.calculated === null ? 'Incomplete' : `${row.calculated}% · ${letterGrade(row.calculated)}`}</span>
                <span className={`rounded-full px-3 py-1.5 ${overrideChanged ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-200' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200'}`}>Final: {row.finalGrade === null ? 'Incomplete' : `${row.finalGrade}% · ${letterGrade(row.finalGrade)}`}{overrideChanged ? ' · override' : ''}</span>
                <span className='rounded-full bg-kcs-gold-100 px-3 py-1.5 text-kcs-blue-900'>{statusLabel(row.card, Boolean(row.submission))}</span>
              </div>
            </div>

            <div className='mt-4 grid gap-3 xl:grid-cols-[.55fr_.85fr_1.35fr]'>
              <div className='rounded-xl bg-white p-3 text-xs text-gray-600 shadow-sm dark:bg-kcs-blue-900 dark:text-gray-300'>
                <p className='font-bold text-kcs-blue-900 dark:text-white'>Attendance · auto</p>
                <div className='mt-2 grid grid-cols-3 gap-1 text-center'><span>{attendance?.present ?? 0}<small className='block text-[10px]'>Present</small></span><span>{attendance?.absent ?? 0}<small className='block text-[10px]'>Absent</small></span><span>{attendance?.late ?? 0}<small className='block text-[10px]'>Late</small></span></div>
              </div>
              <div className='grid gap-2'>
                <label className='text-[10px] font-bold uppercase text-gray-400'>Manual final grade · exceptional<input disabled={locked} className={field} type='number' min={0} max={100} value={row.draft.overrideValue} onChange={(event) => updateEntry(row.student.id, { overrideValue: event.target.value })} placeholder={row.calculated === null ? '0–100' : String(row.calculated)} /></label>
                {row.draft.overrideValue.trim() !== '' && <label className='text-[10px] font-bold uppercase text-red-500'>Required audit reason<input disabled={locked} className={field} value={row.draft.overrideReason} onChange={(event) => updateEntry(row.student.id, { overrideReason: event.target.value })} placeholder='Make-up exam, approved accommodation...' /></label>}
              </div>
              <div className='grid gap-2'>
                <textarea disabled={locked} className={field} rows={2} maxLength={400} value={row.draft.teacherComment} onChange={(event) => updateEntry(row.student.id, { teacherComment: event.target.value })} placeholder='Academic comment' />
                <div className='grid gap-2 sm:grid-cols-2'><input disabled={locked} className={field} maxLength={250} value={row.draft.conduct} onChange={(event) => updateEntry(row.student.id, { conduct: event.target.value })} placeholder='Conduct / learning habits' /><input disabled={locked} className={field} maxLength={300} value={row.draft.recommendation} onChange={(event) => updateEntry(row.student.id, { recommendation: event.target.value })} placeholder='Recommendation / next step' /></div>
              </div>
            </div>
            {!locked && <div className='mt-3 flex flex-wrap items-center gap-2'><span className='flex items-center gap-1 text-[10px] font-bold uppercase text-gray-400'><MessageSquareText size={13} />Comment bank</span>{commentBank.map((comment, index) => <button type='button' key={comment} title={comment} onClick={() => updateEntry(row.student.id, { teacherComment: comment })} className='rounded-lg border border-kcs-blue-100 bg-white px-2.5 py-1.5 text-xs font-semibold text-kcs-blue-700 hover:bg-kcs-blue-50 dark:border-kcs-blue-700 dark:bg-kcs-blue-900 dark:text-kcs-blue-200'>C{index + 1}</button>)}</div>}
          </article>
        })}
        {!rows.length && <div className='py-10 text-center text-sm text-gray-500'>
          <p>{allRows.length ? 'No learner matches the current search and status filter.' : 'No learner is enrolled in this subject yet.'}</p>
          {allRows.length ? <button type='button' onClick={resetRowFilters} className='mt-3 rounded-xl bg-kcs-blue-700 px-4 py-2 text-xs font-bold text-white'>Reset filters</button> : <a href='/portal/teacher/courses' className='mt-3 inline-flex rounded-xl bg-kcs-blue-700 px-4 py-2 text-xs font-bold text-white'>Open Subject Enrollment</a>}
        </div>}
      </div> : (
        <div className='mt-5 overflow-hidden rounded-2xl border border-gray-200 dark:border-kcs-blue-700'>
          <div className='overflow-x-auto'>
            <table className='w-full min-w-[1180px] text-sm'>
              <thead className='bg-kcs-blue-950 text-left text-[10px] font-black uppercase tracking-wide text-white'>
                <tr>
                  <th className='sticky left-0 z-10 bg-kcs-blue-950 px-4 py-3'>Learner</th>
                  <th className='px-3 py-3'>Gradebook</th>
                  <th className='px-3 py-3'>Final / override</th>
                  <th className='px-3 py-3'>Override audit reason</th>
                  <th className='px-3 py-3'>Attendance</th>
                  <th className='px-3 py-3'>Teacher comment</th>
                  <th className='bg-kcs-blue-800 px-3 py-3 text-white dark:bg-kcs-gold-300 dark:text-kcs-blue-950'>Workflow status</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-gray-100 dark:divide-kcs-blue-800'>
                {rows.map((row) => {
                  const attendance = row.student.analytics?.attendanceSummary
                  const overrideChanged = row.draft.overrideValue.trim() !== '' && row.finalGrade !== row.calculated
                  return <tr key={row.student.id} className='align-top bg-white dark:bg-kcs-blue-950/50'>
                    <td className='sticky left-0 z-[1] min-w-56 bg-white px-4 py-3 dark:bg-kcs-blue-950'>
                      <p className='font-bold text-kcs-blue-950 dark:text-white'>{studentName(row.student)}</p>
                      <p className='mt-1 text-xs text-gray-500'>{row.student.studentNumber} · {row.student.grade}{row.student.section ?? ''}</p>
                    </td>
                    <td className='px-3 py-3 font-bold text-kcs-blue-800 dark:text-kcs-blue-200'>
                      {row.calculated === null ? 'Incomplete' : `${row.calculated}% · ${letterGrade(row.calculated)}`}
                    </td>
                    <td className='min-w-36 px-3 py-3'>
                      <input aria-label={`Final grade for ${studentName(row.student)}`} disabled={locked} className={field} type='number' min={0} max={100} value={row.draft.overrideValue} placeholder={row.calculated === null ? '0–100' : String(row.calculated)} onChange={(event) => updateEntry(row.student.id, { overrideValue: event.target.value })} />
                      <p className={`mt-1 text-[10px] font-bold ${overrideChanged ? 'text-red-600 dark:text-red-300' : 'text-emerald-600 dark:text-emerald-300'}`}>{row.finalGrade === null ? 'Grade required' : `${letterGrade(row.finalGrade)} · ${overrideChanged ? 'manual override' : 'calculated'}`}</p>
                    </td>
                    <td className='min-w-56 px-3 py-3'>
                      <input aria-label={`Override reason for ${studentName(row.student)}`} disabled={locked || !row.draft.overrideValue.trim()} className={field} value={row.draft.overrideReason} onChange={(event) => updateEntry(row.student.id, { overrideReason: event.target.value })} placeholder={overrideChanged ? 'Required justification' : 'No override'} />
                    </td>
                    <td className='min-w-44 px-3 py-3 text-xs text-gray-600 dark:text-gray-300'>
                      <p className='font-bold text-kcs-blue-900 dark:text-white'>{attendance?.attendanceRate == null ? 'Not measured' : `${attendance.attendanceRate}%`}</p>
                      <p className='mt-1'>{attendance?.present ?? 0} P · {attendance?.absent ?? 0} A · {attendance?.late ?? 0} L</p>
                    </td>
                    <td className='min-w-72 px-3 py-3'>
                      <textarea aria-label={`Teacher comment for ${studentName(row.student)}`} disabled={locked} className={field} rows={2} maxLength={400} value={row.draft.teacherComment} onChange={(event) => updateEntry(row.student.id, { teacherComment: event.target.value })} placeholder='Professional academic comment' />
                    </td>
                    <td className='min-w-44 bg-kcs-gold-50/80 px-3 py-3 dark:bg-kcs-blue-900'><span className='inline-flex rounded-full bg-kcs-gold-100 px-3 py-1.5 text-xs font-bold text-kcs-blue-900 ring-1 ring-kcs-gold-300 dark:bg-kcs-gold-300 dark:text-kcs-blue-950 dark:ring-kcs-gold-200'>{statusLabel(row.card, Boolean(row.submission))}</span></td>
                  </tr>
                })}
                {!rows.length && <tr><td colSpan={7} className='px-4 py-12 text-center text-sm text-gray-500 dark:text-gray-300'>
                  <p>{allRows.length ? 'No learner matches the current search and status filter.' : 'No learner is enrolled in this subject yet.'}</p>
                  {allRows.length ? <button type='button' onClick={resetRowFilters} className='mt-3 rounded-xl bg-kcs-blue-700 px-4 py-2 text-xs font-bold text-white'>Reset filters</button> : <a href='/portal/teacher/courses' className='mt-3 inline-flex rounded-xl bg-kcs-blue-700 px-4 py-2 text-xs font-bold text-white'>Open Subject Enrollment</a>}
                </td></tr>}
              </tbody>
            </table>
          </div>
          <div className='flex flex-col gap-1 border-t border-gray-100 bg-gray-50 px-4 py-3 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50 dark:text-gray-300'>
            <span>{rows.length} visible of {allRows.length} enrolled learners</span>
            <span>Calculated grades remain traceable; every manual override requires an audit reason before submission.</span>
          </div>
        </div>
      )}
    </div>

    <div className='sticky bottom-4 z-20 flex flex-col gap-3 rounded-2xl border border-kcs-blue-200 bg-white/95 p-4 shadow-2xl backdrop-blur dark:border-kcs-blue-700 dark:bg-kcs-blue-950/95 sm:flex-row sm:items-center sm:justify-between'>
      <div><p className='text-sm font-bold text-kcs-blue-950 dark:text-white'>{locked ? 'This session has been submitted and is protected.' : 'Save drafts freely; submission creates the controlled administrative record.'}</p><p className='text-xs text-gray-500'>Admin approval and publication remain separate institutional actions.</p></div>
      <div className='flex flex-wrap gap-2'>
        <button className='inline-flex items-center gap-2 rounded-xl border border-kcs-blue-200 px-4 py-2.5 text-sm font-bold text-kcs-blue-700 dark:border-kcs-blue-700 dark:text-kcs-blue-200' onClick={() => setPreviewOpen(true)}><Eye size={16} />Preview</button>
        <button className='inline-flex items-center gap-2 rounded-xl border border-kcs-blue-200 px-4 py-2.5 text-sm font-bold text-kcs-blue-700 disabled:opacity-40 dark:border-kcs-blue-700 dark:text-kcs-blue-200' disabled={saving || locked} onClick={() => void persistDrafts()}><Save size={16} />Save draft</button>
        <button className={primary} disabled={saving || locked || !allRows.length || readyCount !== allRows.length} onClick={() => void submit()}><Send size={16} />Submit to administration</button>
      </div>
    </div>

    {previewOpen && <div className='fixed inset-0 z-[80] flex items-center justify-center bg-kcs-blue-950/80 p-4 backdrop-blur-sm'>
      <div className='max-h-[92vh] w-full max-w-5xl overflow-auto rounded-3xl bg-white p-6 shadow-2xl dark:bg-kcs-blue-900'>
        <div className='flex items-start justify-between gap-3'><div><p className='text-xs font-black uppercase tracking-[.18em] text-red-600'>Draft — not official</p><h3 className='mt-1 text-xl font-bold text-kcs-blue-950 dark:text-white'>{course?.code} · {course?.name}</h3><p className='text-sm text-gray-500'>{academicYear} · {term}</p></div><button aria-label='Close preview' onClick={() => setPreviewOpen(false)}><X size={20} /></button></div>
        <div className='mt-5 overflow-x-auto'><table className='min-w-[820px] w-full text-sm'><thead><tr className='border-b text-left text-xs uppercase text-gray-400'><th className='pb-3'>Student</th><th>Gradebook</th><th>Final</th><th>Attendance</th><th>Comment</th><th>Status</th></tr></thead><tbody>{allRows.map((row) => <tr key={row.student.id} className='border-b align-top dark:border-kcs-blue-800'><td className='py-3 font-bold dark:text-white'>{studentName(row.student)}</td><td>{row.calculated === null ? 'Incomplete' : `${row.calculated}%`}</td><td className='font-bold'>{row.finalGrade === null ? 'Incomplete' : `${row.finalGrade}% · ${letterGrade(row.finalGrade)}`}</td><td>{row.student.analytics?.attendanceSummary?.present ?? 0} P / {row.student.analytics?.attendanceSummary?.absent ?? 0} A / {row.student.analytics?.attendanceSummary?.late ?? 0} L</td><td className='max-w-xs'>{row.draft.teacherComment || 'Pending'}</td><td>{statusLabel(row.card, Boolean(row.submission))}</td></tr>)}</tbody></table></div>
        <div className='mt-5 flex justify-end gap-2'><button className='rounded-xl border px-4 py-2 text-sm font-bold dark:border-kcs-blue-700 dark:text-white' onClick={() => setPreviewOpen(false)}>Close</button><button className={primary} onClick={exportPreview}><Sparkles size={16} />Print controlled preview</button></div>
      </div>
    </div>}
  </section>
}

export default function TeacherReportCards() {
  const [mode, setMode] = useState<'learner' | 'subject'>('learner')
  return <div className='space-y-5'>
    <div className='inline-flex rounded-2xl border border-kcs-blue-100 bg-white p-1 shadow-sm dark:border-kcs-blue-800 dark:bg-kcs-blue-900'>
      <button type='button' onClick={() => setMode('learner')} className={`rounded-xl px-4 py-2 text-sm font-bold ${mode === 'learner' ? 'bg-kcs-blue-700 text-white' : 'text-kcs-blue-700 dark:text-kcs-blue-200'}`}>Complete learner report cards</button>
      <button type='button' onClick={() => setMode('subject')} className={`rounded-xl px-4 py-2 text-sm font-bold ${mode === 'subject' ? 'bg-kcs-blue-700 text-white' : 'text-kcs-blue-700 dark:text-kcs-blue-200'}`}>My subject grade submission</button>
    </div>
    {mode === 'learner' ? <TeacherWholeSchoolReportCards /> : <SubjectGradeSubmission />}
  </div>
}
