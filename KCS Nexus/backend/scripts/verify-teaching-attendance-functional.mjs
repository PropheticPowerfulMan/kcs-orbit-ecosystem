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
const call=async(path,method='GET',body,kind='teacher')=>{
 const r=await fetch('http://127.0.0.1:5000/api/teaching-attendance'+path,{method,headers:{'content-type':'application/json',...(kind?{authorization:'Bearer '+token(kind)}:{}),...(kind==='principal'?{'X-Nexus-Workspace':'admin'}:{})},...(body?{body:JSON.stringify(body)}:{})})
 return{status:r.status,data:await r.json()}
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
 const saved=ok(await call('/mark','POST',{...locator,action:'ENTRY',note:'Isolated QA entry'}))
 const repeated=ok(await call('/mark','POST',{...locator,action:'ENTRY'}))
 assert.equal(repeated.id,saved.id);assert.equal(repeated.checkInAt,saved.checkInAt)
 assert.ok(Math.abs(Date.now()-Date.parse(saved.checkInAt))<3000)
 assert.equal(await db.auditLog.count({where:{targetId:saved.id,action:'TEACHING_SESSION_ENTRY'}}),1)
 const overlap=board.sessions.find(row=>row.courseReference===courses[1])
 ok(await call('/mark','POST',{courseId:overlap.courseReference,scheduleKey:overlap.scheduleKey,date:day,action:'ENTRY'}),409)
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
 writeFileSync('/tmp/teaching-browser-fixtures.json',JSON.stringify({day,ids,courses,browserCourseId,start,end,tokens:{teacher:token('teacher'),principal:token('principal')},sessionId:saved.id}))
 console.log(JSON.stringify({status:'PASS',checks,productionUntouched:true,reportCardImpact:false,gradeImpact:false}))
}catch(e){console.error(e.stack);process.exitCode=1}finally{await db.$disconnect()}
