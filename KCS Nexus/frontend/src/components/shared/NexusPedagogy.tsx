import {useUIStore} from '@/store/uiStore'
import {api} from '@/services/api'
import PedagogyWorkspace from './PedagogyWorkspace'
import {printPedagogyReport} from '@/utils/pedagogyPrint'
import './pedagogy.css'
export default function NexusPedagogy(){
 const fr=useUIStore(s=>s.language)==='fr'
 const request=async(path:string,o?:{method?:string;body?:any})=>{const r=await api.request({url:'/pedagogy'+path,method:o?.method||'GET',data:o?.body,headers:{'x-silent-feedback':'true'}});return r.data.data}
 const download=async(id:string,name:string)=>{if(id.startsWith('reference:')){const a=document.createElement('a');a.href='https://academy.kinshasachristianschool.org/library/'+encodeURIComponent(id.slice(10));a.target='_blank';a.rel='noopener';a.click();return}const r=await api.get('/pedagogy/resources/'+encodeURIComponent(id)+'/file',{responseType:'blob'}),url=URL.createObjectURL(r.data),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000)}
 const launch=async(app:'academy'|'planner')=>{try{const r=await api.post(app==='academy'?'/academy/launch':'/lesson-plan/launch');location.assign(r.data.data.url)}catch{alert(fr?'Connexion temporairement indisponible.':'Connection temporarily unavailable.')}}
 return <PedagogyWorkspace fr={fr} request={request} download={download} launch={launch} print={data=>void printPedagogyReport(data,fr?'fr':'en')}/>
}
