import assert from 'node:assert/strict'
import {readFileSync,writeFileSync}from'node:fs'
import jwt from'jsonwebtoken'
import {PrismaClient}from'@prisma/client'
const db=new PrismaClient();assert.match(process.env.DATABASE_URL,/learning_stage_20261127/,'Run only against the isolated synthetic database')
const f=JSON.parse(readFileSync('/qa/fixtures.private.json'));for(const u of Object.values(f.users)){const v=jwt.decode(u.token);u.token=jwt.sign({sub:v.sub,role:v.role},process.env.JWT_SECRET,{expiresIn:'8h'})}
const results=[],check=(name,fn)=>{fn();results.push({name,passed:true});console.log('PASS '+name)}
const request=async(key,path,method='GET',body)=>{const response=await fetch('http://localhost:5000/api'+path,{method,headers:{Authorization:'Bearer '+f.users[key].token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,body:await response.json()}}
try{
 let x=await request('learner','/messages');check('student cannot read a direct parent message even with a stale STUDENT role label',()=>assert.ok(!x.body.data.some(m=>m.id===f.parentOnlyProbe)))
 const legacy=await db.internalMessage.create({data:{senderId:f.users.teacher.id,targetRole:'PARENT',subject:'Synthetic parent broadcast',body:'Parents only'}})
 const own=await db.internalMessage.create({data:{senderId:f.users.teacher.id,recipientId:f.users.learner.id,subject:'Synthetic own student message',body:'Learner only'}})
 x=await request('learner','/messages');check('parent broadcast excluded and own message retained',()=>{assert.ok(!x.body.data.some(m=>m.id===legacy.id));assert.ok(x.body.data.some(m=>m.id===own.id))})
 const other=await db.internalMessage.create({data:{senderId:f.users.teacher.id,recipientId:f.users['other-learner'].id,targetRole:'STUDENT',subject:'Synthetic classmate private message',body:'Not for this learner'}})
 x=await request('learner','/messages?box=inbox');check('another student direct message is private',()=>assert.ok(!x.body.data.some(m=>m.id===other.id)))
 x=await request('learner','/messages/'+f.parentOnlyProbe+'/read','PATCH',{});check('student cannot mark parent correspondence as read',()=>assert.equal(x.status,404))
 x=await request('learner','/messages/'+f.parentOnlyProbe+'/attachment');check('student cannot download parent correspondence attachments',()=>assert.equal(x.status,403))
 await db.user.update({where:{id:f.users.teacher.id},data:{email:'teacher@elective.staging.test'}})
 x=await request('learner','/messages/contacts');check('student directory stays school-staff only and exposes email availability without addresses',()=>{assert.ok(x.body.data.every(c=>!['PARENT','STUDENT'].includes(c.role)));assert.ok(!x.body.data.some(c=>Object.hasOwn(c,'email')));assert.equal(x.body.data.find(c=>c.id===f.users.teacher.id).emailAvailable,true)})
 const before=await db.correspondenceLog.count({where:{senderId:f.users.learner.id}})
 const base={recipientId:f.users.teacher.id,subject:'Synthetic student communication',body:'Exact student content, with no injected greeting.',language:'fr',requestId:'student-channel-test-'+Date.now()}
 x=await request('learner','/messages','POST',{...base,deliveryMode:'NEXUS_ONLY'});check('Nexus-only learner message persists without external mail',()=>{assert.equal(x.status,201,JSON.stringify(x.body));assert.equal(x.body.data.body,base.body);assert.equal(x.body.data.emailQueued,0)})
 assert.equal(await db.correspondenceLog.count({where:{senderId:f.users.learner.id}}),before)
 const sentId=x.body.data.id;x=await request('teacher','/messages?box=inbox');check('chosen teacher receives the Nexus message',()=>assert.ok(x.body.data.some(m=>m.id===sentId)))
 x=await request('parent','/messages');check('student message does not expand to linked parents',()=>assert.ok(!x.body.data.some(m=>m.id===sentId)))
 const emailRequest={...base,requestId:base.requestId+'-email',deliveryMode:'NEXUS_EMAIL'}
 x=await request('learner','/messages','POST',emailRequest);check('explicit Nexus plus email queues exactly one registered recipient',()=>{assert.equal(x.status,201,JSON.stringify(x.body));assert.equal(x.body.data.emailQueued,1)})
 const emailMessageId=x.body.data.id;x=await request('learner','/messages','POST',emailRequest);check('retry returns the same saved message without duplicate delivery',()=>assert.equal(x.body.data.id,emailMessageId))
 assert.equal(await db.correspondenceLog.count({where:{senderId:f.users.learner.id}}),before+1)
 x=await request('learner','/messages','POST',{...emailRequest,body:'Changed content'});check('reusing an idempotency key for another message is rejected',()=>assert.equal(x.status,409))
 x=await request('learner','/messages','POST',{...base,recipientId:f.users.parent.id});check('a learner cannot send to an unauthorized parent recipient',()=>assert.equal(x.status,403))
 x=await request('learner','/messages','POST',{...base,recipientId:f.users['other-teacher'].id,deliveryMode:'NEXUS_EMAIL'});check('missing official external email blocks external delivery clearly',()=>assert.equal(x.status,409))
 // All following campaigns belong exclusively to the synthetic database.
 const cycleBody={title:'Synthetic elective workflow',academicYear:'2097-2098',semester:1,eligibleGrades:['Grade 9'],opensAt:null,closesAt:null}
 await db.electiveCycle.deleteMany({where:{academicYear:{in:['2097-2098','2098-2099','2099-2100']}}})
 x=await request('root','/electives','POST',cycleBody);assert.equal(x.status,201,JSON.stringify(x.body));const cycleId=x.body.data.id
 x=await request('root','/electives/'+cycleId+'/status','PATCH',{status:'OPEN'});check('opening fails before six valid courses exist',()=>assert.equal(x.status,409))
 const courseIds=[]
 for(let i=0;i<7;i++){x=await request('root','/electives/'+cycleId+'/offerings','POST',{code:'QA-'+i,name:'Synthetic pathway '+(i+1),description:'A synthetic elective course with clear learning objectives and prerequisites.',capacity:24,eligibleGrades:['Grade 9'],teacherUserId:f.users.teacher.id});assert.equal(x.status,201,JSON.stringify(x.body));courseIds.push(x.body.data.id)}
 x=await request('root','/electives/offerings/'+courseIds[0],'PATCH',{capacity:25});check('course capacity cannot exceed 24',()=>assert.equal(x.status,400))
 x=await request('teacher','/electives/offerings/'+courseIds[0],'PATCH',{name:'Unauthorized overwrite'});check('teacher cannot edit the administrative catalogue',()=>assert.equal(x.status,403))
 x=await request('root','/electives/offerings/'+courseIds[0],'PATCH',{name:'Synthetic modern pathway',description:'Updated learning objectives saved by the administrator.',capacity:24});check('real course edit persists in draft catalogue',()=>assert.equal(x.body.data.name,'Synthetic modern pathway'))
 x=await request('root','/electives/'+cycleId+'/status','PATCH',{status:'OPEN'});assert.equal(x.status,200,JSON.stringify(x.body))
 x=await request('learner','/electives/'+cycleId+'/choices','PUT',{offeringIds:Array(6).fill(courseIds[0])});check('duplicate ranked courses rejected',()=>assert.equal(x.status,400))
 x=await request('learner','/electives/'+cycleId+'/choices','PUT',{offeringIds:courseIds.slice(0,6)});assert.equal(x.status,200,JSON.stringify(x.body))
 x=await request('learner','/electives/'+cycleId+'/choices','PUT',{offeringIds:courseIds.slice(0,6).reverse()});assert.equal(x.status,200)
 const stored=await db.electiveChoice.findMany({where:{cycleId,studentProfileId:f.studentId},orderBy:{rank:'asc'}});check('resubmission replaces exactly six ranked preferences on the server',()=>assert.deepEqual(stored.map(c=>c.offeringId),courseIds.slice(0,6).reverse()))
 x=await request('root','/electives/'+cycleId+'/status','PATCH',{status:'CLOSED'});assert.equal(x.status,200)
 x=await request('learner','/electives/'+cycleId+'/choices','PUT',{offeringIds:courseIds.slice(0,6)});check('closed campaign is read-only for students',()=>assert.equal(x.status,409))
 x=await request('root','/electives/'+cycleId+'/allocate','POST',{});assert.equal(x.status,200)
 x=await request('root','/electives/'+cycleId+'/publish','POST',{});check('publication blocks missing eligible learner choices',()=>assert.equal(x.status,409))
 x=await request('root','/electives/'+cycleId+'/status','PATCH',{status:'OPEN'});assert.equal(x.status,200);assert.equal(await db.electiveAllocation.count({where:{cycleId}}),0)
 const learners=await db.studentProfile.findMany({where:{status:{equals:'active',mode:'insensitive'},grade:'Grade 9'}})
 for(const learner of learners){f.users['enrol-'+learner.id]={id:learner.userId,token:jwt.sign({sub:learner.userId,role:'student'},process.env.JWT_SECRET,{expiresIn:'8h'})};x=await request('enrol-'+learner.id,'/electives/'+cycleId+'/choices','PUT',{offeringIds:courseIds.slice(0,6)});assert.equal(x.status,200,JSON.stringify(x.body))}
 await request('root','/electives/'+cycleId+'/status','PATCH',{status:'CLOSED'});await request('root','/electives/'+cycleId+'/allocate','POST',{})
 x=await request('learner','/electives');check('provisional allocations are not exposed to students',()=>assert.equal(x.body.data.allocations.filter(a=>a.cycleId===cycleId).length,0))
 x=await request('root','/electives/'+cycleId+'/publish','POST',{});check('complete allocations publish successfully',()=>assert.equal(x.status,200,JSON.stringify(x.body)))
 x=await request('learner','/electives');check('learner sees only own six published allocations',()=>{const rows=x.body.data.allocations.filter(a=>a.cycleId===cycleId);assert.equal(rows.length,6);assert.ok(rows.every(a=>a.studentProfileId===f.studentId))})
 x=await request('teacher','/electives');check('assigned teacher sees published own-course rosters',()=>assert.ok(x.body.data.teacherAssignments.some(a=>a.cycleId===cycleId)))
 x=await request('other-teacher','/electives');check('another teacher does not inherit the roster',()=>assert.equal(x.body.data.teacherAssignments.filter(a=>a.cycleId===cycleId).length,0))
 x=await request('root','/electives/'+cycleId+'/status','PATCH',{status:'OPEN'});check('published cycle remains protected',()=>assert.equal(x.status,409))
 const make=async(academicYear,status)=>{let r=await request('root','/electives','POST',{...cycleBody,academicYear,title:'Synthetic '+status+' elective cycle'});assert.equal(r.status,201);const id=r.body.data.id;for(let i=0;i<7;i++)await request('root','/electives/'+id+'/offerings','POST',{code:'EXP-'+i,name:'Synthetic elective '+(i+1),description:'An engaging course with practical activities, clear objectives and a creative final project.',capacity:24,eligibleGrades:['Grade 9'],teacherUserId:f.users.teacher.id});if(status==='open')await request('root','/electives/'+id+'/status','PATCH',{status:'OPEN'});return id}
 f.electiveOpen=await make('2098-2099','open');f.electiveDraft=await make('2099-2100','draft');f.electivePublished=cycleId
 writeFileSync('/qa/fixtures.private.json',JSON.stringify(f),{mode:0o600});writeFileSync('/qa/workflow-results.json',JSON.stringify(results,null,2));console.log('WORKFLOW_PASS='+results.length)
}finally{await db.$disconnect()}
