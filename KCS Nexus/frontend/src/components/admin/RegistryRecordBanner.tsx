import { useEffect, useState } from 'react'
import { Briefcase, GraduationCap, UsersRound, ShieldCheck, ChevronRight } from 'lucide-react'
import { useUIStore } from '@/store/uiStore'
import './registryDialogs.css'

type Props = { kind: 'student' | 'parent' | 'employee' | 'family'; name?: string; detail?: string; photo?: string | null; badge?: string; mode: 'view' | 'edit' | 'create' }
export default function RegistryRecordBanner({kind,name,detail,photo,badge,mode}:Props) {
 const language=useUIStore(state=>state.language),tr=(fr:string,en:string)=>language==='fr'?fr:en
 const [failedPhoto,setFailedPhoto]=useState(false)
 useEffect(()=>setFailedPhoto(false),[photo])
 const Icon=kind==='student'?GraduationCap:kind==='employee'?Briefcase:UsersRound
 const names={student:tr('Dossier élève','Learner record'),parent:tr('Dossier parent','Parent record'),employee:tr('Dossier employé','Employee record'),family:tr('Inscription familiale','Family registration')}
 const initials=(name||'KCS').split(/\s+/).filter(Boolean).slice(0,2).map(value=>value[0]).join('').toUpperCase()
 return <section className="registry-record-banner" data-record-kind={kind}>
  <div className="registry-record-portrait">{photo&&!failedPhoto?<img src={photo} alt={name||names[kind]} onError={()=>setFailedPhoto(true)}/>:<span>{initials}</span>}<i aria-hidden="true"><Icon size={16}/></i></div>
  <div className="registry-record-identity"><span className="registry-record-eyebrow"><Icon size={13}/>{names[kind]}</span><h2>{name?.trim()||tr('Un nouveau parcours commence ici','A new journey starts here')}</h2><p>{detail||tr('Les informations saisies composent le dossier officiel de l’entité.','The information entered forms this person’s official school record.')}</p><div className="registry-record-tags"><span><ShieldCheck size={12}/>{tr('Registre KCS Orbit','KCS Orbit registry')}</span>{badge&&<span>{badge}</span>}</div></div>
  <div className="registry-record-mode">{mode==='view'?tr('Consultation','Read only'):mode==='edit'?tr('Mise à jour du dossier','Editing record'):tr('Nouveau dossier','New record')}</div>
 </section>
}
export function RegistrySectionNav({titles}:{titles:string[]}) {
 const language=useUIStore(state=>state.language)
 return <nav className="registry-section-nav" aria-label={language==='fr'?'Sections du dossier':'Record sections'}>{titles.map((title,index)=><button key={title} type="button" onClick={event=>{const dialog=event.currentTarget.closest('[data-entity-dialog]');dialog?.querySelectorAll('fieldset')[index]?.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})}}><span>{String(index+1).padStart(2,'0')}</span>{title}<ChevronRight size={12}/></button>)}</nav>
}
export function useRegistryDialogFocus(open:boolean) {
 useEffect(()=>{
  if(!open)return
  const previous=document.activeElement as HTMLElement|null
  const frame=requestAnimationFrame(()=>document.querySelectorAll<HTMLElement>('[data-entity-dialog] .registry-dialog-heading button').item(document.querySelectorAll('[data-entity-dialog] .registry-dialog-heading button').length-1)?.focus({preventScroll:true}))
  const trap=(event:KeyboardEvent)=>{
   if(event.key!=='Tab')return
   const dialogs=Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"],[role="alertdialog"]')),dialog=dialogs.reduce<HTMLElement|undefined>((top,item)=>!top||(Number(getComputedStyle(item).zIndex)||0)>=(Number(getComputedStyle(top).zIndex)||0)?item:top,undefined)
   if(!dialog?.matches('[data-entity-dialog]'))return
   const controls=Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]')).filter(node=>node.getClientRects().length>0)
   const first=controls[0],last=controls.at(-1);if(!first||!last)return
   if(event.shiftKey&&(document.activeElement===first||!dialog.contains(document.activeElement))){event.preventDefault();last.focus()}else if(!event.shiftKey&&(document.activeElement===last||!dialog.contains(document.activeElement))){event.preventDefault();first.focus()}
  }
  document.addEventListener('keydown',trap)
  return()=>{cancelAnimationFrame(frame);document.removeEventListener('keydown',trap);if(previous?.isConnected)previous.focus({preventScroll:true})}
 },[open])
}
