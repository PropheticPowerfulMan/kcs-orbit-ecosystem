type GradebookCycleColumn = {
  id: string
  title: string
  type: string
  category: string
  maxPoints: number
  date: string
  term: string
  description: string
}

type GradebookCycleInput = {
  courseId: string
  assignmentId: string
  title: string
  description: string
  assignmentType: string
  dueDate: Date
  maxScore: number
  academicYear: string
  term: string
  scores: Array<{ studentId: string; score: number; feedback?: string | null }>
  savedAt: string
}

const legacyAcademicYear = '2026-2027'

const categoryForAssignmentType = (value: string) => {
  const normalized = value.trim().toLowerCase()
  if (normalized === 'classwork' || normalized === 'lab' || normalized === 'practical') return 'participation'
  if (normalized === 'presentation' || normalized === 'research') return 'project'
  return ['homework', 'quiz', 'test', 'exam', 'project', 'participation'].includes(normalized) ? normalized : 'test'
}

export const academicCycleFromDate = (date: Date) => {
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth()
  const start = month >= 7 ? year : year - 1
  const academicYear = `${start}-${start + 1}`
  const term = month >= 7 && month <= 10
    ? 'Semester 1 · Trimester 1'
    : month === 11 || month <= 2
      ? 'Semester 1 · Trimester 2'
      : 'Semester 2 · Trimester 3'
  return { academicYear, term }
}

export const mergeAssignmentIntoGradebookCycle = (
  rawState: unknown,
  input: GradebookCycleInput,
) => {
  const state = rawState && typeof rawState === 'object' && !Array.isArray(rawState)
    ? { ...(rawState as Record<string, any>) }
    : {}
  const cycleKey = `${input.courseId}::${input.academicYear}`
  const cycleMap = { ...(state.advancedGradebookByCycle ?? {}) }
  const previous = cycleMap[cycleKey] && typeof cycleMap[cycleKey] === 'object'
    ? cycleMap[cycleKey]
    : {}
  const columnId = `assignment:${input.assignmentId}`
  const category = categoryForAssignmentType(input.assignmentType)
  const column: GradebookCycleColumn = {
    id: columnId,
    title: input.title,
    type: category,
    category,
    maxPoints: input.maxScore,
    date: input.dueDate.toISOString().slice(0, 10),
    term: input.term,
    description: input.description,
  }
  const assignments = [
    ...((Array.isArray(previous.assignments) ? previous.assignments : []) as GradebookCycleColumn[])
      .filter((item) => item.id !== columnId),
    column,
  ].sort((left, right) => Date.parse(left.date) - Date.parse(right.date))
  const scores = { ...(previous.scores ?? {}) }
  const comments = { ...(previous.comments ?? {}) }
  for (const result of input.scores) {
    scores[`${columnId}:${result.studentId}`] = String(result.score)
    if (result.feedback?.trim()) comments[`${columnId}:${result.studentId}`] = result.feedback.trim()
  }
  const snapshot = {
    ...previous,
    assignments,
    categories: Array.isArray(previous.categories) ? previous.categories : [],
    scores,
    comments,
    archivedAssignments: Array.isArray(previous.archivedAssignments) ? previous.archivedAssignments : [],
    savedAt: input.savedAt,
  }
  cycleMap[cycleKey] = snapshot
  state.advancedGradebookByCycle = cycleMap

  // Compatibility mirrors are intentionally limited to the initial cycle.
  // New cycles must never overwrite 2026-2027 report-card data.
  if (input.academicYear === legacyAcademicYear) {
    state.advancedGradebookByCourse = {
      ...(state.advancedGradebookByCourse ?? {}),
      [input.courseId]: snapshot,
    }
  }
  return state
}
