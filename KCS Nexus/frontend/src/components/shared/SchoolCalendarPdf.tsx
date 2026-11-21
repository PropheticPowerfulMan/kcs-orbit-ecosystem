import {lazy,Suspense,useState} from 'react'
import {createPortal} from 'react-dom'
import {Download,Eye,FileText,X} from 'lucide-react'
import {useSchoolDocuments} from '@/hooks/useSchoolDocuments'
import {useUIStore} from '@/store/uiStore'
import '@/pages/SchoolHandbook/schoolHandbook.css'
const Reader=lazy(()=>import('./HandbookPdfReader'))
export default function SchoolCalendarPdf({academicYear}:{academicYear:string}){
 const {documents}=useSchoolDocuments(academicYear),language=useUIStore(s=>s.language),[open,setOpen]=useState(false)
 const tr=(fr:string,en:string)=>language==='fr'?fr:en
 const doc=documents.find(d=>d.kind==='calendar'&&d.language===language)||documents.find(d=>d.kind==='calendar')
 if(!doc)return null
 const title=tr('Calendrier officiel · ','Official calendar · ')+academicYear
 return <div data-calendar-pdf className="school-document-reference"><FileText size={19}/><div><strong>{title}</strong><small>PDF · {doc.language.toUpperCase()} · {doc.filename}</small></div><button type="button" onClick={()=>setOpen(true)}><Eye size={16}/>{tr('Consulter','View')}</button><a href={doc.url+'?download=1'} download={doc.filename}><Download size={16}/>{tr('Télécharger','Download')}</a>{open&&createPortal(<div className="school-document-overlay" role="dialog" aria-modal="true" aria-label={title} onKeyDown={e=>{if(e.key==='Escape')setOpen(false)}}><section><header><div><small>KCS · PDF</small><h2>{title}</h2></div><button type="button" autoFocus onClick={()=>setOpen(false)} aria-label={tr('Fermer le document','Close document')}><X size={21}/></button></header><div className="school-document-scroll"><a className="handbook-secondary" href={doc.url+'?download=1'} download={doc.filename}><Download size={16}/>{tr('Télécharger le PDF','Download PDF')}</a><Suspense fallback={<p role="status">{tr('Chargement…','Loading…')}</p>}><Reader src={doc.url} title={title} language={language}/></Suspense></div></section></div>,document.body)}</div>
}
