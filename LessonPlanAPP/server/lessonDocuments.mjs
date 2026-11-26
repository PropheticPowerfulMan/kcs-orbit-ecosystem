import {createHash} from 'node:crypto';
import {canonicalLessonJSON,lessonDocumentContent,documentSettings} from './lessonDocument.mjs';
export const lessonHash=value=>createHash('sha256').update(canonicalLessonJSON(value)).digest('hex');
export async function resolveLessonDocument(body,{readPlan},verification=false) {
 const id=String(body.lessonId||''),hash=String(body.hash||body.expectedHash||'');
 if(!/^[A-Za-z0-9_-]{1,128}$/.test(id)||hash&&!/^[a-f0-9]{64}$/.test(hash))throw Object.assign(new Error('Invalid lesson document reference.'),{status:400});
 if(verification&&!hash)throw Object.assign(new Error('The document verification hash is required.'),{status:400});
 const row=await readPlan(id);
 if(!row||row.deleted_at||!row.payload)throw Object.assign(new Error('This lesson is unavailable or outside your access.'),{status:404});
 const current={...row.payload,id:row.id,ownerId:row.owner_id,status:row.status},currentHash=lessonHash(current);
 let lesson=current,matched=!hash||hash===currentHash,historical=false;
 if(!matched&&verification)for(const version of current.versions||[]){
  if(version?.snapshot&&lessonHash({...version.snapshot,id:row.id,ownerId:row.owner_id})===hash){lesson={...version.snapshot,id:row.id,ownerId:row.owner_id};matched=true;historical=true;break}
 }
 if(!verification&&!matched)throw Object.assign(new Error('The saved lesson changed. Your draft is preserved; save or reconcile it before generating this document.'),{status:409});
 if(canonicalLessonJSON(lesson).length>600000)throw Object.assign(new Error('This lesson is too large for one PDF. Split it into daily plans.'),{status:413});
 return {lesson,content:lessonDocumentContent(lesson),hash:lessonHash(lesson),requestedHash:hash,matched,historical,settings:documentSettings(body.settings,lesson.printSettings)};
}
