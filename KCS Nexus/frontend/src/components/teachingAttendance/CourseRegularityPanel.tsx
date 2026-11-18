import {useEffect,useState} from 'react'
import {Link} from 'react-router-dom'
import {ChevronDown,ClipboardCheck,RefreshCw,Search} from 'lucide-react'
import {teachingAttendanceAPI} from '@/services/api'
import {useUIStore} from '@/store/uiStore'
import {percentage,teachingError,type PresenceSummary} from './model'
import './teachingAttendance.css'
type Regularity={sessionCount:number;summary:PresenceSummary;students:Array<PresenceSummary&{studentId:string;name:string;studentNumber:string;expected:number;unmarked:number}>}
export default function CourseRegularityPanel({courseId,academicYear,term}:{courseId:string;academicYear:string;term:string}){
 const fr=useUIStore(s=>s.language)==='fr',tr=(a:string,b:string)=>fr?a:b
 const [data,setData]=useState<Regularity|null>(null),[open,setOpen]=useState(false),[error,setError]=useState(''),[query,setQuery]=useState(''),[version,setVersion]=useState(0)
 useEffect(()=>{
  let active=true;setData(null);setError('')
  if(courseId)teachingAttendanceAPI.regularity({courseId,academicYear,term}).then(r=>{if(active)setData(r.data.data)}).catch(e=>{if(active)setError(teachingError(e,fr))})
  return()=>{active=false}
 },[courseId,academicYear,term,version])
 useEffect(()=>{
  const refresh=()=>{if(document.visibilityState==='visible')setVersion(n=>n+1)}
  window.addEventListener('kcs-course-attendance-saved',refresh);document.addEventListener('visibilitychange',refresh)
  const interval=setInterval(refresh,20000)
  return()=>{window.removeEventListener('kcs-course-attendance-saved',refresh);document.removeEventListener('visibilitychange',refresh);clearInterval(interval)}
 },[])

 const rows=(data?.students||[]).filter(row=>(row.name+' '+row.studentNumber).toLocaleLowerCase().includes(query.toLocaleLowerCase()))
 return <section className="teaching-workspace" data-course-regularity>
  <div className="ta-panel">
   <div className="flex flex-wrap items-center justify-between gap-3"><button type="button" className="flex min-w-0 items-center gap-3 text-left" aria-expanded={open} onClick={()=>setOpen(v=>!v)}><ClipboardCheck size={20} className="shrink-0 text-cyan-600 dark:text-cyan-300"/><span><b className="block text-sm">{tr('Régularité au cours','Course regularity')}</b><span className="ta-muted text-xs">{data?data.sessionCount+' '+tr('séance(s) · présence ','session(s) · attendance ')+percentage(data.summary.attendanceRate):error?tr('Registre momentanément indisponible','Register temporarily unavailable'):tr('Chargement…','Loading…')}</span></span><ChevronDown size={16} className={open?'rotate-180':''}/></button>
    <div className="flex items-center gap-2"><button type="button" className="ta-btn" aria-label={tr('Actualiser la régularité','Refresh regularity')} onClick={()=>setVersion(n=>n+1)}><RefreshCw size={14}/></button><Link to="/portal/teacher/course-attendance" className="ta-btn">{tr('Ouvrir les séances','Open sessions')}</Link></div>
   </div>
   {open&&<div className="mt-4 space-y-3"><p className="ta-muted text-xs">{tr('Indicateur de suivi uniquement : les présences par cours n’altèrent ni la moyenne ni le bulletin. Les cases non renseignées restent inconnues.','Follow-up indicator only: session attendance does not change averages or report cards. Unrecorded statuses remain unknown.')}</p>
    {error?<div role="alert" className="ta-alert">{error}</div>:<><label className="block max-w-md"><span className="ta-muted mb-1 flex items-center gap-2 text-xs"><Search size={13}/>{tr('Rechercher un élève','Find a learner')}</span><input className="ta-field" value={query} onChange={e=>setQuery(e.target.value)}/></label><div className="ta-scroll"><table className="ta-table"><thead><tr><th>{tr('Élève','Learner')}</th><th>{tr('Présences','Present')}</th><th>{tr('Retards','Late')}</th><th>{tr('Absences','Absent')}</th><th>{tr('Non renseigné','Unrecorded')}</th><th>{tr('Régularité','Regularity')}</th></tr></thead><tbody>{rows.map(row=><tr key={row.studentId}><td>{row.name}</td><td>{row.present}</td><td>{row.late}</td><td>{row.absent}</td><td>{row.unmarked}</td><td className="font-bold">{percentage(row.attendanceRate)}</td></tr>)}</tbody></table>{!rows.length&&<p className="ta-muted p-5 text-sm">{tr('Aucune présence par cours dans cette période.','No session attendance in this period.')}</p>}</div></>}
   </div>}
  </div>
 </section>
}
