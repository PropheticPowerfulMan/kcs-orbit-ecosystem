import { quarterTerms } from './academicPeriodPolicy.js'
export const ACADEMIC_CLOSURE_GRACE_DAYS = 7
export const SCHOOL_CLOSURE_TIME_ZONE = 'Africa/Kinshasa'
export type ClosureCalendar = {name:string;status?:string;isCurrent?:boolean;startDate:string;endDate:string;periods?:Array<{type:string;sequence:number;startDate:string;endDate:string}>}
const day=(value:string)=>{
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}(?:$|T)/.test(value))return null
 const part=value.slice(0,10),date=new Date(part+'T00:00:00.000Z')
 return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===part&&Number.isFinite(new Date(value).getTime())?part:null
}
export function academicClosureGraceEndDate(endDate:string){
 const value=day(endDate);if(!value)return null
 const date=new Date(value+'T00:00:00.000Z');date.setUTCDate(date.getUTCDate()+ACADEMIC_CLOSURE_GRACE_DAYS)
 return date.toISOString().slice(0,10)
}
export function automaticAcademicClosures(calendars:ClosureCalendar[],now=new Date()){
 if(!Number.isFinite(now.getTime()))return []
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:SCHOOL_CLOSURE_TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now)
 const schoolDay=['year','month','day'].map(type=>parts.find(p=>p.type===type)?.value).join('-')
 const due:Array<{academicYear:string;term:string;graceEndDate:string;endDate:string;rank:number;calendar:ClosureCalendar}>=[]
 for(const calendar of calendars){
  const status=String(calendar.status??'').toUpperCase()
  if(status==='DRAFT'||(!['PUBLISHED','ACTIVE','CLOSED'].includes(status)&&!calendar.isCurrent))continue
  const start=day(calendar.startDate),end=day(calendar.endDate)
  const years=/^(\d{4})-(\d{4})$/.exec(calendar.name)
  if(!years||Number(years[2])!==Number(years[1])+1||!start||!end||start>end)continue
  const periods=[...(calendar.periods??[]).flatMap(p=>{
   const type=String(p.type).toUpperCase()
   const term=['QUARTER','TRIMESTER'].includes(type)?quarterTerms[p.sequence-1]:type==='SEMESTER'&&[1,2].includes(p.sequence)?'Semester '+p.sequence:null
   return term?[{...p,term,rank:type==='SEMESTER'?p.sequence*2+.5:p.sequence}]:[]
  }),{startDate:calendar.startDate,endDate:calendar.endDate,term:'Annual final',rank:5}]
  for(const period of periods){
   const periodStart=day(period.startDate),periodEnd=day(period.endDate),grace=academicClosureGraceEndDate(period.endDate)
   if(!periodStart||!periodEnd||!grace||periodStart<start||periodEnd>end||periodStart>periodEnd||schoolDay<=grace)continue
   due.push({academicYear:calendar.name,term:period.term,graceEndDate:grace,endDate:periodEnd,rank:period.rank,calendar})
  }
 }
 return [...new Map(due.map(item=>[item.academicYear+'::'+item.term,item])).values()].sort((a,b)=>a.graceEndDate.localeCompare(b.graceEndDate)||a.rank-b.rank)
}
