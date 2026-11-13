type Calendar = { name: string; startDate: string; endDate: string; periods?: Array<{ type: string; sequence: number; startDate: string; endDate: string }> }

// No guessed dates: use the matching year and exact official quarter/semester.
export function reportCardPeriodEndDate(academicYear: string, term: string, calendars: Calendar[]): string | null {
  const calendar = calendars.find(item => item.name === academicYear)
  if (!calendar) return null
  const quarter = /(?:quarter|trimester)\s+([1-4])\b/i.exec(term)
  const semester = /semester\s+([1-2])\b/i.exec(term)
  const period = quarter
    ? calendar.periods?.find(item => ['QUARTER', 'TRIMESTER'].includes(item.type) && item.sequence === Number(quarter[1]))
    : semester ? calendar.periods?.find(item => item.type === 'SEMESTER' && item.sequence === Number(semester[1])) : null
  const source = period?.endDate ?? (!quarter && !semester && /annual final/i.test(term) ? calendar.endDate : null)
  if (!source) return null
  const day = source.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(new Date(day).getTime()) && new Date(day).toISOString().slice(0, 10) === day ? day : null
}
