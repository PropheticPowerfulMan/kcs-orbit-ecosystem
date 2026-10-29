const PRESENT_STATUSES = new Set(['PRESENT', 'LATE'])
const ABSENT_STATUSES = new Set(['ABSENT', 'EXCUSED', 'SICK', 'SUSPENDED'])

export type AttendanceStatusCount = {
  total: number
  present: number
  absent: number
  late: number
  excused: number
  sick: number
  suspended: number
  attendanceRate: number | null
}

/**
 * KCS attendance policy:
 * - PRESENT and LATE count as attendance;
 * - ABSENT, EXCUSED, SICK and SUSPENDED all count as absence.
 *
 * Detailed statuses remain visible for audit and pastoral follow-up while the
 * aggregate `absent` value intentionally includes every absence category.
 */
export function summarizeAttendanceStatuses(statuses: string[]): AttendanceStatusCount {
  const count = (status: string) => statuses.filter((value) => value === status).length
  const presentForRate = statuses.filter((status) => PRESENT_STATUSES.has(status)).length
  const absent = statuses.filter((status) => ABSENT_STATUSES.has(status)).length
  return {
    total: statuses.length,
    present: count('PRESENT'),
    absent,
    late: count('LATE'),
    excused: count('EXCUSED'),
    sick: count('SICK'),
    suspended: count('SUSPENDED'),
    attendanceRate: statuses.length ? Number(((presentForRate / statuses.length) * 100).toFixed(1)) : null,
  }
}

export const attendanceRateFromStatuses = (statuses: string[]) => summarizeAttendanceStatuses(statuses).attendanceRate

