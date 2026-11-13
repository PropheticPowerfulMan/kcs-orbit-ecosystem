import {useEffect, useState, type ReactNode} from 'react'
import { MessageCircle, RefreshCw, ShieldCheck, PenLine, Search } from 'lucide-react'
import './forumPresentation.css'
export const forumCategoryLabel=(value:string,language:string)=>language==='fr'?({Academics:'Vie académique',Wellbeing:'Bien-être','Student Life':'Vie étudiante',Safety:'Sécurité',Clubs:'Clubs',Events:'Événements',Transport:'Transport',Communication:'Communication'}[value]??value):value
export function ForumFeedHeading({count,loading,onRefresh,language}:{count:number;loading:boolean;onRefresh:()=>void;language:string}){
 const fr=language==='fr'
 return <div className="forum-feed-heading"><div><span className="forum-eyebrow">{fr?'COMMUNAUTÉ KCS':'KCS COMMUNITY'}</span><h2><MessageCircle size={20}/>{fr?'Le fil des échanges':'Community feed'}</h2><p>{count} {fr?'discussion(s) · Les échanges de votre communauté':'discussion(s) · Conversations in your community'}</p></div><button type="button" onClick={onRefresh} disabled={loading} aria-label={fr?'Actualiser les discussions':'Refresh discussions'} className="forum-refresh"><RefreshCw size={17} className={loading?'animate-spin':''}/><span>{fr?'Actualiser':'Refresh'}</span></button></div>
}
export function ForumTopics({categories,selected,onSelect,language}:{categories:string[];selected:string;onSelect:(value:string)=>void;language:string}){
 return <nav className="forum-topics" aria-label={language==='fr'?'Filtrer les discussions par thème':'Filter discussions by topic'}>{['ALL',...categories].map(category=><button key={category} type="button" aria-pressed={selected===category} onClick={()=>onSelect(category)}>{category==='ALL'?(language==='fr'?'Tout le fil':'All discussions'):forumCategoryLabel(category,language)}</button>)}</nav>
}
export function ForumGuidelines({language}:{language:string}){return <div className="forum-guidelines"><ShieldCheck size={20}/><div><b>{language==='fr'?'Une communauté qui vous ressemble':'A community built together'}</b><p>{language==='fr'?'Partagez vos idées avec respect. Protégez les informations personnelles et privilégiez les échanges utiles à la communauté.':'Share ideas respectfully. Protect personal information and keep conversations helpful to the community.'}</p></div></div>}

export function ForumExpandable({children,language,kind}:{children:ReactNode;language:string;kind:'composer'|'tools'}){
 const [open,setOpen]=useState(false),[desktop,setDesktop]=useState(()=>window.matchMedia('(min-width:1280px)').matches)
 useEffect(()=>{const media=window.matchMedia('(min-width:1280px)'),update=()=>setDesktop(media.matches);media.addEventListener('change',update);return()=>media.removeEventListener('change',update)},[])
 const fr=language==='fr',Icon=kind==='composer'?PenLine:Search
 return <details className={'forum-expandable forum-expandable-'+kind} open={desktop||open} onToggle={event=>{if(!desktop)setOpen(event.currentTarget.open)}}><summary><Icon size={19}/><span>{kind==='composer'?(fr?'Lancer une discussion':'Start a discussion'):(fr?'Rechercher et explorer':'Search and explore')}</span><b aria-hidden="true">{open?'−':'+'}</b></summary><div className="forum-expanded-content">{children}</div></details>
}
