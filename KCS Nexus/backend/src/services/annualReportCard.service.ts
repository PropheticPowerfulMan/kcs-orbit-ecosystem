import { academicTermAliases, canonicalAcademicTerm } from '../utils/academicCycle.js'

export const KCS_QUARTER_TERMS = [
  'Semester 1 · Quarter 1',
  'Semester 1 · Quarter 2',
  'Semester 2 · Quarter 3',
  'Semester 2 · Quarter 4',
] as const
/** @deprecated compatibility export for older imports. */
export const KCS_TRIMESTER_TERMS = KCS_QUARTER_TERMS

export type ReportGradeSource = {
  studentId: string
  courseId: string
  period: string
  percentage: number
  createdAt?: Date | string
}

export type AggregatedCourseResult = {
  studentId: string
  courseId: string
  percentage: number | null
  complete: boolean
  sourceCount: number
  sourceTermCount: number
  termResults: Record<string, number | null>
}

export const isAnnualFinalTerm = (term: string) => term.trim().toLowerCase() === 'annual final'

export const reportCardSourceTerms = (term: string): string[] => {
  if (isAnnualFinalTerm(term)) return [...KCS_QUARTER_TERMS]
  if (term === 'Semester 1') return KCS_QUARTER_TERMS.slice(0, 2)
  if (term === 'Semester 2') return KCS_QUARTER_TERMS.slice(2, 4)
  return [canonicalAcademicTerm(term) ?? term]
}

export const reportCardSourcePeriodTerms = (term: string) => reportCardSourceTerms(term).flatMap(academicTermAliases)

export const reportCardSourcePeriods = (year: string, term: string) => reportCardSourcePeriodTerms(term).flatMap(source => [year+'::'+source+'::SUBMITTED',year+'::'+source+'::APPROVED'])

export function aggregateReportCardResults(
  grades: ReportGradeSource[],
  academicYear: string,
  term: string,
) {
  const requiredTerms = reportCardSourceTerms(term)
  const required = new Set(requiredTerms)
  const newestByTerm = new Map<string, ReportGradeSource>()

  for (const grade of grades) {
    const [year, rawGradeTerm, status] = grade.period.split('::')
    const gradeTerm = canonicalAcademicTerm(rawGradeTerm) ?? rawGradeTerm
    if (year !== academicYear || !['SUBMITTED','APPROVED'].includes(status) || !required.has(gradeTerm)) continue
    const key = `${grade.studentId}:${grade.courseId}:${gradeTerm}`
    const current = newestByTerm.get(key)
    const currentTime = current?.createdAt ? new Date(current.createdAt).getTime() : 0
    const candidateTime = grade.createdAt ? new Date(grade.createdAt).getTime() : 0
    const currentApproved=current?.period.endsWith('::APPROVED')??false
    const candidateApproved=status==='APPROVED'
    if (!current || (candidateApproved&&!currentApproved) || (candidateApproved===currentApproved&&candidateTime>=currentTime)) newestByTerm.set(key, grade)
  }

  const courseKeys = new Set([...newestByTerm.values()].map((grade) => `${grade.studentId}:${grade.courseId}`))
  const results = new Map<string, AggregatedCourseResult>()
  for (const key of courseKeys) {
    const separator = key.lastIndexOf(':')
    const studentId = key.slice(0, separator)
    const courseId = key.slice(separator + 1)
    const termResults: Record<string, number | null> = {}
    const values: number[] = []
    for (const sourceTerm of requiredTerms) {
      const grade = newestByTerm.get(`${key}:${sourceTerm}`)
      termResults[sourceTerm] = grade?.percentage ?? null
      if (grade) values.push(grade.percentage)
    }
    const complete = values.length === requiredTerms.length
    results.set(key, {
      studentId,
      courseId,
      percentage: complete ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)) : null,
      complete,
      sourceCount: values.length,
      sourceTermCount: values.length,
      termResults,
    })
  }
  return results
}
