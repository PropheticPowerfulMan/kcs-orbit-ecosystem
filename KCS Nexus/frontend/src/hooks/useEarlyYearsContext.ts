import {useEffect,useState} from 'react'
import {api} from '@/services/api'
import {useAuthStore} from '@/store/authStore'
type Entry={expires:number;pending:Promise<any>;data?:any}
const entries=new Map<string,Entry>()
export function useEarlyYearsContext(){
 const user=useAuthStore(s=>s.user),owner=user?.id||'',eligible=Boolean(user&&(user.role==='teacher'||user.accessRoles?.includes('teacher')))
 // A resolved context survives route remounts: the nursery menu never disappears while refreshing.
 const [state,setState]=useState<{owner:string;data:any;loading:boolean;error:string}>(()=>({owner,data:eligible?entries.get(owner)?.data??null:null,loading:eligible,error:''})),[revision,setRevision]=useState(0)
 useEffect(()=>{
  let active=true
  if(!eligible||!owner){setState({owner,data:null,loading:false,error:''});return}
  const cached=entries.get(owner)?.data
  setState(v=>({owner,data:v.owner===owner?v.data??cached??null:cached??null,loading:true,error:''}))
  let entry=entries.get(owner)
  if(!entry||entry.expires<Date.now()){
   const previous=entry?.data
   const created:Entry={expires:Date.now()+60000,data:previous,pending:Promise.resolve(null)}
   created.pending=api.get('/early-years/context',{headers:{'x-silent-feedback':'true'}}).then(r=>{if(entries.get(owner)===created)created.data=r.data.data;return r.data.data})
   entries.set(owner,created);entry=created
   created.pending.catch(()=>{if(entries.get(owner)===created){created.expires=0;if(!created.data)entries.delete(owner)}})
  }
  entry.pending.then(data=>{if(active)setState({owner,data,loading:false,error:''})}).catch(()=>{if(active)setState(v=>({owner,data:v.owner===owner?v.data??cached??null:cached??null,loading:false,error:'CONNECTION_UNAVAILABLE'}))})
  const refresh=()=>{const cachedEntry=entries.get(owner);if(cachedEntry)cachedEntry.expires=0;setRevision(v=>v+1)};window.addEventListener('focus',refresh)
  return()=>{active=false;window.removeEventListener('focus',refresh)}
 },[owner,eligible,revision])
 const current=state.owner===owner?state:{owner,data:eligible?entries.get(owner)?.data??null:null,loading:eligible,error:''}
 return{...current,enabled:current.data?.enabled===true,retry:()=>{const entry=entries.get(owner);if(entry)entry.expires=0;setRevision(v=>v+1)}}
}
