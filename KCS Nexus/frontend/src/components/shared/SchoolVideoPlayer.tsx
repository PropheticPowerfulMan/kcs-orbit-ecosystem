import { ExternalLink } from 'lucide-react'
import { schoolVideoSource } from '@/utils/schoolVideo'
import { useUIStore } from '@/store/uiStore'
export default function SchoolVideoPlayer({url,title,poster}:{url:string;title:string;poster?:string}) {
 const language=useUIStore(state=>state.language),source=schoolVideoSource(url)
 if(!source)return <p className="p-5 text-sm text-slate-200">{language==='fr'?'Vidéo indisponible.':'Video unavailable.'}</p>
 if(source.kind==='file')return <video src={source.url} poster={poster} aria-label={title} controls playsInline preload="metadata" className="aspect-video w-full bg-slate-950 object-contain"/>
 if(source.kind==='embed')return <iframe src={source.url} title={title} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen className="aspect-video w-full border-0 bg-slate-950"/>
 return <a href={source.url} target="_blank" rel="noopener noreferrer" className="flex min-h-40 items-center justify-center gap-3 rounded-xl bg-slate-950 p-5 text-center font-bold text-white"><ExternalLink size={20}/>{language==='fr'?'Regarder sur la plateforme de diffusion':'Watch on the streaming platform'}</a>
}
