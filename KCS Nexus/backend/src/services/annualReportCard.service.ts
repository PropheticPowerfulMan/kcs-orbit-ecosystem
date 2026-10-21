export const KCS_TRIMESTER_TERMS = [
  'Semester 1 · Trimester 1',
  'Semester 1 · Trimester 2',
  'Semester 2 · Trimester 3',
] as const

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

export const reportCardSourceTerms = (term: string) => isAnnualFinalTerm(term)
  ? [...KCS_TRIMESTER_TERMS]
  : [term]

export function aggregateReportCardResults(
  grades: ReportGradeSource[],
  academicYear: string,
  term: string,
) {
  const requiredTerms = reportCardSourceTerms(term)
  const required = new Set(requiredTerms)
  const newestByTerm = new Map<string, ReportGradeSource>()

  for (const grade of grades) {
    const [year, gradeTerm, status] = grade.period.split('::')
    if (year !== academicYear || status !== 'SUBMITTED' || !required.has(gradeTerm)) continue
    const key = `${grade.studentId}:${grade.courseId}:${gradeTerm}`
    const current = newestByTerm.get(key)
    const currentTime = current?.createdAt ? new Date(current.createdAt).getTime() : 0
    const candidateTime = grade.createdAt ? new Date(grade.createdAt).getTime() : 0
    if (!current || candidateTime >= currentTime) newestByTerm.set(key, grade)
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
