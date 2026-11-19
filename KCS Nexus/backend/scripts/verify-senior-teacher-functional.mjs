// Refuses production: synthetic fixtures may only run in the dedicated QA database and Orbit.
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {randomUUID} from 'node:crypto'
const require=createRequire(process.cwd()+'/package.json'),{PrismaClient}=require('@prisma/client'),jwt=require('jsonwebtoken'),db=new PrismaClient()
assert.equal(new URL(process.env.DATABASE_URL).pathname,'/nexus_entity_mail_qa')
assert.equal(new URL(process.env.KCS_ORBIT_API_URL).hostname,'suite_orbit_api')
assert.equal(process.env.KCS_ORBIT_ORGANIZATION_ID,'qa-school')
const prefix='senior-qa-'+Date.now().toString(36),cap='nexus:senior-teacher-workspace',users={},profiles={}
const token=who=>jwt.sign({sub:who==='root'?'configured-superadmin':users[who],role:who==='root'?'admin':who==='parent'?'parent':'teacher'},process.env.JWT_SECRET,{expiresIn:'20m'})
const call=async(path,method='GET',body,who='senior')=>{const r=await fetch('http://127.0.0.1:5000/api/senior-teacher'+path,{method,headers:{'content-type':'application/json',...(who?{authorization:'Bearer '+token(who)}:{})},...(body?{body:JSON.stringify(body)}:{})});return{status:r.status,data:await r.json()}}
const ok=(r,status=200)=>{assert.equal(r.status,status,JSON.stringify(r.data));return r.data.data}
let checks=0;const pass=text=>{checks++;console.log('PASS '+text)}
try{
 for(const kind of ['senior','other','parent','student12','student11']){
  users[kind]=prefix+'-'+kind
  await db.user.create({data:{id:users[kind],email:users[kind]+'@example.invalid',firstName:kind,lastName:prefix,accessCode:users[kind],passwordHash:'synthetic-qa-hash',role:kind.startsWith('student')?'STUDENT':kind==='parent'?'PARENT':'TEACHER',permissions:kind==='senior'?[cap]:[]}})
 }
 for(const kind of ['senior','other'])await db.teacherProfile.create({data:{userId:users[kind],employeeNumber:users[kind],department:'QA',qualification:'QA',yearsOfExperience:1}})
 for(const kind of ['student12','student11'])profiles[kind]=(await db.studentProfile.create({data:{userId:users[kind],studentNumber:users[kind],grade:kind==='student12'?'Grade 12':'Grade 11',section:'A'}})).id
 let root=await db.user.findUnique({where:{email:process.env.SUPERADMIN_EMAIL}})
 if(!root)root=await db.user.create({data:{id:prefix+'-root',email:process.env.SUPERADMIN_EMAIL,firstName:'QA',lastName:'Root',role:'ADMIN',passwordHash:'synthetic-qa-hash'}})
 const before={grades:await db.grade.count(),attendance:await db.attendanceRecord.count(),cards:await db.reportCard.count(),identity:await db.user.findUnique({where:{id:users.senior},select:{role:true,passwordHash:true,accessCode:true}})}
 ok(await call('/board','GET',null,null),401);ok(await call('/board','GET',null,'other'),403);ok(await call('/board','GET',null,'parent'),403)
 ok(await call('/access','GET'),403)
 pass('Anonymous, ordinary teacher and parent cannot access Senior Teacher records or delegation')
 let board=ok(await call('/board')),year=board.academicYear
 assert.match(board.schoolDate,/^\d{4}-\d{2}-\d{2}$/);assert.ok(board.rows.some(r=>r.id===profiles.student12));assert.equal(board.rows.some(r=>r.id===profiles.student11),false)
 pass('Official Grade 12 cohort and server school date are correctly scoped')
 const plan={revision:0,pathway:'UNIVERSITY',intendedStudy:'Engineering',destinations:'QA country',advisorNote:'First meeting',nextMeetingDate:'2027-01-15',checklist:Object.fromEntries(['goals','shortlist','requirements','documents','statement','references','funding'].map(k=>[k,'TODO'])),applications:[]}
 plan.checklist.goals='DONE';plan.checklist.shortlist='DONE'
 const url='/plans/'+profiles.student12+'?academicYear='+year
 ok(await call('/plans/'+profiles.student11+'?academicYear='+year,'PUT',plan),404)
 let saved=ok(await call(url,'PUT',plan));assert.equal(saved.plan.revision,1);assert.equal(saved.readiness,29)
 board=ok(await call('/board?academicYear='+year));assert.equal(board.rows.find(r=>r.id===profiles.student12).plan.advisorNote,'First meeting')
 ok(await call(url,'PUT',plan),409)
 pass('Plan writes persist after a fresh authenticated read; stale revisions and other grades rejected')
 plan.revision=1
 const competing=await Promise.all([call(url,'PUT',{...plan,advisorNote:'Second meeting A'}),call(url,'PUT',{...plan,advisorNote:'Second meeting B'})])
 assert.deepEqual(competing.map(r=>r.status).sort(),[200,409]);plan.revision=2
 pass('Concurrent updates are serialized without silently overwriting an advisor')
 const application={id:randomUUID(),university:'QA University',country:'QA',program:'Engineering',intake:'2027',deadline:'2027-02-01',status:'PREPARING',url:'https://example.invalid/admissions',notes:'Confirmed details',archived:false}
 plan.applications=[application];saved=ok(await call(url,'PUT',plan));plan.revision=3
 ok(await call(url,'PUT',{...plan,applications:[]}),409)
 ok(await call(url,'PUT',{...plan,applications:[application,{...application,id:randomUUID()}]}),400)
 ok(await call(url,'PUT',{...plan,nextMeetingDate:'2026-02-31'}),400)
 ok(await call(url,'PUT',{...plan,applications:[{...application,url:'javascript:alert(1)'}]}),400)
 pass('Application history cannot be erased; duplicates, invalid dates and unsafe URLs rejected')
 plan.applications[0].archived=true;saved=ok(await call(url,'PUT',plan));plan.revision=4
 plan.applications[0].archived=false;saved=ok(await call(url,'PUT',plan));plan.revision=5
 const history=ok(await call('/plans/'+profiles.student12+'/history?academicYear='+year));assert.equal(history.length,5);assert.equal(history[0].revision,5)
 pass('Applications archive and restore; five dated revisions retain guidance notes')
 ok(await call('/plans/'+profiles.student12+'?academicYear=2025-2026','PUT',{...plan,revision:0}),409)
 const closure=await db.auditLog.create({data:{action:'ACADEMIC_PERIOD_CLOSED',targetType:'AcademicPeriodClosure',metadata:{academicYear:year,term:'Annual final'}}})
 try{ok(await call(url,'PUT',plan),409);assert.equal(ok(await call('/board')).readOnly,true)}finally{await db.auditLog.delete({where:{id:closure.id}})}
 pass('Historical years and explicitly closed school years are protected')
 const beforeOther=await db.user.findUnique({where:{id:users.other},select:{role:true,passwordHash:true,accessCode:true,permissions:true}})
 ok(await call('/access/'+users.other,'PUT',{enabled:true},'root'));ok(await call('/board','GET',null,'other'))
 const afterOther=await db.user.findUnique({where:{id:users.other},select:{role:true,passwordHash:true,accessCode:true,permissions:true}})
 assert.deepEqual({...afterOther,permissions:beforeOther.permissions},beforeOther)
 assert.ok(afterOther.permissions.includes(cap));assert.equal(afterOther.permissions.includes('nexus:principal-workspace'),false)
 ok(await call('/access/'+users.other,'PUT',{enabled:false},'root'));ok(await call('/board','GET',null,'other'),403)
 pass('Root delegates and revokes ST with existing tokens; credentials and primary role unchanged')
 await db.user.update({where:{id:users.senior},data:{permissions:[]}});ok(await call('/board'),403)
 assert.deepEqual({grades:await db.grade.count(),attendance:await db.attendanceRecord.count(),cards:await db.reportCard.count(),identity:await db.user.findUnique({where:{id:users.senior},select:{role:true,passwordHash:true,accessCode:true}})},before)
 pass('Revocation is immediate and academic records and teacher credentials remain unchanged')
 console.log(JSON.stringify({status:'PASS',checks,grade12Only:true,persistentPlans:true,revisionProtection:true,credentialIsolation:true,noAcademicMutations:true}))
}finally{
 await db.auditLog.deleteMany({where:{OR:[{targetId:{in:Object.values(users)}},{actorId:{in:Object.values(users)}}]}})
 await db.auditLog.deleteMany({where:{targetId:{in:Object.values(profiles)}}})
 await db.user.deleteMany({where:{id:{startsWith:prefix}}});await db.$disconnect()
}
