import {Prisma} from '@prisma/client'
import {historicalRecord,historicalData,historicalStorageRows} from '../utils/historicalRecord.js'
import {attendanceWindowForCalendar,type Calendar} from './reportAttendance.service.js'
import {ApiError} from '../utils/api.js'
type Tx=Prisma.TransactionClient
const identitySelect={id:true,firstName:true,middleName:true,lastName:true,email:true,phone:true,role:true,orbitUserId:true,staffFunction:true,createdAt:true,studentProfile:{select:{id:true,studentNumber:true,grade:true,section:true,status:true}},teacherProfile:{select:{id:true,employeeNumber:true,department:true}},staffProfile:{select:{employeeNumber:true,function:true}},parentLinks:{select:{studentId:true,relation:true}}} as const
export async function captureAcademicHistory(tx:Tx,input:{academicYear:string;term:string;calendar:Calendar;actorId?:string|null;reason:string;now?:Date}){
 const now=input.now??new Date();if(new Date(input.calendar.startDate)>now)throw new ApiError(409,'A future school year cannot be archived as a completed period')
 const yearWindow=attendanceWindowForCalendar(input.academicYear,'Annual final',input.calendar),window=attendanceWindowForCalendar(input.academicYear,input.term,input.calendar)
 const [users,grades,reports,attendance,workspaces,courses,submissions,invoices,staffAttendance]=await Promise.all([
 tx.user.findMany({select:identitySelect,orderBy:{id:'asc'}}),
 tx.grade.findMany({where:{period:{startsWith:input.academicYear+'::'}},include:{course:{select:{id:true,name:true,code:true,grade:true,credits:true,teacherId:true}}},orderBy:{id:'asc'}}),
 tx.reportCard.findMany({where:{term:{startsWith:input.academicYear+' · '}},orderBy:{id:'asc'}}),
 tx.attendanceRecord.findMany({where:{date:window},orderBy:[{date:'asc'},{id:'asc'}]}),
 tx.teacherWorkspace.findMany({select:{userId:true,state:true,revision:true,updatedAt:true}}),
 tx.course.findMany({select:{id:true,name:true,code:true,grade:true,credits:true,teacherId:true,enrollments:{select:{studentId:true,createdAt:true}},schedules:true},orderBy:{id:'asc'}}),
 tx.assignmentSubmission.findMany({where:{assignment:{dueDate:yearWindow}},include:{assignment:{select:{id:true,title:true,courseId:true,dueDate:true,type:true,maxScore:true}},answers:true},orderBy:{id:'asc'}}),
 tx.feeInvoice.findMany({where:{OR:[{createdAt:yearWindow},{dueDate:yearWindow}]},include:{payments:true,charges:true},orderBy:{id:'asc'}}),
 tx.staffAttendanceRecord.findMany({where:{date:window},orderBy:[{date:'asc'},{id:'asc'}]}),
 ])
 const group=<T,>(rows:T[],key:(row:T)=>string)=>{const map=new Map<string,T[]>();for(const row of rows){const id=key(row);const list=map.get(id)??[];list.push(row);map.set(id,list)}return map}
 const gradesByStudent=group(grades,g=>g.studentId),gradesByTeacher=group(grades,g=>g.course.teacherId),reportsByStudent=group(reports,r=>r.studentId),attendanceByStudent=group(attendance,r=>r.studentId),staffByOrbit=group(staffAttendance,r=>r.staffOrbitId),submissionsByStudent=group(submissions,r=>r.studentId),invoicesByStudent=group(invoices,r=>r.studentId),coursesByTeacher=group(courses,c=>c.teacherId),workspaceByUser=new Map(workspaces.map(w=>[w.userId,w]));
 const coursesByStudent=new Map<string,typeof courses>();for(const course of courses)for(const enrollment of course.enrollments){const list=coursesByStudent.get(enrollment.studentId)??[];list.push(course);coursesByStudent.set(enrollment.studentId,list)}
 const rows=users.map(user=>{
  const studentId=user.studentProfile?.id,teacherId=user.teacherProfile?.id,workspace=workspaceByUser.get(user.id),state=(workspace?.state??{})as Record<string,any>
  const gradebookYearState:Record<string,any>=Object.fromEntries(['advancedGradebookByCycle','gradebookCategoryWeightsByCycle','gradebookClosedCategoryWeightsByCycle'].map(field=>[field,Object.fromEntries(Object.entries(state[field]??{}).filter(([key])=>key.includes('::'+input.academicYear)))]))
  if(input.academicYear==='2026-2027'&&!Object.keys(gradebookYearState.advancedGradebookByCycle).length)gradebookYearState.legacyInitialGradebook=state.advancedGradebookByCourse??{}
  const data={publishedCalendar:input.calendar,referencePeriod:{academicYear:input.academicYear,term:input.term,from:window.gte.toISOString(),to:window.lte.toISOString()},identityCapturedAt:now.toISOString().slice(0,10),identity:user,grades:studentId?(gradesByStudent.get(studentId)??[]):teacherId?(gradesByTeacher.get(teacherId)??[]):[],reportCards:reportsByStudent.get(studentId??'')??[],attendance:attendanceByStudent.get(studentId??'')??[],staffAttendance:staffByOrbit.get(user.orbitUserId??'')??[],courses:teacherId?(coursesByTeacher.get(teacherId)??[]):studentId?(coursesByStudent.get(studentId)??[]):[],assignmentSubmissions:submissionsByStudent.get(studentId??'')??[],schoolInvoices:invoicesByStudent.get(studentId??'')??[],...(teacherId?{gradebookYearState,workspaceRevision:workspace?.revision??null}:{}),coverage:{academicValues:'Recorded values; no historical grades are invented or recalculated',identity:'Identity as captured on the stated capture date',externalApplications:'Full ecosystem backup is required for the other application databases and uploaded files'}}
  return historicalRecord({academicYear:input.academicYear,term:input.term,entityType:user.role,entityId:studentId||user.id,label:[user.lastName,user.middleName,user.firstName].filter(Boolean).join(' '),grade:user.studentProfile?.grade,section:user.studentProfile?.section,data,reason:input.reason,capturedAt:now,actorId:input.actorId})
 })
 const stored=rows.map(historicalStorageRows)
 let saved=0;for(let i=0;i<stored.length;i+=30){const chunk=stored.slice(i,i+30);const result=await tx.auditLog.createMany({data:chunk.map(row=>({...row.header,metadata:row.header.metadata as Prisma.InputJsonValue})),skipDuplicates:true});saved+=result.count;await tx.auditLog.createMany({data:chunk.map(row=>({...row.payload,metadata:row.payload.metadata as Prisma.InputJsonValue})),skipDuplicates:true})}

 return {capturedEntities:rows.length,newVersions:saved,academicYear:input.academicYear,term:input.term}
}
/** Preserve course dependencies before their FK cascade can remove them. */
export async function preserveCourseHistory(tx:Tx,courseId:string,actorId:string|null){
 const course=await tx.course.findUnique({where:{id:courseId},include:{teacher:{select:{userId:true,user:{select:{firstName:true,middleName:true,lastName:true}}}},grades:true,schedules:true,enrollments:true,assignments:{include:{questions:true,submissions:{include:{answers:true}}}}}})
 if(!course)return
 const workspace=await tx.teacherWorkspace.findUnique({where:{userId:course.teacher.userId},select:{state:true,revision:true}}),state=(workspace?.state??{})as Record<string,any>
 const workspaceCourse=Object.fromEntries(['advancedGradebookByCycle','advancedGradebookByCourse','gradebookColumnsByCourse','gradebookCategoryWeightsByCycle'].map(field=>[field,Object.fromEntries(Object.entries(state[field]??{}).filter(([key])=>key===courseId||key.startsWith(courseId+'::')))]))
 const years=new Set(course.grades.map(g=>/^\d{4}-\d{4}/.exec(g.period)?.[0]).filter(Boolean)as string[]);for(const key of Object.keys(state.advancedGradebookByCycle??{}).filter(key=>key.startsWith(courseId+'::'))){const year=/\d{4}-\d{4}$/.exec(key)?.[0];if(year)years.add(year)}
 if(!years.size)years.add('UNSCOPED')
 for(const academicYear of years){const row=historicalRecord({academicYear,term:'COURSE_ARCHIVE',entityType:'COURSE',entityId:courseId,label:course.name,grade:course.grade,data:historicalData({course,workspaceCourse,workspaceRevision:workspace?.revision}),reason:'BEFORE_COURSE_DELETION',capturedAt:new Date(),actorId});for(const stored of Object.values(historicalStorageRows(row)))await tx.auditLog.upsert({where:{id:stored.id},create:{...stored,metadata:stored.metadata as Prisma.InputJsonValue},update:{}})}
}
