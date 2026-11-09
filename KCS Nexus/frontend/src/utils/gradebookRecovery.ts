import { canonicalGradebookTerm } from './gradebookPeriods'

export type AssignmentType = 'homework' | 'quiz' | 'test' | 'exam' | 'project' | 'participation'

export type GradebookColumn = {
  id: string
  title: string
  type: AssignmentType
  category: string
  maxPoints: number
  date: string
  term: string
  description: string
}

export type Category = {
  id: string
  name: string
  weight: number
}

export type GradebookSnapshot = {
  assignments: GradebookColumn[]
  categories: Category[]
  scores: Record<string, string>
  comments: Record<string, string>
  archivedAssignments?: ArchivedAssignment[]
  savedAt?: string
}

export type ArchivedAssignment = {
  assignment: GradebookColumn
  scores: Record<string, string>
  comments: Record<string, string>
  deletedAt: string
}

export const defaultGradebookCategories: Category[] = [
  { id: 'homework', name: 'Homework', weight: 15 },
  { id: 'quiz', name: 'Quiz', weight: 15 },
  { id: 'test', name: 'Test', weight: 20 },
  { id: 'project', name: 'Project', weight: 20 },
  { id: 'exam', name: 'Exam', weight: 25 },
  { id: 'participation', name: 'Participation', weight: 5 },
]

type StudentIdentity = { id: string; studentNumber?: string }
type Source = { snapshot: Partial<GradebookSnapshot>; browser: boolean; rank: number }
const legacyYear = '2026-2027'
const validTypes = new Set<AssignmentType>(['homework', 'quiz', 'test', 'exam', 'project', 'participation'])

export function stableGradebookValue(value: unknown): string {
  const sort = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(sort)
    if (item && typeof item === 'object') return Object.fromEntries(Object.entries(item).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, v]) => [key, sort(v)]))
    return item
  }
  return JSON.stringify(sort(value))
}

export function recoverGradebook(input: {
  courseId: string; academicYear: string; aliases?: string[]; state: Record<string, any>;
  students: StudentIdentity[]; browserSnapshots?: Array<Partial<GradebookSnapshot>>;
}) {
  const { state, courseId, academicYear } = input
  const ids = academicYear === legacyYear ? [...new Set([courseId, ...(input.aliases ?? [])])] : [courseId]
  const aliases = new Map<string, string>()
  for (const student of input.students) {
    aliases.set(student.id, student.id)
    if (student.studentNumber) aliases.set(student.studentNumber.toLowerCase(), student.id)
  }
  for (const student of state.teacherStudents ?? []) {
    const current = aliases.get(String(student.id)) ?? aliases.get(String(student.studentNumber ?? '').toLowerCase())
    if (current) aliases.set(String(student.id), current)
  }
  const mapKey = (key: string) => {
    const divider = key.lastIndexOf(':')
    if (divider < 0) return key
    const id = key.slice(divider + 1)
    return key.slice(0, divider + 1) + (aliases.get(id) ?? aliases.get(id.toLowerCase()) ?? id)
  }
  const sources: Source[] = []
  if (academicYear === legacyYear) {
    for (const id of ids) {
      const columns = (state.gradebookColumnsByCourse?.[id] ?? []) as Array<{ id: string; title: string; type?: string; date?: string; maxPoints?: number; term?: string }>
      const scores: Record<string, string> = {}
      for (const column of columns) {
        const prefix = `${id}-${column.id}-`
        for (const [key, value] of Object.entries(state.gradebookScores ?? {})) {
          if (key.startsWith(prefix)) scores[mapKey(`${column.id}:${key.slice(prefix.length)}`)] = String(value ?? '')
        }
      }
      const assignments = columns.map((column): GradebookColumn => {
        const normalized = String(column.type ?? 'test').toLowerCase() as AssignmentType
        const type = validTypes.has(normalized) ? normalized : 'test'
        return { id: column.id, title: column.title, type, category: type, date: column.date ?? '', maxPoints: Math.max(1, Number(column.maxPoints) || 100), term: canonicalGradebookTerm(column.term || 'Semester 1 · Quarter 1'), description: '' }
      })
      sources.push({ snapshot: { assignments, scores }, browser: false, rank: -1 })
      if (state.advancedGradebookByCourse?.[id]) sources.push({ snapshot: state.advancedGradebookByCourse[id], browser: false, rank: 1 })
    }
  }
  for (const id of ids) if (state.advancedGradebookByCycle?.[`${id}::${academicYear}`]) sources.push({ snapshot: state.advancedGradebookByCycle[`${id}::${academicYear}`], browser: false, rank: 2 })
  for (const snapshot of input.browserSnapshots ?? []) if (snapshot?.assignments?.length) sources.push({ snapshot, browser: true, rank: 0 })
  sources.sort((a, b) => (Date.parse(a.snapshot.savedAt ?? '') || 0) - (Date.parse(b.snapshot.savedAt ?? '') || 0) || a.rank - b.rank)
  const assignments = new Map<string, GradebookColumn>()
  const archived = new Map<string, ArchivedAssignment>()
  const scores: Record<string, string> = {}
  const comments: Record<string, string> = {}
  let categories: Category[] = []
  for (const source of sources) {
    for (const assignment of source.snapshot.assignments ?? []) {
      assignments.set(assignment.id, { ...assignment, term: canonicalGradebookTerm(assignment.term || 'Semester 1 · Quarter 1') })
      archived.delete(assignment.id)
    }
    for (const entry of source.snapshot.archivedAssignments ?? []) {
      assignments.delete(entry.assignment.id)
      archived.set(entry.assignment.id, entry)
    }
    for (const [key, raw] of Object.entries(source.snapshot.scores ?? {})) {
      const mapped = mapKey(key)
      const value = String(raw ?? '')
      // A blank browser cache must never hide an existing server mark.
      if (source.browser && value === '' && scores[mapped]?.trim()) continue
      scores[mapped] = value
    }
    for (const [key, value] of Object.entries(source.snapshot.comments ?? {})) comments[mapKey(key)] = value
    if (source.snapshot.categories?.length) categories = source.snapshot.categories
  }
  const officialWeights = state.gradebookCategoryWeightsByCycle?.[courseId + '::' + academicYear]?.categories
  if (Array.isArray(officialWeights) && officialWeights.length) categories = officialWeights
  const primary = state.advancedGradebookByCycle?.[`${courseId}::${academicYear}`]
    ?? (academicYear === legacyYear ? state.advancedGradebookByCourse?.[courseId] : undefined)
  const primaryScores = new Map(Object.entries(primary?.scores ?? {}).map(([key, value]) => [mapKey(key), String(value ?? '')]))
  const primaryTasks = new Set((primary?.assignments ?? []).map((task: GradebookColumn) => task.id))
  const recoveredCells = Object.entries(scores).filter(([key, value]) => value.trim() !== '' && !primaryScores.has(key) && assignments.has(key.slice(0, key.lastIndexOf(':')))).length
  const recoveredTasks = [...assignments.keys()].filter((id) => !primaryTasks.has(id)).length
  return {
    snapshot: { assignments: [...assignments.values()], scores, comments, categories, archivedAssignments: [...archived.values()], savedAt: primary?.savedAt } as GradebookSnapshot,
    baseSavedAt: primary?.savedAt ?? '', recoveredCells, recoveredTasks,
  }
}
