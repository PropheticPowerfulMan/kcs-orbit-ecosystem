import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Clock3, FileCheck2, GraduationCap, RefreshCw, Save, Search, Send, ShieldCheck, UserRoundCheck, Users } from 'lucide-react'
import { academicRecordsAPI } from '@/services/api'
import { canonicalClassLabel, compareClassLabels } from '@/utils/classLabels'

type SubjectContribution = {
  courseId: string
  courseName: string
  courseCode: string
  credits: number
  teacherName: string
  percentage: number | null
  letterGrade: string | null
  submittedAt: string | null
}

type LearnerRecord = {
  id: string
  studentNumber: string
  name: string
  grade: string
  section: string
  isHomeroomStudent: boolean
  subjects: SubjectContribution[]
  expectedSubjectCount: number
  submittedSubjectCount: number
  allSubjectsSubmitted: boolean
  average: number | null
  attendance: { total: number; present: number; absent: number; late: number; excused: number; sick: number; suspended: number; attendanceRate: number | null }
  reportCard: { id: string; teacherComment?: string | null; conduct?: string | null; principalStatus: string; publicationStatus: string } | null
}

type Dashboard = {
  teacher: { name: string; status: string; homeroomGrade?: string | null; homeroomSection?: string | null }
  learners: LearnerRecord[]
  hierarchy: Record<string, string>
}

const sessions = ['Semester 1 · Trimester 1', 'Semester 1 · Trimester 2', 'Semester 2 · Trimester 3', 'Annual final']
const panel = 'rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50'
const field = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-kcs-blue-950 outline-none focus:border-kcs-blue-500 dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white'

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
  return value >= 60 ? 'D' : 'F'
}

const workflowLabel = (learner: LearnerRecord) => {
  const status = learner.reportCard?.publicationStatus
  if (status === 'POSTED_TO_PORTAL') return 'Published'
  if (status === 'APPROVED') return 'Approved'
  if (status === 'READY_FOR_REVIEW') return 'Administrative review'
  if (status === 'DRAFT') return 'Main-teacher draft'
  return learner.allSubjectsSubmitted ? 'Ready for main teacher' : 'Waiting for subject grades'
}

export default function TeacherWholeSchoolReportCards() {
  const [academicYear, setAcademicYear] = useState('2026-2027')
  const [term, setTerm] = useState(sessions[0])
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [selectedId, setSelectedId] = useState('')
  const [query, setQuery] = useState('')
  const [classFilter, setClassFilter] = useState('All classes')
  const [statusFilter, setStatusFilter] = useState<'all' | 'waiting' | 'ready' | 'homeroom' | 'submitted'>('all')
  const [teacherComment, setTeacherComment] = useState('')
  const [conduct, setConduct] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await academicRecordsAPI.teacherReportDashboard({ academicYear, term })
      const next = response.data?.data as Dashboard
      setDashboard(next)
      setSelectedId((current) => next.learners.some((learner) => learner.id === current) ? current : (next.learners.find((learner) => learner.isHomeroomStudent)?.id ?? next.learners[0]?.id ?? ''))
    } catch (reason: any) {
      setError(reason?.response?.data?.message ?? 'The whole-school report-card workspace could not be loaded.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [academicYear, term])

  const learners = dashboard?.learners ?? []
  const classes = useMemo(() => Array.from(new Set(learners.map((learner) => canonicalClassLabel(learner.grade, learner.section)))).sort(compareClassLabels), [learners])
  const visibleLearners = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return learners.filter((learner) => {
      const className = canonicalClassLabel(learner.grade, learner.section)
      const matchesQuery = !normalizedQuery || `${learner.name} ${learner.studentNumber} ${className}`.toLowerCase().includes(normalizedQuery)
      const matchesClass = classFilter === 'All classes' || className === classFilter
      const matchesStatus = statusFilter === 'all'
        || (statusFilter === 'waiting' && !learner.allSubjectsSubmitted)
        || (statusFilter === 'ready' && learner.allSubjectsSubmitted && (!learner.reportCard || learner.reportCard.publicationStatus === 'DRAFT'))
        || (statusFilter === 'homeroom' && learner.isHomeroomStudent)
        || (statusFilter === 'submitted' && Boolean(learner.reportCard && learner.reportCard.publicationStatus !== 'DRAFT'))
      return matchesQuery && matchesClass && matchesStatus
    }).sort((left, right) => compareClassLabels(canonicalClassLabel(left.grade, left.section), canonicalClassLabel(right.grade, right.section)) || left.name.localeCompare(right.name, 'fr', { sensitivity: 'base' }))
  }, [classFilter, learners, query, statusFilter])

  const selected = learners.find((learner) => learner.id === selectedId) ?? visibleLearners[0]
  useEffect(() => {
    setTeacherComment(selected?.reportCard?.teacherComment ?? '')
    setConduct(selected?.reportCard?.conduct ?? '')
    setNotice('')
    setError('')
  }, [selected?.id, term])

  const locked = Boolean(selected?.reportCard && selected.reportCard.publicationStatus !== 'DRAFT')
  const updateReport = async (submit: boolean) => {
    if (!selected) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const payload = { academicYear, term, teacherComment, conduct }
      if (submit) await academicRecordsAPI.submitTeacherReport(selected.id, payload)
      else await academicRecordsAPI.saveTeacherReportDraft(selected.id, payload)
      setNotice(submit ? 'The complete report card was submitted to Super Administration.' : 'The main-teacher draft was saved in KCS Nexus.')
      await load()
    } catch (reason: any) {
      setError(reason?.response?.data?.message ?? 'The report-card operation failed.')
    } finally {
      setSaving(false)
    }
  }

  const homeroomCount = learners.filter((learner) => learner.isHomeroomStudent).length
  const readyCount = learners.filter((learner) => learner.allSubjectsSubmitted).length
  const submittedCount = learners.filter((learner) => learner.reportCard && learner.reportCard.publicationStatus !== 'DRAFT').length

  if (loading && !dashboard) return <div className={panel}><Clock3 className='mr-2 inline animate-spin' />Loading the whole-school report-card register...</div>

  return <section className='space-y-5'>
    <div className='rounded-3xl bg-gradient-to-br from-kcs-blue-950 via-kcs-blue-800 to-kcs-blue-700 p-6 text-white shadow-xl'>
      <div className='flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between'>
        <div>
          <p className='flex items-center gap-2 text-xs font-black uppercase tracking-[.18em] text-kcs-gold-300'><ShieldCheck size={17} />Collaborative official report cards</p>
          <h2 className='mt-2 font-display text-2xl font-bold'>One learner, every subject teacher, one controlled report card</h2>
          <p className='mt-2 max-w-4xl text-sm text-blue-100'>Every subject grade comes from the responsible teacher's My Courses Gradebook. The main teacher reviews the complete class record, adds the institutional comment, and submits it. Super Administration alone approves, publishes, and controls Grade 9-12 transcripts.</p>
        </div>
        <button type='button' onClick={() => void load()} className='inline-flex items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-bold hover:bg-white/20'><RefreshCw size={16} />Refresh official data</button>
      </div>
      <div className='mt-5 grid gap-2 sm:grid-cols-3'>
        {Object.entries(dashboard?.hierarchy ?? {}).map(([role, detail], index) => <div key={role} className='rounded-xl border border-white/20 bg-white/10 p-3'><span className='text-xs font-black text-kcs-gold-300'>{index + 1}</span><p className='mt-1 text-xs font-bold capitalize'>{role.replace(/([A-Z])/g, ' $1')}</p><p className='mt-1 text-[11px] text-blue-100'>{detail}</p></div>)}
      </div>
    </div>

    {(notice || error) && <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${error ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200' : 'border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-200'}`}>{error || notice}</div>}

    <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-5'>
      {[
        [Users, 'School learners', learners.length],
        [UserRoundCheck, 'My homeroom', homeroomCount],
        [FileCheck2, 'All subjects ready', readyCount],
        [Send, 'In admin workflow', submittedCount],
        [GraduationCap, 'Pass standard', '≥70%'],
      ].map(([Icon, label, value]) => {
        const CardIcon = Icon as typeof Users
        return <div key={String(label)} className={panel}><CardIcon size={18} className='text-kcs-blue-600 dark:text-kcs-blue-300' /><p className='mt-2 font-display text-2xl font-bold text-kcs-blue-950 dark:text-white'>{String(value)}</p><p className='text-xs font-semibold text-gray-500'>{String(label)}</p></div>
      })}
    </div>

    <div className={panel}>
      <div className='grid gap-3 lg:grid-cols-5'>
        <label className='text-xs font-bold uppercase text-gray-400'>Academic year<input className={`${field} mt-1 normal-case`} value={academicYear} onChange={(event) => setAcademicYear(event.target.value)} /></label>
        <label className='text-xs font-bold uppercase text-gray-400'>Report session<select className={`${field} mt-1 normal-case`} value={term} onChange={(event) => setTerm(event.target.value)}>{sessions.map((session) => <option key={session}>{session}</option>)}</select></label>
        <label className='text-xs font-bold uppercase text-gray-400'>Class<select className={`${field} mt-1 normal-case`} value={classFilter} onChange={(event) => setClassFilter(event.target.value)}><option>All classes</option>{classes.map((className) => <option key={className}>{className}</option>)}</select></label>
        <label className='text-xs font-bold uppercase text-gray-400'>Workflow<select className={`${field} mt-1 normal-case`} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}><option value='all'>All learners</option><option value='waiting'>Waiting for grades</option><option value='ready'>Ready for main teacher</option><option value='homeroom'>My homeroom only</option><option value='submitted'>Submitted or published</option></select></label>
        <label className='text-xs font-bold uppercase text-gray-400'>Search<div className='relative mt-1'><Search className='absolute left-3 top-3 text-gray-400' size={15} /><input className={`${field} pl-9 normal-case`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder='Name or student number' /></div></label>
      </div>
    </div>

    <div className='grid gap-5 xl:grid-cols-[360px_1fr]'>
      <div className={`${panel} max-h-[760px] overflow-auto p-3`}>
        <div className='mb-3 flex items-center justify-between px-2'><h3 className='font-bold text-kcs-blue-950 dark:text-white'>Learner directory</h3><span className='text-xs font-bold text-gray-500'>{visibleLearners.length}</span></div>
        <div className='space-y-2'>
          {visibleLearners.map((learner) => <button type='button' key={learner.id} onClick={() => setSelectedId(learner.id)} className={`w-full rounded-xl border p-3 text-left transition ${selected?.id === learner.id ? 'border-kcs-blue-500 bg-kcs-blue-50 ring-2 ring-kcs-blue-100 dark:bg-kcs-blue-950' : 'border-gray-100 hover:border-kcs-blue-200 dark:border-kcs-blue-800'}`}>
            <div className='flex items-start justify-between gap-2'><div><p className='text-sm font-bold text-kcs-blue-950 dark:text-white'>{learner.name}</p><p className='text-xs text-gray-500'>{learner.studentNumber} · {canonicalClassLabel(learner.grade, learner.section)}</p></div>{learner.isHomeroomStudent && <UserRoundCheck size={17} className='text-emerald-600' />}</div>
            <div className='mt-2 flex items-center justify-between text-[11px] font-semibold'><span className={learner.allSubjectsSubmitted ? 'text-emerald-600' : 'text-amber-600'}>{learner.submittedSubjectCount}/{learner.expectedSubjectCount} subjects</span><span className='text-kcs-blue-600 dark:text-kcs-blue-300'>{workflowLabel(learner)}</span></div>
          </button>)}
          {!visibleLearners.length && <p className='p-6 text-center text-sm text-gray-500'>No learner matches these filters.</p>}
        </div>
      </div>

      <div className={panel}>
        {!selected ? <p className='py-16 text-center text-sm text-gray-500'>Select a learner to open the complete report-card file.</p> : <>
          <div className='flex flex-col gap-3 border-b border-gray-100 pb-4 sm:flex-row sm:items-start sm:justify-between dark:border-kcs-blue-800'>
            <div><p className='text-xs font-black uppercase tracking-wide text-kcs-gold-600'>Complete learner record</p><h3 className='mt-1 font-display text-2xl font-bold text-kcs-blue-950 dark:text-white'>{selected.name}</h3><p className='text-sm text-gray-500'>{selected.studentNumber} · {canonicalClassLabel(selected.grade, selected.section)}</p></div>
            <div className='flex flex-wrap gap-2 text-xs font-bold'><span className='rounded-full bg-kcs-blue-50 px-3 py-1.5 text-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-kcs-blue-200'>{workflowLabel(selected)}</span>{selected.isHomeroomStudent ? <span className='rounded-full bg-emerald-100 px-3 py-1.5 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200'>Main-teacher control</span> : <span className='rounded-full bg-gray-100 px-3 py-1.5 text-gray-600 dark:bg-kcs-blue-800 dark:text-gray-300'>Whole-school read only</span>}</div>
          </div>

          <div className='mt-4 grid gap-3 sm:grid-cols-4'>
            <div className='rounded-xl bg-gray-50 p-3 dark:bg-kcs-blue-950'><p className='text-xs text-gray-500'>Weighted average</p><p className='mt-1 text-xl font-black text-kcs-blue-950 dark:text-white'>{selected.average === null ? 'Pending' : `${selected.average}% · ${letterGrade(selected.average)}`}</p></div>
            <div className='rounded-xl bg-gray-50 p-3 dark:bg-kcs-blue-950'><p className='text-xs text-gray-500'>Course grades</p><p className='mt-1 text-xl font-black text-kcs-blue-950 dark:text-white'>{selected.submittedSubjectCount}/{selected.expectedSubjectCount}</p></div>
            <div className='rounded-xl bg-gray-50 p-3 dark:bg-kcs-blue-950'><p className='text-xs text-gray-500'>Attendance</p><p className='mt-1 text-xl font-black text-kcs-blue-950 dark:text-white'>{selected.attendance.attendanceRate === null ? 'N/A' : `${selected.attendance.attendanceRate}%`}</p></div>
            <div className='rounded-xl bg-gray-50 p-3 dark:bg-kcs-blue-950'><p className='text-xs text-gray-500'>Promotion standard</p><p className={`mt-1 text-xl font-black ${(selected.average ?? 0) >= 70 ? 'text-emerald-600' : 'text-amber-600'}`}>≥70%</p></div>
          </div>

          <div className='mt-5 overflow-hidden rounded-xl border border-gray-200 dark:border-kcs-blue-700'>
            <div className='border-b bg-gray-50 px-4 py-3 dark:border-kcs-blue-700 dark:bg-kcs-blue-950'><h4 className='font-bold text-kcs-blue-950 dark:text-white'>Subject contributions from all teachers</h4><p className='text-xs text-gray-500'>Each row is owned and submitted by the teacher responsible for that course.</p></div>
            <div className='overflow-x-auto'><table className='w-full min-w-[720px] text-sm'><thead className='bg-kcs-blue-950 text-left text-xs uppercase text-white'><tr><th className='px-4 py-3'>Course</th><th className='px-4 py-3'>Teacher</th><th className='px-4 py-3'>Credits</th><th className='px-4 py-3'>Final grade</th><th className='px-4 py-3'>Status</th></tr></thead><tbody className='divide-y divide-gray-100 dark:divide-kcs-blue-800'>{selected.subjects.map((subject) => <tr key={subject.courseId}><td className='px-4 py-3'><b className='text-kcs-blue-950 dark:text-white'>{subject.courseName}</b><small className='block text-gray-500'>{subject.courseCode}</small></td><td className='px-4 py-3 text-gray-600 dark:text-gray-300'>{subject.teacherName}</td><td className='px-4 py-3'>{subject.credits}</td><td className='px-4 py-3 font-bold'>{subject.percentage === null ? 'Pending' : `${subject.percentage}% · ${subject.letterGrade}`}</td><td className='px-4 py-3'>{subject.percentage === null ? <span className='text-amber-600'>Teacher submission required</span> : <span className='text-emerald-600'>Submitted</span>}</td></tr>)}</tbody></table></div>
            {!selected.subjects.length && <p className='p-6 text-center text-sm text-gray-500'>No official course enrollment is linked to this learner yet.</p>}
          </div>

          <div className='mt-5 grid gap-4 lg:grid-cols-[.7fr_1.3fr]'>
            <div className='rounded-xl bg-kcs-blue-50 p-4 dark:bg-kcs-blue-950'><h4 className='font-bold text-kcs-blue-950 dark:text-white'>Attendance summary</h4><div className='mt-3 grid grid-cols-3 gap-2 text-center text-sm'><span><b className='block text-lg text-emerald-600'>{selected.attendance.present}</b>Present</span><span><b className='block text-lg text-red-600'>{selected.attendance.absent}</b>Absent</span><span><b className='block text-lg text-amber-600'>{selected.attendance.late}</b>Late</span></div></div>
            <div className='rounded-xl border border-gray-200 p-4 dark:border-kcs-blue-700'>
              <div className='flex items-center justify-between gap-2'><div><h4 className='font-bold text-kcs-blue-950 dark:text-white'>Main teacher review</h4><p className='text-xs text-gray-500'>Institutional synthesis after every subject teacher has submitted.</p></div><UserRoundCheck className='text-kcs-blue-600' size={20} /></div>
              {!selected.isHomeroomStudent && <p className='mt-3 rounded-xl bg-gray-50 p-3 text-sm text-gray-600 dark:bg-kcs-blue-950 dark:text-gray-300'>You may review this learner's complete report card, but only the assigned main teacher may write or submit the institutional comment.</p>}
              <label className='mt-3 grid gap-1 text-xs font-bold text-kcs-blue-950 dark:text-white'>Main teacher comment<textarea disabled={!selected.isHomeroomStudent || locked} className={`${field} min-h-28 disabled:cursor-not-allowed disabled:opacity-60`} maxLength={1500} value={teacherComment} onChange={(event) => setTeacherComment(event.target.value)} placeholder='Synthesize academic progress, effort, strengths, and the next priority.' /></label>
              <label className='mt-3 grid gap-1 text-xs font-bold text-kcs-blue-950 dark:text-white'>Conduct and learning habits<input disabled={!selected.isHomeroomStudent || locked} className={`${field} disabled:cursor-not-allowed disabled:opacity-60`} maxLength={500} value={conduct} onChange={(event) => setConduct(event.target.value)} placeholder='Conduct, responsibility, collaboration, punctuality...' /></label>
              {selected.isHomeroomStudent && !selected.allSubjectsSubmitted && <p className='mt-3 rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-700 dark:bg-amber-950/30 dark:text-amber-200'>Submission remains locked: {selected.expectedSubjectCount - selected.submittedSubjectCount} subject teacher(s) still need to submit final grades.</p>}
              {selected.isHomeroomStudent && <div className='mt-4 flex flex-wrap justify-end gap-2'><button type='button' disabled={saving || locked} onClick={() => void updateReport(false)} className='inline-flex items-center gap-2 rounded-xl border border-kcs-blue-200 px-4 py-2 text-sm font-bold text-kcs-blue-700 disabled:opacity-40 dark:border-kcs-blue-700 dark:text-kcs-blue-200'><Save size={15} />Save draft</button><button type='button' disabled={saving || locked || !selected.allSubjectsSubmitted || teacherComment.trim().length < 5} onClick={() => void updateReport(true)} className='inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-40'><CheckCircle2 size={15} />Submit to Super Administration</button></div>}
            </div>
          </div>
        </>}
      </div>
    </div>
  </section>
}
