export type DiscountCandidate = {
  id: string
  name: string
  type: string
  thresholdAmount: number | null
  fixedAmount: number | null
  targetAmount: number | null
  percentage: number | null
  requiresApproval: boolean
}

export function calculateDiscount(subtotal: number, rules: DiscountCandidate[]) {
  for (const rule of rules) {
    if (rule.requiresApproval) continue
    if (subtotal < (rule.thresholdAmount ?? 0)) continue
    let discount = 0
    if (rule.type === 'THRESHOLD_FIXED_TOTAL' && rule.targetAmount != null) discount = subtotal - rule.targetAmount
    if (rule.type === 'FIXED_AMOUNT' && rule.fixedAmount != null) discount = rule.fixedAmount
    if (rule.type === 'PERCENTAGE' && rule.percentage != null) discount = subtotal * rule.percentage / 100
    discount = Math.max(0, Math.min(subtotal, discount))
    if (discount > 0) return { rule, discount, finalAmount: subtotal - discount }
  }
  return { rule: null, discount: 0, finalAmount: subtotal }
}
