import { prisma } from '../config/prisma.js'
import { academicCalendars } from './reportAttendance.service.js'
import { schoolDayDecision, type NonSchoolRange } from '../utils/schoolDayPolicy.js'
import { ApiError } from '../utils/api.js'
import {nonSchoolSettings} from './attendanceCalendarSettings.service.js'
export {attendanceCalendarKey,nonSchoolSettings} from './attendanceCalendarSettings.service.js'
export async function attendanceDayAccess(day:string){
 const calendars=await academicCalendars()
 const calendar=calendars.find(c=>day>=c.startDate.slice(0,10)&&day<=c.endDate.slice(0,10))
 const settings=calendar?await nonSchoolSettings(calendar.name):{ranges:[]}
 return schoolDayDecision(day,calendars,settings.ranges)
}
export async function assertAttendanceSchoolDay(date:Date){
 const access=await attendanceDayAccess(date.toISOString().slice(0,10))
 if(!access.allowed)throw new ApiError(409,'ATTENDANCE_DAY_CLOSED: '+access.reason.fr+' / '+access.reason.en)
 return access
}
