export function canonicalGradebookTerm(term: string): string {
  return term.replace(/\bTrimester\b/gi, 'Quarter')
}

export function openingGradebookTerm(
  assignments: Array<{ term: string }>,
  rememberedTerm: string | null,
  officialTerm: string,
  terms: readonly string[],
  annualReady = false,
): string {
  const remembered = rememberedTerm ? canonicalGradebookTerm(rememberedTerm) : null
  if (remembered && terms.includes(remembered) && (remembered !== 'Annual final' || annualReady)) return remembered
  const populated = new Set(assignments.map((assignment) => canonicalGradebookTerm(assignment.term)))
  return terms.filter((term) => term !== 'Annual final' && populated.has(term)).at(-1) ?? officialTerm
}

export function annualGradebookSummaryReady(access: { closedPeriods: Array<{ academicYear: string; term: string }> } | null | undefined, year: string) {
  if (!access) return false
  const closed = new Set(access.closedPeriods.filter(period => period.academicYear === year).map(period => canonicalGradebookTerm(period.term)))
  return closed.has('Annual final') || [1, 2, 3, 4].every(quarter => closed.has('Semester ' + (quarter <= 2 ? 1 : 2)) || closed.has('Semester ' + (quarter <= 2 ? 1 : 2) + ' · Quarter ' + quarter))
}
