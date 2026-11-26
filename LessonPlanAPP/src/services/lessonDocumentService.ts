import {canonicalLessonJSON} from '../../server/lessonDocument.mjs';
import {cloudAuthService} from './cloudAuthService';
import type {LessonPlan} from '../types/lesson';
const configured=(import.meta.env.VITE_FEDERATED_AUTH_URL||'/lesson-plan/api/auth/ecosystem-login') as string;
const endpoint=(name:string)=>configured.replace(/\/auth\/ecosystem-login$/,'/documents/'+name);
export const documentHash=async(lesson:LessonPlan)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonicalLessonJSON(lesson))))).map(n=>n.toString(16).padStart(2,'0')).join('');
async function request(path:string,body:unknown){const token=await cloudAuthService.ensureAccessToken();const response=await fetch(endpoint(path),{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(60000)});if(!response.ok){const error=await response.json().catch(()=>({}));throw new Error(error.error||'The lesson document could not be verified.')}return response}
export async function officialLessonPdf(lesson:LessonPlan,language:'en'|'fr'){
 const expectedHash=await documentHash(lesson),response=await request('pdf',{lessonId:lesson.id,expectedHash,settings:{...lesson.printSettings,language}});
 return {blob:await response.blob(),viewUrl:response.headers.get('X-Document-View')?endpoint('view/'+response.headers.get('X-Document-View')+'.pdf'):'',hash:expectedHash,filename:response.headers.get('X-Document-Filename')||'Lesson Plan.pdf'};
}
export async function verifyLessonDocument(lessonId:string,hash:string){return(await request('verify',{lessonId,hash})).json()}

export type PreparedLessonPdf={viewUrl:string;filename:string;hash:string;generatedAt:string};
export const lessonPreviewKey=(lesson:LessonPlan,language:'en'|'fr')=>JSON.stringify([cloudAuthService.getSessionUserId(),canonicalLessonJSON(lesson),lesson.printSettings||{},language]);
export async function prepareLessonPreview(lesson:LessonPlan,language:'en'|'fr'):Promise<PreparedLessonPdf>{
 const expectedHash=await documentHash(lesson),response=await request('preview',{lessonId:lesson.id,expectedHash,settings:{...lesson.printSettings,language}});
 const value=await response.json();
 if(!/^[a-f0-9]{64}$/.test(value.viewToken)||value.hash!==expectedHash)throw new Error('The prepared document could not be verified.');
 return {viewUrl:endpoint('view/'+value.viewToken+'.pdf'),filename:encodeURIComponent(value.filename||'Lesson Plan.pdf'),hash:expectedHash,generatedAt:value.generatedAt};
}
