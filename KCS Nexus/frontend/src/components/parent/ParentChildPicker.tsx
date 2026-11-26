import {useEffect,useLayoutEffect,useId,useRef,useState} from 'react'
import {createPortal} from 'react-dom'
import {Check,ChevronDown,GraduationCap,Search,Users,X} from 'lucide-react'
import './parentChildPicker.css'
type Child={id:string;name:string;grade:string;studentNumber:string;avatar:string|null}
export default function ParentChildPicker({children,selectedId,onChange,language}:{children:Child[];selectedId:string;onChange:(id:string)=>void;language:string}){
 const fr=language==='fr',tr=(a:string,b:string)=>fr?a:b,id=useId(),[open,setOpen]=useState(false),[query,setQuery]=useState(''),[active,setActive]=useState(0),[position,setPosition]=useState({left:16,top:80,width:320,maxHeight:400})
 const trigger=useRef<HTMLButtonElement>(null),popup=useRef<HTMLDivElement>(null),input=useRef<HTMLInputElement>(null)
 const selected=children.find(c=>c.id===selectedId)||children[0]
 const clean=(v:string)=>v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()
 const words=clean(query).split(/\s+/).filter(Boolean)
 const options=children.filter(c=>words.every(word=>clean(c.name+' '+c.grade+' '+c.studentNumber).includes(word)))
 const close=()=>{setOpen(false);trigger.current?.focus()}
 const choose=(child:Child)=>{onChange(child.id);close()}
 useEffect(()=>{setActive(0)},[query])
 useLayoutEffect(()=>{setOpen(false);setQuery('')},[selectedId])
 useEffect(()=>{
  if(!open)return
  const place=()=>{const rect=trigger.current?.getBoundingClientRect();if(!rect)return;const width=Math.min(380,innerWidth-24),left=Math.max(12,Math.min(rect.right-width,innerWidth-width-12)),below=innerHeight-rect.bottom-20;setPosition({left,top:below>=220?rect.bottom+8:Math.max(12,rect.top-Math.min(400,rect.top-20)-8),width,maxHeight:Math.max(180,Math.min(400,below>=220?below:rect.top-20))})}
  place();input.current?.focus()
  const outside=(event:PointerEvent)=>{if(!popup.current?.contains(event.target as Node)&&!trigger.current?.contains(event.target as Node))setOpen(false)}
  addEventListener('resize',place);addEventListener('scroll',place,true);document.addEventListener('pointerdown',outside)
  return()=>{removeEventListener('resize',place);removeEventListener('scroll',place,true);document.removeEventListener('pointerdown',outside)}
 },[open])
 useEffect(()=>{if(open)document.getElementById(id+'-'+active)?.scrollIntoView({block:'nearest'})},[active,open])
 if(!selected)return null
 return <><button ref={trigger} type="button" className="parent-child-trigger" aria-expanded={open} aria-haspopup="listbox" aria-controls={open?id:undefined} aria-label={tr('Choisir un enfant','Choose a child')+' · '+selected.name} onClick={()=>{setQuery('');setOpen(v=>!v)}}><span className="parent-child-avatar"><GraduationCap size={22}/>{selected.avatar&&<img src={selected.avatar} alt="" onLoad={e=>{e.currentTarget.style.visibility='visible'}} onError={e=>{e.currentTarget.style.visibility='hidden'}}/>}</span><span className="parent-child-current"><small>{tr('ÉLÈVE ACTIF','ACTIVE CHILD')}</small><strong>{selected.name}</strong><span>{selected.grade} · <Users size={11}/> {children.length} {tr(children.length>1?'enfants':'enfant',children.length>1?'children':'child')}</span></span><ChevronDown size={17}/></button>
 {open&&createPortal(<div ref={popup} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node)&&!trigger.current?.contains(e.relatedTarget as Node))setOpen(false)}} className="parent-child-menu" style={{position:'fixed',left:position.left,top:position.top,width:position.width,maxHeight:position.maxHeight,zIndex:1000}}><header><strong>{tr('Votre famille KCS','Your KCS family')}</strong><button type="button" onClick={close} aria-label={tr('Fermer le choix','Close child selection')}><X size={16}/></button></header><label className="parent-child-search"><Search size={16}/><input ref={input} role="combobox" aria-expanded="true" aria-controls={id} aria-activedescendant={options.length?id+'-'+Math.min(active,options.length-1):undefined} aria-label={tr('Rechercher un enfant','Search children')} autoComplete="off" value={query} onChange={e=>setQuery(e.target.value)} placeholder={tr('Nom, classe ou numéro d’élève…','Name, grade or student number…')} onKeyDown={e=>{
 if(e.key==='Escape'){e.preventDefault();close()}
 if(e.key==='ArrowDown'){e.preventDefault();setActive(v=>Math.max(0,Math.min(options.length-1,v+1)))}
 if(e.key==='ArrowUp'){e.preventDefault();setActive(v=>Math.max(0,v-1))}
 if(e.key==='Home'){e.preventDefault();setActive(0)}
 if(e.key==='End'){e.preventDefault();setActive(Math.max(0,options.length-1))}
 if(e.key==='Enter'&&options[active]){e.preventDefault();choose(options[active])}
 }}/></label><div id={id} role="listbox" aria-label={tr('Enfants de cette famille','Children in this family')} className="parent-child-options">{options.map((child,index)=><button key={child.id} id={id+'-'+index} type="button" role="option" aria-selected={child.id===selectedId} tabIndex={-1} data-active={active===index} onMouseEnter={()=>setActive(index)} onClick={()=>choose(child)}><span className="parent-child-avatar"><GraduationCap size={19}/></span><span><strong>{child.name}</strong><small>{child.grade}{child.studentNumber?' · '+child.studentNumber:''}</small></span>{child.id===selectedId&&<Check size={17}/>}</button>)}{!options.length&&<p role="status">{tr('Aucun enfant ne correspond à cette recherche.','No child matches this search.')}</p>}</div></div>,document.body)}</>
}
