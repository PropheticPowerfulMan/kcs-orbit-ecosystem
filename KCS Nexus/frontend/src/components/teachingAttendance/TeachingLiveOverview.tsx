import {Clock3,DoorOpen,AlertTriangle,Users,CheckCircle2} from 'lucide-react'
import {sessionLabels,timeLabel,type TeachingSession,type ScheduleWarning} from './model'

export default function TeachingLiveOverview({sessions,warnings,now,fr,onReview,onSchedules}:{
 sessions:TeachingSession[];warnings:ScheduleWarning[];now:Date|null;fr:boolean;
 onReview:(row:TeachingSession)=>void;onSchedules:()=>void;
}){
 const tr=(a:string,b:string)=>fr?a:b,at=now?.getTime()||0
 const active=sessions.filter(row=>{
  const start=Date.parse(row.expectedStartAt),end=Date.parse(row.expectedEndAt)
  return (start<=at&&at<end)||(!!row.checkInAt&&!row.checkOutAt&&at<end)
 })
 const today=now?new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Kinshasa',year:'numeric',month:'2-digit',day:'2-digit'}).format(now):''
 const missing=sessions.filter(row=>row.schoolDate===today&&row.checkInAt&&!row.checkOutAt&&Date.parse(row.expectedEndAt)<=at)
 const present=active.filter(row=>row.checkInAt&&!row.checkOutAt)
 const onTime=present.filter(row=>Date.parse(row.checkInAt!)<=Date.parse(row.expectedStartAt)).length
 const late=present.length-onTime,waiting=active.filter(row=>!row.checkInAt).length
 const unresolved=warnings.filter(row=>Date.parse(row.expectedStartAt)<=at&&at<Date.parse(row.expectedEndAt))
 const next=sessions.find(row=>Date.parse(row.expectedStartAt)>at)
 const state=(row:TeachingSession)=>row.checkOutAt?'COMPLETED':!row.checkInAt?'AWAITING_ENTRY':Date.parse(row.checkInAt)<=Date.parse(row.expectedStartAt)?'ON_TIME':'LATE'
 const labels:Record<string,string>={COMPLETED:tr('Sortie pointée','Checked out'),AWAITING_ENTRY:tr('Pas encore pointé','Not checked in'),ON_TIME:tr('En salle · à l’heure','Checked in · on time'),LATE:tr('En salle · en retard','Checked in · late')}
 return <section className="ta-panel space-y-3" data-teaching-live>
  <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="flex items-center gap-2 text-base font-black"><DoorOpen size={19}/>{tr('Les classes en direct','Live classroom overview')}</h3><p className="ta-muted mt-1 text-xs">{tr('Selon les pointages et l’horaire officiel · mise à jour automatique.','Based on check-ins and the official timetable · updates automatically.')}</p></div><span className="ta-badge" data-state="IN_CLASS"><span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"/>{tr('En direct','Live')} · Kinshasa</span></div>
  <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">{[
   [tr('En salle (pointage)','In class (check-in)'),present.length,Users,'IN_CLASS'],
   [tr('Arrivés à l’heure','Arrived on time'),onTime,CheckCircle2,'ON_TIME'],
   [tr('Arrivés en retard','Arrived late'),late,Clock3,'LATE'],
   [tr('Encore attendus','Still expected'),waiting,AlertTriangle,'AWAITING_ENTRY'],
  ].map(([label,value,Icon,status])=>{const Glyph=Icon as typeof Users;return <div className="ta-stat" data-live-status={String(status)} key={String(status)}><span className="flex items-center gap-2"><Glyph size={14}/>{String(label)}</span><b>{Number(value)}</b></div>})}</div>
  {active.length>0&&<div className="hidden overflow-x-auto md:block"><table className="ta-table min-w-[600px]"><thead><tr>{[tr('Enseignant','Teacher'),tr('Cours / classe / salle','Subject / class / room'),tr('Horaire et entrée','Schedule and entry'),tr('Situation en direct','Live status'),''].map((label,i)=><th key={i}>{label}</th>)}</tr></thead><tbody>{active.map(row=><tr key={row.courseReference+row.scheduleKey+row.schoolDate} data-live-session={row.courseReference}>
   <td className="max-w-[180px] break-words font-bold">{row.teacherName}</td><td className="max-w-[230px] break-words">{row.courseName}<span className="ta-muted block text-[10px]">{row.className} · {row.room||'—'}</span></td><td>{timeLabel(row.expectedStartAt,fr)}–{timeLabel(row.expectedEndAt,fr)}<span className="ta-muted block text-[10px]">{tr('Entrée : ','Entry: ')}{timeLabel(row.checkInAt,fr)}</span></td><td><span className="ta-badge" data-state={state(row)}>{labels[state(row)]}</span></td><td><button type="button" className="ta-btn !px-2 !py-1 !text-[10px]" onClick={()=>onReview(row)}>{tr('Examiner','Review')}</button></td>
  </tr>)}</tbody></table></div>}
  <div className="grid gap-2 md:hidden">{active.map(row=><article className="rounded-xl border border-slate-400/25 p-3" key={row.courseReference+row.scheduleKey+row.schoolDate} data-live-session={row.courseReference}>
   <div className="flex flex-wrap items-center justify-between gap-2"><b className="text-xs">{row.teacherName}</b><span className="ta-badge" data-state={state(row)}>{labels[state(row)]}</span></div>
   <p className="mt-2 text-xs font-semibold">{row.courseName} · {row.className}</p><div className="mt-2 flex flex-wrap items-center justify-between gap-2"><span className="ta-muted text-[11px]">{timeLabel(row.expectedStartAt,fr)}–{timeLabel(row.expectedEndAt,fr)} · {row.room||tr('Salle non précisée','Room not specified')}{row.checkInAt?' · '+tr('Entrée : ','Entry: ')+timeLabel(row.checkInAt,fr):''}</span><button type="button" className="ta-btn !px-2 !py-1 !text-[10px]" onClick={()=>onReview(row)}>{tr('Examiner','Review')}</button></div>
  </article>)}</div>
  {!active.length&&<div className="ta-stat text-xs"><p>{tr('Aucun cours en cours à cette heure dans la sélection.','No class is currently scheduled in this selection.')}</p>{next&&<p className="ta-muted mt-2">{tr('Prochain cours : ','Next class: ')}{next.teacherName} · {next.courseName} · {next.className} · {next.schoolDate} {timeLabel(next.expectedStartAt,fr)}</p>}</div>}
  {missing.length>0&&<details className="ta-stat text-xs"><summary className="cursor-pointer font-bold">{tr('Sorties à clarifier','Checkouts to clarify')} · {missing.length}</summary><p className="ta-muted mt-2">{tr('Ces séances sont terminées. Sans sortie enregistrée, aucune présence actuelle en salle n’est supposée.','These sessions have ended. A missing checkout does not establish current presence in class.')}</p><div className="mt-2 space-y-2">{missing.map(row=><div key={row.courseReference+row.scheduleKey+row.schoolDate} className="flex flex-wrap justify-between gap-2"><span>{row.teacherName} · {row.courseName} · {row.className} · {row.schoolDate}</span><span className="ta-badge" data-state="MISSING_EXIT">{sessionLabels.MISSING_EXIT[fr?0:1]}</span></div>)}</div></details>}
  {unresolved.length>0&&<div className="ta-alert text-xs"><b>{tr('Créneaux en cours à relier à un cours : ','Current timetable slots awaiting a course link: ')}{unresolved.length}</b><p className="mt-1">{tr('Ils restent séparés des absences : le pointage ne sera possible qu’après résolution de la correspondance.','They remain separate from absences: check-in becomes available after the course match is resolved.')}</p><button type="button" className="ta-btn mt-2" onClick={onSchedules}>{tr('Programmer les cours','Schedule subjects')}</button></div>}
 </section>
}
