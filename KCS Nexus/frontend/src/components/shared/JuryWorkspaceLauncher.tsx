import {useEffect,useRef,useState} from 'react'
import {Award,Loader2} from 'lucide-react'
import {api} from '@/services/api'
import {useAuthStore} from '@/store/authStore'
import {useUIStore} from '@/store/uiStore'
import {alertPortalMessage} from '@/utils/portalActionDialogs'
/** Enabled only for a reviewed environment; canonical authorization is checked by the API. */
export default function JuryWorkspaceLauncher({className,compact=false}:{className:string;compact?:boolean}){
 const userId=useAuthStore(s=>s.user?.id),fr=useUIStore(s=>s.language)==='fr',[allowed,setAllowed]=useState(false),[busy,setBusy]=useState(false),[manual,setManual]=useState(''),lock=useRef(false)
 const configured=import.meta.env.VITE_JURY_ENABLED==='true'&&Boolean(import.meta.env.VITE_JURY_PUBLIC_URL)
 useEffect(()=>{setAllowed(false);setManual('');if(!configured||!userId)return;let active=true;void api.get('/jury/access',{headers:{'x-silent-feedback':'true'}}).then(r=>{if(active)setAllowed(r.data?.data?.enabled===true)}).catch(()=>{});return()=>{active=false}},[configured,userId])
 if(!configured||!allowed)return null
 const label='KCS Nexus Jury'
 const open=async()=>{if(lock.current)return;lock.current=true;setBusy(true);try{const owner=userId,r=await api.post('/jury/launch',{}, {headers:{'x-silent-feedback':'true'}}),url=new URL(r.data?.data?.url),expected=new URL(import.meta.env.VITE_JURY_PUBLIC_URL);if(useAuthStore.getState().user?.id!==owner)return;if(url.origin!==expected.origin||url.pathname!==expected.pathname||url.username||url.password)throw Error('Invalid destination');if(navigator.userActivation?.isActive===false){setManual(url.href);setTimeout(()=>setManual(''),45000)}else window.open(url.href,'_blank','noopener,noreferrer')}catch{await alertPortalMessage(fr?'L’accès à Jury n’a pas pu être ouvert. Vérifiez votre connexion et vos droits.':'Jury could not be opened. Check your connection and access rights.')}finally{lock.current=false;setBusy(false)}}
 return manual?<a className={className} href={manual} target="_blank" rel="noopener noreferrer" title={label} data-jury-launch onClick={()=>setTimeout(()=>setManual(''),0)}><Award size={18}/>{!compact&&<span>{fr?'Ouvrir KCS Nexus Jury':'Open KCS Nexus Jury'}</span>}</a>:<button type="button" className={className} title={label} onClick={()=>void open()} disabled={busy} aria-busy={busy} data-kcs-no-processing="true" data-jury-launch>{busy?<Loader2 size={18} className="animate-spin"/>:<Award size={18}/>} {!compact&&<span>{busy?(fr?'Ouverture sécurisée…':'Opening securely…'):label}</span>}</button>
}
