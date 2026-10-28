export const KCS_ACADEMIC_TERMS = [
  'Semester 1 · Quarter 1',
  'Semester 1 · Quarter 2',
  'Semester 2 · Quarter 3',
  'Semester 2 · Quarter 4',
  'Annual final',
] as const

export const KCS_QUARTER_DAYS = 45
export const KCS_INSTRUCTIONAL_DAYS = 180

const LEGACY_TERM_ALIASES: Record<string, KcsAcademicTerm> = {
  'Semester 1 · Trimester 1': 'Semester 1 · Quarter 1',
  'Semester 1 · Trimester 2': 'Semester 1 · Quarter 2',
  'Semester 2 · Trimester 3': 'Semester 2 · Quarter 3',
}

export type KcsAcademicTerm = (typeof KCS_ACADEMIC_TERMS)[number]

export const isSequentialAcademicYear = (value: string) => {
  const match = /^(\d{4})-(\d{4})$/.exec(value)
  return Boolean(match && Number(match[2]) === Number(match[1]) + 1)
}
export const isKcsAcademicTerm = (value: string): value is KcsAcademicTerm => (
  KCS_ACADEMIC_TERMS.includes(value as KcsAcademicTerm)
)

export const canonicalAcademicTerm = (value: string): KcsAcademicTerm | null => (
  isKcsAcademicTerm(value) ? value : LEGACY_TERM_ALIASES[value] ?? null
)

export const academicTermAliases = (value: string) => {
  const canonical = canonicalAcademicTerm(value)
  if (!canonical) return [value]
  const legacy = Object.entries(LEGACY_TERM_ALIASES).filter(([, target]) => target === canonical).map(([source]) => source)
  return [canonical, ...legacy]
}

export const academicPeriodKey = (
  academicYear: string,
  term: KcsAcademicTerm,
  status: 'SUBMITTED' | 'APPROVED',
) => `${academicYear}::${term}::${status}`

