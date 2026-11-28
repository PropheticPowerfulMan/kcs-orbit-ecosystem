export const VALUE_WORD_OFFSETS=[7,3,1]as const
export const valueWordDate=(now=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Kinshasa',year:'numeric',month:'2-digit',day:'2-digit'}).format(now)
export const shiftValueWordDate=(day:string,days:number)=>new Date(Date.parse(day+'T12:00:00Z')+days*86400000).toISOString().slice(0,10)
export const valueWordTime=(day:string,time:string)=>new Date(day+'T'+time+':00+01:00')
export function currentValueWordReminder(startsAt:Date,now:Date){if(now>=startsAt)return null;return [...VALUE_WORD_OFFSETS].reverse().find(days=>now.getTime()>=startsAt.getTime()-days*86400000)??null}
type Person={id:string;name:string;group:'TEACHER'|'STAFF'}
/** Deterministic rotation: fewest booked turns, then oldest turn, then name/id. */
export function valueWordRotation(days:string[],people:Person[],history:Array<{schoolDate:string;speakerReference:string;status:string}>,staffWeekday=5){
 const counts=new Map<string,number>(),last=new Map<string,string>();for(const row of history)if(row.status!=='CANCELLED'){counts.set(row.speakerReference,(counts.get(row.speakerReference)||0)+1);last.set(row.speakerReference,[last.get(row.speakerReference)||'',row.schoolDate].sort().at(-1)!)}
 return days.map(day=>{const preferStaff=new Date(day+'T12:00:00Z').getUTCDay()===staffWeekday;let group=people.filter(p=>p.group===(preferStaff?'STAFF':'TEACHER'));if(!group.length)group=people.filter(p=>p.group==='TEACHER');if(!group.length)group=people;const person=[...group].sort((a,b)=>(counts.get(a.id)||0)-(counts.get(b.id)||0)||(last.get(a.id)||'').localeCompare(last.get(b.id)||'')||a.name.localeCompare(b.name,['fr','en'],{sensitivity:'base'})||a.id.localeCompare(b.id))[0];if(!person)return null;counts.set(person.id,(counts.get(person.id)||0)+1);last.set(person.id,day);return{day,person}}).filter((r):r is NonNullable<typeof r>=>Boolean(r))
}
