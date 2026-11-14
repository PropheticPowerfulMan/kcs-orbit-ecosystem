import { z } from 'zod'
import { env } from '../config/env.js'
import { prisma } from '../config/prisma.js'
import { ensureTeacherProfile } from '../utils/teacherProfile.js'
import { normalizeClassParts } from '../utils/className.js'
import { isTeacherHomeroomForStudent } from '../utils/teacherClassAccess.js'
import { isKcsAcademicTerm, isSequentialAcademicYear } from '../utils/academicCycle.js'
import { ApiError } from '../utils/api.js'
export const PARENT_MEETING_KIND = 'PARENT_PERIOD_MEETING'
export type MeetingInvitation = { key:string; studentId:string; studentNumber:string; studentName:string; parentId:string; parentName:string }
const name=(person:any)=>person.fullName||[person.lastName,person.middleName,person.firstName].filter(Boolean).join(' ')
export async function parentMeetingRoster(userId:string){
 const teacher=await ensureTeacherProfile(userId)
 if(teacher.status!=='HOMEROOM_TEACHER'||!teacher.homeroomGrade)throw new ApiError(403,'Only an assigned main teacher may prepare a class parent-meeting report')
 const profile=await prisma.user.findUniqueOrThrow({where:{id:userId},select:{firstName:true,middleName:true,lastName:true}})
 const classParts=normalizeClassParts(teacher.homeroomGrade,teacher.homeroomSection)
 let invitations:MeetingInvitation[]=[];let source='nexus'
 if(env.KCS_ORBIT_API_URL&&env.KCS_ORBIT_API_KEY&&env.KCS_ORBIT_ORGANIZATION_ID){
  const response=await fetch(`${env.KCS_ORBIT_API_URL.replace(/\/$/,'')}/api/integration/read/shared-directory?organizationId=${encodeURIComponent(env.KCS_ORBIT_ORGANIZATION_ID)}`,{headers:{'x-api-key':env.KCS_ORBIT_API_KEY,'x-app-slug':'KCS_NEXUS'},signal:AbortSignal.timeout(12_000)})
  if(!response.ok)throw new ApiError(503,'The official family roster is temporarily unavailable. Retry before preparing this report.')
  const data=await response.json() as any
  if(!Array.isArray(data.students)||!Array.isArray(data.parents))throw new ApiError(503,'The official family roster is incomplete')
  for(const student of data.students){
   const parts=normalizeClassParts(student.className,student.section)
   if(String(student.status||'active').toLowerCase()!=='active'||!isTeacherHomeroomForStudent(teacher,{grade:parts.grade,section:parts.section}))continue
   const parents=data.parents.filter((parent:any)=>(parent.studentIds||[]).includes(student.id)||student.parentId===parent.id)
   for(const parent of parents.length?parents:[null])invitations.push({key:JSON.stringify([student.id,parent?.id||'']),studentId:student.id,studentNumber:student.studentNumber||student.displayId||student.id,studentName:name(student),parentId:parent?.id||'',parentName:parent?name(parent):''})
  }
  source='orbit'
 }else{
  const students=await prisma.studentProfile.findMany({where:{status:{equals:'active',mode:'insensitive'}},select:{id:true,studentNumber:true,grade:true,section:true,user:{select:{firstName:true,middleName:true,lastName:true}},parentLinks:{select:{parent:{select:{id:true,firstName:true,middleName:true,lastName:true}}}}}})
  for(const student of students.filter(student=>isTeacherHomeroomForStudent(teacher,student)))for(const parent of student.parentLinks.length?student.parentLinks.map(link=>link.parent):[null])invitations.push({key:JSON.stringify([student.id,parent?.id||'']),studentId:student.id,studentNumber:student.studentNumber,studentName:name(student.user),parentId:parent?.id||'',parentName:parent?name(parent):''})
 }
 invitations=[...new Map(invitations.map(row=>[row.key,row])).values()].sort((a,b)=>a.studentName.localeCompare(b.studentName,'fr')||a.parentName.localeCompare(b.parentName,'fr'))
 return{teacherId:teacher.id,teacherName:name(profile),className:[classParts.grade,classParts.section].filter(Boolean).join(' '),invitations,source}
}
export const meetingSaveSchema=z.object({id:z.string().min(1).optional(),updatedAt:z.string().datetime().optional(),clientKey:z.string().uuid(),academicYear:z.string().refine(isSequentialAcademicYear),term:z.string().refine(isKcsAcademicTerm),meetingDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value=>Number.isFinite(Date.parse(value))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value),language:z.enum(['fr','en']),recipientRole:z.enum(['ADMINISTRATOR','SUPER_ADMINISTRATOR','BOTH']),summary:z.string().trim().max(16000),followUp:z.string().trim().max(8000),entries:z.array(z.object({key:z.string().min(1).max(300),status:z.enum(['NOT_MARKED','PRESENT','ABSENT','EXCUSED']),bulletinSigned:z.boolean(),attendeeName:z.string().trim().max(160).default(''),notes:z.string().trim().max(2000).default(''),nextAction:z.string().trim().max(1500).default('')}).strict()).min(1).max(500)}).strict()
export type MeetingEvidence={kind:typeof PARENT_MEETING_KIND;version:1;clientKey:string;academicYear:string;term:string;meetingDate:string;language:'fr'|'en';className:string;teacherName:string;summary:string;followUp:string;entries:Array<MeetingInvitation&{status:'NOT_MARKED'|'PRESENT'|'ABSENT'|'EXCUSED';bulletinSigned:boolean;attendeeName:string;notes:string;nextAction:string}>}
export function meetingEvidence(payload:z.infer<typeof meetingSaveSchema>,roster:Awaited<ReturnType<typeof parentMeetingRoster>>):MeetingEvidence{
 const map=new Map(roster.invitations.map(row=>[row.key,row]));const keys=new Set(payload.entries.map(row=>row.key))
 if(keys.size!==payload.entries.length||keys.size!==map.size||payload.entries.some(row=>!map.has(row.key)))throw new ApiError(409,'The class family roster changed. Reload it before saving; no other class may be included.')
 const entries=payload.entries.map(entry=>{if(entry.bulletinSigned&&entry.status!=='PRESENT')throw new ApiError(400,'A bulletin can be marked signed only when the parent is present');return{...map.get(entry.key)!,...entry}})
 return{kind:PARENT_MEETING_KIND,version:1,clientKey:payload.clientKey,academicYear:payload.academicYear,term:payload.term,meetingDate:payload.meetingDate,language:payload.language,className:roster.className,teacherName:roster.teacherName,summary:payload.summary,followUp:payload.followUp,entries}
}
export function meetingCounts(data:MeetingEvidence){const count=(status:string)=>data.entries.filter(row=>row.status===status).length;return{learners:new Set(data.entries.map(row=>row.studentId)).size,invitations:data.entries.length,present:count('PRESENT'),absent:count('ABSENT'),excused:count('EXCUSED'),pending:count('NOT_MARKED'),signed:data.entries.filter(row=>row.bulletinSigned).length}}
export function meetingNarrative(data:MeetingEvidence){
 const fr=data.language==='fr',tr=(a:string,b:string)=>fr?a:b,c=meetingCounts(data)
 return[tr('RENCONTRE PARENTS–ÉCOLE · FIN DE PÉRIODE','PARENT–SCHOOL CONFERENCE · END OF PERIOD'),`${data.className} · ${data.academicYear} · ${data.term} · ${data.meetingDate}`,`${tr('Enseignant titulaire','Main teacher')}: ${data.teacherName}`,`${tr('Présents / Absents / Excusés / Non renseignés / Bulletins signés','Present / Absent / Excused / Unmarked / Bulletins signed')}: ${c.present} / ${c.absent} / ${c.excused} / ${c.pending} / ${c.signed}`,'',tr('BILAN ÉCRIT','WRITTEN SUMMARY'),data.summary,'',tr('SUIVI À ASSURER','FOLLOW-UP ACTIONS'),data.followUp,'',...data.entries.map(row=>`${row.studentName} · ${row.parentName||row.attendeeName||tr('Parent non lié','Unlinked parent')} · ${row.status} · ${tr('Bulletin signé','Bulletin signed')}: ${row.bulletinSigned?tr('Oui','Yes'):tr('Non','No')}\n${row.notes}\n${row.nextAction}`)].join('\n')
}
