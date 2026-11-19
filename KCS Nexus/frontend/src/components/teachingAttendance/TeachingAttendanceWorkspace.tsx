import {CampusSettings,PresenceEvidence,PresenceVerificationDialog,freshCampusPosition} from './TeachingPresenceControls'
import TeachingLiveOverview from './TeachingLiveOverview'
import TeachingScheduleEditor from './TeachingScheduleEditor'
import {useCallback,useEffect,useMemo,useRef,useState} from 'react'
import {Bar,BarChart,CartesianGrid,Legend,Line,LineChart,ResponsiveContainer,Tooltip,XAxis,YAxis} from 'recharts'
import {CalendarDays,BarChart3,CheckCircle2,ChevronLeft,ChevronRight,Clock3,ClipboardCheck,Download,GraduationCap,Loader2,LogIn,LogOut,RefreshCw,Search,ShieldCheck,Users} from 'lucide-react'
import {teachingAttendanceAPI} from '@/services/api'
import {useTeachingClock} from '@/hooks/useTeachingClock'
import {useUIStore} from '@/store/uiStore'
import {printOfficialPdf} from '@/utils/officialPdf'
import TeachingDialog from './TeachingDialog'
import SessionRosterDialog from './SessionRosterDialog'
import {percentage,reviewLabels,sessionLabels,teachingError,timeLabel,type CourseChoice,type ReviewStatus,type TeachingBoard,type TeachingSession} from './model'
import './teachingAttendance.css'

function ReviewDialog({session,onClose,onSaved}:{session:TeachingSession;onClose:()=>void;onSaved:()=>void}){
 const fr=useUIStore(s=>s.language)==='fr',tr=(a:string,b:string)=>fr?a:b
 const [status,setStatus]=useState<ReviewStatus>(session.reviewStatus==='PENDING'?'ACKNOWLEDGED':session.reviewStatus),[note,setNote]=useState(session.reviewNote||''),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const submit=async()=>{
  if(note.trim().length<3)return
  setBusy(true);setError('')
  try{await teachingAttendanceAPI.review({courseId:session.courseReference,scheduleKey:session.scheduleKey,date:session.schoolDate,status,note:note.trim()});onSaved()}
  catch(e){setError(teachingError(e,fr))}finally{setBusy(false)}
 }
 return <TeachingDialog title={tr('Observation du Principal','Principal review')} onClose={()=>{if(!busy)onClose()}} footer={<><button type="button" className="ta-btn" disabled={busy} onClick={onClose}>{tr('Annuler','Cancel')}</button><button type="button" className="ta-btn ta-primary" disabled={busy||note.trim().length<3} onClick={()=>void submit()}>{busy?<Loader2 size={16} className="animate-spin"/>:<ShieldCheck size={16}/>} {tr('Enregistrer la décision','Save review')}</button></>}>
  <div className="space-y-4"><p className="text-sm font-bold">{session.teacherName} · {session.courseName}</p><p className="ta-muted text-xs">{session.schoolDate} · {timeLabel(session.expectedStartAt,fr)}–{timeLabel(session.expectedEndAt,fr)} · {session.className}</p>
   {session.teacherNote&&<blockquote className="ta-stat text-sm">{session.teacherNote}</blockquote>}
   <p className="ta-muted text-xs">{tr('Votre observation sera visible par le professeur. Les heures réellement enregistrées restent inchangées.','Your review will be visible to the teacher. Recorded entry and exit times remain unchanged.')}</p>
   {error&&<div role="alert" className="ta-alert">{error}</div>}
   <label className="block text-xs font-bold">{tr('Suite à donner','Review outcome')}<select className="ta-field mt-2" value={status} onChange={e=>setStatus(e.target.value as ReviewStatus)}>{(['ACKNOWLEDGED','FOLLOW_UP','JUSTIFIED'] as const).map(value=><option key={value} value={value}>{reviewLabels[value][fr?0:1]}</option>)}</select></label>
   <label className="block text-xs font-bold">{tr('Observation et décision','Observation and decision')}<textarea rows={5} maxLength={2000} className="ta-field mt-2" value={note} onChange={e=>setNote(e.target.value)}/></label>
  </div>
 </TeachingDialog>
}
function dateRange(day:string,kind:'day'|'week'|'month'|'year',calendar?:TeachingBoard['calendars'][number]){
 if(kind==='day')return{from:day,to:day}
 if(kind==='year'&&calendar)return{from:calendar.startDate.slice(0,10),to:calendar.endDate.slice(0,10)}
 const date=new Date(day+'T12:00:00Z')
 if(kind==='month'||kind==='year'){const first=day.slice(0,7)+'-01';const next=new Date(first+'T12:00:00Z');next.setUTCMonth(next.getUTCMonth()+1);next.setUTCDate(0);return{from:first,to:next.toISOString().slice(0,10)}}
 const weekday=date.getUTCDay()||7;date.setUTCDate(date.getUTCDate()-weekday+1)
 const from=date.toISOString().slice(0,10);date.setUTCDate(date.getUTCDate()+6)
 return{from,to:date.toISOString().slice(0,10)}
}
export default function TeachingAttendanceWorkspace({manager=false}:{manager?:boolean}){
 const fr=useUIStore(s=>s.language)==='fr',tr=useCallback((a:string,b:string)=>fr?a:b,[fr])
 const clock=useTeachingClock()
 const [range,setRange]=useState({from:'',to:''}),[draft,setDraft]=useState({from:'',to:''})
 const [board,setBoard]=useState<TeachingBoard|null>(null),[catalog,setCatalog]=useState<CourseChoice[]>([])
 const [className,setClassName]=useState(''),[room,setRoom]=useState(''),[statusFilter,setStatusFilter]=useState(''),[search,setSearch]=useState('')
 const [courseId,setCourseId]=useState(''),[teacherId,setTeacherId]=useState(''),[query,setQuery]=useState(''),[reviewFilter,setReviewFilter]=useState('')
 const [tab,setTab]=useState<'sessions'|'learners'|'analysis'|'schedules'>('sessions'),[page,setPage]=useState(1),[loading,setLoading]=useState(true),[error,setError]=useState('')
 const [busyKey,setBusyKey]=useState(''),[roster,setRoster]=useState<TeachingSession|null>(null),[review,setReview]=useState<TeachingSession|null>(null)
 const [receipt,setReceipt]=useState<{title:string;message:string;ok:boolean}|null>(null),[notes,setNotes]=useState<Record<string,string>>({})
 const [verify,setVerify]=useState<TeachingSession|null>(null)
 const sequence=useRef(0)
 useEffect(()=>{const timer=setTimeout(()=>setSearch(query.trim()),250);return()=>clearTimeout(timer)},[query])
 useEffect(()=>{if(clock.schoolDate&&!range.from){const next={from:clock.schoolDate,to:clock.schoolDate};setRange(next);setDraft(next)}},[clock.schoolDate,range.from])
 const load=useCallback(async(quiet=false)=>{
  if(!range.from||!range.to)return
  const request=++sequence.current
  if(!quiet)setLoading(true)
  try{
   const response=await(manager?teachingAttendanceAPI.principal:teachingAttendanceAPI.mine)({...range,...(courseId?{courseId}:{}),...(manager&&teacherId?{teacherUserId:teacherId}:{}),...(className?{className}:{}),...(room?{room}:{}),...(statusFilter&&tab==='sessions'?{status:statusFilter}:{}),...(reviewFilter&&tab==='sessions'?{reviewStatus:reviewFilter}:{}),...(search?{search}:{}),searchScope:tab==='learners'?'learners':'sessions'})
   if(request!==sequence.current)return
   const next=response.data.data as TeachingBoard
   setBoard(next);setError('')
   setCatalog(current=>!courseId&&!teacherId?next.courses:[...new Map([...current,...next.courses].map(row=>[row.id,row])).values()])
  }catch(e){if(request===sequence.current)setError(teachingError(e,fr))}
  finally{if(request===sequence.current)setLoading(false)}
 },[manager,range.from,range.to,courseId,teacherId,className,room,statusFilter,reviewFilter,search,tab,fr])
 useEffect(()=>{
  void load()
  const interval=Date.parse(range.to)-Date.parse(range.from)<=7*86400000?setInterval(()=>{if(document.visibilityState==='visible')void load(true)},10000):undefined
  const resume=()=>{if(document.visibilityState==='visible')void load(true)}
  document.addEventListener('visibilitychange',resume)
  return()=>{sequence.current++;clearInterval(interval);document.removeEventListener('visibilitychange',resume)}
 },[load])
 useEffect(()=>setPage(1),[search,reviewFilter,statusFilter,className,room,range.from,range.to,courseId,teacherId,tab])
 const rowKey=(row:TeachingSession)=>[row.courseReference,row.scheduleKey,row.schoolDate].join('|')
 const mark=async(row:TeachingSession,action:'ENTRY'|'EXIT')=>{
  if(busyKey)return
  const key=rowKey(row);setBusyKey(key)
  try{
   const locator={courseId:row.courseReference,scheduleKey:row.scheduleKey,date:row.schoolDate,action}
   const challenge=await teachingAttendanceAPI.challenge(locator)
   const position=await freshCampusPosition()
   const response=await teachingAttendanceAPI.mark({location:{token:challenge.data.data.token,position},courseId:row.courseReference,scheduleKey:row.scheduleKey,date:row.schoolDate,action,...(notes[key]?.trim()?{note:notes[key].trim()}:{})})
   const time=action==='ENTRY'?response.data.data.checkInAt:response.data.data.checkOutAt
   await load(true);void clock.resync()
   setReceipt({ok:true,title:action==='ENTRY'?tr('Entrée au cours enregistrée','Course entry recorded'):tr('Sortie du cours enregistrée','Course exit recorded'),message:row.courseName+' · '+row.schoolDate+' · '+timeLabel(time,fr)+' (Kinshasa) · '+tr('Localisation contrôlée ; confirmation du Principal attendue.','Location checked; Principal confirmation pending.')})
  }catch(e){setReceipt({ok:false,title:tr('Opération non enregistrée','Operation not recorded'),message:teachingError(e,fr)})}
  finally{setBusyKey('')}
 }
 const teachers=useMemo(()=>[...new Map(catalog.map(row=>[row.teacherUserId,{id:row.teacherUserId,name:row.teacherName}])).values()].sort((a,b)=>a.name.localeCompare(b.name)),[catalog])
 const filtered=board?.sessions||[]
 const learnerRows=board?.learners||[]
 const classOptions=useMemo(()=>{
  const list=board?.classes||[]
  return [...new Set(list.flatMap(label=>[label.replace(/\s+[AB]$/,''),label]))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}))
 },[board?.classes])
 const resetFilters=()=>{setQuery('');setSearch('');setReviewFilter('');setStatusFilter('');setCourseId('');setTeacherId('');setClassName('');setRoom('')}

 const pageCount=Math.max(1,Math.ceil((tab==='learners'?learnerRows.length:filtered.length)/8)),visible=filtered.slice((page-1)*8,page*8)
 useEffect(()=>setPage(p=>Math.min(p,pageCount)),[pageCount])
 const calendar=board?.calendars.find(row=>row.isCurrent)||board?.calendars.find(row=>clock.schoolDate>=row.startDate.slice(0,10)&&clock.schoolDate<=row.endDate.slice(0,10))
 const exportReport=()=>{
  if(!board)return
  const stats=board.summary
  const learner=tab==='learners'
  printOfficialPdf({
   title:learner?tr('Régularité des élèves par cours','Learner course regularity'):tr('Présence et ponctualité des enseignants','Teacher session attendance and punctuality'),
   metadata:[[tr('Période','Period'),range.from+' – '+range.to],[tr('Fuseau officiel','Official timezone'),'Africa/Kinshasa'],[tr('Début du suivi','Tracking since'),board.trackingSince],[tr('Classe','Class'),className||tr('Toutes','All')],[tr('Recherche','Search'),search||'—']],
   indicators:learner?[[tr('Statuts renseignés','Recorded learner statuses'),board.learnerSummary.recorded],[tr('Présence','Attendance'),percentage(board.learnerSummary.attendanceRate)],[tr('Retards','Late'),board.learnerSummary.late]]:[[tr('Présences enregistrées','Recorded sessions'),stats.recorded],[tr('Ponctualité','Punctuality'),percentage(stats.punctualityRate)],[tr('Retard moyen (min)','Mean delay (min)'),stats.meanLateMinutes??'—']],
   columns:learner?[tr('Élève','Learner'),tr('Classe','Class'),tr('Cours','Course'),tr('Présents','Present'),tr('Retards','Late'),tr('Absents','Absent'),tr('Taux','Rate')]:[tr('Date','Date'),tr('Professeur','Teacher'),tr('Cours','Course'),tr('Horaire prévu','Scheduled'),tr('Entrée','Entry'),tr('Sortie','Exit'),tr('Retard (min)','Delay (min)'),tr('Statut','Status'),tr('Contrôle du Principal','Principal verification')],
   rows:learner?learnerRows.map(row=>[row.name,row.className,row.courseName,row.present,row.late,row.absent,percentage(row.attendanceRate)]):filtered.map(row=>[row.schoolDate,row.teacherName,row.courseName,timeLabel(row.expectedStartAt,fr)+'–'+timeLabel(row.expectedEndAt,fr),timeLabel(row.checkInAt,fr),timeLabel(row.checkOutAt,fr),row.timing.lateMinutes,sessionLabels[row.timing.status][fr?0:1],(row.presenceProof?.entry?.status||tr('Entrée historique','Historical entry'))+' / '+(row.presenceProof?.exit?.status||tr('Sortie non vérifiée','Unverified exit'))]),
   narrative:tr('Les heures réelles proviennent de l’horloge PostgreSQL. Les séances sans pointage sont identifiées séparément. La régularité des élèves n’altère ni leurs notes ni leur bulletin.','Actual timestamps come from the PostgreSQL clock. Sessions without a recorded check-in are identified separately. Learner course regularity does not change grades or report cards.')+' '+tr('Retard médian / P95 (min) : ','Median / P95 delay (min): ')+(stats.medianLateMinutes??'—')+' / '+(stats.p95LateMinutes??'—'),
   orientation:'landscape',documentKind:'activity',
  })
 }
 const summary=board?.summary
 return <div className="teaching-workspace space-y-4" data-teaching-attendance={manager?'principal':'teacher'}>
  <header className="ta-hero flex flex-wrap items-center justify-between gap-4">
   <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[.17em]">KCS · {tr('Chaque séance compte','Every session matters')}</p><h2 className="mt-2 flex items-center gap-3 text-xl font-black"><GraduationCap size={25}/>{manager?tr('Présences aux cours','Teaching attendance'):tr('Mes séances de cours','My teaching sessions')}</h2><p className="mt-2 max-w-2xl text-xs">{manager?tr('Horaires, arrivées, sorties et régularité des élèves : un suivi précis pour vos décisions.','Schedules, arrivals, departures and learner regularity: clear evidence for your decisions.'):tr('Pointez votre entrée, relevez les élèves présents, puis enregistrez votre sortie.','Check in, record your learners’ attendance, then check out.')}</p></div>
   <div className="ta-clock"><span className="flex items-center gap-2 text-[10px] uppercase tracking-wider"><Clock3 size={13}/>{tr('Heure serveur · Kinshasa','Server time · Kinshasa')}</span><strong className="mt-1 block text-2xl tracking-widest" data-teaching-clock>{clock.now?new Intl.DateTimeFormat(fr?'fr-FR':'en-GB',{timeZone:'Africa/Kinshasa',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(clock.now):'—'}</strong><p className="text-[10px]">{clock.synchronized?tr('Synchronisée','Synchronized'):tr('Resynchronisation…','Resynchronizing…')}</p></div>
  </header>
  {manager&&<CampusSettings/>}
  {manager&&board&&<TeachingLiveOverview sessions={filtered} warnings={board.scheduleWarnings||[]} now={clock.now} fr={fr} onReview={row=>(row.presenceProof?.entry||row.presenceProof?.exit)?setVerify(row):setReview(row)} onSchedules={()=>setTab('schedules')}/>}
  <section className="ta-panel space-y-4">
   <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2">{(['day','week','month','year'] as const).map((kind,i)=><button key={kind} type="button" className="ta-btn" disabled={!clock.schoolDate||(kind==='year'&&!calendar)} onClick={()=>{const next=dateRange(clock.schoolDate,kind,calendar);setRange(next);setDraft(next)}}>{[tr('Jour','Day'),tr('Semaine','Week'),tr('Mois','Month'),tr('Année scolaire','School year')][i]}</button>)}</div><div className="flex gap-2"><button type="button" className="ta-btn" disabled={loading} onClick={()=>void load()}><RefreshCw size={14} className={loading?'animate-spin':''}/>{tr('Actualiser','Refresh')}</button><button type="button" className="ta-btn" disabled={!board||!!error} onClick={exportReport}><Download size={14}/>{tr('Rapport / PDF','Report / PDF')}</button></div></div>
   <form className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1.2fr_1.2fr_auto]" onSubmit={e=>{e.preventDefault();setRange(draft)}}>
    <label className="text-xs font-semibold">{tr('Du','From')}<input type="date" className="ta-field mt-1" value={draft.from} onChange={e=>setDraft(v=>({...v,from:e.target.value}))} required/></label><label className="text-xs font-semibold">{tr('Au','To')}<input type="date" className="ta-field mt-1" value={draft.to} min={draft.from} onChange={e=>setDraft(v=>({...v,to:e.target.value}))} required/></label>
    {manager?<label className="text-xs font-semibold">{tr('Professeur','Teacher')}<select className="ta-field mt-1" value={teacherId} onChange={e=>{setTeacherId(e.target.value);setCourseId('')}}><option value="">{tr('Tous les enseignants','All teachers')}</option>{teachers.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label>:<div className="ta-muted self-end text-xs">{tr('Les heures correspondent à votre horaire officiel ou à My Courses.','Times follow your official timetable or My Courses.')}</div>}
    <label className="text-xs font-semibold">{tr('Cours et classe','Subject and class')}<select className="ta-field mt-1" value={courseId} onChange={e=>setCourseId(e.target.value)}><option value="">{tr('Tous les cours','All subjects')}</option>{catalog.filter(row=>!teacherId||row.teacherUserId===teacherId).map(row=><option key={row.id} value={row.id}>{row.name} · {row.className}</option>)}</select></label>
    <button type="submit" className="ta-btn ta-primary self-end"><CalendarDays size={15}/>{tr('Afficher','Show')}</button>
   </form>
   {board&&<p className="ta-muted text-[11px]">{tr('Suivi actif depuis le ','Tracking active since ')}{board.trackingSince}. {tr('Aucune absence n’est reconstituée pour les dates antérieures. Actualisation automatique des vues journalières et hebdomadaires.','No absences are inferred for earlier dates. Daily and weekly views refresh automatically.')}</p>}
   {error&&<div role="alert" className="ta-alert">{error}</div>}
  </section>
  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
   {[[tr('Séances dues','Sessions due'),summary?.due??'—',tr('Selon l’horaire et le calendrier','From the timetable and calendar')],[tr('Présences enregistrées','Recorded sessions'),summary?.recorded??'—',tr('Sans pointage après la fin : ','Unrecorded after end: ')+(summary?.unrecorded??'—')],[tr('Ponctualité','Punctuality'),percentage(summary?.punctualityRate),tr('Sur les arrivées enregistrées','Among recorded arrivals')],[tr('Retard moyen','Mean delay'),summary?.meanLateMinutes==null?'—':summary.meanLateMinutes+' min',tr('Sorties anticipées : ','Early departures: ')+(summary?.earlyExits??'—')+' · '+tr('Sorties manquantes : ','Missing exits: ')+(summary?.missingExits??'—')]].map(([label,value,detail])=><div className="ta-stat" key={String(label)}><span>{label}</span><b>{value}</b><span>{detail}</span></div>)}
  </div>
  <section className="ta-panel">
   <nav className="mb-4 flex flex-wrap gap-2" aria-label={tr('Vues du registre','Register views')}>{([['sessions',Clock3,tr('Séances des enseignants','Teacher sessions')],['learners',Users,tr('Présences des élèves','Learner attendance')],['analysis',BarChart3,tr('Analyses et tendances','Analysis and trends')]] as const).map(([value,Icon,label])=><button type="button" key={value} className="ta-btn" aria-pressed={tab===value} onClick={()=>setTab(value)}><Icon size={16}/>{label}</button>)}{manager&&<button type="button" className="ta-btn" aria-pressed={tab==='schedules'} onClick={()=>setTab('schedules')}><CalendarDays size={16}/>{tr('Programmer les cours','Schedule subjects')}</button>}</nav>
   {tab!=='schedules'&&<div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
    <label className="min-w-0 text-xs font-semibold"><span className="mb-1 flex items-center gap-2"><Search size={14}/>{tab==='learners'?tr('Rechercher un élève, une classe ou un cours','Search learner, class or subject'):tr('Rechercher un nom, un cours, une classe ou une salle','Search name, subject, class or room')}</span><input maxLength={200} className="ta-field" value={query} placeholder={tr('Ex. : Jonathan "Grade 11"','E.g. Jonathan "Grade 11"')} onChange={e=>setQuery(e.target.value)}/></label>
    <label className="text-xs font-semibold">{tr('Classe / section exacte','Exact class / section')}<select className="ta-field mt-1" value={className} onChange={e=>setClassName(e.target.value)} data-teaching-class-filter><option value="">{tr('Toutes les classes','All classes')}</option>{[...new Set([...classOptions,...(className?[className]:[])])].map(value=><option key={value} value={value}>{value}</option>)}</select></label>
    <label className="text-xs font-semibold">{tr('Salle','Room')}<select className="ta-field mt-1" value={room} onChange={e=>setRoom(e.target.value)}><option value="">{tr('Toutes les salles','All rooms')}</option>{[...new Set([...(board?.rooms||[]),...(room?[room]:[])])].map(value=><option key={value} value={value}>{value}</option>)}</select></label>
    {tab==='sessions'&&<label className="text-xs font-semibold">{tr('État de la séance','Session status')}<select className="ta-field mt-1" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="">{tr('Tous les états','All statuses')}</option>{Object.entries(sessionLabels).map(([value,label])=><option value={value} key={value}>{label[fr?0:1]}</option>)}</select></label>}
    {manager&&tab==='sessions'&&<label className="text-xs font-semibold">{tr('Examen du Principal','Principal review')}<select className="ta-field mt-1" value={reviewFilter} onChange={e=>setReviewFilter(e.target.value)}><option value="">{tr('Toutes les décisions','All review states')}</option>{Object.entries(reviewLabels).map(([value,label])=><option value={value} key={value}>{label[fr?0:1]}</option>)}</select></label>}
    <div className="flex flex-wrap items-end gap-2"><button type="button" className="ta-btn" onClick={resetFilters}>{tr('Réinitialiser','Reset')}</button><span className="ta-muted self-center text-[10px]">{tr('Mots dans tout ordre · accents ignorés · guillemets pour une expression exacte.','Words in any order · accents ignored · quotes for an exact phrase.')}</span></div>
   </div>}
   {!!board?.scheduleWarnings?.length&&<details className="ta-alert mb-4 text-xs" data-teaching-schedule-warnings><summary className="cursor-pointer font-bold">{tr('Créneaux officiels nécessitant une correspondance','Official timetable slots needing a course match')} · {board.scheduleWarnings.length}</summary><p className="my-2">{tr('Ces créneaux sont affichés sans inventer de présence ou d’absence. Vérifiez les noms et les classes dans My Courses, puis les horaires avec le Principal.','These slots are shown without inventing presence or absence. Check subject names and classes in My Courses, then review the timetable with the Principal.')}</p><div className="grid gap-2 sm:grid-cols-2">{board.scheduleWarnings.map(row=><div className="rounded-lg border border-amber-600/25 p-2" key={row.key}><b>{row.teacherName} · {row.subject}</b><p className="mt-1">{row.className} · {row.schoolDate} · {timeLabel(row.expectedStartAt,fr)}–{timeLabel(row.expectedEndAt,fr)}</p><p className="mt-1">{row.reason==='AMBIGUOUS'?tr('Plusieurs cours possibles : validation nécessaire.','Multiple possible courses: verification required.'):tr('Aucun cours correspondant pour cette classe.','No matching course for this class.')}</p></div>)}</div></details>}

   {loading&&!board?<p role="status" className="p-10 text-center text-sm">{tr('Chargement des séances et du registre…','Loading sessions and attendance…')}</p>:<>
    {tab==='schedules'&&manager&&board&&<TeachingScheduleEditor courses={catalog} calendars={board.calendars} onPublished={()=>void load(true)}/>}
    {tab==='sessions'&&<div className="space-y-3">{visible.map(row=>{
     const key=rowKey(row),today=row.schoolDate===clock.schoolDate,at=clock.now?.getTime()||0
     const canEnter=today&&!row.checkInAt&&at>=Date.parse(row.expectedStartAt)-30*60000&&at<Date.parse(row.expectedEndAt)
     const canExit=today&&!!row.checkInAt&&!row.checkOutAt
     return <article className="ta-session" key={key}>
      <div className="min-w-0"><div className="mb-2 flex flex-wrap gap-2"><span className="ta-badge" data-state={row.timing.status}>{sessionLabels[row.timing.status][fr?0:1]}</span>{row.reviewStatus!=='PENDING'&&<span className="ta-badge" data-state={row.reviewStatus}>{reviewLabels[row.reviewStatus][fr?0:1]}</span>}</div><PresenceEvidence row={row}/><h3 className="mt-2 break-words text-sm font-bold">{row.courseName} <span className="ta-muted font-normal">· {row.className}</span></h3><p className="ta-muted mt-1 text-xs">{row.schoolDate} · {row.teacherName}</p><p className="ta-muted mt-1 text-[11px]">{row.room||tr('Salle non précisée','Room not specified')} · {row.academicYear} · {row.term}</p>{row.teacherNote&&<p className="mt-2 break-words text-xs">{row.teacherNote}</p>}{row.reviewNote&&<p className="mt-2 rounded-lg border border-cyan-600/30 p-2 text-xs"><b>{tr('Principal : ','Principal: ')}</b>{row.reviewNote}</p>}</div>
      <div className="grid grid-cols-2 gap-2 text-xs"><div><span className="ta-muted block text-[10px]">{tr('Horaire prévu','Scheduled')}</span><b>{timeLabel(row.expectedStartAt,fr)}–{timeLabel(row.expectedEndAt,fr)}</b></div><div><span className="ta-muted block text-[10px]">{tr('Entrée / sortie réelles','Actual entry / exit')}</span><b>{timeLabel(row.checkInAt,fr)} / {timeLabel(row.checkOutAt,fr)}</b></div><div><span className="ta-muted block text-[10px]">{tr('Retard à l’entrée','Arrival delay')}</span><b>{row.timing.lateMinutes==null?'—':row.timing.lateMinutes+' min'}</b></div><div><span className="ta-muted block text-[10px]">{tr('Présences élèves','Learner statuses')}</span><b>{row.studentSummary.recorded}/{row.rosterSize}</b></div></div>
      <div className="ta-session-actions flex max-w-[250px] flex-wrap gap-2">
       {!manager&&<>{!row.checkOutAt&&<input className="ta-field !text-[11px]" placeholder={tr('Observation de séance (facultative)','Session observation (optional)')} aria-label={tr('Observation pour ','Observation for ')+row.courseName} maxLength={1000} value={notes[key]??''} onChange={e=>setNotes(v=>({...v,[key]:e.target.value}))}/>}<button type="button" className="ta-btn ta-primary" data-teaching-entry={row.courseReference} disabled={!canEnter||!!busyKey||!!error||!clock.synchronized} onClick={()=>void mark(row,'ENTRY')}>{busyKey===key?<Loader2 size={14} className="animate-spin"/>:<LogIn size={14}/>} {tr('Entrer','Check in')}</button><button type="button" className="ta-btn ta-complete" data-teaching-exit={row.courseReference} disabled={!canExit||!!busyKey||!!error||!clock.synchronized} onClick={()=>void mark(row,'EXIT')}><LogOut size={14}/>{tr('Sortir','Check out')}</button></>}
       <button type="button" className="ta-btn" data-teaching-roster={row.courseReference} disabled={!row.id||(!manager&&!row.checkInAt)} onClick={()=>setRoster(row)}><ClipboardCheck size={14}/>{manager?tr('Voir les élèves','View learners'):tr('Présences élèves','Learner attendance')}</button>
       {manager&&(row.presenceProof?.entry||row.presenceProof?.exit)&&<button type="button" className="ta-btn ta-complete" onClick={()=>setVerify(row)}><ShieldCheck size={14}/>{tr('Vérifier sur place','Verify on site')}</button>}
       {manager&&<button type="button" className="ta-btn ta-primary" data-teaching-review={row.courseReference} onClick={()=>setReview(row)}><ShieldCheck size={14}/>{tr('Examiner','Review')}</button>}
      </div>
     </article>
    })}{!filtered.length&&<p className="ta-muted p-8 text-center text-sm">{tr('Aucune séance ne correspond à cette sélection. Le Principal peut publier les horaires manquants dans « Programmer les cours ».','No session matches this selection. The Principal can publish missing times in “Schedule subjects”.')}</p>}</div>}
    {tab==='learners'&&<><div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{[[tr('Présence','Attendance'),percentage(board?.learnerSummary.attendanceRate)],[tr('Statuts renseignés','Recorded statuses'),board?.learnerSummary.recorded??0],[tr('Retards','Late'),board?.learnerSummary.late??0],[tr('Absences','Absences'),board?.learnerSummary.absent??0]].map(([label,value])=><div className="ta-stat" key={label}><span>{label}</span><b>{value}</b></div>)}</div><p className="ta-muted mb-3 text-xs">{tr('Chaque taux est calculé uniquement sur les présences explicitement enregistrées dans ce cours. Aucune modification du bulletin ou des notes.','Each rate uses only explicitly recorded attendance in that course. Report cards and grades are unchanged.')}</p><div className="overflow-auto"><table className="ta-table min-w-[650px]"><thead><tr>{[tr('Élève','Learner'),tr('Cours / classe','Subject / class'),tr('Présent','Present'),tr('Retard','Late'),tr('Absent','Absent'),tr('Régularité','Regularity')].map(label=><th key={label}>{label}</th>)}</tr></thead><tbody>{learnerRows.slice((page-1)*8,page*8).map(row=><tr key={row.studentId+row.courseId}><td className="font-bold">{row.name}</td><td>{row.courseName}<span className="ta-muted block text-[10px]">{row.className}</span></td><td>{row.present}</td><td>{row.late}</td><td>{row.absent}</td><td className="font-bold">{percentage(row.attendanceRate)}<span className="ta-muted block text-[10px]">n = {row.recorded}</span></td></tr>)}</tbody></table>{!learnerRows.length&&<p className="ta-muted p-8 text-center text-sm">{tr('Aucune présence d’élève par cours n’a été enregistrée sur cette période.','No learner session attendance has been recorded for this period.')}</p>}</div></>}
    {tab==='analysis'&&board&&<div className="space-y-4"><div className="grid gap-4 lg:grid-cols-2"><div className="ta-stat"><h3 className="mb-3 text-sm font-bold">{tr('Évolution des séances','Session trend')}</h3><ResponsiveContainer width="100%" height={250}><BarChart data={board.trend}><CartesianGrid strokeDasharray="3 3" opacity={.2}/><XAxis dataKey="day" tick={{fontSize:10,fill:fr?'#7090a4':'#7090a4'}} tickFormatter={s=>s.slice(5)}/><YAxis allowDecimals={false} tick={{fontSize:10,fill:'#7090a4'}}/><Tooltip contentStyle={{background:fr?'#eef5fa':'#eef5fa',borderRadius:12,color:'#14344d'}}/><Legend wrapperStyle={{fontSize:11}}/><Bar isAnimationActive={false} name={tr('Séances dues','Sessions due')} dataKey="due" fill="#66829b" radius={[4,4,0,0]}/><Bar isAnimationActive={false} name={tr('Présence enregistrée','Recorded presence')} dataKey="recorded" fill="#0f9ba7" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div><div className="ta-stat"><h3 className="mb-3 text-sm font-bold">{tr('Ponctualité et délai moyen','Punctuality and mean delay')}</h3><ResponsiveContainer width="100%" height={250}><LineChart data={board.trend}><CartesianGrid strokeDasharray="3 3" opacity={.2}/><XAxis dataKey="day" tickFormatter={s=>s.slice(5)} tick={{fontSize:10,fill:'#7090a4'}}/><YAxis yAxisId="rate" domain={[0,100]} tick={{fontSize:10,fill:'#7090a4'}}/><YAxis yAxisId="delay" orientation="right" tick={{fontSize:10,fill:'#7090a4'}}/><Tooltip contentStyle={{background:'#eef5fa',borderRadius:12,color:'#14344d'}}/><Legend wrapperStyle={{fontSize:11}}/><Line isAnimationActive={false} yAxisId="rate" name={tr('Ponctualité (%)','Punctuality (%)')} type="monotone" dataKey="punctualityRate" stroke="#0d91a5" strokeWidth={2}/><Line isAnimationActive={false} yAxisId="delay" name={tr('Retard moyen (min)','Mean delay (min)')} dataKey="meanLateMinutes" stroke="#d39438" strokeWidth={2}/></LineChart></ResponsiveContainer></div></div>
     <div className="ta-stat"><h3 className="mb-3 text-sm font-bold">{tr('Lecture statistique','Statistical interpretation')}</h3><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[[tr('Médiane des retards','Median delay'),summary?.medianLateMinutes??'—'],[tr('95e percentile (min)','95th percentile (min)'),summary?.p95LateMinutes??'—'],[tr('Échantillon des arrivées','Recorded arrival sample'),summary?.recorded??0],[tr('Intervalle de ponctualité à 95 %','95% punctuality interval'),summary?.punctuality95?summary.punctuality95.join(' – ')+'%':'—']].map(([label,value])=><div key={label}><span>{label}</span><b className="!text-lg">{value}</b></div>)}</div><p className="ta-muted mt-3 text-xs">{tr('La ponctualité se mesure parmi les arrivées enregistrées. Les pointages manquants restent séparés. L’intervalle de Wilson à 95 % indique l’incertitude liée à la taille de l’échantillon.','Punctuality is measured among recorded arrivals. Missing check-ins remain separate. The 95% Wilson interval shows uncertainty associated with sample size.')}</p></div>
     {manager&&<div className="overflow-auto"><table className="ta-table min-w-[680px]"><thead><tr>{[tr('Enseignant','Teacher'),tr('Séances dues','Due'),tr('Pointages','Recorded'),tr('Manquants','Unrecorded'),tr('Ponctualité','Punctuality'),tr('Retard médian','Median delay'),tr('Sorties anticipées','Early exits')].map(label=><th key={label}>{label}</th>)}</tr></thead><tbody>{board.teachers.map(row=><tr key={row.id}><td className="font-bold">{row.name}</td><td>{row.due}</td><td>{row.recorded}</td><td>{row.unrecorded}</td><td>{percentage(row.punctualityRate)}</td><td>{row.medianLateMinutes==null?'—':row.medianLateMinutes+' min'}</td><td>{row.earlyExits}</td></tr>)}</tbody></table></div>}
    </div>}
   </>}
   {tab!=='analysis'&&tab!=='schedules'&&<div className="mt-4 flex items-center justify-between gap-3"><span className="ta-muted text-xs">{tr('Page','Page')} {page}/{pageCount} · {tab==='learners'?learnerRows.length:filtered.length} {tr('résultat(s)','result(s)')}</span><div className="flex gap-2"><button type="button" className="ta-btn" aria-label={tr('Page précédente','Previous page')} disabled={page<=1} onClick={()=>setPage(p=>p-1)}><ChevronLeft size={16}/></button><button type="button" className="ta-btn" aria-label={tr('Page suivante','Next page')} disabled={page>=pageCount} onClick={()=>setPage(p=>p+1)}><ChevronRight size={16}/></button></div></div>}
  </section>
  {verify&&<PresenceVerificationDialog row={verify} onClose={()=>setVerify(null)} onSaved={()=>{setVerify(null);void load(true);setReceipt({ok:true,title:tr('Contrôle enregistré','Verification recorded'),message:tr('Le contrôle indépendant est conservé sans modifier les heures réelles.','Independent verification is saved without changing actual timestamps.')})}}/>}
  {roster&&<SessionRosterDialog session={roster} manager={manager} onClose={()=>setRoster(null)} onSaved={()=>{setRoster(null);void load(true);setReceipt({ok:true,title:tr('Présences du cours enregistrées','Course attendance saved'),message:tr('Le registre et les indicateurs de régularité du gradebook ont été mis à jour. Le bulletin reste inchangé.','The register and gradebook regularity indicators are updated. The report card remains unchanged.')})}}/>}
  {review&&<ReviewDialog session={review} onClose={()=>setReview(null)} onSaved={()=>{setReview(null);void load(true);setReceipt({ok:true,title:tr('Décision enregistrée','Review saved'),message:tr('Votre observation est conservée dans l’historique de la séance et visible par le professeur.','Your review is preserved in the session history and visible to the teacher.')})}}/>}
  {receipt&&<TeachingDialog title={receipt.title} onClose={()=>setReceipt(null)} footer={<button type="button" className="ta-btn ta-primary" onClick={()=>setReceipt(null)}>{tr('Compris','Done')}</button>}><div className="py-4 text-center"><CheckCircle2 size={46} className={'mx-auto mb-4 '+(receipt.ok?'text-emerald-600 dark:text-emerald-300':'text-rose-600 dark:text-rose-300')}/><p className="text-sm">{receipt.message}</p></div></TeachingDialog>}
 </div>
}
