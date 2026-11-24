import {alphabeticCourseLearners} from '@/utils/courseLearnerOrder'
import {useEffect,useRef,useState} from 'react'
import {CheckCheck,Loader2,Save,Search} from 'lucide-react'
import {teachingAttendanceAPI} from '@/services/api'
import {useUIStore} from '@/store/uiStore'
import TeachingDialog from './TeachingDialog'
import {statusLabels,teachingError,type LearnerStatus,type RosterLearner,type SessionRegister,type TeachingSession} from './model'
export default function SessionRosterDialog({session,manager,onClose,onSaved}:{session:TeachingSession;manager:boolean;onClose:()=>void;onSaved:()=>void}){
 const fr=useUIStore(s=>s.language)==='fr',tr=(a:string,b:string)=>fr?a:b
 const [data,setData]=useState<SessionRegister|null>(null),[rows,setRows]=useState<RosterLearner[]>([]),[query,setQuery]=useState('')
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[dirty,setDirty]=useState(false)
 const original=useRef(new Set<string>()),saveRef=useRef<()=>void>(()=>{})
 useEffect(()=>{
  let active=true;setLoading(true)
  teachingAttendanceAPI.register(session.id!).then(response=>{
   if(!active)return
   const register=response.data.data as SessionRegister
   setData(register);setRows(alphabeticCourseLearners(register.roster));original.current=new Set(register.roster.filter(row=>row.status).map(row=>row.studentId));setError('')
  }).catch(e=>{if(active)setError(teachingError(e,fr))}).finally(()=>{if(active)setLoading(false)})
  return()=>{active=false}
 },[session.id])
 const save=async()=>{
  if(!data||busy||manager)return
  const entries=rows.filter(row=>row.eligible&&row.status).map(row=>({studentId:row.studentId,status:row.status as LearnerStatus,...(row.note.trim()?{note:row.note.trim()}:{})}))
  if(!entries.length){setError(tr('Choisissez au moins un statut avant d’enregistrer.','Choose at least one status before saving.'));return}
  setBusy(true);setError('')
  try{await teachingAttendanceAPI.saveRegister(session.id!,{revision:data.session.rosterRevision,entries});setDirty(false);window.dispatchEvent(new Event('kcs-course-attendance-saved'));onSaved()}
  catch(e){setError(teachingError(e,fr))}
  finally{setBusy(false)}
 }
 saveRef.current=()=>{void save()}
 useEffect(()=>{
  const shortcut=(event:KeyboardEvent)=>{if(!manager&&(event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();event.stopImmediatePropagation();saveRef.current()}}
  document.addEventListener('keydown',shortcut,true)
  return()=>document.removeEventListener('keydown',shortcut,true)
 },[manager])
 const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
 const filtered=rows.filter(row=>normalize([row.name,row.studentNumber,row.className].join(' ')).includes(normalize(query.trim())))
 const update=(id:string,change:Partial<RosterLearner>)=>{setRows(current=>current.map(row=>row.studentId===id?{...row,...change}:row));setDirty(true)}
 return <TeachingDialog title={tr('Présences des élèves · ','Learner attendance · ')+session.courseName} onClose={()=>{if(!busy)onClose()}} footer={<>
  <button type="button" className="ta-btn" onClick={onClose} disabled={busy}>{tr('Fermer','Close')}</button>
  {!manager&&<button type="button" className="ta-btn ta-primary" onClick={()=>void save()} disabled={busy||loading||!data||!dirty} data-teacher-save-primary>{busy?<Loader2 size={16} className="animate-spin"/>:<Save size={16}/>} {busy?tr('Enregistrement…','Saving…'):tr('Enregistrer les présences','Save attendance')}</button>}
 </>}>
  <p className="ta-muted mb-4 text-xs">{session.schoolDate} · {session.term} · {tr('Ce registre est réservé au suivi du cours. Il ne modifie ni le bulletin ni les notes.','This register tracks course regularity. It does not change report cards or grades.')}</p>
  {error&&<div role="alert" className="ta-alert mb-4">{error}</div>}
  {loading?<p role="status" className="p-8 text-center text-sm">{tr('Chargement du registre enregistré…','Loading saved register…')}</p>:<>
   <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
    <label className="min-w-[200px] flex-1"><span className="ta-muted mb-1 flex items-center gap-2 text-xs"><Search size={14}/>{tr('Nom, classe ou matricule','Name, class or learner ID')}</span><input className="ta-field" value={query} onChange={e=>setQuery(e.target.value)}/></label>
    <span className="ta-badge">{rows.filter(row=>row.status).length}/{rows.length} {tr('statuts renseignés','statuses recorded')}</span>
    {!manager&&<button type="button" className="ta-btn" disabled={busy||!filtered.some(row=>row.eligible)} onClick={()=>{const ids=new Set(filtered.filter(row=>row.eligible).map(row=>row.studentId));setRows(current=>current.map(row=>ids.has(row.studentId)?{...row,status:'PRESENT'}:row));setDirty(true)}}><CheckCheck size={16}/>{tr('Élèves affichés présents','Mark shown learners present')}</button>}
   </div>
   <div className="space-y-2">
    {filtered.map(row=><div key={row.studentId} className="ta-stat grid gap-3 sm:grid-cols-[minmax(150px,1.2fr)_minmax(120px,.8fr)_minmax(160px,1fr)]">
     <div><b className="!m-0 !text-sm">{row.name}</b><span>{row.className} · {row.studentNumber}</span>{!row.eligible&&<p className="ta-muted mt-1 text-[10px]">{tr('Donnée historique · inscription non active','Historical record · enrollment not active')}</p>}</div>
     <label><span className="ta-muted mb-1 block text-[10px]">{tr('Présence au cours','Course attendance')}</span>
      {manager||!row.eligible?<span className="ta-badge">{row.status?statusLabels[row.status][fr?0:1]:tr('Non renseigné','Not recorded')}</span>:<select className="ta-field" aria-label={tr('Présence · ','Attendance · ')+row.name} value={row.status||''} disabled={busy} onChange={e=>update(row.studentId,{status:(e.target.value||null) as LearnerStatus|null})}><option value="" disabled={original.current.has(row.studentId)}>{tr('Choisir le statut…','Choose status…')}</option>{Object.entries(statusLabels).map(([value,labels])=><option key={value} value={value}>{labels[fr?0:1]}</option>)}</select>}
     </label>
     <label><span className="ta-muted mb-1 block text-[10px]">{tr('Observation (facultative)','Observation (optional)')}</span>{manager||!row.eligible?<p className="break-words text-xs">{row.note||'—'}</p>:<input className="ta-field" maxLength={500} aria-label={tr('Observation · ','Observation · ')+row.name} disabled={busy} value={row.note} onChange={e=>update(row.studentId,{note:e.target.value})}/>}</label>
    </div>)}
    {!filtered.length&&<p className="ta-muted p-8 text-center text-sm">{tr('Aucun élève ne correspond à cette recherche.','No learner matches this search.')}</p>}
   </div>
  </>}
 </TeachingDialog>
}
