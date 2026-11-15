type Calendar={name:string;isCurrent?:boolean;status?:string;startDate:string;periods?:Array<{type:string;sequence:number;startDate:string;endDate:string}>}
/** Timetables follow the published year and date; grade-entry closure is a separate explicit decision. */
export function publishedSemesterScope(calendars:Calendar[],day:string){
 const published=calendars.filter(c=>c.status!=='PLANNED').sort((a,b)=>b.startDate.localeCompare(a.startDate));const year=published.find(c=>c.isCurrent)||published[0];if(!year)return null;
 const periods=(year.periods||[]).filter(p=>p.type==='SEMESTER').sort((a,b)=>a.sequence-b.sequence);
 const semester=periods.find(p=>day>=p.startDate.slice(0,10)&&day<=p.endDate.slice(0,10))||periods.filter(p=>p.startDate.slice(0,10)<=day).at(-1)||periods[0];
 return {academicYear:year.name,semester:semester?.sequence||1};
}
