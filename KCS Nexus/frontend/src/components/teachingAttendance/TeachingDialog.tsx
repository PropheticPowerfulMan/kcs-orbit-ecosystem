import {useEffect,useId,useRef,type ReactNode} from 'react'
import {createPortal} from 'react-dom'
import {X} from 'lucide-react'
import {useUIStore} from '@/store/uiStore'
export default function TeachingDialog({title,children,footer,onClose}:{title:string;children:ReactNode;footer?:ReactNode;onClose:()=>void}){
 const id=useId(),ref=useRef<HTMLDivElement>(null),close=useRef(onClose);close.current=onClose
 const fr=useUIStore(s=>s.language)==='fr'
 useEffect(()=>{
  const previous=document.activeElement as HTMLElement|null
  ref.current?.focus()
  const handler=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close.current()}
   if(event.key==='Tab'){
    const nodes=[...ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')||[]].filter(node=>node.offsetParent!==null)
    if(!nodes.length){event.preventDefault();return}
    const first=nodes[0],last=nodes[nodes.length-1]
    if(event.shiftKey&&(document.activeElement===first||document.activeElement===ref.current)){event.preventDefault();last.focus()}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
   }
  }
  document.addEventListener('keydown',handler,true)
  return()=>{document.removeEventListener('keydown',handler,true);previous?.focus()}
 },[])
 return createPortal(<div className="teaching-workspace fixed inset-0 z-[12050] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm" data-teaching-dialog>
  <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={id} className="ta-dialog">
   <header className="ta-dialog-head"><h2 id={id} className="text-base font-bold">{title}</h2><button className="ta-btn" type="button" onClick={onClose} aria-label={fr?'Fermer':'Close'}><X size={18}/></button></header>
   <div className="ta-dialog-body">{children}</div>{footer&&<footer className="ta-dialog-foot">{footer}</footer>}
  </div>
 </div>,document.body)
}
