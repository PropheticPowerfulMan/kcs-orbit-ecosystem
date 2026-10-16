export const KCS_ACADEMIC_TERMS = [
  'Semester 1 · Trimester 1',
  'Semester 1 · Trimester 2',
  'Semester 2 · Trimester 3',
  'Annual final',
] as const

export type KcsAcademicTerm = (typeof KCS_ACADEMIC_TERMS)[number]

export const isSequentialAcademicYear = (value: string) => {
  const match = /^(\d{4})-(\d{4})$/.exec(value)
  return Boolean(match && Number(match[2]) === Number(match[1]) + 1)
}
export const isKcsAcademicTerm = (value: string): value is KcsAcademicTerm => (
  KCS_ACADEMIC_TERMS.includes(value as KcsAcademicTerm)
)

export const academicPeriodKey = (
  academicYear: string,
  term: KcsAcademicTerm,
  status: 'SUBMITTED' | 'APPROVED',
) => `${academicYear}::${term}::${status}`

