import PrincipalAttendanceAnalysis from './PrincipalAttendanceAnalysis'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownRight, ArrowUpRight, Bell, CalendarDays, ClipboardCheck, FileText, GraduationCap, Layers3, MessageSquare, ShieldCheck, Users } from 'lucide-react'
import './principalHome.css'

type Props={overview:any;directory:any;finance:any;status:'loading'|'ready'|'error';basePath:string;language:string;children:ReactNode}
export default function PrincipalDashboardOverview({overview,directory,finance,status,basePath,language,children}:Props){
 const tr=(fr:string,en:string)=>language==='fr'?fr:en
 const number=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)?new Intl.NumberFormat(language==='fr'?'fr-FR':'en-US').format(value):'—'
 const stats=overview.stats||{}
 const actions=[
  {path:'teaching-attendance',icon:ClipboardCheck,label:tr('Les cours en direct','Classroom live view'),detail:tr('Présence, ponctualité et suivi des séances.','Attendance, punctuality and lesson follow-up.'),tone:'teal'},
  {path:'report-cards',icon:GraduationCap,label:tr('Bulletins des élèves','Learner report cards'),detail:tr('Consulter les résultats officiels en lecture seule.','Review official results in read-only mode.'),tone:'gold'},
  {path:'main-teachers',icon:Users,label:tr('Équipes de classe','Class leadership'),detail:tr('Main Teachers, assistants et affectations.','Main Teachers, assistants and assignments.'),tone:'violet'},
  {path:'academic-calendar',icon:CalendarDays,label:tr('Calendrier académique','Academic calendar'),detail:tr('Le calendrier officiel partagé de KCS.','The shared official KCS calendar.'),tone:'teal'},
  {path:'teacher-reports',icon:FileText,label:tr('Rapports pédagogiques','Teacher reports'),detail:tr('Lire les observations et rapports transmis.','Read submitted observations and reports.'),tone:'violet'},
  {path:'transcripts',icon:Layers3,label:tr('Parcours académiques','Academic transcripts'),detail:tr('Consulter le parcours de Grade 9 à Grade 12.','Review the Grade 9–12 academic journey.'),tone:'gold'},
 ]
 const metrics=[
  {label:tr('Élèves','Learners'),value:directory.counts?.students,icon:GraduationCap,path:'students',note:tr('Registre officiel','Official registry')},
  {label:tr('Familles','Families'),value:directory.counts?.families,icon:Users,path:'parents',note:tr('Communauté KCS','KCS community')},
  {label:tr('Messages non lus','Unread messages'),value:stats.pendingMessages,icon:MessageSquare,path:'messages',note:tr('Communication interne','Internal communication')},
  {label:tr('Rapports à suivre','Reports to review'),value:stats.pendingReports,icon:FileText,path:'reports',note:tr('Suivi opérationnel','Operational follow-up')},
 ]
 const priorities=[{label:tr('Admissions à examiner','Admissions to review'),value:stats.admissionTasks,icon:Users,path:'admissions'},{label:tr('Messages en attente','Pending messages'),value:stats.pendingMessages,icon:MessageSquare,path:'messages'},{label:tr('Rapports des équipes','Team reports'),value:stats.pendingReports,icon:FileText,path:'reports'}]
 const attendance=Array.isArray(overview.attendanceByClass)?overview.attendanceByClass:[]
 const announcements=Array.isArray(overview.announcements)?overview.announcements:[]
 return <div className="principal-home" data-principal-home>
  <section className="principal-home-hero">
   <div><span className="principal-home-eyebrow"><ShieldCheck size={14}/>{tr('Direction de l’école','School leadership')}</span><h2>{tr('Une vision claire. Des décisions éclairées.','Clarity for every decision.')}</h2><p>{tr('Vos priorités et les espaces essentiels de KCS, réunis pour diriger la journée avec confiance.','Your priorities and essential KCS workspaces, brought together to lead the school day with confidence.')}</p><Link to={basePath+'/teaching-attendance'} className="principal-home-primary">{tr('Ouvrir le suivi des cours','Open classroom monitoring')}<ArrowUpRight size={17}/></Link></div>
   <aside className="principal-home-brief"><span>{tr('Votre point de départ','Your starting point')}</span><b>{tr('Principal','Principal')}</b><p>{tr('Observer · Accompagner · Coordonner','Observe · Support · Coordinate')}</p><span className="principal-home-sync" data-state={status}><i/>{status==='loading'?tr('Actualisation des indicateurs…','Refreshing indicators…'):status==='error'?tr('Synchronisation partielle · actualisez','Partial sync · refresh to retry'):tr('Données du registre et des services KCS','Data from KCS records and services')}</span></aside>
  </section>
  <div className="principal-home-metrics">{metrics.map(({label,value,icon:Icon,path,note})=><Link key={path} to={basePath+'/'+path} className="principal-home-metric"><span><Icon size={19}/><ArrowUpRight size={14}/></span><strong>{number(value)}</strong><b>{label}</b><small>{note}</small></Link>)}</div>
  <section aria-labelledby="principal-explore-title"><header className="principal-home-section-title"><div><span>{tr('Vos espaces de travail','Your workspaces')}</span><h3 id="principal-explore-title">{tr('Aller à l’essentiel','Go straight to what matters')}</h3></div><span className="principal-home-section-note">{tr('Des accès directs, selon vos droits','Direct access, within your permissions')}</span></header><div className="principal-home-actions">{actions.map(({path,icon:Icon,label,detail,tone})=><Link key={path} to={basePath+'/'+path} data-tone={tone}><span className="principal-home-action-icon"><Icon size={22}/></span><div><b>{label}</b><p>{detail}</p></div><ArrowUpRight className="principal-home-action-arrow" size={18}/></Link>)}</div></section>
  <div className="principal-home-insights"><section className="principal-home-surface"><header className="principal-home-section-title"><div><span>{tr('À votre attention','For your attention')}</span><h3>{tr('Priorités de la direction','Leadership priorities')}</h3></div><ClipboardCheck size={21}/></header><div className="principal-home-priorities">{priorities.map(({label,value,icon:Icon,path})=><Link to={basePath+'/'+path} key={path}><Icon size={18}/><span>{label}</span><b>{number(value)}</b><ArrowUpRight size={14}/></Link>)}</div><p className="principal-home-footnote">{tr('Ouvrez une rubrique pour consulter les dossiers et agir selon vos autorisations.','Open a section to review the records and act within your permissions.')}</p></section>
   <PrincipalAttendanceAnalysis rows={attendance} language={language}/>
  </div>
  <details className="principal-home-surface principal-home-details"><summary><span><Bell size={19}/>{tr('Informations et suivi détaillé','Updates and detailed follow-up')}</span><ArrowDownRight size={18}/></summary><div className="principal-home-detail-content">{announcements.length>0&&<section className="principal-home-announcements"><h3>{tr('Dernières annonces','Latest announcements')}</h3>{announcements.slice(0,3).map((item:any)=><Link key={item.id} to={basePath+'/announcements'}><b>{item.title}</b><ArrowUpRight size={16}/></Link>)}</section>}{finance&&<Link className="principal-home-finance" to={basePath+'/finance'}>{tr('Suivi EduPay · paiements complétés','EduPay follow-up · completed payments')}<b>{number(finance.totals?.paymentCompletionRate)}%</b><ArrowUpRight size={17}/></Link>}{children}</div></details>
 </div>
}
