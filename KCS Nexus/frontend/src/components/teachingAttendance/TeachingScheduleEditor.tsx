import {useEffect,useMemo,useState} from 'react'
import {CalendarDays,Copy,Loader2,Plus,Save,Search,Trash2} from 'lucide-react'
import {useUIStore} from '@/store/uiStore'
import {teachingAttendanceAPI} from '@/services/api'
import {teachingError,type CourseChoice,type TeachingBoard} from './model'
type Slot={day:string;startTime:string;endTime:string;room:string;className:string;period:number}
export default function TeachingScheduleEditor({courses,calendars,onPublished}:{courses:CourseChoice[];calendars:TeachingBoard['calendars'];onPublished:()=>void}){
 const fr=useUIStore(s=>s.language)==='fr',tr=(a:string,b:string)=>fr?a:b
 const [courseId,setCourseId]=useState(''),[year,setYear]=useState(''),[semester,setSemester]=useState(1),[query,setQuery]=useState('')
 const [slots,setSlots]=useState<Slot[]>([]),[classes,setClasses]=useState<string[]>([]),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false)
 const days=['Monday','Tuesday','Wednesday','Thursday','Friday'],dayLabels=fr?['Lundi','Mardi','Mercredi','Jeudi','Vendredi']:days
 useEffect(()=>{if(!year)setYear(calendars.find(row=>row.isCurrent)?.name||calendars[0]?.name||'')},[calendars,year])
 useEffect(()=>{
  let active=true
  setError('');setSaved(false);setSlots([])
  if(!courseId||!year)return
  setLoading(true)
  teachingAttendanceAPI.schedule({courseId,academicYear:year,semester}).then(r=>{if(active){setSlots(r.data.data.entries.map(({id,...row}:Slot&{id?:string})=>row));setClasses(r.data.data.classes)}}).catch(e=>{if(active)setError(teachingError(e,fr))}).finally(()=>{if(active)setLoading(false)})
  return()=>{active=false}
 },[courseId,year,semester])
 const selected=courses.find(row=>row.id===courseId)
 const options=useMemo(()=>courses.filter(row=>row.id===courseId||[row.name,row.className,row.teacherName,row.code].join(' ').toLocaleLowerCase().includes(query.toLocaleLowerCase())),[courses,courseId,query])
 const update=(index:number,patch:Partial<Slot>)=>{setSlots(rows=>rows.map((row,i)=>i===index?{...row,...patch}:row));setSaved(false)}
 const publish=async()=>{
  if(!courseId||!year||!slots.length||busy)return
  setBusy(true);setError('');setSaved(false)
  try{await teachingAttendanceAPI.publishSchedule({courseId,academicYear:year,semester,entries:slots});setSaved(true);onPublished()}
  catch(e){setError(teachingError(e,fr))}finally{setBusy(false)}
 }
 return <div className="space-y-4" data-teaching-schedule-editor>
  <div className="ta-stat"><h3 className="flex items-center gap-2 text-sm font-bold"><CalendarDays size={18}/>{tr('Publier les créneaux d’un cours','Publish a subject’s time slots')}</h3><p className="ta-muted mt-2 text-xs">{tr('Les horaires identifiables du calendrier officiel sont repris automatiquement. Pour les autres cours, choisissez le professeur et le cours, puis publiez les heures exactes. Les pointages déjà enregistrés gardent leurs heures d’origine.','Unambiguous official timetable entries are linked automatically. For other subjects, select the teacher and subject, then publish the actual teaching times. Previously recorded sessions preserve their original timestamps.')}</p></div>
  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
   <label className="text-xs font-semibold"><span className="mb-1 flex items-center gap-1"><Search size={13}/>{tr('Rechercher un cours / professeur','Find subject / teacher')}</span><input className="ta-field" value={query} onChange={e=>setQuery(e.target.value)}/></label>
   <label className="text-xs font-semibold">{tr('Cours à programmer','Subject to schedule')}<select className="ta-field mt-1" value={courseId} onChange={e=>setCourseId(e.target.value)}><option value="">{tr('Choisir un cours…','Choose a subject…')}</option>{options.map(row=><option key={row.id} value={row.id}>{row.name} · {row.className} · {row.teacherName}</option>)}</select></label>
   <label className="text-xs font-semibold">{tr('Année scolaire officielle','Official school year')}<select className="ta-field mt-1" value={year} onChange={e=>setYear(e.target.value)}>{calendars.map(row=><option value={row.name} key={row.name}>{row.name}</option>)}</select></label>
   <label className="text-xs font-semibold">{tr('Semestre concerné','Teaching semester')}<select className="ta-field mt-1" value={semester} onChange={e=>setSemester(Number(e.target.value))}><option value={1}>{tr('Semestre 1','Semester 1')}</option><option value={2}>{tr('Semestre 2','Semester 2')}</option></select></label>
  </div>
  {error&&<div role="alert" className="ta-alert">{error}</div>}
  {saved&&<p role="status" className="rounded-xl bg-emerald-100 p-3 text-sm font-bold text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200">{tr('Horaire publié. Les séances apparaissent maintenant chez le professeur et dans le suivi du Principal.','Schedule published. Sessions now appear for the teacher and in the Principal’s register.')}</p>}
  {loading?<p role="status" className="ta-muted p-8 text-center text-sm">{tr('Chargement de l’horaire officiel…','Loading the official schedule…')}</p>:selected&&<>
   <div className="ta-muted text-xs"><b>{selected.teacherName}</b> · {selected.name} · {tr('Les heures sont celles de Kinshasa.','All times are in Kinshasa.')}</div>
   <form className="space-y-3" onSubmit={e=>{e.preventDefault();void publish()}}>
    {slots.map((slot,index)=><div className="ta-stat grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_.7fr_.7fr_1fr_auto]" key={index}>
     <label className="text-[11px] font-semibold">{tr('Jour du cours','Teaching day')}<select className="ta-field mt-1" value={slot.day} onChange={e=>update(index,{day:e.target.value})}>{days.map((day,i)=><option key={day} value={day}>{dayLabels[i]}</option>)}</select></label>
     <label className="text-[11px] font-semibold">{tr('Classe / section','Class / section')}<select className="ta-field mt-1" value={slot.className} onChange={e=>update(index,{className:e.target.value})} required><option value="">{tr('Choisir…','Choose…')}</option>{classes.map(value=><option key={value} value={value}>{value}</option>)}</select></label>
     <label className="text-[11px] font-semibold">{tr('Début prévu','Scheduled start')}<input type="time" className="ta-field mt-1" required value={slot.startTime} onChange={e=>update(index,{startTime:e.target.value})}/></label>
     <label className="text-[11px] font-semibold">{tr('Fin prévue','Scheduled end')}<input type="time" className="ta-field mt-1" required min={slot.startTime} value={slot.endTime} onChange={e=>update(index,{endTime:e.target.value})}/></label>
     <label className="text-[11px] font-semibold">{tr('Salle (facultative)','Room (optional)')}<input className="ta-field mt-1" maxLength={100} value={slot.room} onChange={e=>update(index,{room:e.target.value})}/></label>
     <button type="button" className="ta-btn ta-danger" aria-label={tr('Retirer le créneau ','Remove time slot ')+(index+1)} onClick={()=>{setSlots(rows=>rows.filter((_,i)=>i!==index));setSaved(false)}}><Trash2 size={15}/></button>
    </div>)}
    {!slots.length&&<p className="ta-muted rounded-xl border border-dashed border-cyan-700/30 p-6 text-center text-sm">{tr('Aucun horaire relié à ce cours. Ajoutez ses créneaux avant d’activer le pointage.','No timetable is linked to this subject. Add its time slots to enable check-in.')}</p>}
    <div className="flex flex-wrap items-center justify-between gap-3">
     <div className="flex flex-wrap gap-2"><button type="button" className="ta-btn" disabled={busy||slots.length>=50||!classes.length} onClick={()=>{setSlots(rows=>[...rows,{day:'Monday',className:classes[0]||'',startTime:'',endTime:'',room:'',period:Math.max(0,...rows.map(row=>row.period))+1}]);setSaved(false)}}><Plus size={15}/>{tr('Ajouter un créneau','Add time slot')}</button>
      {slots.length===1&&<button type="button" className="ta-btn" disabled={busy} onClick={()=>{setSlots(days.map(day=>({...slots[0],day})));setSaved(false)}}><Copy size={15}/>{tr('Répéter du lundi au vendredi','Repeat Monday to Friday')}</button>}</div>
     <button type="submit" className="ta-btn ta-primary" disabled={busy||!slots.length||!slots.every(row=>row.startTime&&row.endTime&&row.className)}>{busy?<Loader2 className="animate-spin" size={15}/>:<Save size={15}/>} {tr('Publier cet horaire','Publish this schedule')}</button>
    </div>
   </form>
  </>}
 </div>
}
