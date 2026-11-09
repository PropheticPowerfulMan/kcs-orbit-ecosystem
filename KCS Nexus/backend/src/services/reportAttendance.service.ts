import { env } from '../config/env.js'

type Window = { gte: Date; lte: Date }
type Calendar = { name: string; startDate: string; endDate: string; periods?: Array<{ type: string; sequence: number; startDate: string; endDate: string }> }
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

async function calendars(): Promise<Calendar[]> {
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
  return attendanceWindowForCalendar(year, term, (await calendars()).find(item => item.name === year))
}

export const attendanceWithSuspensions=(records:Array<{status:string;date:Date}>,suspensions:Array<{suspensionStart:Date|null;suspensionEnd:Date|null}>,window:{gte:Date;lte:Date})=>{
 const effective=[...records],registeredDays=new Set(records.map(item=>item.date.toISOString().slice(0,10)))
 for(const suspension of suspensions){
  if(!suspension.suspensionStart||!suspension.suspensionEnd)continue
  const cursor=new Date(Math.max(window.gte.getTime(),suspension.suspensionStart.getTime())),end=new Date(Math.min(window.lte.getTime(),suspension.suspensionEnd.getTime()))
  cursor.setUTCHours(0,0,0,0)
  for(;cursor<=end;cursor.setUTCDate(cursor.getUTCDate()+1)){
   const weekday=cursor.getUTCDay(),key=cursor.toISOString().slice(0,10)
   if(weekday!==0&&weekday!==6&&!registeredDays.has(key)){effective.push({status:'SUSPENDED',date:new Date(cursor)});registeredDays.add(key)}
  }
 }
 return effective
}
