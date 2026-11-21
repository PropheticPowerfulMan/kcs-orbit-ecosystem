import {useEffect,useState} from 'react'
import {createPortal} from 'react-dom'
import {useLocation} from 'react-router-dom'
import {ArrowUp,Rows3} from 'lucide-react'
import {useUIStore} from '@/store/uiStore'
type Destination={id:string;label:string}
export default function MobileWorkspaceNavigator(){
 const {pathname}=useLocation(),fr=useUIStore(s=>s.language)==='fr'
 const [destinations,setDestinations]=useState<Destination[]>([]),[selected,setSelected]=useState(''),[editing,setEditing]=useState(false),[obscured,setObscured]=useState(false)
 useEffect(()=>{
  const media=matchMedia('(max-width:767px)')
  let timer=0,main:HTMLElement|null=null
  const assigned=new Map<HTMLElement,string>(),tables=new Set<HTMLElement>()
  const excluded='[role=dialog],[hidden],[data-official-document],[data-report-card-document],.report-card-paper,.official-report-card,.transcript-paper,[data-mobile-workspace-nav]'
  const scan=()=>{
   clearTimeout(timer);main=document.querySelector<HTMLElement>('.portal-shell>main')
   if(!media.matches||!main||main.querySelector('[data-kcs-gradebook]')){setDestinations([]);if(main)delete main.dataset.mobileSections;return}
   setObscured(Array.from(document.querySelectorAll('[role=dialog],[data-gradebook-focus]')).some(e=>e.getClientRects().length>0))
   const found:Destination[]=[]
   for(const heading of main.querySelectorAll<HTMLElement>('h2,h3,h4')){
    if(heading.closest(excluded)||!heading.getClientRects().length)continue
    const label=heading.textContent?.trim().replace(/\s+/g,' ')
    if(!label||label.length>110||found.some(d=>d.label===label))continue
    if(!heading.id){const id='nexus-mobile-section-'+assigned.size;heading.id=id;assigned.set(heading,id)}
    found.push({id:heading.id,label});if(found.length===30)break
   }
   for(const table of main.querySelectorAll<HTMLTableElement>('table')){
    if(table.closest(excluded)||!table.getClientRects().length)continue
    table.dataset.mobileTable='true';tables.add(table)
    const wrap=table.parentElement
    if(wrap&&wrap.children.length===1){wrap.dataset.mobileTableScroll='true';tables.add(wrap)}
   }
   if(found.length>=3)main.dataset.mobileSections='true';else delete main.dataset.mobileSections
   setDestinations(old=>JSON.stringify(old)===JSON.stringify(found)?old:found);setSelected(old=>found.some(d=>d.id===old)?old:'')
  }
  const schedule=()=>{clearTimeout(timer);timer=window.setTimeout(scan,120)}
  const focus=()=>queueMicrotask(()=>setEditing(/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName||'')&&!document.activeElement?.closest('[data-mobile-workspace-nav]')))
  const observer=new MutationObserver(schedule);observer.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['hidden','open','aria-selected']})
  media.addEventListener('change',schedule);window.addEventListener('resize',schedule);document.addEventListener('focusin',focus);document.addEventListener('focusout',focus);scan()
  return()=>{observer.disconnect();clearTimeout(timer);media.removeEventListener('change',schedule);window.removeEventListener('resize',schedule);document.removeEventListener('focusin',focus);document.removeEventListener('focusout',focus);if(main)delete main.dataset.mobileSections;for(const [heading,id]of assigned)if(heading.id===id)heading.removeAttribute('id');for(const table of tables){delete table.dataset.mobileTable;delete table.dataset.mobileTableScroll}}
 },[pathname,fr])
 if(destinations.length<3||editing||obscured)return null
 const visit=(id:string)=>{setSelected(id);const heading=document.getElementById(id);if(!heading)return;heading.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant' as ScrollBehavior:'smooth'});heading.tabIndex=-1;heading.focus({preventScroll:true})}
 return createPortal(<nav data-mobile-workspace-nav aria-label={fr?'Accès rapide aux rubriques':'Quick access to sections'}><Rows3 size={17}/><label><span className="sr-only">{fr?'Aller à une rubrique':'Jump to a section'}</span><select value={selected} onChange={event=>visit(event.target.value)}><option value="">{fr?'Aller directement à…':'Jump directly to…'}</option>{destinations.map(d=><option key={d.id} value={d.id}>{d.label}</option>)}</select></label><button type="button" aria-label={fr?'Revenir en haut':'Back to top'} onClick={()=>window.scrollTo({top:0,behavior:'smooth'})}><ArrowUp size={17}/></button></nav>,document.body)
}
