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

export const VALUE_WORD_AUDIENCES=['GENERAL','LOWER','UPPER']as const
export type ValueWordAudience=typeof VALUE_WORD_AUDIENCES[number]
export function valueWordAudienceForGrade(grade:string|null|undefined):ValueWordAudience|null{const value=String(grade||'').trim();if(/^K[3-5]$/i.test(value))return 'LOWER';const number=/^Grade\s*(\d{1,2})$/i.exec(value);if(!number)return null;const n=Number(number[1]);return n>=9&&n<=12?'UPPER':n>=1&&n<=8?'LOWER':null}
export function valueWordSlots(day:string):ValueWordAudience[]{const weekday=new Date(day+'T12:00:00Z').getUTCDay();return[1,5].includes(weekday)?['GENERAL']:[2,3,4].includes(weekday)?['LOWER','UPPER']:[]}
export function valueWordAudienceLabel(group:string,language:'fr'|'en') {return group==='LOWER'?'K3–Grade 8':group==='UPPER'?'Grade 9–12':language==='fr'?'Assemblée générale · toute l’école':'General assembly · whole school'}
export function valueWordRecipientMatches(group:string,user:{role:string;studentProfile?:{grade:string}|null;parentLinks?:Array<{student:{grade:string}}> ;teacherProfile?:{homeroomGrade:string|null;courses:Array<{grade:string}>}|null}){if(group==='GENERAL'||['ADMIN','STAFF'].includes(user.role))return true;if(user.role==='STUDENT')return valueWordAudienceForGrade(user.studentProfile?.grade)===group;if(user.role==='PARENT')return Boolean(user.parentLinks?.some(p=>valueWordAudienceForGrade(p.student.grade)===group));if(user.teacherProfile)return[user.teacherProfile.homeroomGrade,...user.teacherProfile.courses.map(c=>c.grade)].some(g=>valueWordAudienceForGrade(g)===group);return false}
