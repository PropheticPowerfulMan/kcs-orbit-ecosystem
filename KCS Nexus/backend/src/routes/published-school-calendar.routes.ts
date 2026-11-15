import {DRC_HOLIDAYS} from '../utils/schoolDayPolicy.js'
import {Router} from 'express'
import {createHash} from 'node:crypto'
import {academicCalendars} from '../services/reportAttendance.service.js'
import {nonSchoolSettings} from '../services/attendanceCalendarSettings.service.js'
import {asyncHandler,ApiError} from '../utils/api.js'
/** Public school dates only: never exposes identities, organization IDs or audit records. */
export const publishedSchoolCalendarRouter=Router()
publishedSchoolCalendarRouter.get('/',asyncHandler(async(_req,res)=>{
 const calendars=(await academicCalendars()).filter(c=>c.status!=='PLANNED').map(c=>({name:c.name,status:c.status,isCurrent:Boolean(c.isCurrent),startDate:c.startDate,endDate:c.endDate,periods:(c.periods||[]).map(p=>({type:p.type,sequence:p.sequence,code:(p as {code?:string}).code||`${p.type==='SEMESTER'?'S':'Q'}${p.sequence}`,name:(p as {name?:string}).name||`${p.type==='SEMESTER'?'Semester':'Quarter'} ${p.sequence}`,startDate:p.startDate,endDate:p.endDate}))}))
 if(!calendars.length)throw new ApiError(503,'Published school calendar temporarily unavailable')
 const calendar=calendars.find(c=>c.isCurrent)||calendars[0]
 const closures=await Promise.all(calendars.map(async c=>({academicYear:c.name,...await nonSchoolSettings(c.name)})))
 const payload={calendar,calendars,closures,publicHolidays:DRC_HOLIDAYS.map(h=>h[0]),source:'KCS_OFFICIAL'}
 res.setHeader('Cache-Control','public, max-age=0, must-revalidate')
 return res.json({...payload,version:createHash('sha256').update(JSON.stringify(payload)).digest('hex')})
}))
