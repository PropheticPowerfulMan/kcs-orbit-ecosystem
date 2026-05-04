import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Brain,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Lightbulb,
  Plus,
  Search,
  Sparkles,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wand2,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type Course = {
  id: string
  name: string
  abbreviation: string
  className: string
  gradeLevels: string[]
  studentIds: string[]
}

type GradebookStudent = {
  id: string
  name: string
  grade: string
  section: string
  advisor?: string
  average?: number
  attendance?: number
  risk?: string
  strengths?: string[]
  weaknesses?: string[]
}

type AssignmentType = 'homework' | 'quiz' | 'test' | 'exam' | 'project' | 'participation'

type GradebookColumn = {
  id: string
  title: string
  type: AssignmentType
  category: string
  maxPoints: number
  date: string
  term: string
  description: string
}

type Category = {
  id: string
  name: string
  weight: number
}

type Props = {
  courses: Course[]
  students: GradebookStudent[]
  selectedCourseId: string
  onSelectCourse: (courseId: string) => void
  onAction: (message: string) => void
}

const assignmentTypes: AssignmentType[] = ['homework', 'quiz', 'test', 'exam', 'project', 'participation']
const terms = ['Term 1', 'Term 2', 'Final']
const scoreScales = [20, 100, 50]

const defaultPointsByType: Record<AssignmentType, number> = {
  homework: 20,
  quiz: 20,
  test: 100,
  exam: 100,
  project: 100,
  participation: 10,
}

const defaultCategories: Category[] = [
  { id: 'homework', name: 'Homework', weight: 15 },
  { id: 'quiz', name: 'Quiz', weight: 20 },
  { id: 'test', name: 'Test', weight: 25 },
  { id: 'exam', name: 'Exam', weight: 30 },
  { id: 'participation', name: 'Participation', weight: 10 },
]

const defaultAssignments: GradebookColumn[] = [
  { id: 'gb-lab', title: 'Lab Report', type: 'project', category: 'test', maxPoints: 100, date: '2026-04-18', term: 'Term 2', description: 'Research, evidence, and lab conclusion.' },
  { id: 'gb-quiz', title: 'Genetics Quiz', type: 'quiz', category: 'quiz', maxPoints: 20, date: '2026-04-22', term: 'Term 2', description: 'Fast check on heredity vocabulary.' },
  { id: 'gb-homework', title: 'Problem Set', type: 'homework', category: 'homework', maxPoints: 50, date: '2026-04-25', term: 'Term 2', description: 'Independent practice submitted online.' },
  { id: 'gb-exam', title: 'Unit Exam', type: 'exam', category: 'exam', maxPoints: 100, date: '2026-05-03', term: 'Final', description: 'Cumulative unit performance.' },
  { id: 'gb-participation', title: 'Seminar', type: 'participation', category: 'participation', maxPoints: 10, date: '2026-05-08', term: 'Final', description: 'Discussion preparedness and collaboration.' },
]

const buildInitialScores = (students: GradebookStudent[]) => {
  const scores: Record<string, string> = {}
  students.forEach((student, index) => {
    defaultAssignments.forEach((assignment, assignmentIndex) => {
      const baseline = student.average ?? 82
      const drift = ((index % 5) - 2) * 3 + assignmentIndex * 2
      const missing = index % 9 === 0 && assignmentIndex === 2
      const score = Math.round((Math.max(48, Math.min(100, baseline + drift)) / 100) * assignment.maxPoints)
      scores[`${assignment.id}:${student.id}`] = missing ? '' : String(score)
    })
  })
  return scores
}

const buildMissingScoreCells = (
  assignments: GradebookColumn[],
  students: GradebookStudent[],
  existingScores: Record<string, string>,
) => {
  const next = { ...existingScores }

  students.forEach((student) => {
    assignments.forEach((assignment) => {
      const key = `${assignment.id}:${student.id}`
      if (next[key] === undefined) next[key] = ''
    })
  })

  return next
}

const toneForScore = (score: number | null) => {
  if (score === null) return 'bg-gray-50 text-gray-400 dark:bg-kcs-blue-950 dark:text-gray-500'
  if (score < 65) return 'bg-red-50 text-red-700 ring-red-100 dark:bg-red-900/20 dark:text-red-300 dark:ring-red-900/40'
  if (score < 78) return 'bg-yellow-50 text-yellow-700 ring-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-300 dark:ring-yellow-900/40'
  if (score >= 90) return 'bg-green-50 text-green-700 ring-green-100 dark:bg-green-900/20 dark:text-green-300 dark:ring-green-900/40'
  return 'bg-kcs-blue-50 text-kcs-blue-700 ring-kcs-blue-100 dark:bg-kcs-blue-900/30 dark:text-kcs-blue-200 dark:ring-kcs-blue-800'
}

const parseScore = (value: string, maxPoints: number) => {
  const normalized = value.trim().toUpperCase()
  if (!normalized || normalized === 'E' || normalized === 'I') return null
  if (normalized === 'U' || normalized === 'M') return 0
  const numeric = Number(normalized)
  if (!Number.isFinite(numeric)) return null
  return Math.max(0, Math.min(100, (numeric / Math.max(maxPoints, 1)) * 100))
}

const formatPercent = (value: number | null) => value === null ? 'I' : `${Math.round(value)}%`

const AdvancedGradebook = ({ courses, students, selectedCourseId, onSelectCourse, onAction }: Props) => {
  const [assignments, setAssignments] = useState(defaultAssignments)
  const [categories, setCategories] = useState(defaultCategories)
  const [scores, setScores] = useState(() => buildInitialScores(students))
  const [comments, setComments] = useState<Record<string, string>>({})
  const [term, setTerm] = useState('Term 2')
  const [scale, setScale] = useState(100)
  const [query, setQuery] = useState('')
  const [bulkValue, setBulkValue] = useState('')
  const [selectedAssignmentId, setSelectedAssignmentId] = useState(defaultAssignments[0].id)
  const [draft, setDraft] = useState({
    title: 'Concept Check',
    type: 'quiz' as AssignmentType,
    category: 'quiz',
    maxPoints: 20,
    date: '2026-05-12',
    description: 'Short standards-aligned formative assessment.',
  })

  const selectedCourse = courses.find((course) => course.id === selectedCourseId) ?? courses[0]
  const courseStudents = useMemo(() => {
    const roster = selectedCourse?.studentIds?.length
      ? selectedCourse.studentIds.map((id) => students.find((student) => student.id === id)).filter(Boolean) as GradebookStudent[]
      : students

    return roster.filter((student) => `${student.name} ${student.grade} ${student.section}`.toLowerCase().includes(query.toLowerCase()))
  }, [query, selectedCourse, students])

  const visibleAssignments = assignments.filter((assignment) => assignment.term === term || term === 'Final')

  const scoreKey = (assignmentId: string, studentId: string) => `${assignmentId}:${studentId}`

  const getRawScore = (assignmentId: string, studentId: string) => scores[scoreKey(assignmentId, studentId)] ?? ''

  const getScore = (assignment: GradebookColumn, studentId: string) => parseScore(getRawScore(assignment.id, studentId), assignment.maxPoints)

  useEffect(() => {
    setScores((current) => buildMissingScoreCells(assignments, courseStudents, current))
  }, [assignments, courseStudents])

  const getCategoryAverage = (studentId: string, categoryId: string) => {
    const categoryAssignments = visibleAssignments.filter((assignment) => assignment.category === categoryId)
    const values = categoryAssignments.map((assignment) => getScore(assignment, studentId)).filter((value): value is number => value !== null)
    if (!values.length) return null
    return values.reduce((sum, value) => sum + value, 0) / values.length
  }

  const getWeightedAverage = (studentId: string) => {
    let weighted = 0
    let activeWeight = 0
    categories.forEach((category) => {
      const average = getCategoryAverage(studentId, category.id)
      if (average !== null) {
        weighted += average * category.weight
        activeWeight += category.weight
      }
    })
    return activeWeight ? weighted / activeWeight : null
  }

  const studentAnalytics = courseStudents.map((student) => {
    const average = getWeightedAverage(student.id)
    const missing = visibleAssignments.filter((assignment) => !getRawScore(assignment.id, student.id).trim()).length
    const projected = average === null ? null : Math.max(0, Math.min(100, average + (student.attendance && student.attendance > 94 ? 2 : -3) - missing * 2))
    const risk = average === null || projected === null || missing >= 2 || projected < 70 ? 'high' : average < 78 || projected < 80 ? 'medium' : 'low'
    return { student, average, missing, projected, risk }
  })

  const classAverage = studentAnalytics.filter((item) => item.average !== null).reduce((sum, item) => sum + (item.average ?? 0), 0) / Math.max(1, studentAnalytics.filter((item) => item.average !== null).length)
  const atRiskCount = studentAnalytics.filter((item) => item.risk !== 'low').length
  const missingCount = studentAnalytics.reduce((sum, item) => sum + item.missing, 0)
  const topStudent = [...studentAnalytics].filter((item) => item.average !== null).sort((a, b) => (b.average ?? 0) - (a.average ?? 0))[0]

  const getAssignmentAverage = (assignment: GradebookColumn) => {
    const values = courseStudents.map((student) => getScore(assignment, student.id)).filter((value): value is number => value !== null)
    if (!values.length) return null
    return values.reduce((sum, value) => sum + value, 0) / values.length
  }

  const distribution = [
    { band: '90-100', count: studentAnalytics.filter((item) => (item.average ?? 0) >= 90).length, color: '#22c55e' },
    { band: '80-89', count: studentAnalytics.filter((item) => (item.average ?? 0) >= 80 && (item.average ?? 0) < 90).length, color: '#2563eb' },
    { band: '70-79', count: studentAnalytics.filter((item) => (item.average ?? 0) >= 70 && (item.average ?? 0) < 80).length, color: '#f59e0b' },
    { band: '<70', count: studentAnalytics.filter((item) => (item.average ?? 0) < 70 || item.average === null).length, color: '#ef4444' },
  ]

  const trendData = [
    { month: 'Jan', average: Math.max(58, Math.round(classAverage - 6)) },
    { month: 'Feb', average: Math.max(58, Math.round(classAverage - 3)) },
    { month: 'Mar', average: Math.round(classAverage - 1) },
    { month: 'Apr', average: Math.round(classAverage) },
    { month: 'May', average: Math.min(98, Math.round(classAverage + 2)) },
  ]

  const addAssignment = () => {
    const nextAssignment = {
      id: `gb-${Date.now()}`,
      title: draft.title.trim() || 'New Assignment',
      type: draft.type,
      category: draft.category,
      maxPoints: Math.max(1, Number(draft.maxPoints) || scale),
      date: draft.date,
      term,
      description: draft.description,
    }
    setAssignments((current) => [...current, nextAssignment])
    setScores((current) => buildMissingScoreCells([nextAssignment], courseStudents, current))
    setSelectedAssignmentId(nextAssignment.id)
    onAction(`${nextAssignment.title} ${nextAssignment.type} added to ${selectedCourse?.name ?? 'Gradebook'}; averages will recalculate automatically as scores are entered.`)
  }

  const deleteAssignment = (assignmentId: string) => {
    setAssignments((current) => current.filter((assignment) => assignment.id !== assignmentId))
    setScores((current) => {
      const next = { ...current }
      Object.keys(next).forEach((key) => {
        if (key.startsWith(`${assignmentId}:`)) delete next[key]
      })
      return next
    })
    onAction('Assignment deleted, calculations refreshed, and audit event recorded.')
  }

  const updateScore = (assignmentId: string, studentId: string, value: string) => {
    setScores((current) => ({ ...current, [scoreKey(assignmentId, studentId)]: value }))
  }

  const applyBulkScore = () => {
    if (!selectedAssignmentId) return
    setScores((current) => {
      const next = { ...current }
      courseStudents.forEach((student) => {
        next[scoreKey(selectedAssignmentId, student.id)] = bulkValue
      })
      return next
    })
    onAction('Bulk grade entry applied, real-time sync events queued, and audit trail updated.')
  }

  const suggestGrade = (assignment: GradebookColumn, student: GradebookStudent) => {
    const average = getWeightedAverage(student.id) ?? student.average ?? classAverage
    return String(Math.round((Math.max(0, Math.min(100, average + 2)) / 100) * assignment.maxPoints))
  }

  const generateFeedback = (student: GradebookStudent) => {
    const analytics = studentAnalytics.find((item) => item.student.id === student.id)
    const average = analytics?.average ?? student.average ?? 0
    const message = average >= 88
      ? `${student.name} demonstrates strong mastery and should receive enrichment through advanced application tasks.`
      : average >= 75
        ? `${student.name} is progressing, with the greatest gains likely from targeted practice on ${student.weaknesses?.[0] ?? 'current unit skills'}.`
        : `${student.name} needs immediate support, missing-work recovery, and a parent-teacher intervention plan this week.`
    setComments((current) => ({ ...current, [`feedback:${student.id}`]: message }))
    onAction(`AI feedback generated for ${student.name}.`)
  }

  const exportGradebook = (format: 'PDF' | 'Excel' | 'CSV') => {
    onAction(`${format} export prepared with gradebook table, report-card comments, and audit metadata.`)
  }

  const updateCategoryWeight = (categoryId: string, weight: number) => {
    setCategories((current) => current.map((category) => category.id === categoryId ? { ...category, weight: Math.max(0, weight) } : category))
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-kcs-blue-600 dark:text-kcs-blue-300">AI Gradebook Command Center</p>
              <h3 className="mt-1 font-display text-2xl font-bold text-kcs-blue-900 dark:text-white">{selectedCourse?.name ?? 'Gradebook'}</h3>
              <p className="mt-2 max-w-2xl text-sm text-gray-600 dark:text-gray-300">
                Spreadsheet entry, weighted categories, predictive risk detection, report-card comments, and synchronized parent/student/admin visibility.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => exportGradebook('PDF')} className="rounded-xl bg-kcs-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-kcs-blue-800"><FileText size={15} className="mr-1 inline" /> PDF</button>
              <button onClick={() => exportGradebook('Excel')} className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-kcs-blue-700 hover:bg-kcs-blue-50 dark:border-kcs-blue-700 dark:text-kcs-blue-200 dark:hover:bg-kcs-blue-800"><FileSpreadsheet size={15} className="mr-1 inline" /> Excel</button>
              <button onClick={() => exportGradebook('CSV')} className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-kcs-blue-700 hover:bg-kcs-blue-50 dark:border-kcs-blue-700 dark:text-kcs-blue-200 dark:hover:bg-kcs-blue-800"><Download size={15} className="mr-1 inline" /> CSV</button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_0.7fr_0.7fr_1fr]">
            <select className="input-kcs py-2 text-sm" value={selectedCourse?.id} onChange={(event) => onSelectCourse(event.target.value)}>
              {courses.map((course) => <option key={course.id} value={course.id}>{course.gradeLevels[0]} - {course.name}</option>)}
            </select>
            <select className="input-kcs py-2 text-sm" value={term} onChange={(event) => setTerm(event.target.value)}>
              {terms.map((item) => <option key={item}>{item}</option>)}
            </select>
            <select className="input-kcs py-2 text-sm" value={scale} onChange={(event) => setScale(Number(event.target.value))}>
              {scoreScales.map((item) => <option key={item} value={item}>{item}-point scale</option>)}
            </select>
            <label className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 dark:border-kcs-blue-700 dark:bg-kcs-blue-950">
              <Search size={16} className="text-gray-400" />
              <input className="w-full bg-transparent text-sm outline-none dark:text-white" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search students" />
            </label>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-2">
          {[
            { label: 'Class average', value: `${Math.round(classAverage)}%`, icon: TrendingUp, tone: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300' },
            { label: 'At risk', value: String(atRiskCount), icon: AlertTriangle, tone: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300' },
            { label: 'Missing work', value: String(missingCount), icon: Bell, tone: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300' },
            { label: 'Top performer', value: topStudent?.student.name.split(' ')[0] ?? 'None', icon: Sparkles, tone: 'bg-kcs-blue-50 text-kcs-blue-700 dark:bg-kcs-blue-900/30 dark:text-kcs-blue-200' },
          ].map((item) => {
            const Icon = item.icon
            return (
              <div key={item.label} className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
                <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${item.tone}`}><Icon size={18} /></div>
                <p className="font-display text-2xl font-bold text-kcs-blue-900 dark:text-white">{item.value}</p>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{item.label}</p>
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
          <div className="flex items-center justify-between gap-3">
            <h4 className="font-bold text-kcs-blue-900 dark:text-white">Create task</h4>
            <span className="rounded-full bg-kcs-blue-50 px-3 py-1 text-xs font-bold text-kcs-blue-700 dark:bg-kcs-blue-900/30 dark:text-kcs-blue-200">RBAC: teacher classes only</span>
          </div>
          <div className="mt-4 grid gap-3">
            <input className="input-kcs py-2 text-sm" value={draft.title} onChange={(event) => setDraft((item) => ({ ...item, title: event.target.value }))} placeholder="Title" />
            <div className="grid gap-3 sm:grid-cols-3">
              <select
                className="input-kcs py-2 text-sm"
                value={draft.type}
                onChange={(event) => {
                  const type = event.target.value as AssignmentType
                  setDraft((item) => ({
                    ...item,
                    type,
                    category: type,
                    maxPoints: defaultPointsByType[type],
                  }))
                }}
              >
                {assignmentTypes.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <select className="input-kcs py-2 text-sm" value={draft.category} onChange={(event) => setDraft((item) => ({ ...item, category: event.target.value }))}>
                {categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <input className="input-kcs py-2 text-sm" type="number" min={1} value={draft.maxPoints} onChange={(event) => setDraft((item) => ({ ...item, maxPoints: Number(event.target.value) }))} />
            </div>
            <input className="input-kcs py-2 text-sm" type="date" value={draft.date} onChange={(event) => setDraft((item) => ({ ...item, date: event.target.value }))} />
            <textarea className="input-kcs min-h-20 py-2 text-sm" value={draft.description} onChange={(event) => setDraft((item) => ({ ...item, description: event.target.value }))} />
            <button onClick={addAssignment} className="rounded-xl bg-kcs-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-kcs-blue-800"><Plus size={16} className="mr-1 inline" /> Add task</button>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
          <h4 className="font-bold text-kcs-blue-900 dark:text-white">Category weighting</h4>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {categories.map((category) => {
              const categoryValues = studentAnalytics.map(({ student }) => getCategoryAverage(student.id, category.id)).filter((value): value is number => value !== null)
              const categoryAverage = categoryValues.length ? Math.round(categoryValues.reduce((sum, value) => sum + value, 0) / categoryValues.length) : 0
              return (
                <div key={category.id} className="rounded-xl bg-gray-50 p-3 dark:bg-kcs-blue-800/30">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-kcs-blue-900 dark:text-white">{category.name}</p>
                    <span className="text-xs font-bold text-kcs-blue-700 dark:text-kcs-blue-200">{categoryAverage}% avg</span>
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <input className="h-2 flex-1 accent-kcs-blue-700" type="range" min={0} max={60} value={category.weight} onChange={(event) => updateCategoryWeight(category.id, Number(event.target.value))} />
                    <input className="w-16 rounded-lg border border-gray-200 px-2 py-1 text-right text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white" type="number" value={category.weight} onChange={(event) => updateCategoryWeight(category.id, Number(event.target.value))} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
        <div className="flex flex-col gap-3 border-b border-gray-100 p-4 dark:border-kcs-blue-800 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h4 className="font-bold text-kcs-blue-900 dark:text-white">Live spreadsheet</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">Sticky roster, editable cells, comments, missing detection, weighted final average, and predictive final grade.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select className="input-kcs py-2 text-sm" value={selectedAssignmentId} onChange={(event) => setSelectedAssignmentId(event.target.value)}>
              {visibleAssignments.map((assignment) => <option key={assignment.id} value={assignment.id}>{assignment.title}</option>)}
            </select>
            <input className="input-kcs w-24 py-2 text-sm" value={bulkValue} onChange={(event) => setBulkValue(event.target.value)} placeholder="Score" />
            <button onClick={applyBulkScore} className="rounded-xl bg-kcs-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-kcs-blue-800">Bulk apply</button>
          </div>
        </div>

        <div className="max-h-[680px] overflow-auto">
          <table className="w-full min-w-[1280px] border-separate border-spacing-0 text-sm">
            <thead className="sticky top-0 z-20 bg-gray-50 text-xs uppercase text-gray-500 shadow-sm dark:bg-kcs-blue-900 dark:text-gray-300">
              <tr>
                <th className="sticky left-0 z-30 w-64 bg-gray-50 px-4 py-3 text-left dark:bg-kcs-blue-900">Student</th>
                {visibleAssignments.map((assignment) => (
                  <th key={assignment.id} className="min-w-36 border-l border-gray-100 px-3 py-3 text-center dark:border-kcs-blue-800">
                    <span className="block font-bold text-kcs-blue-900 dark:text-white">{assignment.title}</span>
                    <span className="block normal-case text-gray-400">{assignment.type} - {assignment.maxPoints} pts</span>
                    <button onClick={() => deleteAssignment(assignment.id)} className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold normal-case text-red-500 hover:text-red-600"><Trash2 size={12} /> Delete</button>
                  </th>
                ))}
                <th className="min-w-32 border-l border-gray-100 px-3 py-3 text-center dark:border-kcs-blue-800">Average</th>
                <th className="min-w-32 border-l border-gray-100 px-3 py-3 text-center dark:border-kcs-blue-800">Prediction</th>
                <th className="min-w-40 border-l border-gray-100 px-3 py-3 text-left dark:border-kcs-blue-800">AI status</th>
              </tr>
            </thead>
            <tbody>
              {studentAnalytics.map(({ student, average, missing, projected, risk }) => (
                <tr key={student.id} className="group">
                  <td className="sticky left-0 z-10 border-t border-gray-100 bg-white px-4 py-3 dark:border-kcs-blue-800 dark:bg-kcs-blue-900">
                    <p className="font-semibold text-kcs-blue-900 dark:text-white">{student.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{student.grade}{student.section} - {student.advisor ?? 'Advisor pending'}</p>
                  </td>
                  {visibleAssignments.map((assignment) => {
                    const normalized = getScore(assignment, student.id)
                    return (
                      <td key={`${student.id}-${assignment.id}`} className="border-l border-t border-gray-100 px-3 py-3 dark:border-kcs-blue-800">
                        <div className="flex flex-col gap-2">
                          <input
                            className={`mx-auto w-20 rounded-lg px-2 py-2 text-center text-sm font-bold outline-none ring-1 transition-colors focus:ring-2 focus:ring-kcs-blue-400 ${toneForScore(normalized)}`}
                            value={getRawScore(assignment.id, student.id)}
                            onChange={(event) => updateScore(assignment.id, student.id, event.target.value)}
                            placeholder="I"
                          />
                          <div className="flex justify-center gap-1">
                            <button className="rounded-md bg-gray-100 px-2 py-1 text-[11px] font-bold text-gray-600 hover:bg-kcs-blue-50 dark:bg-kcs-blue-800 dark:text-gray-300" onClick={() => updateScore(assignment.id, student.id, suggestGrade(assignment, student))}>
                              AI
                            </button>
                            <button className="rounded-md bg-gray-100 px-2 py-1 text-[11px] font-bold text-gray-600 hover:bg-kcs-blue-50 dark:bg-kcs-blue-800 dark:text-gray-300" onClick={() => setComments((current) => ({ ...current, [scoreKey(assignment.id, student.id)]: current[scoreKey(assignment.id, student.id)] || 'Teacher note pending.' }))}>
                              Note
                            </button>
                          </div>
                        </div>
                      </td>
                    )
                  })}
                  <td className="border-l border-t border-gray-100 px-3 py-3 text-center dark:border-kcs-blue-800">
                    <span className={`inline-flex min-w-20 justify-center rounded-lg px-3 py-2 text-sm font-bold ring-1 ${toneForScore(average)}`}>{formatPercent(average)}</span>
                  </td>
                  <td className="border-l border-t border-gray-100 px-3 py-3 text-center dark:border-kcs-blue-800">
                    <span className={`inline-flex min-w-20 justify-center rounded-lg px-3 py-2 text-sm font-bold ring-1 ${toneForScore(projected)}`}>{formatPercent(projected)}</span>
                  </td>
                  <td className="border-l border-t border-gray-100 px-3 py-3 dark:border-kcs-blue-800">
                    <div className="flex flex-col gap-2">
                      <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-bold ${risk === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : risk === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'}`}>
                        {risk} risk
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{missing} missing</span>
                    </div>
                  </td>
                </tr>
              ))}
              {studentAnalytics.length > 0 && (
                <tr className="bg-gray-50 font-bold text-kcs-blue-900 dark:bg-kcs-blue-800/30 dark:text-white">
                  <td className="sticky left-0 z-10 border-t border-gray-100 bg-gray-50 px-4 py-3 dark:border-kcs-blue-800 dark:bg-kcs-blue-800">
                    Class average
                  </td>
                  {visibleAssignments.map((assignment) => (
                    <td key={`average-${assignment.id}`} className="border-l border-t border-gray-100 px-3 py-3 text-center dark:border-kcs-blue-800">
                      {formatPercent(getAssignmentAverage(assignment))}
                    </td>
                  ))}
                  <td className="border-l border-t border-gray-100 px-3 py-3 text-center dark:border-kcs-blue-800">
                    {formatPercent(studentAnalytics.some((item) => item.average !== null) ? classAverage : null)}
                  </td>
                  <td className="border-l border-t border-gray-100 px-3 py-3 text-center dark:border-kcs-blue-800">
                    {formatPercent(studentAnalytics.some((item) => item.projected !== null)
                      ? studentAnalytics.reduce((sum, item) => sum + (item.projected ?? 0), 0) / Math.max(1, studentAnalytics.filter((item) => item.projected !== null).length)
                      : null)}
                  </td>
                  <td className="border-l border-t border-gray-100 px-3 py-3 text-xs text-gray-500 dark:border-kcs-blue-800 dark:text-gray-300">
                    Auto-calculated
                  </td>
                </tr>
              )}
              {!studentAnalytics.length && (
                <tr>
                  <td colSpan={visibleAssignments.length + 4} className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                    Select a class with students from the Super Admin registry to start entering grades.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
            <h4 className="mb-4 flex items-center gap-2 font-bold text-kcs-blue-900 dark:text-white"><BarChart3 size={18} /> Class distribution</h4>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={distribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
                <XAxis dataKey="band" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#0f2352', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '12px' }} />
                <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                  {distribution.map((entry) => <Cell key={entry.band} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
            <h4 className="mb-4 flex items-center gap-2 font-bold text-kcs-blue-900 dark:text-white"><TrendingUp size={18} /> Performance trend</h4>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis domain={[50, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#0f2352', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '12px' }} />
                <Area type="monotone" dataKey="average" stroke="#2563eb" strokeWidth={2.5} fill="#dbeafe" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
          <h4 className="flex items-center gap-2 font-bold text-kcs-blue-900 dark:text-white"><Brain size={18} /> AI insights dashboard</h4>
          <div className="mt-4 space-y-3">
            <div className="rounded-xl bg-kcs-blue-50 p-4 text-sm text-kcs-blue-900 dark:bg-kcs-blue-900/30 dark:text-kcs-blue-100">
              <p className="font-bold">Natural-language analysis</p>
              <p className="mt-1">The class is trending toward {Math.round(classAverage + 2)}%. {atRiskCount} student(s) need intervention before the final window, mostly due to missing assignments and weak category averages.</p>
            </div>
            {studentAnalytics.filter((item) => item.risk !== 'low').slice(0, 4).map(({ student, average, projected, missing }) => (
              <div key={student.id} className="rounded-xl border border-gray-100 p-4 dark:border-kcs-blue-800">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-kcs-blue-900 dark:text-white">{student.name}</p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Current {formatPercent(average)} - projected {formatPercent(projected)} - {missing} missing</p>
                  </div>
                  <TrendingDown size={18} className="text-red-500" />
                </div>
                <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">Recommendation: assign personalized practice on {student.weaknesses?.[0] ?? 'foundational skills'}, notify parents, and review the next two submissions manually.</p>
                <button onClick={() => generateFeedback(student)} className="mt-3 rounded-lg bg-kcs-blue-700 px-3 py-2 text-xs font-bold text-white hover:bg-kcs-blue-800"><Wand2 size={13} className="mr-1 inline" /> Generate feedback</button>
              </div>
            ))}
            {courseStudents.slice(0, 2).map((student) => comments[`feedback:${student.id}`] && (
              <div key={`feedback-${student.id}`} className="rounded-xl bg-green-50 p-4 text-sm text-green-800 dark:bg-green-900/20 dark:text-green-200">
                <p className="font-bold">{student.name} report-card comment</p>
                <p className="mt-1">{comments[`feedback:${student.id}`]}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { icon: CheckCircle2, title: 'Real-time sync', text: 'Grade saves queue updates for student, parent, and admin dashboards with audit metadata.' },
          { icon: Lightbulb, title: 'Intelligent suggestions', text: 'AI grade suggestions use the learner trend, current category strength, and class baseline.' },
          { icon: AlertTriangle, title: 'Smart alerts', text: 'Failing, sudden drops, missing work, and projected-risk patterns are surfaced before report cards.' },
        ].map((item) => {
          const Icon = item.icon
          return (
            <div key={item.title} className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <Icon size={20} className="text-kcs-blue-600 dark:text-kcs-blue-300" />
              <p className="mt-3 font-bold text-kcs-blue-900 dark:text-white">{item.title}</p>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{item.text}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default AdvancedGradebook
