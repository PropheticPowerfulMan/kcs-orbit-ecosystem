import {academicRecordsAPI} from '@/services/api'
type OfficialTranscript={student:{id?:string;studentNumber:string;name:string};rows:unknown[]}
export async function printOfficialTranscript(transcript:OfficialTranscript,onBlocked:(message:string)=>void){
 const fr=document.documentElement.lang.toLowerCase().startsWith('fr')
 if(!transcript.student.id){onBlocked(fr?'Actualisez le dossier avant de préparer le transcript.':'Reload the learner record before preparing the transcript.');return}
 const win=window.open('','_blank','width=1100,height=900')
 if(!win){onBlocked(fr?'Autorisez les fenêtres d’impression puis réessayez.':'Allow print windows and try again.');return}
 try{
  const response=await academicRecordsAPI.transcriptDocument(transcript.student.id)
  const html=response.data.data.html as string
  if(!html.startsWith('<!doctype html>'))throw new Error('Invalid official transcript')
  const ready=`<script>addEventListener('load',async function(){await document.fonts.ready;await Promise.all(Array.from(document.images,function(i){return i.complete?Promise.resolve():new Promise(function(r){i.onload=r;i.onerror=r})}));setTimeout(function(){window.focus();window.print()},150)});<\/script>`
  const url=URL.createObjectURL(new Blob([html.replace('</body>',ready+'</body>')],{type:'text/html;charset=utf-8'}));win.location.replace(url);setTimeout(()=>URL.revokeObjectURL(url),300000)
 }catch{win.close();onBlocked(fr?'Impossible de préparer le transcript officiel. Vérifiez les résultats approuvés puis réessayez.':'Unable to prepare the official transcript. Check the approved records and try again.')}
}
