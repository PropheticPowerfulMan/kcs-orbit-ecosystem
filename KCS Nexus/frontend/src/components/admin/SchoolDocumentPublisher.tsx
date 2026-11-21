import {useRef,useState} from 'react'
import {FileUp,FileText,Loader2,ShieldCheck} from 'lucide-react'
import {api} from '@/services/api'
import {useAuthStore} from '@/store/authStore'
import {useUIStore} from '@/store/uiStore'
import {useSchoolDocuments,notifySchoolDocumentPublished} from '@/hooks/useSchoolDocuments'
import {confirmPortalAction,alertPortalMessage} from '@/utils/portalActionDialogs'
import '@/pages/SchoolHandbook/schoolHandbook.css'
export default function SchoolDocumentPublisher({kind,academicYear}:{kind:'handbook'|'calendar';academicYear?:string}){
 const user=useAuthStore(s=>s.user),language=useUIStore(s=>s.language),{documents,loading,error,refresh}=useSchoolDocuments(academicYear)
 const [edition,setEdition]=useState<'en'|'fr'>('en'),[file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false),[status,setStatus]=useState(''),input=useRef<HTMLInputElement>(null)
 const tr=(fr:string,en:string)=>language==='fr'?fr:en
 if(user?.id!=='configured-superadmin')return null
 const current=documents.find(d=>d.kind===kind&&d.language===edition)
 const publish=async()=>{
  if(!file||busy||loading||error)return
  const selected=file,scope=kind==='calendar'?academicYear:undefined
  if(!await confirmPortalAction(tr('Publier ce PDF pour toute l’école ? La version précédente sera conservée dans l’historique.','Publish this PDF for the whole school? The previous version will be retained in the history.')))return
  setBusy(true);setStatus('')
  try{
   const {inspectSchoolPdf}=await import('@/components/shared/HandbookPdfReader')
   const pages=await inspectSchoolPdf(selected)
   const form=new FormData();form.append('file',selected);form.append('kind',kind);form.append('language',edition);form.append('revision',String(current?.revision||0));form.append('pages',String(pages));if(scope)form.append('academicYear',scope)
   await api.post('/school-documents/upload',form,{timeout:120000,headers:{'x-silent-feedback':'true'}})
   notifySchoolDocumentPublished();await refresh();setFile(null);if(input.current)input.current.value=''
   const message=tr('PDF publié. Le site et les dashboards utilisent désormais cette version.','PDF published. The website and dashboards now use this version.')
   setStatus(message);await alertPortalMessage(message)
  }catch(e:any){const message=e?.response?.status===409?tr('Une autre version vient d’être publiée. Actualisez puis recommencez.','Another version was just published. Refresh and try again.'):e?.response?.data?.message||tr('Le PDF n’a pas pu être publié. Vérifiez le fichier et réessayez.','The PDF could not be published. Check the file and retry.');setStatus(message);await alertPortalMessage(message)}
  finally{setBusy(false)}
 }
 return <section className="school-document-publisher" data-school-document-publisher={kind}><div className="school-document-publisher-title"><span><FileUp size={23}/></span><div><small>KCS · {tr('DOCUMENTS OFFICIELS','OFFICIAL DOCUMENTS')}</small><h2>{kind==='handbook'?tr('Mettre à jour le School Handbook','Update the school handbook'):tr('Publier le calendrier en PDF','Publish the calendar PDF')}</h2><p>{kind==='handbook'?tr('Les éditions française et anglaise sont remplacées séparément, pour le site et tous les dashboards.','Replace the French and English editions independently, across the website and every dashboard.'):tr('Document de référence pour '+academicYear+'. Il ne modifie ni les dates, ni les périodes, ni les règles du calendrier central.','Reference document for '+academicYear+'. It does not change dates, periods or rules in the central calendar.')}</p></div></div><div className="school-document-upload-grid"><label>{tr('Langue du PDF','PDF language')}<select disabled={busy} value={edition} onChange={e=>{setEdition(e.target.value as 'en'|'fr');setStatus('')}}><option value="en">English</option><option value="fr">Français</option></select></label><label className="school-document-file"><FileText size={21}/><span>{file?.name||tr('Choisir un PDF · 20 Mo maximum','Choose a PDF · 20 MB maximum')}</span><input ref={input} aria-label={tr('Choisir le PDF à publier','Choose the PDF to publish')} disabled={busy} type="file" accept="application/pdf,.pdf" onChange={e=>{const next=e.target.files?.[0]||null;if(next&&(next.size>20*1024*1024||!/\.pdf$/i.test(next.name))){setFile(null);e.target.value='';setStatus(tr('Choisissez un PDF de 20 Mo maximum.','Choose a PDF no larger than 20 MB.'));return}setFile(next);setStatus('')}}/></label><button type="button" disabled={busy||loading||error||!file||kind==='calendar'&&!academicYear} onClick={()=>void publish()}>{busy?<Loader2 size={17} className="animate-spin"/>:<ShieldCheck size={17}/>} {busy?tr('Validation et publication…','Validating and publishing…'):tr('Publier le PDF','Publish PDF')}</button></div><p className="school-document-current">{current?tr('Version publiée : ','Published version: ')+current.filename+' · '+new Date(current.publishedAt).toLocaleDateString(language==='fr'?'fr-FR':'en-GB'):tr('Aucun remplacement publié pour cette édition. Le document existant reste disponible.','No replacement published for this edition. The existing document remains available.')}</p>{error&&<p role="alert">{tr('Le catalogue est indisponible.','Document catalog unavailable.')} <button type="button" onClick={()=>void refresh()}>{tr('Réessayer','Retry')}</button></p>}{status&&<p role="status">{status}</p>}</section>
}
