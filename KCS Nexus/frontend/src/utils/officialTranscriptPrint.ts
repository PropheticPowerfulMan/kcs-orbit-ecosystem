import {academicRecordsAPI} from '@/services/api'
type OfficialTranscript={student:{id?:string;studentNumber:string;name:string};rows:unknown[]}

/** Reserve the preview during the click, and keep it available after printing or a failed request. */
export async function printOfficialTranscript(transcript:OfficialTranscript,onBlocked:(message:string)=>void){
 const fr=document.documentElement.lang.toLowerCase().startsWith('fr')
 const text=fr?{
  loading:'Préparation de l’aperçu du transcript…',print:'Imprimer / Enregistrer en PDF',close:'Fermer',retry:'Réessayer',
  failed:'Impossible de charger l’aperçu du transcript. Vérifiez votre connexion ou vos droits d’accès, puis réessayez.',
  blocked:'Autorisez les fenêtres d’impression puis réessayez.',reload:'Actualisez le dossier avant de préparer le transcript.'
 }:{
  loading:'Preparing the transcript preview…',print:'Print / Save PDF',close:'Close',retry:'Retry',
  failed:'The transcript preview could not be loaded. Check your connection or access permissions, then retry.',
  blocked:'Allow print windows and try again.',reload:'Reload the learner record before preparing the transcript.'
 }
 const studentId=transcript.student.id
 if(!studentId){onBlocked(text.reload);return}
 const win=window.open('','_blank','width=1100,height=900')
 if(!win){onBlocked(text.blocked);return}
 let busy=false
 const button=(label:string,action:()=>void)=>{
  const element=win.document.createElement('button')
  element.type='button';element.textContent=label;element.addEventListener('click',action)
  return element
 }
 const status=(message:string,error=false)=>{
  win.document.open()
  win.document.write('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>KCS · Transcript</title><style>body{margin:0;padding:5vh 20px;background:#eaf2f8;color:#102849;font:16px Arial,sans-serif}main{max-width:640px;margin:10vh auto;padding:32px;background:#fff;border:1px solid #c8ddec;border-radius:16px}h1{font-size:24px}p{line-height:1.6}button{padding:12px 20px;margin:8px 10px 0 0;border:0;border-radius:8px;background:#073b70;color:white;font-weight:bold;cursor:pointer}</style></head><body><main><h1>KCS · Transcript</h1><p role="status"></p><nav></nav></main></body></html>')
  win.document.close();win.document.documentElement.lang=fr?'fr':'en'
  win.document.querySelector('p')!.textContent=message
  const nav=win.document.querySelector('nav')!
  if(error)nav.append(button(text.retry,()=>{void prepare()}))
  nav.append(button(text.close,()=>win.close()))
 }
 const print=()=>{if(!win.closed){win.focus();win.print()}}
 const prepare=async()=>{
  if(busy||win.closed)return
  busy=true;status(text.loading)
  try{
   const response=await academicRecordsAPI.transcriptDocument(studentId)
   const html=response.data.data.html as string
   if(typeof html!=='string'||!/^<!doctype html>/i.test(html))throw new Error('Invalid transcript document')
   if(win.closed)return
   win.document.open();win.document.write(html);win.document.close()
   // Parent-owned handlers avoid injected-script escaping and Blob load-event races.
   const style=win.document.createElement('style')
   style.textContent='.kcs-transcript-print-toolbar{position:sticky;top:0;z-index:10;display:flex;flex-wrap:wrap;justify-content:center;gap:10px;padding:12px;background:#073b70;box-shadow:0 3px 12px #10284933}.kcs-transcript-print-toolbar button{border:1px solid #aac8e0;border-radius:8px;padding:10px 18px;background:#e9f5fc;color:#073b70;font:700 14px Arial;cursor:pointer}@media print{.kcs-transcript-print-toolbar{display:none!important}}'
   win.document.head.append(style)
   const toolbar=win.document.createElement('nav')
   toolbar.className='kcs-transcript-print-toolbar';toolbar.setAttribute('aria-label',text.print)
   toolbar.append(button(text.print,print),button(text.close,()=>win.close()))
   win.document.body.prepend(toolbar)
   const images=Array.from(win.document.images).map(image=>image.complete?Promise.resolve():new Promise<void>(resolve=>{
    image.addEventListener('load',()=>resolve(),{once:true});image.addEventListener('error',()=>resolve(),{once:true})
   }))
   let timer:ReturnType<typeof setTimeout>|undefined
   await Promise.race([Promise.all([win.document.fonts.ready,...images]),new Promise<void>(resolve=>{timer=setTimeout(resolve,4000)})])
   if(timer)clearTimeout(timer)
   print()
  }catch{
   if(!win.closed)status(text.failed,true)
   onBlocked(text.failed)
  }finally{busy=false}
 }
 await prepare()
}
