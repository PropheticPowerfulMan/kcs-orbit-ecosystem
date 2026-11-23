import {createHash} from 'node:crypto'
import {normalizeClassParts} from './className.js'
export const voterKey=(electionId:string,userId:string)=>createHash('sha256').update('kcs-school-election\0'+electionId+'\0'+userId).digest('hex')
export function electionOfficeMatches(office:{scope:string;grade?:string|null;section?:string|null},classes:Array<{grade:string;section?:string|null}>){
 if(office.scope==='GLOBAL')return true
 const target=normalizeClassParts(office.grade||'',office.section||'')
 return classes.some(c=>{const actual=normalizeClassParts(c.grade,c.section||'');return actual.grade.toLowerCase()===target.grade.toLowerCase()&&(!target.section||actual.section.toLowerCase()===target.section.toLowerCase())})
}
export function validSchoolBallot(offices:Array<{id:string;candidates:Array<{id:string}>}>,choices:Array<{officeId:string;candidateId?:string|null;abstained?:boolean}>,allowAbstention:boolean){
 if(!offices.length||offices.length!==choices.length||new Set(choices.map(c=>c.officeId)).size!==choices.length)return false
 return choices.every(c=>{const office=offices.find(o=>o.id===c.officeId);return Boolean(office&&(c.abstained?allowAbstention&&!c.candidateId:office.candidates.some(a=>a.id===c.candidateId)))})
}
export function electionWindowOpen(e:{status:string;startAt:Date;endAt:Date},now:Date){return e.status==='OPEN'&&now>=e.startAt&&now<=e.endAt}
