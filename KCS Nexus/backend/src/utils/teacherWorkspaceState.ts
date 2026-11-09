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
  return { state, previousGradebook: gradebookChanged ? previousGradebook : undefined }
}
