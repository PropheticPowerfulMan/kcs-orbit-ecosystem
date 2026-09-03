import { useEffect, useRef, useState } from 'react'
import { Camera, UserRound } from 'lucide-react'
type Props={label:string,value:string,onChange:(value:string)=>void,onError:(message:string)=>void}
export default function PhotoCaptureField({label,value,onChange,onError}:Props){
 const [open,setOpen]=useState(false),[error,setError]=useState('');const video=useRef<HTMLVideoElement|null>(null),stream=useRef<MediaStream|null>(null)
 useEffect(()=>{if(!open)return;let cancelled=false;setError('');navigator.mediaDevices?.getUserMedia({video:{facingMode:'user'},audio:false}).then(media=>{if(cancelled)return media.getTracks().forEach(track=>track.stop());stream.current=media;if(video.current)video.current.srcObject=media}).catch(()=>setError('Caméra indisponible. Vérifiez les permissions.'));return()=>{cancelled=true;stream.current?.getTracks().forEach(track=>track.stop());stream.current=null}},[open])
 const choose=(file?:File)=>{if(!file)return;if(!file.type.startsWith('image/'))return onError('Veuillez sélectionner une image.');if(file.size>5*1024*1024)return onError('La photo ne doit pas dépasser 5 Mo.');const reader=new FileReader();reader.onload=()=>onChange(String(reader.result||''));reader.readAsDataURL(file)}
 const capture=()=>{if(!video.current)return;const canvas=document.createElement('canvas');canvas.width=video.current.videoWidth||640;canvas.height=video.current.videoHeight||480;canvas.getContext('2d')?.drawImage(video.current,0,0,canvas.width,canvas.height);onChange(canvas.toDataURL('image/jpeg',.86));setOpen(false)}
 return <div className="rounded-xl border border-kcs-blue-100 bg-white/80 p-4 dark:border-kcs-blue-700 dark:bg-kcs-blue-950/50">
  <div className="flex items-center gap-4"><div className="flex h-24 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-kcs-blue-300">{value?<img src={value} alt={label} className="h-full w-full object-cover"/>:<UserRound className="text-kcs-blue-300"/>}</div>
  <div><p className="text-sm font-bold dark:text-white">{label}</p><p className="text-xs text-gray-500">JPG, PNG ou WebP · 5 Mo maximum</p><div className="mt-2 flex flex-wrap gap-2">
   <label className="cursor-pointer rounded-lg bg-kcs-blue-700 px-3 py-2 text-xs font-bold text-white">Importer<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={event=>choose(event.target.files?.[0])}/></label>
   <button type="button" onClick={()=>setOpen(true)} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-bold text-kcs-blue-700 dark:text-kcs-blue-200"><Camera size={14}/>Caméra</button>
   {value?<button type="button" onClick={()=>onChange('')} className="text-xs font-bold text-red-600">Retirer</button>:null}
  </div></div></div>
  {open?<div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/70 p-4"><div className="w-full max-w-3xl rounded-2xl bg-white p-5 dark:bg-kcs-blue-950"><h3 className="font-bold dark:text-white">{label}</h3><video ref={video} autoPlay playsInline muted className="mt-4 aspect-video w-full rounded-xl bg-black object-cover"/>{error?<p className="mt-2 text-sm text-red-500">{error}</p>:null}<div className="mt-4 flex justify-end gap-3"><button type="button" onClick={()=>setOpen(false)} className="rounded-xl border px-4 py-2 dark:text-white">Annuler</button><button type="button" onClick={capture} className="rounded-xl bg-kcs-blue-700 px-4 py-2 font-bold text-white">Capturer</button></div></div></div>:null}
 </div>
}
