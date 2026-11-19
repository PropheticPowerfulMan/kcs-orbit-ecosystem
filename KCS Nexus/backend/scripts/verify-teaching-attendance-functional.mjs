// Only the isolated QA database/Orbit/SMTP may be used by this integration check.
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {writeFileSync} from 'node:fs'
const require=createRequire(process.cwd()+'/package.json'),{PrismaClient}=require('@prisma/client'),jwt=require('jsonwebtoken'),db=new PrismaClient()
assert.equal(new URL(process.env.DATABASE_URL).pathname,'/nexus_entity_mail_qa')
assert.equal(new URL(process.env.KCS_ORBIT_API_URL).hostname,'suite_orbit_api')
assert.equal(process.env.KCS_ORBIT_ORGANIZATION_ID,'qa-school')
const uid='teaching-qa-'+Date.now().toString(36)
const ids={teacher:uid+'-teacher',other:uid+'-other',principal:uid+'-principal',staff:uid+'-staff',student:uid+'-student',student2:uid+'-student2',student3:uid+'-student3'}
const token=(kind)=>jwt.sign({sub:ids[kind],role:kind==='teacher'||kind==='other'?'teacher':kind.startsWith('student')?'student':'staff'},process.env.JWT_SECRET,{expiresIn:'1h'})
const rawCall=async(path,method='GET',body,kind='teacher')=>{
 const r=await fetch('http://127.0.0.1:5000/api/teaching-attendance'+path,{method,headers:{'content-type':'application/json',...(kind?{authorization:'Bearer '+token(kind)}:{}),...(kind==='principal'?{'X-Nexus-Workspace':'admin'}:{})},...(body?{body:JSON.stringify(body)}:{})})
 return{status:r.status,data:await r.json()}
}
const call=async(path,method='GET',body,kind='teacher')=>{
 if(path==='/mark'&&body&&!body.location){
  const challenge=await rawCall('/location-challenge','POST',{courseId:body.courseId,scheduleKey:body.scheduleKey,date:body.date,action:body.action},kind)
  body={...body,location:{token:challenge.data.data?.token||'a'.repeat(64),position:{latitude:-4.4,longitude:15.3,accuracy:10}}}
 }
 return rawCall(path,method,body,kind)
}
const ok=(r,status=200)=>{assert.equal(r.status,status,JSON.stringify(r.data));return r.data.data}
let checks=0;const pass=message=>{checks++;console.log('PASS '+message)}
try{
 const now=(await db.$queryRawUnsafe('SELECT clock_timestamp() AS now'))[0].now
 const {dayOfSchool,weekdayOfSchool}=await import('./dist/utils/teachingAttendance.js')
 const day=dayOfSchool(now),weekday=weekdayOfSchool(day)
 assert.ok(!['Saturday','Sunday'].includes(weekday),'Run this live clock QA on a school day')
 const clock=new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Kinshasa',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now)
 const minute=Number(clock.slice(0,2))*60+Number(clock.slice(3))
 assert.ok(minute>=0&&minute<1439,'Run QA outside the midnight boundary')
 const hm=value=>String(Math.floor(value/60)).padStart(2,'0')+':'+String(value%60).padStart(2,'0')
 const start=hm(Math.max(0,minute-5)),end=hm(Math.min(1439,minute+30))
 for(const kind of Object.keys(ids)){
  await db.user.create({data:{id:ids[kind],email:ids[kind]+'@example.invalid',firstName:kind==='teacher'?'Teacher':kind,lastName:uid,accessCode:ids[kind].toUpperCase(),passwordHash:'synthetic-qa-hash',role:kind==='teacher'||kind==='other'?'TEACHER':kind.startsWith('student')?'STUDENT':'STAFF',permissions:kind==='principal'?['nexus:principal-workspace']:[]}})
 }
 for(const kind of ['teacher','other'])await db.teacherProfile.create({data:{id:ids[kind]+'-profile',userId:ids[kind],employeeNumber:ids[kind],department:'QA',qualification:'QA',yearsOfExperience:1}})
 for(const kind of ['student','student2','student3'])await db.studentProfile.create({data:{id:ids[kind]+'-profile',userId:ids[kind],studentNumber:ids[kind],grade:kind==='student3'?'Grade 8':'Grade 7',section:'A',status:'active'}})
 const courses=[]
 for(const[suffix,teacher]of [['main','teacher'],['overlap','teacher'],['other','other'],['semester2','teacher']]){
  const id=uid+'-'+suffix
  await db.course.create({data:{id,name:'QA Teaching '+suffix,code:id,description:'Isolated teaching attendance QA',grade:'Grade 7 A',teacherId:ids[teacher]+'-profile',credits:1,schedules:{create:{id:id+'-schedule',day:weekday,startTime:start,endTime:end,room:'QA 101'}}}})
  courses.push(id)
 }
 await db.enrollment.create({data:{courseId:courses[0],studentId:ids.student+'-profile'}})
 await db.enrollment.create({data:{courseId:courses[0],studentId:ids.student2+'-profile'}})
 await db.enrollment.create({data:{courseId:courses[0],studentId:ids.student3+'-profile'}})
 await db.auditLog.create({data:{id:'nexus-course-periods:'+courses[3],action:'COURSE_TEACHING_PERIODS',targetType:'Course',targetId:courses[3],metadata:{periods:[{academicYear:'2026-2027',semesters:[2]}],revision:1}}})
 const initial={daily:await db.attendanceRecord.count(),grades:await db.grade.count(),cards:await db.reportCard.count()}
 ok(await call('/clock','GET',null,null),401)
 ok(await call('/clock','GET',null,'student'),403)
 const authority=ok(await call('/clock'))
 assert.equal(authority.schoolTimezone,'Africa/Kinshasa');assert.equal(authority.authority,'PostgreSQL clock_timestamp')
 assert.ok(Math.abs(Date.now()-Date.parse(authority.serverUtc))<3000)
 pass('Authoritative PostgreSQL/Kinshasa clock; unauthenticated and learner access rejected')

 let board=ok(await call('/mine?from='+day+'&to='+day))
 const row=board.sessions.find(row=>row.courseReference===courses[0])
 assert.ok(row);assert.equal(board.sessions.some(row=>row.courseReference===courses[2]),false)
 assert.equal(board.sessions.some(row=>row.courseReference===courses[3]),false)
 ok(await call('/principal'),403);ok(await call('/principal','GET',null,'staff'),403)
 const queryHijack=ok(await call('/mine?from='+day+'&to='+day+'&teacherUserId='+ids.other))
 assert.equal(queryHijack.sessions.some(row=>row.teacherUserId===ids.other),false)
 pass('Subject ownership, Principal-only oversight and semester separation are enforced')

 const locator={courseId:row.courseReference,scheduleKey:row.scheduleKey,date:day}
 ok(await call('/mark','POST',{...locator,action:'ENTRY',checkInAt:'2000-01-01T00:00:00Z'}),400)
 ok(await call('/mark','POST',{courseId:courses[2],scheduleKey:'course-schedule:'+courses[2]+'-schedule',date:day,action:'ENTRY'}),404)
 ok(await call('/mark','POST',{...locator,action:'EXIT'}),409)
 ok(await rawCall('/mark','POST',{...locator,action:'ENTRY'}),400)
 const policy={latitude:-4.4,longitude:15.3,radiusMeters:150,maxAccuracyMeters:50}
 ok(await call('/campus','PUT',policy),403)
 ok(await call('/campus','PUT',policy,'principal'))
 const missingToken=ok(await call('/location-challenge','POST',{...locator,action:'ENTRY'})).token
 ok(await rawCall('/mark','POST',{...locator,action:'ENTRY',location:{token:missingToken,position:{latitude:-5,longitude:15.3,accuracy:10}}}),403)
 const saved=ok(await call('/mark','POST',{...locator,action:'ENTRY',note:'Isolated QA entry'}))
 const repeated=ok(await call('/mark','POST',{...locator,action:'ENTRY'}))
 assert.equal(repeated.id,saved.id);assert.equal(repeated.checkInAt,saved.checkInAt)
 assert.ok(Math.abs(Date.now()-Date.parse(saved.checkInAt))<3000)
 assert.equal(await db.auditLog.count({where:{targetId:saved.id,action:'TEACHING_SESSION_ENTRY'}}),1)
 const overlap=board.sessions.find(row=>row.courseReference===courses[1])
 ok(await call('/mark','POST',{courseId:overlap.courseReference,scheduleKey:overlap.scheduleKey,date:day,action:'ENTRY'}),409)
 let proofBoard=ok(await call('/mine?from='+day+'&to='+day))
 const proofRow=proofBoard.sessions.find(r=>r.id===saved.id)
 assert.equal(proofRow.presenceProof.entry.status,'PENDING')
 const verify={action:'ENTRY',status:'VERIFIED',revision:0,note:'Observed independently in classroom',observedOnSite:true}
 ok(await call('/sessions/'+saved.id+'/verify-presence','POST',verify),403)
 // A teacher with Principal capability still cannot verify their own check-in.
 await db.user.update({where:{id:ids.teacher},data:{permissions:['nexus:principal-workspace']}})
 const self=await fetch('http://127.0.0.1:5000/api/teaching-attendance/sessions/'+saved.id+'/verify-presence',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+token('teacher'),'X-Nexus-Workspace':'admin'},body:JSON.stringify(verify)})
 assert.equal(self.status,403)
 await db.user.update({where:{id:ids.teacher},data:{permissions:[]}})
 ok(await call('/sessions/'+saved.id+'/verify-presence','POST',verify,'principal'))
 ok(await call('/sessions/'+saved.id+'/verify-presence','POST',verify,'principal'),409)
 proofBoard=ok(await call('/mine?from='+day+'&to='+day))
 assert.equal(proofBoard.sessions.find(r=>r.id===saved.id).presenceProof.entry.status,'VERIFIED')
 const heads=await db.auditLog.findMany({where:{targetId:saved.id}})
 assert.ok(heads.every(row=>!JSON.stringify(row.metadata).includes('latitude')))
 pass('GPS check, independent Principal confirmation, self-verification denial, stale revision protection and coordinate minimization')
 pass('Server-only immutable/idempotent check-in, exit prerequisite and overlapping-session guard')

 let register=ok(await call('/sessions/'+saved.id+'/learners'))
 assert.equal(register.roster.length,2);assert.ok(register.roster.every(row=>row.status===null))
 ok(await call('/sessions/'+saved.id+'/learners','GET',null,'student'),403)
 const outOfClass=ids.student3+'-profile'
 ok(await call('/sessions/'+saved.id+'/learners','PUT',{revision:0,entries:[{studentId:outOfClass,status:'PRESENT'}]}),403)
 const entries=[{studentId:ids.student+'-profile',status:'PRESENT'},{studentId:ids.student2+'-profile',status:'ABSENT',note:'QA explanation'}]
 const rosterSaved=ok(await call('/sessions/'+saved.id+'/learners','PUT',{revision:0,entries}))
 assert.equal(rosterSaved.revision,1)
 ok(await call('/sessions/'+saved.id+'/learners','PUT',{revision:0,entries}),409)
 register=ok(await call('/sessions/'+saved.id+'/learners'))
 assert.equal(register.summary.attendanceRate,50);assert.equal(register.summary.recorded,2)
 assert.deepEqual({daily:await db.attendanceRecord.count(),grades:await db.grade.count(),cards:await db.reportCard.count()},initial)
 pass('Real roster persists with concurrency protection; daily attendance, grades and report cards unchanged')

 const regularity=ok(await call('/regularity?courseId='+courses[0]+'&academicYear=2026-2027&term='+encodeURIComponent('Semester 1 · Quarter 2')))
 assert.equal(regularity.sessionCount,1);assert.equal(regularity.students.find(row=>row.studentId===ids.student+'-profile').attendanceRate,100)
 assert.equal(regularity.students.find(row=>row.studentId===ids.student2+'-profile').attendanceRate,0)
 const oldQuarter=ok(await call('/regularity?courseId='+courses[0]+'&academicYear=2026-2027&term='+encodeURIComponent('Semester 1 · Quarter 1')))
 assert.equal(oldQuarter.sessionCount,0)
 const principal=ok(await call('/principal?from='+day+'&to='+day,'GET',null,'principal'))
 assert.ok(principal.sessions.some(row=>row.id===saved.id&&row.checkInAt===saved.checkInAt))
 assert.equal(principal.learners.find(row=>row.studentId===ids.student+'-profile'&&row.courseId===courses[0]).attendanceRate,100)
 const reviewed=ok(await call('/review','POST',{...locator,status:'FOLLOW_UP',note:'Please discuss the recorded delay.'},'principal'))
 assert.equal(reviewed.checkInAt,saved.checkInAt);assert.equal(reviewed.reviewStatus,'FOLLOW_UP')
 board=ok(await call('/mine?from='+day+'&to='+day))
 assert.equal(board.sessions.find(row=>row.id===saved.id).reviewNote,'Please discuss the recorded delay.')
 pass('Quarter-scoped gradebook regularity and live Principal review synchronize without altering actual times')

 await db.courseSchedule.update({where:{id:courses[0]+'-schedule'},data:{startTime:hm(Math.max(0,minute-2)),endTime:hm(Math.min(1439,minute+40))}})
 board=ok(await call('/mine?from='+day+'&to='+day))
 assert.equal(board.sessions.find(row=>row.id===saved.id).expectedStartAt,saved.expectedStartAt)
 const exited=ok(await call('/mark','POST',{...locator,action:'EXIT'}))
 const exitAgain=ok(await call('/mark','POST',{...locator,action:'EXIT'}))
 assert.equal(exited.checkOutAt,exitAgain.checkOutAt)
 assert.ok(Date.parse(exited.checkOutAt)>=Date.parse(exited.checkInAt))
 pass('Schedule edits preserve historical planned hours; checkout is server-stamped and repeat-safe')

 const prior='2026-09-08'
 const history=ok(await call('/mine?from='+prior+'&to='+prior))
 assert.equal(history.sessions.filter(row=>row.courseReference.startsWith(uid)).length,0)
 const weekend=new Date(day+'T12:00:00Z');while(weekend.getUTCDay()!==6)weekend.setUTCDate(weekend.getUTCDate()+1)
 const saturday=weekend.toISOString().slice(0,10)
 const weekendBoard=ok(await call('/mine?from='+saturday+'&to='+saturday))
 assert.equal(weekendBoard.sessions.filter(row=>row.courseReference.startsWith(uid)).length,0)
 pass('No invented absence history before activation, and weekends have no scheduled attendance')

 await db.enrollment.delete({where:{courseId_studentId:{courseId:courses[0],studentId:ids.student2+'-profile'}}})
 register=ok(await call('/sessions/'+saved.id+'/learners'))
 assert.ok(register.roster.some(row=>row.studentId===ids.student2+'-profile'&&!row.eligible&&row.status==='ABSENT'))
 await db.course.delete({where:{id:courses[0]}})
 const preserved=await db.teachingSession.findUnique({where:{id:saved.id},include:{students:true}})
 assert.equal(preserved.courseId,null);assert.equal(preserved.students.length,2);assert.equal(preserved.courseName,'QA Teaching main')
 const archivedBoard=ok(await call('/principal?from='+day+'&to='+day,'GET',null,'principal'))
 assert.ok(archivedBoard.sessions.some(row=>row.id===saved.id))
 pass('Withdrawn learners and deleted courses retain their traceable session history')

 const beforeRead={grades:await db.grade.count(),cards:await db.reportCard.count()}
 for(const[path,method]of[['/report-cards/generate','POST'],['/report-cards/fake/approve','PATCH'],['/report-cards/fake/publish','PATCH'],['/report-cards/fake/editorial','PATCH'],['/transcripts/verification','POST'],['/legacy-records/import','POST'],['/transcripts/fake/visibility','PATCH'],['/report-cards/deliver','POST']]){
  const res=await fetch('http://127.0.0.1:5000/api/academic-records'+path,{method,headers:{authorization:'Bearer '+token('principal'),'X-Nexus-Workspace':'admin','content-type':'application/json'},body:'{}'})
  assert.equal(res.status,403,path);assert.ok((await res.text()).includes('PRINCIPAL_ACADEMIC_RECORDS_READ_ONLY'))
 }
 for(const path of ['/report-cards?academicYear=2026-2027','/review?academicYear=2026-2027','/student-registry']){
  const res=await fetch('http://127.0.0.1:5000/api/academic-records'+path,{headers:{authorization:'Bearer '+token('principal'),'X-Nexus-Workspace':'admin'}})
  assert.equal(res.status,200,path)
 }
 assert.deepEqual({grades:await db.grade.count(),cards:await db.reportCard.count()},beforeRead)
 pass('Principal sees the real academic interfaces; every administrative write is rejected on the server')
 const browserCourseId=uid+'-browser'
 await db.course.create({data:{id:browserCourseId,name:'QA Live Classroom '+uid,code:browserCourseId,description:'Browser QA only',grade:'Grade 7 A',teacherId:ids.teacher+'-profile',credits:1,schedules:{create:{id:browserCourseId+'-schedule',day:weekday,startTime:start,endTime:end,room:'QA 201'}},enrollments:{create:[{studentId:ids.student+'-profile'},{studentId:ids.student2+'-profile'}]}}})
 await db.courseSchedule.deleteMany({where:{courseId:{in:[courses[1],browserCourseId]}}})
 await db.academicScheduleEntry.create({data:{sourceKey:uid+'-official',academicYear:'2026-2027',semester:1,grade:'Grade 7',classGroup:'G7A',day:weekday,period:9,startTime:start,endTime:end,subject:('QA Live Classroom '+uid).replaceAll(' ',''),teacherName:'Teacher',room:'QA 201',sourceDocument:'QA imported short-name timetable'}})
 const mapped=ok(await call('/mine?from='+day+'&to='+day)).sessions.find(row=>row.courseReference===browserCourseId)
 assert.ok(mapped,'The imported short teacher name and compact subject must match unambiguously')
 assert.equal(mapped.source,'OFFICIAL_TIMETABLE');assert.equal(mapped.className,'Grade 7 A')
 const editQuery='/schedule?courseId='+browserCourseId+'&academicYear=2026-2027&semester=1'
 const editor=ok(await call(editQuery,'GET',null,'principal'))
 assert.equal(editor.entries.length,1);assert.ok(editor.classes.includes('Grade 7 A'))
 const schedulePayload={courseId:browserCourseId,academicYear:'2026-2027',semester:1,entries:editor.entries.map(({id,...row})=>row)}
 ok(await call('/schedule','PUT',schedulePayload,'teacher'),403)
 ok(await call('/schedule','PUT',schedulePayload,'principal'))
 const linked=ok(await call('/mine?from='+day+'&to='+day)).sessions.find(row=>row.courseReference===browserCourseId)
 assert.ok(linked);assert.equal(linked.courseName,'QA Live Classroom '+uid)
 const overlapping={...schedulePayload,entries:[...schedulePayload.entries,{...schedulePayload.entries[0],period:10}]}
 ok(await call('/schedule','PUT',overlapping,'principal'),409)
 const stillSaved=ok(await call(editQuery,'GET',null,'principal'))
 assert.equal(stillSaved.entries.length,1)
 pass('Real short-name official timetables map without guessing; only Principal publishes schedules and overlapping publication rolls back')
 // Reproduce the real missed morning periods with short official labels.
 const algebraId=uid+'-algebra',programmingId=uid+'-programming'
 for(const[id,name,grade]of[[algebraId,'Algebra2','Grade 11'],[programmingId,'Programming','Grade 7 A']]){
  await db.course.create({data:{id,name,code:id,description:'Timetable completeness QA',grade,teacherId:ids.teacher+'-profile',credits:1}})
 }
 for(const[courseId,label,grade,group,period,planned]of[
  [algebraId,'Math','Grade 11',null,1,'08:30'],
  [algebraId,'Math','Grade 11',null,2,'09:15'],
  [programmingId,'Programming (O)','Grade 7','G7A',5,'11:30'],
 ]){
  await db.academicScheduleEntry.create({data:{sourceKey:uid+'-complete-'+period,academicYear:'2026-2027',semester:1,grade,classGroup:group,day:weekday,period,startTime:planned,endTime:planned==='08:30'?'09:15':planned==='09:15'?'10:00':'12:15',subject:label,teacherName:uid+' Teacher',room:'QA Completeness',sourceDocument:'QA completeness'}})
 }
 const complete=ok(await call('/mine?from='+day+'&to='+day))
 assert.equal(complete.sessions.filter(row=>row.courseReference===algebraId).length,1)
 assert.equal(complete.sessions.filter(row=>row.courseReference===programmingId).length,1)
 assert.ok(complete.sessions.every((row,i,all)=>!i||row.expectedStartAt>=all[i-1].expectedStartAt))
 pass('Morning Math and elective slots are complete and chronologically ordered under the real teacher course names')

 const filtered=ok(await call('/principal?from='+day+'&to='+day+'&teacherUserId='+ids.teacher+'&className=Grade%2011&room=QA%20Completeness&search=Math','GET',null,'principal'))
 assert.equal(filtered.sessions.length,0,'Search uses the actual course name, not an unrelated official heading')
 const precise=ok(await call('/principal?from='+day+'&to='+day+'&teacherUserId='+ids.teacher+'&className=Grade%2011&room=QA%20Completeness&search=Algebra%202','GET',null,'principal'))
 assert.equal(precise.sessions.length,1);assert.equal(precise.summary.scheduled,1)
 assert.ok(precise.sessions.every(row=>row.className==='Grade 11'))
 const wrongGrade=ok(await call('/principal?from='+day+'&to='+day+'&teacherUserId='+ids.teacher+'&className=Grade%201','GET',null,'principal'))
 assert.equal(wrongGrade.sessions.length,0)
 pass('Principal class, teacher, room and multi-term filters also scope statistics without Grade 1/11 collisions')
 const nextSchool=new Date(day+'T12:00:00Z');do{nextSchool.setUTCDate(nextSchool.getUTCDate()+1)}while([0,6].includes(nextSchool.getUTCDay()))
 const nextDay=nextSchool.toISOString().slice(0,10)
 await db.courseSchedule.create({data:{courseId:algebraId,day:weekdayOfSchool(nextDay),startTime:'08:30',endTime:'09:15',room:'QA Future'}})
 const nextBoard=ok(await call('/mine?from='+nextDay+'&to='+nextDay))
 assert.ok(nextBoard.sessions.some(row=>row.courseReference===algebraId&&row.source==='MY_COURSES'))
 pass('An official slot on one weekday no longer suppresses My Courses schedules on other weekdays')

 await db.course.create({data:{id:uid+'-geometry',name:'Geometry',code:uid+'-geometry',description:'Ambiguity guard QA',grade:'Grade 11',teacherId:ids.teacher+'-profile',credits:1}})
 const ambiguous=ok(await call('/mine?from='+day+'&to='+day))
 assert.ok(ambiguous.scheduleWarnings.some(row=>row.subject==='Math'&&row.className==='Grade 11'&&row.reason==='AMBIGUOUS'))
 assert.ok(!ambiguous.sessions.some(row=>row.courseReference===algebraId))
 pass('Ambiguous official slots remain visible as course-match warnings without inventing attendance')
 writeFileSync('/tmp/teaching-browser-fixtures.json',JSON.stringify({day,ids,courses,browserCourseId,start,end,tokens:{teacher:token('teacher'),principal:token('principal')},sessionId:saved.id}))
 console.log(JSON.stringify({status:'PASS',checks,productionUntouched:true,reportCardImpact:false,gradeImpact:false}))
}catch(e){console.error(e.stack);process.exitCode=1}finally{await db.$disconnect()}
