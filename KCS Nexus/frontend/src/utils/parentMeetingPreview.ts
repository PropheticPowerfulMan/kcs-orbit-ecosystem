import { parentMeetingsAPI } from '@/services/api'
import { showOfficialDocument } from './officialDocumentPreview'
export async function previewParentMeeting(id: string, language: 'fr'|'en', onError: (message:string)=>void) {
 const win=window.open('', '_blank', 'width=1200,height=900')
 if(!win){onError(language==='fr'?'Autorisez la fenêtre du document.':'Allow the document window.');return}
 win.document.body.textContent=language==='fr'?'Préparation du rapport…':'Preparing the report…'
 try{const response=await parentMeetingsAPI.document(id,language);await showOfficialDocument(win,response.data.data.html,{filename:response.data.data.documentId,language,autoPrint:false,onError})}
 catch{win.close();onError(language==='fr'?'Le rapport enregistré est indisponible. Réessayez.':'The saved report is unavailable. Please retry.')}
}
