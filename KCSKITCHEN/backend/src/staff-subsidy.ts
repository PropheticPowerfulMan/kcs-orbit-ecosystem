export type SubsidyRole = 'TEACHER' | 'STAFF' | string

export function calculateSchoolSubsidy(eligibleSubtotal: number, role: SubsidyRole) {
  if (!['TEACHER', 'STAFF'].includes(role) || eligibleSubtotal < 5000) return 0
  if (eligibleSubtotal < 10000) return 2000
  if (eligibleSubtotal < 20000) return 4000
  return 8000
}
