export type SubsidyRole = 'TEACHER' | 'STAFF' | string

export function calculateSchoolSubsidy(eligibleSubtotal: number, role: SubsidyRole) {
  const amount = Number.isFinite(eligibleSubtotal) ? Math.max(0, Math.floor(eligibleSubtotal)) : 0
  const normalizedRole = String(role || '').trim().toUpperCase()
  if (!['TEACHER', 'STAFF', 'ADMINISTRATIVE_STAFF'].includes(normalizedRole) || amount <= 4999) return 0
  if (amount <= 9999) return 2000
  if (amount <= 19999) return 4000
  return 8000
}
