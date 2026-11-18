export const TEACHING_TIMEZONE = 'Africa/Kinshasa'
export const dayOfSchool = (value: Date) => new Intl.DateTimeFormat('en-CA', {
  timeZone: TEACHING_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
}).format(value)
export const schoolInstant = (day: string, time: string) => new Date(day + 'T' + time + ':00+01:00')
export const normalizeTeachingLabel = (value: string | null | undefined) => (value || '')
  .normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
export const weekdayOfSchool = (day: string) => ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date(day + 'T12:00:00Z').getUTCDay()]
export function canonicalTeachingDay(value: string) {
  const label = normalizeTeachingLabel(value)
  const index = [['monday','lundi','mon'],['tuesday','mardi','tue'],['wednesday','mercredi','wed'],['thursday','jeudi','thu'],['friday','vendredi','fri']].findIndex(names => names.includes(label))
  return ['Monday','Tuesday','Wednesday','Thursday','Friday'][index] || null
}
export function sameTeacherName(official: string | null, name: string) {
  const titles = new Set(['mr','mrs','ms','dr','mme','m'])
  const tokens = (value: string) => normalizeTeachingLabel(value).split(' ').filter(token => token && !titles.has(token)).sort()
  const a = tokens(official || ''), b = tokens(name)
  // One shared name is insufficient: never attribute a colleague's session.
  return a.length >= 2 && a.length === b.length && a.every((token, i) => token === b[i])
}
export type TimingRecord = {
  schoolDate: string; expectedStartAt: Date | string; expectedEndAt: Date | string
  checkInAt?: Date | string | null; checkOutAt?: Date | string | null; reviewStatus?: string
}
const at = (value: string | Date) => new Date(value).getTime()
const round = (value: number) => Math.round(value * 10) / 10
export function teachingTiming(record: TimingRecord, now: Date) {
  const start = at(record.expectedStartAt), end = at(record.expectedEndAt)
  const entry = record.checkInAt ? at(record.checkInAt) : null
  const exit = record.checkOutAt ? at(record.checkOutAt) : null
  const due = now.getTime() >= start, ended = now.getTime() >= end
  return {
    due, ended,
    status: entry !== null ? exit !== null ? 'COMPLETED' : ended ? 'MISSING_EXIT' : 'IN_CLASS' : ended ? 'UNRECORDED' : due ? 'AWAITING_ENTRY' : 'UPCOMING',
    lateMinutes: entry === null ? null : round(Math.max(0, (entry - start) / 60000)),
    earlyExitMinutes: exit === null ? null : round(Math.max(0, (end - exit) / 60000)),
    actualMinutes: entry === null || exit === null ? null : round(Math.max(0, (exit - entry) / 60000)),
    coveredMinutes: entry === null || exit === null ? null : round(Math.max(0, (Math.min(exit, end) - Math.max(entry, start)) / 60000)),
    expectedMinutes: round(Math.max(0, (end - start) / 60000)),
    onTime: entry === null ? null : entry <= start,
  }
}
export function wilsonInterval(successes: number, total: number): [number, number] | null {
  if (!total) return null
  const z = 1.96, p = successes / total, d = 1 + z*z/total
  const centre = (p + z*z/(2*total))/d
  const delta = z * Math.sqrt(p*(1-p)/total + z*z/(4*total*total))/d
  return [round(Math.max(0, centre-delta)*100), round(Math.min(1, centre+delta)*100)]
}
export function teachingStatistics(records: TimingRecord[], now: Date) {
  const timings = records.map(record => teachingTiming(record, now))
  const recorded = timings.filter(row => row.onTime !== null)
  const late = recorded.map(row => row.lateMinutes!).sort((a,b) => a-b)
  const onTime = recorded.filter(row => row.onTime).length
  const percentile = (p: number) => late.length ? late[Math.min(late.length-1, Math.ceil(late.length*p)-1)] : null
  const mean = late.length ? round(late.reduce((a,b) => a+b,0)/late.length) : null
  const median = late.length ? round((late[Math.floor((late.length-1)/2)] + late[Math.floor(late.length/2)])/2) : null
  const due = timings.filter(row => row.due).length
  return {
    scheduled: records.length, due, recorded: recorded.length,
    unrecorded: timings.filter(row => row.status === 'UNRECORDED').length,
    awaiting: timings.filter(row => row.status === 'AWAITING_ENTRY').length,
    inClass: timings.filter(row => row.status === 'IN_CLASS').length,
    completed: timings.filter(row => row.status === 'COMPLETED').length,
    missingExits: timings.filter(row => row.status === 'MISSING_EXIT').length,
    onTime, late: recorded.length-onTime,
    punctualityRate: recorded.length ? round(onTime/recorded.length*100) : null,
    recordedPresenceRate: due ? round(timings.filter(row => row.due && row.onTime !== null).length/due*100) : null,
    meanLateMinutes: mean, medianLateMinutes: median, p95LateMinutes: percentile(.95),
    earlyExits: timings.filter(row => (row.earlyExitMinutes ?? 0) > 0).length,
    actualMinutes: round(timings.reduce((sum,row) => sum+(row.actualMinutes??0),0)),
    punctuality95: wilsonInterval(onTime, recorded.length),
  }
}
export function coursePresenceStatistics(statuses: string[]) {
  const present = statuses.filter(value => value === 'PRESENT').length
  const late = statuses.filter(value => value === 'LATE').length
  return { recorded: statuses.length, present, late, absent: statuses.length-present-late,
    attendanceRate: statuses.length ? round((present+late)/statuses.length*100) : null,
    presence95: wilsonInterval(present+late, statuses.length) }
}

/** A short timetable name is accepted only after course/class matching yields
 * exactly one owner across the school. Never use one shared token alone. */
export function teachingAliasMatches(alias:string|null,fullName:string){
 const titles=new Set(['mr','mrs','ms','dr','mme','m','pastor','pasteur'])
 const tokens=(value:string)=>normalizeTeachingLabel(value).split(' ').filter(token=>token&&!titles.has(token))
 const complete=tokens(fullName)
 return (alias||'').split('/').some(value=>{const parts=tokens(value);return parts.length>0&&parts.every(token=>complete.includes(token))})
}
export const normalizedTeachingSubject=(value:string)=>normalizeTeachingLabel(value).replace(/ /g,'')
export function uniquelyAssignedCourse<T extends {id:string}>(candidates:T[]):T|null {
 const unique=[...new Map(candidates.map(value=>[value.id,value])).values()]
 return unique.length===1?unique[0]:null
}
