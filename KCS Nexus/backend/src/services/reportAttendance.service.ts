import {nonSchoolSettings} from './attendanceCalendarSettings.service.js'
import {schoolDayDecision,type NonSchoolRange,type SchoolCalendar} from '../utils/schoolDayPolicy.js'
import { env } from '../config/env.js'

type Window = { gte: Date; lte: Date }
type SchoolDayContext={nonSchoolRanges?:NonSchoolRange[];calendar?:SchoolCalendar}
const schoolDayContexts=new WeakMap<Window,SchoolDayContext>()
type Calendar = { isCurrent?: boolean; status?: string; name: string; startDate: string; endDate: string; periods?: Array<{ type: string; sequence: number; startDate: string; endDate: string }> }
let cached: Calendar[] = []
let expiresAt = 0
let pending: Promise<Calendar[]> | null = null

export function attendanceWindowForCalendar(year: string, term: string, calendar?: Calendar): Window {
  const quarter = /(?:quarter|trimester)\s+(\d)/i.exec(term)
  const semester = !quarter && /semester\s+(\d)/i.exec(term)
  const period = calendar?.periods?.find(item => quarter
    ? ['QUARTER', 'TRIMESTER'].includes(item.type) && item.sequence === Number(quarter[1])
    : semester ? item.type === 'SEMESTER' && item.sequence === Number(semester[1]) : false)
  if (period || (calendar && !quarter && !semester)) {
    const source = period ?? calendar!
    const gte = new Date(source.startDate)
    const lte = new Date(source.endDate)
    lte.setUTCHours(23, 59, 59, 999)
    if (Number.isFinite(gte.getTime()) && Number.isFinite(lte.getTime())) return { gte, lte }
  }
  const [start, end] = year.split('-')
  // Retain the initial school calendar while separating older and future cycles.
  const bounds = year === '2026-2027'
    ? [['09-07','11-06'],['11-07','01-29'],['01-30','03-31'],['04-01','06-11']]
    : [['09-01','11-07'],['11-08','01-31'],['02-01','03-31'],['04-01','07-31']]
  const date = (monthDay: string) => (Number(monthDay.slice(0, 2)) >= 8 ? start : end) + '-' + monthDay
  if (quarter) {
    const range = bounds[Number(quarter[1]) - 1]
    return { gte: new Date(date(range[0]) + 'T00:00:00.000Z'), lte: new Date(date(range[1]) + 'T23:59:59.999Z') }
  }
  if (semester) {
    const index = Number(semester[1]) === 1 ? 0 : 2
    return { gte: new Date(date(bounds[index][0]) + 'T00:00:00.000Z'), lte: new Date(date(bounds[index + 1][1]) + 'T23:59:59.999Z') }
  }
  return { gte: new Date(start + '-08-01T00:00:00.000Z'), lte: new Date(end + '-07-31T23:59:59.999Z') }
}

export function invalidateAcademicCalendarCache() { expiresAt = 0 }

export async function academicCalendars(): Promise<Calendar[]> {
  if (Date.now() < expiresAt) return cached
  if (pending) return pending
  const base = env.ACADEMIC_CALENDAR_ORBIT_API_URL || env.KCS_ORBIT_API_URL
  const key = env.ACADEMIC_CALENDAR_ORBIT_API_KEY || env.KCS_ORBIT_API_KEY
  const organization = env.ACADEMIC_CALENDAR_ORBIT_ORGANIZATION_ID || env.KCS_ORBIT_ORGANIZATION_ID
  if (!base || !key || !organization) return cached
  pending = (async () => {
    try {
      const response = await fetch(base.replace(/\/$/, '') + '/api/integration/academic-year/calendar?organizationId=' + encodeURIComponent(organization), { headers: { 'x-api-key': key, 'x-app-slug': 'KCS_NEXUS' }, signal: AbortSignal.timeout(4000) })
      if (!response.ok) throw new Error('Calendar unavailable')
      const data = await response.json() as { calendars?: Calendar[] }
      if (Array.isArray(data.calendars)) cached = data.calendars
      expiresAt = Date.now() + 60_000
    } catch {
      expiresAt = Date.now() + 30_000
    } finally { pending = null }
    return cached
  })()
  return pending
}

export async function attendanceWindow(year: string, term: string) {
  const calendar=(await academicCalendars()).find(item => item.name === year)
  const window=attendanceWindowForCalendar(year,term,calendar)
  schoolDayContexts.set(window,{calendar,nonSchoolRanges:(await nonSchoolSettings(year)).ranges})
  return window
}

type ReportAttendanceRecord = { status: string; date: Date; period?: string | null; createdAt?: Date; updatedAt?: Date }

// One official school day is counted once, even after a section transfer or a corrected register.
export const attendanceWithSuspensions = (records: ReportAttendanceRecord[], suspensions: Array<{suspensionStart: Date | null; suspensionEnd: Date | null}>, window: Window, context:SchoolDayContext=schoolDayContexts.get(window)??{}) => {
 const days = new Map<string, ReportAttendanceRecord>()
 const isSchoolDay=(date:Date)=>schoolDayDecision(date.toISOString().slice(0,10),[context.calendar??{name:'historic',startDate:window.gte.toISOString(),endDate:window.lte.toISOString()}],context.nonSchoolRanges??[]).allowed
 const timestamp = (row: ReportAttendanceRecord) => (row.updatedAt ?? row.createdAt ?? row.date).getTime()
 const daily = (row: ReportAttendanceRecord) => !row.period || row.period.toLowerCase() === 'daily'
 for (const row of records) {
  if (row.date < window.gte || row.date > window.lte || !isSchoolDay(row.date)) continue
  const day = row.date.toISOString().slice(0, 10), previous = days.get(day)
  if (!previous || (daily(row) && !daily(previous)) || (daily(row) === daily(previous) && timestamp(row) >= timestamp(previous))) days.set(day, row)
 }
 for (const suspension of suspensions) {
  if (!suspension.suspensionStart || !suspension.suspensionEnd) continue
  const cursor = new Date(Math.max(window.gte.getTime(), suspension.suspensionStart.getTime()))
  const end = new Date(Math.min(window.lte.getTime(), suspension.suspensionEnd.getTime()))
  cursor.setUTCHours(0, 0, 0, 0)
  for (; cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
   const weekday = cursor.getUTCDay(), day = cursor.toISOString().slice(0, 10)
   if (weekday !== 0 && weekday !== 6 && isSchoolDay(cursor)) days.set(day, { ...days.get(day), date: new Date(cursor), status: 'SUSPENDED' })
  }
 }
 return [...days.values()].sort((left, right) => left.date.getTime() - right.date.getTime())
}

export function shouldRefreshReportCardAttendance(card: {attendanceSummary: unknown; publicationStatus?: string; academicCorrections?: unknown}) {
 if (!card.attendanceSummary) return true
 return !hasReportCardAttendanceOverride(card)
}

export function hasReportCardAttendanceOverride(card: {academicCorrections?: unknown}) {
 const corrections = card.academicCorrections && typeof card.academicCorrections === 'object' && !Array.isArray(card.academicCorrections) ? card.academicCorrections as Record<string, unknown> : {}
 // Legacy polished records retain their saved summary; explicit new teacher submissions reset this choice.
 return corrections.attendanceOverride === true || (corrections.attendanceOverride === undefined && typeof corrections.correctedBy === 'string')
}

export function attendanceSummarySnapshotKey(value: unknown) {
 const summary = value && typeof value === 'object' ? value as Record<string, unknown> : {}
 return JSON.stringify(['total','present','absent','late','excused','sick','suspended','attendanceRate'].map(key => summary[key] ?? null))
}
