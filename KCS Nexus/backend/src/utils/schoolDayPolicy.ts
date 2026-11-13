export type NonSchoolRange = {startDate: string; endDate: string; label: string}
export type SchoolCalendar = {name: string; startDate: string; endDate: string; status?: string; periods?: Array<{type: string; sequence: number; startDate: string; endDate: string}>}
export const DRC_HOLIDAYS = [
 ['01-01','Nouvel An','New Year'],['01-04','Martyrs de l’indépendance','Independence Martyrs'],
 ['01-16','Laurent-Désiré Kabila','Laurent-Désiré Kabila'],['01-17','Patrice Emery Lumumba','Patrice Emery Lumumba'],
 ['04-06','Simon Kimbangu et conscience africaine','Simon Kimbangu and African Consciousness'],['05-01','Fête du Travail','Labour Day'],
 ['05-17','Forces armées','Armed Forces Day'],['06-30','Indépendance','Independence Day'],['08-01','Fête des parents','Parents’ Day'],['12-25','Noël','Christmas'],
] as const
// Ordonnance 23/042, 30 March 2023. The school calendar may add exceptional closures.
export function schoolDayDecision(day: string, calendars: SchoolCalendar[], ranges: NonSchoolRange[] = []) {
 const date=new Date(day+'T00:00:00.000Z')
 const blocked=(code:string,fr:string,en:string)=>({date:day,allowed:false,code,reason:{fr,en},academicYear:null as string|null})
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==day)return blocked('INVALID_DATE','Date invalide.','Invalid date.')
 if([0,6].includes(date.getUTCDay()))return blocked('WEEKEND','Samedi et dimanche : aucune saisie de présence.','Saturday and Sunday: attendance entry is closed.')
 const holiday=DRC_HOLIDAYS.find(([md])=>day.slice(5)===md)
 if(holiday)return blocked('DRC_HOLIDAY','Jour férié RDC : '+holiday[1]+'.','DRC public holiday: '+holiday[2]+'.')
 const calendar=calendars.find(c=>c.status!=='PLANNED'&&day>=c.startDate.slice(0,10)&&day<=c.endDate.slice(0,10))
 if(!calendar)return blocked('OUTSIDE_PUBLISHED_CALENDAR','Cette date ne fait pas partie d’une année scolaire publiée.','This date is outside the published school calendar.')
 const closure=ranges.find(r=>day>=r.startDate&&day<=r.endDate)
 if(closure)return {...blocked('SCHOOL_CLOSED','École fermée : '+closure.label+'.','School closed: '+closure.label+'.'),academicYear:calendar.name}
 const quarters=(calendar.periods??[]).filter(p=>['QUARTER','TRIMESTER'].includes(p.type))
 if(quarters.length&&!quarters.some(p=>day>=p.startDate.slice(0,10)&&day<=p.endDate.slice(0,10)))return {...blocked('BETWEEN_SCHOOL_PERIODS','Jour sans cours entre deux périodes scolaires.','Non-instructional day between school periods.'),academicYear:calendar.name}
 return {date:day,allowed:true,code:'SCHOOL_DAY',reason:{fr:'Jour ouvrable du calendrier scolaire.',en:'Working day in the school calendar.'},academicYear:calendar.name}
}
