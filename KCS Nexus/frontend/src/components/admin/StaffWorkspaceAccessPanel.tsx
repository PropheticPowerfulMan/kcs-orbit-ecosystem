import SeniorTeacherAccessPanel from './SeniorTeacherAccessPanel'
import {useState} from 'react'
import {ShieldCheck,Search,RefreshCw} from 'lucide-react'
import {api} from '@/services/api'
import {useUIStore} from '@/store/uiStore'
import {confirmPortalAction} from '@/utils/portalActionDialogs'

type Workspace='staff'|'principal'
type Entry={id:string;name:string;email:string;role:string;enabled:boolean;included:boolean;workspace:Workspace}
export default function StaffWorkspaceAccessPanel(){
 const language=useUIStore(state=>state.language),tr=(fr:string,en:string)=>language==='fr'?fr:en
 const [open,setOpen]=useState(false),[rows,setRows]=useState<Entry[]>([]),[query,setQuery]=useState(''),[busy,setBusy]=useState(''),[notice,setNotice]=useState(''),[selection,setSelection]=useState<Record<string,Workspace>>({})
 const load=async()=>{setBusy('load');try{const response=await api.get('/admin/staff-workspace-access');setRows(response.data.data);setSelection({})}catch{setNotice(tr('Chargement impossible. Réessayez.','Unable to load. Please retry.'))}finally{setBusy('')}}
 const change=async(row:Entry,enabled:boolean)=>{
  const workspace=selection[row.id]??row.workspace??'staff',label=workspace==='principal'?'Principal':'Staff'
  const question=enabled?tr('Accorder à '+row.name+' l’espace '+label+' ? Ses cours et ses identifiants seront conservés.','Grant '+row.name+' the '+label+' workspace? Courses and credentials will be retained.'):tr('Retirer l’accès administratif supplémentaire de '+row.name+' ? Son espace habituel sera conservé.','Remove additional administrative access for '+row.name+'? The usual workspace will be retained.')
  if(!await confirmPortalAction(question))return
  setBusy(row.id)
  try{const response=await api.put('/admin/staff-workspace-access/'+encodeURIComponent(row.id),{enabled,workspace});setRows(current=>current.map(item=>item.id===row.id?{...item,...response.data.data}:item));setNotice(tr('Autorisation enregistrée. La personne peut actualiser sa page pour mettre à jour son menu.','Permission saved. The person can refresh their page to update the menu.'))}
  catch{setNotice(tr('Modification impossible. Réessayez.','Unable to change access. Please retry.'))}finally{setBusy('')}
 }
 const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
 const visible=rows.filter(row=>normalize(row.name+' '+row.email+' '+row.role).includes(normalize(query)))
 return <><section data-staff-workspace-access className="overflow-hidden rounded-2xl border border-sky-200 bg-sky-50/80 dark:border-sky-800 dark:bg-kcs-blue-950/60">
  <button type="button" aria-expanded={open} onClick={()=>{if(!open)void load();setOpen(!open)}} className="flex w-full items-center gap-3 p-4 text-left font-bold text-sky-950 dark:text-sky-100"><ShieldCheck size={20}/><span className="flex-1">{tr('Accès aux espaces Staff et Principal','Staff and Principal workspace access')}</span><span>{open?'−':'+'}</span></button>
  {open&&<div className="space-y-4 border-t border-sky-200 p-4 dark:border-sky-800">
   <p className="text-sm text-slate-700 dark:text-slate-200">{tr('Choisissez Staff pour les fonctions administratives ou Principal pour la direction pédagogique. Tout compte actif du répertoire peut recevoir cet accès et conserve son espace habituel, ses données et ses identifiants. Une fiche employé ne donne aucun accès supplémentaire à elle seule.','Choose Staff for administrative duties or Principal for academic leadership. Any active directory account can receive this access and retains its usual workspace, data and credentials. An employee record alone grants no additional access.')}</p>
   <div className="flex gap-2"><label className="relative flex-1"><Search size={16} className="absolute left-3 top-3 text-slate-500"/><input aria-label={tr('Rechercher une personne pour l’accès administratif','Search administrative workspace access')} value={query} onChange={e=>setQuery(e.target.value)} placeholder={tr('Nom complet ou e-mail…','Full name or email…')} className="w-full rounded-xl border border-sky-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 dark:border-sky-700 dark:bg-kcs-blue-900 dark:text-white"/></label><button type="button" disabled={Boolean(busy)} onClick={()=>void load()} aria-label={tr('Actualiser les accès','Refresh workspace access')} className="rounded-xl bg-sky-700 px-3 text-white disabled:opacity-50"><RefreshCw size={18}/></button></div>
   {notice&&<p role="status" className="rounded-xl bg-sky-100 p-3 text-sm text-sky-950 dark:bg-sky-900 dark:text-sky-100">{notice}</p>}
   <div className="grid max-h-96 gap-2 overflow-y-auto">{visible.map(row=><article key={row.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-sky-100 bg-white p-3 dark:border-sky-800 dark:bg-kcs-blue-900">
    <div className="min-w-0 flex-1"><p className="font-bold text-slate-900 dark:text-white">{row.name}</p><p className="break-all text-xs text-slate-600 dark:text-slate-300">{row.email}</p><span className="mt-1 inline-block text-xs font-semibold text-sky-800 dark:text-sky-200">{row.enabled?(row.workspace==='principal'?'Principal':'Staff'):tr('Accès supplémentaire désactivé','Additional access disabled')}</span></div>
    <label className="grid gap-1 text-xs font-semibold text-slate-700 dark:text-slate-200">{tr('Espace à accorder','Workspace to grant')}<select aria-label={tr('Espace pour ','Workspace for ')+row.name} value={selection[row.id]??row.workspace??'staff'} disabled={Boolean(busy)||row.role==='ADMIN'} onChange={e=>setSelection(current=>({...current,[row.id]:e.target.value as Workspace}))} className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-slate-950 dark:border-sky-700 dark:bg-kcs-blue-950 dark:text-white"><option value="staff">Staff</option><option value="principal">Principal</option></select></label>
    <div className="flex gap-2">{(!row.enabled||(selection[row.id]??row.workspace)!==row.workspace)&&<button type="button" disabled={Boolean(busy)} onClick={()=>void change(row,true)} className="rounded-lg bg-sky-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-60">{row.enabled?tr('Appliquer','Apply'):tr('Accorder l’accès','Grant access')}</button>}{row.enabled&&<button type="button" disabled={Boolean(busy)||(row.included&&(row.role==='ADMIN'||row.workspace!=='principal'))} onClick={()=>void change(row,false)} className="rounded-lg bg-rose-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-60">{row.included&&(row.role==='ADMIN'||row.workspace!=='principal')?(row.role==='ADMIN'?tr('Inclus dans son rôle Principal','Included in Principal role'):tr('Inclus dans son rôle Staff','Included in Staff role')):tr('Retirer l’accès','Remove access')}</button>}</div>
   </article>)}{!visible.length&&!busy&&<p className="p-3 text-sm text-slate-600 dark:text-slate-300">{tr('Aucun compte actif correspondant.','No matching active account.')}</p>}</div>
  </div>}
 </section><SeniorTeacherAccessPanel/></>
}
