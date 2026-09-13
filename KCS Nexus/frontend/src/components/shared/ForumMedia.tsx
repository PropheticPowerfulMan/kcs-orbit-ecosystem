import { useEffect, useState } from 'react'
import { Download, FileText, Loader2, Play } from 'lucide-react'

type Props={type?:string;name?:string;hasAttachment?:boolean;load:()=>Promise<any>;language:'fr'|'en';compact?:boolean}
export default function ForumMedia({type,name,hasAttachment,load,language,compact=false}:Props){
 const[url,setUrl]=useState(''),[loading,setLoading]=useState(false),[error,setError]=useState('')
 const tr=(fr:string,en:string)=>language==='fr'?fr:en
 useEffect(()=>()=>{if(url)URL.revokeObjectURL(url)},[url])
 if(!hasAttachment)return null
 const open=async()=>{if(url)return;setLoading(true);setError('');try{const response=await load();setUrl(URL.createObjectURL(response.data))}catch{setError(tr('Impossible de charger ce média.','Unable to load this media.'))}finally{setLoading(false)}}
 return <div className={compact?'mt-2':'mt-4'}>{!url?<button type="button" onClick={()=>void open()} disabled={loading} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-bold text-cyan-800 dark:border-cyan-700 dark:bg-kcs-blue-950 dark:text-cyan-200">{loading?<Loader2 className="animate-spin" size={17}/>:type==='document'?<FileText size={17}/>:<Play size={17}/>} {loading?tr('Chargement…','Loading…'):tr('Ouvrir le média','Open media')} {name&&<span className="max-w-48 truncate font-normal">· {name}</span>}</button>:<div className="overflow-hidden rounded-2xl bg-black/5 dark:bg-black/30">{type==='image'?<img src={url} alt={name||tr('Photo du forum','Forum photo')} className="max-h-[520px] w-full object-contain" loading="lazy"/>:type==='video'?<video src={url} controls playsInline preload="metadata" className="max-h-[520px] w-full"/>:type==='audio'?<audio src={url} controls preload="metadata" className="w-full p-3"/>:<a href={url} download={name||'attachment'} className="inline-flex items-center gap-2 p-4 font-bold text-cyan-700 dark:text-cyan-200"><Download size={17}/>{name||tr('Télécharger le document','Download document')}</a>}</div>}{error&&<p className="mt-2 text-xs font-semibold text-red-600">{error}</p>}</div>
}
