import {useEffect,useRef,useState} from 'react'
import {useLocation} from 'react-router-dom'
import {Award,Loader2,RefreshCw} from 'lucide-react'
import {api} from '@/services/api'
import {useAuthStore} from '@/store/authStore'
import {useUIStore} from '@/store/uiStore'
/** A ready, genuine openerless link preserves installed-app capture and never changes the Nexus origin. */
export default function JuryWorkspaceLauncher({className,compact=false}:{className:string;compact?:boolean}){
 const userId=useAuthStore(s=>s.user?.id),fr=useUIStore(s=>s.language)==='fr',location=useLocation(),[allowed,setAllowed]=useState(false),[ready,setReady]=useState<{url:string;until:number}|null>(null),[busy,setBusy]=useState(false),[failed,setFailed]=useState(false),[attempt,setAttempt]=useState(0),generation=useRef(0)
 const configured=import.meta.env.VITE_JURY_ENABLED==='true'&&Boolean(import.meta.env.VITE_JURY_PUBLIC_URL)
 const workspace=location.pathname.startsWith('/admin')?'admin':location.pathname.split('/').slice(0,3).join('/')
 useEffect(()=>{
  const epoch=++generation.current;setAllowed(false);setReady(null);setFailed(false);if(!configured||!userId)return
  let active=true,checking=false,last=0
  const current=()=>active&&generation.current===epoch&&useAuthStore.getState().user?.id===userId
  const prepare=async()=>{if(checking||!navigator.onLine||document.visibilityState==='hidden'||Date.now()-last<30000)return;checking=true;last=Date.now();if(current())setBusy(true);try{const access=await api.get('/jury/access',{headers:{'x-silent-feedback':'true'}});if(!current())return;setAllowed(access.data?.data?.enabled===true);if(!access.data?.data?.enabled)return;const response=await api.post('/jury/launch',{}, {headers:{'x-silent-feedback':'true'}}),url=new URL(response.data?.data?.url),expected=new URL(import.meta.env.VITE_JURY_PUBLIC_URL);if(!current())return;if(url.origin!==expected.origin||url.pathname!==expected.pathname||url.username||url.password)throw Error('Invalid destination');setReady({url:url.href,until:Date.now()+180000});setFailed(false)}catch{if(current()){setReady(null);setFailed(true)}}finally{checking=false;if(current())setBusy(false)}}
  void prepare();const timer=setInterval(()=>void prepare(),120000),resume=()=>void prepare();addEventListener('online',resume);addEventListener('focus',resume);document.addEventListener('visibilitychange',resume)
  return()=>{active=false;clearInterval(timer);removeEventListener('online',resume);removeEventListener('focus',resume);document.removeEventListener('visibilitychange',resume)}
 },[configured,userId,workspace,attempt])
 if(!configured||(!allowed&&!failed))return null
 const label='KCS Nexus Jury'
 return ready?<a className={className} href={ready.url} target="_blank" rel="noopener noreferrer" title={label} data-jury-launch onClick={event=>{if(Date.now()>=ready.until){event.preventDefault();setReady(null);setAttempt(n=>n+1);return}setTimeout(()=>{setReady(null);setAttempt(n=>n+1)},0)}}><Award size={18}/>{!compact&&<span>{label}</span>}</a>:<button type="button" className={className} title={label} onClick={()=>setAttempt(n=>n+1)} disabled={busy} aria-busy={busy} data-kcs-no-processing="true" data-jury-launch>{busy?<Loader2 size={18} className="animate-spin"/>:failed?<RefreshCw size={18}/>:<Award size={18}/>} {!compact&&<span>{busy?(fr?'Préparation de Jury…':'Preparing Jury…'):failed?(fr?'Réessayer Jury':'Retry Jury'):label}</span>}</button>
}
