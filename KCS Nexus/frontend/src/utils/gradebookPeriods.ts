export function canonicalGradebookTerm(term: string): string {
  return term.replace(/\bTrimester\b/gi, 'Quarter')
}

export function openingGradebookTerm(
  assignments: Array<{ term: string }>,
  rememberedTerm: string | null,
  officialTerm: string,
  terms: readonly string[],
): string {
  const remembered = rememberedTerm ? canonicalGradebookTerm(rememberedTerm) : null
  if (remembered && terms.includes(remembered)) return remembered
  const populated = new Set(assignments.map((assignment) => canonicalGradebookTerm(assignment.term)))
  return terms.filter((term) => term !== 'Annual final' && populated.has(term)).at(-1) ?? officialTerm
}
