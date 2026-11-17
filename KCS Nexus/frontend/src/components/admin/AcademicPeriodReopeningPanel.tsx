import { useEffect, useState } from 'react'
import { Unlock, Search, ShieldCheck } from 'lucide-react'
import { academicCalendarAPI } from '@/services/api'
import { ACADEMIC_REPORT_PERIODS, academicPeriodLabel } from '@/constants/academicPeriods'
import { confirmPortalAction } from '@/utils/portalActionDialogs'
import { useUIStore } from '@/store/uiStore'
type Teacher = { userId: string; employeeNumber: string; user: { firstName: string; middleName?: string | null; lastName: string } }
type Grant = { id: string; metadata: { academicYear: string; term: string; teacherUserId: string; reason: string } }
const name = (t: Teacher) => [t.user.lastName,t.user.middleName,t.user.firstName].filter(Boolean).join(' ')
const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
const field = 'w-full rounded-xl border border-sky-200 bg-white p-2.5 text-sm text-slate-900 dark:border-kcs-blue-600 dark:bg-kcs-blue-950 dark:text-white'
export default function AcademicPeriodReopeningPanel({ academicYear }: { academicYear: string }) {
 const language = useUIStore(s=>s.language), tr=(fr:string,en:string)=>language==='fr'?fr:en
 const [teachers,setTeachers]=useState<Teacher[]>([]),[grants,setGrants]=useState<Grant[]>([])
 const [term,setTerm]=useState<string>(ACADEMIC_REPORT_PERIODS[0]),[ids,setIds]=useState<string[]>([]),[all,setAll]=useState(false)
 const [query,setQuery]=useState(''),[reason,setReason]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('')
 const load=async()=>{const {data}=await academicCalendarAPI.reopenings();setTeachers(data.data.teachers);setGrants(data.data.grants)}
 useEffect(()=>{void load().catch(()=>setNotice(tr('Chargement des dérogations impossible.','Permissions could not be loaded.')))},[academicYear])
 const change=async(enabled:boolean,targetIds=ids,everyone=all,targetTerm=term)=>{
   if(busy||(!everyone&&!targetIds.length)||reason.trim().length<3)return
   const ok=await confirmPortalAction(tr('Confirmer la modification des droits de correction ?','Confirm correction permission change?')+'\n'+academicYear+' · '+academicPeriodLabel(targetTerm,language)+' · '+(everyone?tr('Tous les enseignants','All teachers'):teachers.filter(t=>targetIds.includes(t.userId)).map(name).join(', ')))
   if(!ok)return
   setBusy(true);setNotice('')
   try{await academicCalendarAPI.reopenPeriod({academicYear,term:targetTerm,teacherUserIds:targetIds,allTeachers:everyone,enabled,confirmed:true,reason:reason.trim()});await load();window.dispatchEvent(new Event('kcs-academic-period-closed'));setNotice(tr('Dérogation enregistrée. La clôture générale reste inchangée.','Permission saved. The general closure remains unchanged.'))}
   catch(e:any){setNotice(e?.response?.data?.message||tr('Enregistrement impossible.','Permission could not be saved.'))}
   finally{setBusy(false)}
 }
 const visible=teachers.filter(t=>normalize(name(t)+' '+t.employeeNumber).includes(normalize(query)))
 const label=(id:string)=>id==='*'?tr('Tous les enseignants','All teachers'):teachers.find(t=>t.userId===id)?name(teachers.find(t=>t.userId===id)!):id
 return <details className="mt-5 rounded-2xl border border-sky-300 bg-sky-50 p-4 text-kcs-blue-950 dark:border-sky-700 dark:bg-kcs-blue-900 dark:text-white">
  <summary className="flex cursor-pointer items-center gap-2 font-extrabold"><Unlock size={18}/>{tr('Réouvrir les corrections pour des enseignants','Reopen corrections for teachers')}</summary>
  <p className="my-3 text-sm">{tr('Le SuperAdmin peut toujours corriger les bulletins. Accordez ici une dérogation pour modifier les notes et soumettre à nouveau les bulletins d’une période clôturée, sans changer le calendrier ni la clôture générale.','The SuperAdmin can always edit report cards. Allow teachers to correct grades and resubmit report cards in a closed period without changing the calendar or general closure.')}</p>
  <div className="grid gap-3 md:grid-cols-2"><label className="grid gap-1 text-xs font-bold">{tr('Période concernée','Period')}<select className={field} value={term} onChange={e=>setTerm(e.target.value)}>{ACADEMIC_REPORT_PERIODS.map(t=><option key={t} value={t}>{academicPeriodLabel(t,language)}</option>)}</select></label><label className="grid gap-1 text-xs font-bold">{tr('Motif de la dérogation ou de la révocation','Reason for permission or revocation')}<input className={field} value={reason} maxLength={500} onChange={e=>setReason(e.target.value)}/></label></div>
  <label className="my-3 flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={all} onChange={e=>setAll(e.target.checked)}/>{tr('Tous les enseignants','All teachers')}</label>
  {!all&&<><label className="flex items-center gap-2"><Search size={17}/><input className={field} placeholder={tr('Rechercher par nom ou numéro professionnel','Search by name or employee number')} value={query} onChange={e=>setQuery(e.target.value)}/></label><div className="my-3 max-h-52 overflow-y-auto rounded-xl border border-sky-200 p-2 dark:border-kcs-blue-600">{visible.map(t=><label key={t.userId} className="flex items-center gap-2 rounded-lg p-2 text-sm hover:bg-sky-100 dark:hover:bg-kcs-blue-800"><input type="checkbox" checked={ids.includes(t.userId)} onChange={e=>setIds(old=>e.target.checked?[...old,t.userId]:old.filter(id=>id!==t.userId))}/>{name(t)} · {t.employeeNumber}</label>)}</div><p className="mb-3 break-words text-xs">{tr('Sélection','Selected')}: {teachers.filter(t=>ids.includes(t.userId)).map(name).join(', ')||'—'}</p></>}
  <button type="button" className="btn-primary" disabled={busy||reason.trim().length<3||(!all&&!ids.length)} onClick={()=>void change(true)}><ShieldCheck size={16}/>{tr('Autoriser les corrections et soumissions','Allow corrections and submissions')}</button>
  {notice&&<p className="my-3 text-sm font-semibold" role="status">{notice}</p>}
  <div className="mt-4 grid gap-2">{grants.filter(g=>g.metadata.academicYear===academicYear).map(g=><article key={g.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-200 bg-white p-3 text-sm dark:border-kcs-blue-600 dark:bg-kcs-blue-950"><div><b>{academicPeriodLabel(g.metadata.term,language)}</b><p>{label(g.metadata.teacherUserId)}</p><p className="mt-1 text-xs">{g.metadata.reason}</p></div><button className="rounded-lg bg-red-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-40" disabled={busy||reason.trim().length<3} onClick={()=>void change(false,g.metadata.teacherUserId==='*'?[]:[g.metadata.teacherUserId],g.metadata.teacherUserId==='*',g.metadata.term)}>{tr('Révoquer','Revoke')}</button></article>)}</div>
 </details>
}
