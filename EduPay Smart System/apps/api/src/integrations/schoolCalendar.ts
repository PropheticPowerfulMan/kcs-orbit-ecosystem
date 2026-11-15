export type PublishedSchoolCalendar={name:string;startDate:string;endDate:string;status:'ACTIVE'|'CLOSED'|'ARCHIVED';isCurrent:boolean;periods:Array<{type:string;sequence:number;startDate:string;endDate:string}>}
export function createSchoolCalendarReader(url:string,request:typeof fetch=fetch,now=Date.now){
 let cached:PublishedSchoolCalendar|null=null,expires=0,pending:Promise<PublishedSchoolCalendar|null>|null=null
 const load=async()=>{if(now()<expires)return cached;if(pending)return pending;pending=(async()=>{try{const response=await request(url,{signal:AbortSignal.timeout(2500)});if(!response.ok)throw Error('Calendar unavailable');const body=await response.json() as {calendar?:PublishedSchoolCalendar};const c=body.calendar;if(!c||!/^\d{4}-\d{4}$/.test(c.name)||typeof c.isCurrent!=='boolean'||!['ACTIVE','CLOSED','ARCHIVED'].includes(c.status)||!Number.isFinite(Date.parse(c.startDate))||!Number.isFinite(Date.parse(c.endDate))||c.startDate>c.endDate||!Array.isArray(c.periods)||c.periods.length!==6)throw Error('Invalid school calendar');cached=c;expires=now()+30000}catch{expires=now()+5000}finally{pending=null}return cached})();return pending}
 return Object.assign(load,{peek:()=>cached})
}
const reader=createSchoolCalendarReader(process.env.KCS_SCHOOL_CALENDAR_URL||'https://kinshasachristianschool.org/api/published-school-calendar')
export const readPublishedSchoolCalendar=()=>process.env.NODE_ENV==='test'&&!process.env.KCS_SCHOOL_CALENDAR_URL?Promise.resolve(null):reader()

export const cachedPublishedSchoolCalendar=()=>reader.peek()
