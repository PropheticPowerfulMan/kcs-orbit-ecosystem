import { ApiError } from './api.js'

const gradebookFields = [
  'advancedGradebookByCourse',
  'advancedGradebookByCycle',
  'gradebookColumnsByCourse',
  'gradebookScores',
] as const

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

export function mergeTeacherWorkspaceState(previous: unknown, incoming: Record<string, unknown>) {
  const existing = record(previous)
  const state = { ...existing, ...incoming }
  if (existing.gradebookCategoryWeightsByCycle !== undefined) state.gradebookCategoryWeightsByCycle = existing.gradebookCategoryWeightsByCycle
  else delete state.gradebookCategoryWeightsByCycle
  if (existing.gradebookPeriodCorrectionsByCycle !== undefined) state.gradebookPeriodCorrectionsByCycle = existing.gradebookPeriodCorrectionsByCycle
  else delete state.gradebookPeriodCorrectionsByCycle
  const previousGradebook: Record<string, unknown> = {}
  let gradebookChanged = false
  for (const field of gradebookFields) {
    const stored = record(existing[field])
    const requested = record(incoming[field])
    if (field.startsWith('advancedGradebook')) {
      for (const [key, value] of Object.entries(requested)) {
        const before = record(stored[key])
        const after = record(value)
        const hadTasks = Array.isArray(before.assignments) && before.assignments.length > 0
        const hasTasks = Array.isArray(after.assignments) && after.assignments.length > 0
        const academicYear = field === 'advancedGradebookByCycle' ? key.slice(key.lastIndexOf('::') + 2) : '2026-2027'
        const courseId = field === 'advancedGradebookByCycle' ? key.slice(0, key.lastIndexOf('::')) : key
        const cycleSnapshot = record(record(existing.advancedGradebookByCycle)[courseId + '::' + academicYear])
        const legacySnapshot = academicYear === '2026-2027' ? record(record(existing.advancedGradebookByCourse)[courseId]) : {}
        const legacyColumns = academicYear === '2026-2027' ? record(existing.gradebookColumnsByCourse)[courseId] : []
        const correctedIds = record(record(existing.gradebookPeriodCorrectionsByCycle)[courseId + '::' + academicYear]).assessmentIds
        const knownIds = new Set([
          ...[before, cycleSnapshot, legacySnapshot].flatMap(source => Array.isArray(source.assignments) ? source.assignments : []),
          ...(Array.isArray(legacyColumns) ? legacyColumns : []),
          ...(Array.isArray(correctedIds) ? correctedIds.map(id => ({ id })) : []),
          ...(Array.isArray(before.archivedAssignments) ? before.archivedAssignments : []).map(entry => record(entry).assignment),
        ].map(task => record(task).id))
        for (const value of Array.isArray(after.assignments) ? after.assignments : []) {
          const task = record(value)
          const term = String(task.term || '').replace(/Trimester/gi, 'Quarter')
          if (!knownIds.has(task.id) && /Quarter [234]$/.test(term) && task.confirmedCycle !== academicYear + '::' + term) {
            throw new ApiError(409, 'Reload the updated Gradebook and confirm the academic year and quarter before creating an assessment in a new quarter.')
          }
        }
        const archived = Array.isArray(after.archivedAssignments) && after.archivedAssignments.length > 0
        const hadMarks = Object.values(record(before.scores)).some((value) => String(value ?? '').trim() !== '')
        const hasMarks = Object.values(record(after.scores)).some((value) => String(value ?? '').trim() !== '')
        if (((hadTasks && !hasTasks) || (hadMarks && !hasMarks)) && !archived) {
          throw new ApiError(409, 'An empty gradebook cannot replace saved assessments. Reload the gradebook before saving again.')
        }
      }
    }
    if (existing[field] !== undefined || incoming[field] !== undefined) {
      state[field] = { ...stored, ...requested }
      previousGradebook[field] = stored
      gradebookChanged ||= JSON.stringify(stored) !== JSON.stringify(state[field])
    }
  }
  for (const [cycle, correctionValue] of Object.entries(record(existing.gradebookPeriodCorrectionsByCycle))) {
    const correction = record(correctionValue)
    const divider = cycle.lastIndexOf('::')
    const courseId = cycle.slice(0, divider)
    const year = cycle.slice(divider + 2)
    const ids = new Set(Array.isArray(correction.assessmentIds) ? correction.assessmentIds : [])
    const fixTask = (value: unknown) => {
      const task = record(value)
      return ids.has(task.id) && String(task.term ?? '').replace(/Trimester/gi, 'Quarter') === correction.from ? { ...task, term: correction.to } : task
    }
    for (const field of ['advancedGradebookByCycle', ...(year === '2026-2027' ? ['advancedGradebookByCourse', 'gradebookColumnsByCourse'] : [])]) {
      const key = field === 'advancedGradebookByCycle' ? cycle : courseId
      const values = record(state[field])
      if (!values[key]) continue
      const snapshot = record(values[key])
      const corrected = field === 'gradebookColumnsByCourse'
        ? (Array.isArray(values[key]) ? values[key] as unknown[] : []).map(fixTask)
        : { ...snapshot, assignments: (Array.isArray(snapshot.assignments) ? snapshot.assignments : []).map(fixTask), archivedAssignments: (Array.isArray(snapshot.archivedAssignments) ? snapshot.archivedAssignments : []).map(entry => ({ ...record(entry), assignment: fixTask(record(entry).assignment) })) }
      state[field] = { ...values, [key]: corrected }
    }
  }
  return { state, previousGradebook: gradebookChanged ? previousGradebook : undefined }
}
