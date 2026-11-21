import {useEffect} from 'react'
import {useQuery} from '@tanstack/react-query'
import {api} from '@/services/api'
export type SchoolDocument={kind:'handbook'|'calendar';language:'fr'|'en';academicYear?:string;version:string;revision:number;filename:string;bytes:number;pages?:number;sha256:string;publishedAt:string;url:string}
const eventName='kcs-school-documents-published',signal='kcs:school-documents:published'
export function notifySchoolDocumentPublished(){
 window.dispatchEvent(new Event(eventName))
 try{localStorage.setItem(signal,String(Date.now()))}catch{}
}
const cacheKey=(year?:string)=>'kcs:public-school-documents:'+(year||'handbooks')
function cachedDocuments(year?:string):SchoolDocument[]|undefined {
 try{const data=JSON.parse(localStorage.getItem(cacheKey(year))||'null');return Array.isArray(data)&&data.every(d=>['handbook','calendar'].includes(d.kind)&&['fr','en'].includes(d.language)&&/^[a-f0-9-]{36}$/.test(d.version)&&d.url.endsWith('/school-documents/files/'+d.version))?data:undefined}catch{return undefined}
}
export function useSchoolDocuments(academicYear?:string){
 const query=useQuery({queryKey:['school-documents',academicYear||''],initialData:()=>cachedDocuments(academicYear),initialDataUpdatedAt:0,queryFn:async()=>{const r=await api.get('/school-documents',{params:academicYear?{academicYear}:undefined,headers:{'Cache-Control':'no-cache'}});const documents=r.data.data as SchoolDocument[];try{localStorage.setItem(cacheKey(academicYear),JSON.stringify(documents))}catch{}return documents},staleTime:10000,refetchInterval:15000,refetchOnWindowFocus:true,refetchOnReconnect:true,retry:1})
 const refresh=query.refetch
 useEffect(()=>{const update=()=>{void refresh()},storage=(event:StorageEvent)=>{if(event.key===signal)update()};window.addEventListener(eventName,update);window.addEventListener('storage',storage);return()=>{window.removeEventListener(eventName,update);window.removeEventListener('storage',storage)}},[refresh])
 return {documents:query.data||[],loading:query.isPending,error:query.isError,refresh}
}
