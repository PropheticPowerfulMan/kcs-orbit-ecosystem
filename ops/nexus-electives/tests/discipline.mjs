import assert from'node:assert/strict'
import{readFileSync,writeFileSync}from'node:fs'
import{createHash}from'node:crypto'
import jwt from'jsonwebtoken'
import{PrismaClient}from'@prisma/client'
const db=new PrismaClient();assert.match(process.env.DATABASE_URL,/learning_stage_20261127/,'Synthetic QA database only')
const f=JSON.parse(readFileSync('/qa/fixtures.private.json')),checks=[];const check=(name,fn)=>{fn();checks.push({name,passed:true});console.log('PASS '+name)}
const request=async(key,path)=>{const r=await fetch('http://localhost:5000/api/classroom-passes'+path,{headers:{Authorization:'Bearer '+f.users[key].token}});return{status:r.status,data:(await r.json()).data}}
try{
 const director=await db.user.upsert({where:{email:'discipline@elective.staging.invalid'},create:{email:'discipline@elective.staging.invalid',accessCode:'QA-DISCIPLINE-20261128',role:'STAFF',firstName:'Synthetic',lastName:'Discipline',permissions:['nexus:discipline-director-workspace']},update:{permissions:['nexus:discipline-director-workspace']}});f.users.discipline={id:director.id,token:jwt.sign({sub:director.id,role:'staff'},process.env.JWT_SECRET,{expiresIn:'8h'})};
 await db.classroomPassSession.deleteMany({where:{academicYear:'2096-2097',studentName:'Synthetic report learner'}})
 const now=Date.now();await db.classroomPassSession.createMany({data:Array.from({length:65},(_,i)=>({teacherReference:f.users.teacher.id,teacherId:f.users.teacher.id,studentReference:f.studentId,studentId:f.studentId,badgeType:['BATHROOM','HALLPASS','KITCHEN'][i%3],academicYear:'2096-2097',period:'Semester 1 · Quarter 1',teacherName:'Synthetic report teacher',studentName:'Synthetic report learner',className:'Grade 9 A',issuedAt:new Date(now-(i+1)*3600000),expectedReturnAt:new Date(now-(i+1)*3600000+600000),returnedAt:new Date(now-(i+1)*3600000+180000),issueNote:'Synthetic recorded note',returnNote:'Synthetic confirmed return'}))})
 let x=await request('discipline','?academicYear=2096-2097&grade=Grade%209');check('Discipline Director supervises every matching teacher movement',()=>{assert.equal(x.status,200);assert.equal(x.data.canMonitor,true);assert.equal(x.data.total,65);assert.equal(x.data.rows.length,50)})
 x=await request('discipline','/report?academicYear=2096-2097&grade=Grade%209');check('Discipline PDF snapshot includes all pages rather than only first 50 rows',()=>{assert.equal(x.status,200);assert.equal(x.data.rows.length,65);assert.ok(x.data.rows.every(r=>r.studentName==='Synthetic report learner'));assert.ok(x.data.reference.startsWith('KCS-PASS-'))})
 const snapshot=x.data;check('Report fingerprint matches exact server snapshot',()=>assert.equal(snapshot.fingerprint,createHash('sha256').update(JSON.stringify({generatedAt:snapshot.generatedAt,scope:snapshot.scope,rows:snapshot.rows})).digest('hex')))
 check('Report register is chronological and retains exact recorded notes',()=>{assert.ok(snapshot.rows.every((r,i)=>!i||r.issuedAt>=snapshot.rows[i-1].issuedAt));assert.equal(snapshot.rows[0].returnNote,'Synthetic confirmed return')})
 x=await request('discipline','/report?academicYear=2096-2097&grade=Grade%201');check('Grade 1 filter cannot accidentally select Grade 9 or Grade 10',()=>assert.equal(x.data.rows.length,0))
 x=await request('discipline','?academicYear=2096-2097&active=false');check('Returned-pass filter uses persisted confirmed returns',()=>assert.equal(x.data.total,65))
 x=await request('discipline','?academicYear=2096-2097&overdue=true');check('Currently-overdue filter excludes completed returns',()=>assert.equal(x.data.total,0))
 x=await request('other-teacher','/report?academicYear=2096-2097');check('Teacher cannot export another teacher private pass history',()=>{assert.equal(x.status,200);assert.equal(x.data.rows.length,0)})
 x=await request('parent','/report');check('Parent cannot export schoolwide movement reports',()=>assert.equal(x.status,403))
 x=await request('learner','/report');check('Learner cannot export staff movement reports',()=>assert.equal(x.status,403))
 writeFileSync('/qa/fixtures.private.json',JSON.stringify(f),{mode:0o600});writeFileSync('/qa/discipline-results.json',JSON.stringify(checks,null,2));console.log('DISCIPLINE_PASS='+checks.length)
}finally{await db.$disconnect()}
