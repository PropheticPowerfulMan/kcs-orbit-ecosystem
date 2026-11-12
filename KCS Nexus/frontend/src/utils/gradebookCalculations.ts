import type { Category, GradebookColumn } from './gradebookRecovery'

export function gradebookScorePercentage(value: string, maxPoints: number): number | null {
  const normalized = value.trim().toUpperCase()
  if (!normalized || normalized === 'E' || normalized === 'I') return null
  if (normalized === 'U' || normalized === 'M') return 0
  const numeric = Number(normalized)
  if (!Number.isFinite(numeric)) return null
  return Math.max(0, Math.min(100, numeric / Math.max(maxPoints, 1) * 100))
}

export function gradebookWeightedAverage(studentId: string, assignments: GradebookColumn[], categories: Category[], scores: Record<string, string>): number | null {
  let weighted = 0, activeWeight = 0
  for (const category of categories) {
    const values = assignments.filter(task => task.category === category.id)
      .map(task => gradebookScorePercentage(scores[task.id + ':' + studentId] ?? '', task.maxPoints))
      .filter((value): value is number => value !== null)
    if (!values.length) continue
    weighted += values.reduce((sum, value) => sum + value, 0) / values.length * category.weight
    activeWeight += category.weight
  }
  return activeWeight ? weighted / activeWeight : null
}

export function zeroWeightScoredAssessments(assignments: GradebookColumn[], categories: Category[], scores: Record<string, string>, studentIds: string[]) {
  return assignments.filter(task => !(categories.find(category => category.id === task.category)?.weight)
    && studentIds.some(id => gradebookScorePercentage(scores[task.id + ':' + id] ?? '', task.maxPoints) !== null))
}

// A proposal is displayed for teacher approval before any official weighting changes.
export function proposeScoredCategoryWeights(categories: Category[], excludedIds: string[], defaults: Category[]): Category[] {
  const excluded = new Set(excludedIds)
  const proposed = categories.map(category => ({ ...category, weight: excluded.has(category.id) ? defaults.find(item => item.id === category.id)?.weight || 1 : 0 }))
  const reserved = proposed.reduce((sum, category) => sum + category.weight, 0)
  const weighted = categories.filter(category => category.weight > 0 && !excluded.has(category.id))
  const total = weighted.reduce((sum, category) => sum + category.weight, 0)
  if (!total || reserved >= 100) return categories
  const allocations = weighted.map(category => {
    const exact = category.weight / total * (100 - reserved)
    return { id: category.id, weight: Math.floor(exact), fraction: exact - Math.floor(exact) }
  })
  const remaining = 100 - reserved - allocations.reduce((sum, item) => sum + item.weight, 0)
  allocations.sort((left, right) => right.fraction - left.fraction).forEach((allocation, index) => {
    proposed.find(item => item.id === allocation.id)!.weight = allocation.weight + (index < remaining ? 1 : 0)
  })
  return proposed
}
