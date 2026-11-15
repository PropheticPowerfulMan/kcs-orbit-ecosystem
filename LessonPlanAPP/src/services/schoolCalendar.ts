export type SchoolCalendar={name:string;startDate:string;endDate:string;status:string;isCurrent:boolean;periods:Array<{type:string;sequence:number;startDate:string;endDate:string}>}
let current:SchoolCalendar|null=null
try{const saved=JSON.parse(localStorage.getItem('plp:published-school-calendar')||'null');if(saved&&/^\d{4}-\d{4}$/.test(saved.name)&&Array.isArray(saved.periods)&&saved.periods.length===6)current=saved}catch{/* Fresh server read remains available. */}
export async function refreshSchoolCalendar(signal?:AbortSignal){
 const response=await fetch(import.meta.env.VITE_SCHOOL_CALENDAR_URL||'https://kinshasachristianschool.org/api/published-school-calendar',{credentials:'omit',signal});if(!response.ok)throw Error('Published calendar unavailable');const body=await response.json() as {calendar?:SchoolCalendar};const c=body.calendar;
 if(!c||typeof c.isCurrent!=='boolean'||!['ACTIVE','CLOSED','ARCHIVED'].includes(c.status)||!/^\d{4}-\d{4}$/.test(c.name)||!Number.isFinite(Date.parse(c.startDate))||!Number.isFinite(Date.parse(c.endDate))||c.startDate>c.endDate||!Array.isArray(c.periods)||c.periods.length!==6)throw Error('Invalid published calendar');current=c;try{localStorage.setItem('plp:published-school-calendar',JSON.stringify(c))}catch{/* Keep the verified in-memory calendar. */}return c
}
export function publishedLessonDefaults(now=new Date()){
 if(!current)return null
 const day=now.toLocaleDateString('en-CA',{timeZone:'Africa/Kinshasa'}),ordinals=['1st','2nd','3rd','4th'];
 const quarter=current.periods.find(p=>p.type==='QUARTER'&&day>=p.startDate.slice(0,10)&&day<=p.endDate.slice(0,10)),semester=current.periods.find(p=>p.type==='SEMESTER'&&day>=p.startDate.slice(0,10)&&day<=p.endDate.slice(0,10));
 return {schoolYear:current.name,semester:ordinals[(semester?.sequence||1)-1],quarter:ordinals[(quarter?.sequence||1)-1]}
}
