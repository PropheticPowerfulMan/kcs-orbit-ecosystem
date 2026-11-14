import {test,after} from 'node:test'
import assert from 'node:assert/strict'
import {prisma} from '../config/prisma.js'
import {parentMeetingRoster,meetingEvidence,meetingSaveSchema,meetingCounts} from '../services/parentMeeting.service.js'
import {parentMeetingsRouter} from './parent-meetings.routes.js'
import {parentMeetingDocument,parentMeetingFingerprint} from '../utils/parentMeetingDocument.js'
const p=prisma as any,original={teacher:p.teacherProfile.findUnique,user:p.user.findUniqueOrThrow,students:p.studentProfile.findMany,transaction:p.$transaction,report:p.teacherActivityReport.findUnique,actor:p.user.findUnique}
after(()=>{p.teacherProfile.findUnique=original.teacher;p.user.findUniqueOrThrow=original.user;p.studentProfile.findMany=original.students;p.$transaction=original.transaction;p.teacherActivityReport.findUnique=original.report;p.user.findUnique=original.actor})
let teacher:any={id:'t1',status:'HOMEROOM_TEACHER',homeroomGrade:'Grade 9',homeroomSection:'A'}
p.teacherProfile.findUnique=async()=>teacher;p.user.findUniqueOrThrow=async()=>({firstName:'QA',lastName:'Teacher'});p.user.findUnique=async()=>({id:'real-admin'})
const parent=(id:string)=>({parent:{id,firstName:id,lastName:'Parent'}})
p.studentProfile.findMany=async()=>[{id:'s1',studentNumber:'QA-1',grade:'Grade 9',section:'A',user:{firstName:'Ada',lastName:'Synthetic'},parentLinks:[parent('p1'),parent('p2')]},{id:'s2',studentNumber:'QA-2',grade:'Grade 9',section:'B',user:{firstName:'Ben',lastName:'Synthetic'},parentLinks:[parent('p3')]}]
const payload=(invitations:any[])=>({clientKey:'a2b9c389-d902-4f8e-945e-297d18db017a',academicYear:'2026-2027',term:'Semester 1 · Quarter 1',meetingDate:'2026-11-14',language:'en' as const,recipientRole:'BOTH' as const,summary:'Parents discussed academic progress and the action plan for next quarter.',followUp:'Follow-up meeting next week.',entries:invitations.map(row=>({key:row.key,status:'PRESENT' as const,bulletinSigned:true,attendeeName:'',notes:'Progress reviewed.',nextAction:'Regular homework.'}))})
const handler=(path:string,method='post'):any=>{const layer:any=parentMeetingsRouter.stack.find((layer:any)=>layer.route?.path===path&&layer.route.methods[method]);assert.ok(layer);return layer.route.stack.at(-1).handle}
const call=(path:string,body:any={},params:any={},role='teacher',query:any={})=>new Promise<any>((resolve,reject)=>handler(path,path.endsWith('/document')||path==='/verify'?'get':'post')({user:{sub:role==='admin'?'configured-superadmin':'u1',role},body,params,query},{setHeader(){},status(){return this},json(value:any){resolve(value.data);return this}},reject))
test('only the main teacher sees their exact section and all linked parents',async()=>{
 const roster=await parentMeetingRoster('u1');assert.equal(roster.invitations.length,2);assert.ok(roster.invitations.every(row=>row.studentId==='s1'))
 teacher={...teacher,status:'ASSISTANT_TEACHER'};await assert.rejects(parentMeetingRoster('u1'),(e:any)=>e.statusCode===403);teacher={...teacher,status:'HOMEROOM_TEACHER'}
 const parsed=meetingSaveSchema.parse(payload(roster.invitations)),evidence=meetingEvidence(parsed,roster);assert.deepEqual(meetingCounts(evidence),{learners:1,invitations:2,present:2,absent:0,excused:0,pending:0,signed:2})
 assert.throws(()=>meetingSaveSchema.parse({...parsed,meetingDate:'2026-02-31'}))
 assert.throws(()=>meetingEvidence({...parsed,entries:[...parsed.entries,{...parsed.entries[0],key:'foreign-student'}]},roster))
 assert.throws(()=>meetingEvidence({...parsed,entries:[{...parsed.entries[0],status:'ABSENT'},parsed.entries[1]]},roster))
})
test('draft save, retry, optimistic version, submission, leadership review, QR and PDF source work as one real workflow',async()=>{
 const roster=await parentMeetingRoster('u1'),body=payload(roster.invitations),reports=new Map<string,any>(),audits:any[]=[],notices:any[]=[];let clock=0
 const find=(args:any)=>{const report=reports.get(args.where.id)||[...reports.values()].find(r=>r.evidence.clientKey===args.where.evidence?.equals);if(args.where.teacherId&&report?.teacherId!==args.where.teacherId)return null;return report||null}
 const model={findFirst:async(args:any)=>find(args),findUniqueOrThrow:async(args:any)=>{const result=find(args);assert.ok(result);return result},create:async({data}:any)=>{const report={...data,id:'meeting-1',status:'DRAFT',submittedAt:null,updatedAt:new Date(1700000000000+(++clock)*1000)};reports.set(report.id,report);return report},updateMany:async({where,data}:any)=>{const current=reports.get(where.id);if(!current||current.updatedAt.getTime()!==new Date(where.updatedAt).getTime()||!where.status.in.includes(current.status))return{count:0};reports.set(where.id,{...current,...data,updatedAt:new Date(1700000000000+(++clock)*1000)});return{count:1}}}
 p.$transaction=async(fn:any)=>fn({$queryRaw:async()=>[],teacherActivityReport:model,user:{findMany:async()=>[{id:'admin-1',role:'ADMIN'},{id:'principal-1',role:'STAFF'}]},teacherProfile:{findUniqueOrThrow:async()=>({userId:'u1'})},notification:{createMany:async({data}:any)=>{notices.push(...data)},create:async({data}:any)=>{notices.push(data)}},auditLog:{create:async({data}:any)=>{audits.push(data)}}})
 p.teacherActivityReport.findUnique=async({where}:any)=>reports.get(where.id)
 let saved=await call('/save',body);assert.equal(saved.status,'DRAFT');assert.equal((await call('/save',body)).id,saved.id);assert.equal(reports.size,1)
 await assert.rejects(call('/save',{...body,id:saved.id,updatedAt:'2020-01-01T00:00:00.000Z'}),(e:any)=>e.statusCode===409)
 saved=await call('/save',{...body,id:saved.id,updatedAt:saved.updatedAt.toISOString(),entries:body.entries.map((row,i)=>i?{...row,status:'NOT_MARKED',bulletinSigned:false}:row)})
 await assert.rejects(call('/:id/submit',{updatedAt:saved.updatedAt.toISOString()},{id:saved.id}),(e:any)=>e.statusCode===400)
 saved=await call('/save',{...body,id:saved.id,updatedAt:saved.updatedAt.toISOString()})
 const submitted=await call('/:id/submit',{updatedAt:saved.updatedAt.toISOString()},{id:saved.id});assert.equal(submitted.status,'SUBMITTED');assert.equal(notices.length,2);assert.ok(audits.some(row=>row.action==='PARENT_MEETING_SUBMITTED'))
 await call('/:id/submit',{updatedAt:saved.updatedAt.toISOString()},{id:saved.id});assert.equal(notices.length,2)
 await assert.rejects(call('/save',{...body,id:saved.id,updatedAt:submitted.updatedAt.toISOString()}),(e:any)=>e.statusCode===409)
 const verified=await call('/verify',{}, {}, 'teacher',{document:submitted.id,fingerprint:parentMeetingFingerprint(submitted)});assert.equal(verified.valid,true);assert.equal(verified.studentName,undefined)
 const doc=await parentMeetingDocument(submitted,'fr');assert.match(doc.html,/Rencontre parents–école/);assert.match(doc.html,/KCS verification QR/);assert.doesNotMatch(doc.html,/<script/)
 const reviewed=await call('/:id/review',{status:'RETURNED',updatedAt:submitted.updatedAt.toISOString(),reviewerNote:'Please add the agreed next steps.'},{id:submitted.id},'admin');assert.equal(reviewed.status,'RETURNED');assert.equal(audits.at(-1).actorId,'real-admin');assert.equal(notices.at(-1).userId,'u1')
})
