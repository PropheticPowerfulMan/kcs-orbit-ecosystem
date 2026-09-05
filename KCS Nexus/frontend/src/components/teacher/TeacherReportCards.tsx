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

type Student = {
  id: string
  studentNumber: string
  grade: string
  section?: string
  user: { firstName: string; lastName: string }
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

const studentName = (student: Student) =>
  [student.user.lastName, student.user.firstName].filter(Boolean).join(' ').trim() || student.studentNumber

const letterGrade = (value: number | null) => {
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

export default function TeacherReportCards() {
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
      const nextCourses = (overviewResponse.data?.data?.courses ?? []) as Course[]
      const state = workspaceResponse.data?.data?.state as { reportCardWorkflow?: DraftStore } | undefined
      setCourses(nextCourses)
      setCourseId((current) => current || nextCourses[0]?.id || '')
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
        const assessmentGrades = course.grades.filter((grade) => grade.studentId === student.id && grade.assignmentId)
        const calculated = assessmentGrades.length
          ? Number((assessmentGrades.reduce((sum, grade) => sum + grade.percentage, 0) / assessmentGrades.length).toFixed(2))
          : null
        const draft = cycleDrafts[student.id] ?? emptyEntry()
        const override = draft.overrideValue.trim() === '' ? null : Number(draft.overrideValue)
        const submission = submissions.find((item) => item.courseId === course.id && item.studentId === student.id && item.cycle.academicYear === academicYear && item.cycle.term === term)
        const card = reportCards.find((item) => item.studentId === student.id && item.term === officialTerm)
        const draftFinal = override !== null && Number.isFinite(override) ? Math.max(0, Math.min(100, override)) : calculated
        const finalGrade = submission?.percentage ?? draftFinal
        return { student, calculated, draft, finalGrade, submission, card }
      })
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
      {!courses.length && <p className='mt-4 rounded-xl bg-amber-50 p-4 text-sm font-semibold text-amber-800 dark:bg-amber-950/30 dark:text-amber-200'>No official subject is assigned to this teacher account yet.</p>}
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
        {!rows.length && <p className='py-10 text-center text-sm text-gray-500'>No enrolled learner matches this subject and search.</p>}
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
                  <th className='px-3 py-3'>Workflow status</th>
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
                    <td className='min-w-44 px-3 py-3'><span className='inline-flex rounded-full bg-kcs-gold-100 px-3 py-1.5 text-xs font-bold text-kcs-blue-900'>{statusLabel(row.card, Boolean(row.submission))}</span></td>
                  </tr>
                })}
                {!rows.length && <tr><td colSpan={7} className='px-4 py-12 text-center text-sm text-gray-500 dark:text-gray-300'>No enrolled learner matches the current search and status filter.</td></tr>}
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
