import {useEffect,useState} from 'react'
import {api} from '@/services/api'
import {useAuthStore} from '@/store/authStore'

const entries=new Map<string,{expires:number;pending:Promise<any>}>()
export function useEarlyYearsContext(){
 const user=useAuthStore(s=>s.user),owner=user?.id||'',eligible=Boolean(user&&(user.role==='teacher'||user.accessRoles?.includes('teacher')))
 const [state,setState]=useState<{owner:string;data:any;loading:boolean;error:string}>({owner:'',data:null,loading:eligible,error:''}),[revision,setRevision]=useState(0)
 useEffect(()=>{
  let active=true
  if(!eligible||!owner){setState({owner,data:null,loading:false,error:''});return}
  setState(v=>({owner,data:v.owner===owner?v.data:null,loading:true,error:''}))
  let entry=entries.get(owner)
  if(!entry||entry.expires<Date.now()){entry={expires:Date.now()+15000,pending:api.get('/early-years/context',{headers:{'x-silent-feedback':'true'}}).then(r=>r.data.data)};entries.set(owner,entry);entry.pending.catch(()=>{if(entries.get(owner)===entry)entries.delete(owner)})}
  entry.pending.then(data=>{if(active)setState({owner,data,loading:false,error:''})}).catch(()=>{if(active)setState({owner,data:null,loading:false,error:'CONNECTION_UNAVAILABLE'})})
  const refresh=()=>{entries.delete(owner);setRevision(v=>v+1)};window.addEventListener('focus',refresh)
  return()=>{active=false;window.removeEventListener('focus',refresh)}
 },[owner,eligible,revision])
 const current=state.owner===owner?state:{owner,data:null,loading:eligible,error:''}
 return{...current,enabled:current.data?.enabled===true,retry:()=>{entries.delete(owner);setRevision(v=>v+1)}}
}
