import assert from'node:assert/strict'
import{readFileSync,writeFileSync}from'node:fs'
import{PrismaClient}from'@prisma/client'
const db=new PrismaClient();assert.match(process.env.DATABASE_URL,/learning_stage_20261127/,'Isolated synthetic QA only');const f=JSON.parse(readFileSync('/qa/fixtures.private.json')),checks=[];const check=(name,fn)=>{fn();checks.push({name,pass:true});console.log('PASS '+name)}
const request=async(path,method='GET',body)=>{const response=await fetch('http://localhost:5000/api/classroom-passes'+path,{method,headers:{Authorization:'Bearer '+f.users.teacher.token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return{status:response.status,data:(await response.json()).data}}
try{
 const teacher=await db.teacherProfile.findUniqueOrThrow({where:{userId:f.users.teacher.id}}),otherStudent=await db.studentProfile.findUniqueOrThrow({where:{userId:f.users['other-learner'].id}})
 const course=await db.course.upsert({where:{code:'QA-PASS-TARGETED'},create:{name:'Synthetic targeted course',code:'QA-PASS-TARGETED',description:'Synthetic course selection regression',grade:'Grade 9',teacherId:teacher.id,credits:1},update:{teacherId:teacher.id}})
 await db.enrollment.deleteMany({where:{courseId:course.id}});await db.enrollment.create({data:{courseId:course.id,studentId:otherStudent.id}})
 let x=await request('/bootstrap');assert.equal(x.status,200);const courses=new Set(x.data.courses.map(c=>c.id));check('Every exposed membership belongs to a course taught by this teacher',()=>assert.ok(x.data.students.every(s=>s.courseIds.every(id=>courses.has(id)))))
 check('Targeted course includes its enrolled learner',()=>assert.ok(x.data.students.find(s=>s.id===otherStudent.id).courseIds.includes(course.id)))
 check('A homeroom or another-course learner is not falsely enrolled in this course',()=>assert.ok(!x.data.students.find(s=>s.id===f.studentId).courseIds.includes(course.id)))
 const memberships=await db.enrollment.findMany({where:{course:{teacherId:teacher.id}}});check('Bootstrap membership ids match actual current enrollment rows',()=>{for(const student of x.data.students)assert.deepEqual([...student.courseIds].sort(),memberships.filter(e=>e.studentId===student.id).map(e=>e.courseId).sort())})
 x=await request('','POST',{studentId:f.studentId,courseId:course.id,badgeType:'BATHROOM',expectedMinutes:10});check('Server refuses a learner not enrolled in the selected teaching course',()=>assert.equal(x.status,403))
 await db.classroomPassSession.deleteMany({where:{studentReference:otherStudent.id,returnedAt:null}})
 x=await request('','POST',{studentId:otherStudent.id,courseId:course.id,badgeType:'BATHROOM',expectedMinutes:10});check('Enrolled learner can receive a pass tied to the selected real course',()=>{assert.equal(x.status,201);assert.equal(x.data.courseReference,course.id);assert.equal(x.data.courseName,course.name)})
 const pass=x.data;x=await request('/'+pass.id+'/return','POST',{revision:pass.revision,note:'Synthetic pass returned'});check('The selected-course pass retains normal timed return behavior',()=>{assert.equal(x.status,200);assert.ok(x.data.returnedAt)})
 f.targetedCourse=course.id;f.targetedStudent=otherStudent.id;writeFileSync('/qa/fixtures.private.json',JSON.stringify(f),{mode:0o600});writeFileSync('/evidence/course-scope-results.json',JSON.stringify(checks,null,2));console.log('COURSE_SCOPE_PASS='+checks.length)
}finally{await db.$disconnect()}
