import { ApiError } from './api.js'

// Previously saved exclusions can outlive a deleted course or an enrollment transfer.
// Ignore those obsolete exclusions, while rejecting newly supplied foreign course IDs.
export function reportCardVisibility(courseIds: string[], requested: string[], previousHidden: string[] = []) {
  const official = new Set(courseIds), previous = new Set(previousHidden)
  if (requested.some(id => !official.has(id) && !previous.has(id))) throw new ApiError(400, 'A hidden course does not belong to this learner official enrollment')
  const hidden = [...new Set(requested)].filter(id => official.has(id))
  const visible = [...official].filter(id => !hidden.includes(id))
  if (!visible.length) throw new ApiError(400, 'At least one official course must remain visible on the report card')
  return { hiddenCourseIds: hidden, visibleCourseIds: visible }
}
