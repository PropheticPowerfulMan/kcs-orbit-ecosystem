import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../config/prisma.js'
import { authenticate, requireRoles, type AuthenticatedRequest } from '../middleware/auth.js'
import { ApiError, asyncHandler, success } from '../utils/api.js'
import { getRouteParam } from '../utils/request.js'
import { getParentAcademicClearance } from './finance.routes.js'

const submissionSchema=z.object({
 courseId:z.string().min(1),academicYear:z.string().regex(/^\d{4}-\d{4}$/),term:z.string().min(2).max(80),
 results:z.array(z.object({studentId:z.string().min(1),percentage:z.number().min(0).max(100),comment:z.string().max(1000).optional()})).min(1)
})
const cycleSchema=z.object({academicYear:z.string().regex(/^\d{4}-\d{4}$/),term:z.string().min(2).max(80)})
const letter=(value:number)=>value>=97?'A+':value>=93?'A':value>=90?'A-':value>=87?'B+':value>=83?'B':value>=80?'B-':value>=77?'C+':value>=73?'C':value>=70?'C-':value>=67?'D+':value>=63?'D':value>=60?'D-':'F'
const periodKey=(year:string,term:string,status:'SUBMITTED'|'APPROVED')=>`${year}::${term}::${status}`
const parsePeriod=(period:string)=>{const [academicYear,term,status]=period.split('::');return{academicYear,term,status}}

const attendanceWindow=(year:string,term:string)=>{const key=term.toLowerCase();if(year==='2026-2027'){if(key.includes('trimester 1'))return{gte:new Date('2026-09-07T00:00:00Z'),lte:new Date('2026-12-18T23:59:59Z')};if(key.includes('trimester 2'))return{gte:new Date('2027-01-05T00:00:00Z'),lte:new Date('2027-03-19T23:59:59Z')};if(key.includes('trimester 3'))return{gte:new Date('2027-04-05T00:00:00Z'),lte:new Date('2027-06-11T23:59:59Z')};if(key.includes('semester 1'))return{gte:new Date('2026-09-07T00:00:00Z'),lte:new Date('2027-01-29T23:59:59Z')};if(key.includes('semester 2'))return{gte:new Date('2027-02-01T00:00:00Z'),lte:new Date('2027-06-11T23:59:59Z')}}const [start,end]=year.split('-');return{gte:new Date(`${start}-08-01T00:00:00Z`),lte:new Date(`${end}-07-31T23:59:59Z`)}}
const summarizeAttendance=(records:Array<{status:string}>)=>{const count=(status:string)=>records.filter(item=>item.status===status).length;const attended=records.filter(item=>['PRESENT','LATE','EXCUSED'].includes(item.status)).length;return{total:records.length,present:count('PRESENT'),absent:count('ABSENT'),late:count('LATE'),excused:count('EXCUSED'),sick:count('SICK'),suspended:count('SUSPENDED'),attendanceRate:records.length?Number((attended*100/records.length).toFixed(1)):null}}
export const academicRecordsRouter=Router()
academicRecordsRouter.use(authenticate)

academicRecordsRouter.post('/final-grades/submit',requireRoles('teacher'),asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const payload=submissionSchema.parse(req.body)
 const course=await prisma.course.findUnique({where:{id:payload.courseId},include:{teacher:true,enrollments:{select:{studentId:true}}}})
 if(!course)throw new ApiError(404,'Course not found')
 if(course.teacher.userId!==req.user!.sub)throw new ApiError(403,'Only the assigned teacher may submit these grades')
 const enrolled=new Set(course.enrollments.map(item=>item.studentId))
 if(payload.results.some(item=>!enrolled.has(item.studentId)))throw new ApiError(400,'A submitted student is not enrolled in this course')
 if(new Set(payload.results.map(item=>item.studentId)).size!==payload.results.length)throw new ApiError(400,'Duplicate student in submission')
 const lockedCards=await prisma.reportCard.count({where:{studentId:{in:payload.results.map(item=>item.studentId)},term:`${payload.academicYear} · ${payload.term}`,publicationStatus:{in:['APPROVED','EMAILED','POSTED_TO_PORTAL']}}})
 if(lockedCards)throw new ApiError(409,'This reporting session is already approved or published and can no longer be changed')
 const period=periodKey(payload.academicYear,payload.term,'SUBMITTED')
 const saved=await prisma.$transaction(async tx=>{
  await tx.grade.deleteMany({where:{courseId:course.id,assignmentId:null,period}})
  const created=[]
  for(const item of payload.results)created.push(await tx.grade.create({data:{courseId:course.id,studentId:item.studentId,assignmentId:null,score:item.percentage,maxScore:100,percentage:item.percentage,letterGrade:letter(item.percentage),period}}))
  await tx.auditLog.create({data:{actorId:req.user!.sub,action:'FINAL_GRADES_SUBMITTED',targetType:'Course',targetId:course.id,metadata:{academicYear:payload.academicYear,term:payload.term,count:created.length,results:payload.results}}})
  return created
 })
 return success(res,{course:{id:course.id,name:course.name,code:course.code},academicYear:payload.academicYear,term:payload.term,count:saved.length},'Final grades submitted for administrative review',201)
}))

academicRecordsRouter.get('/final-grades/me',requireRoles('teacher'),asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const teacher=await prisma.teacherProfile.findUnique({where:{userId:req.user!.sub},select:{courses:{select:{id:true,enrollments:{select:{studentId:true}}}}}})
 if(!teacher)return success(res,{submissions:[],reportCards:[]},'Teacher profile synchronization pending')
 const courseIds=teacher.courses.map(course=>course.id)
 const studentIds=[...new Set(teacher.courses.flatMap(course=>course.enrollments.map(item=>item.studentId)))]
 const [grades,cards]=await Promise.all([
  courseIds.length?prisma.grade.findMany({where:{courseId:{in:courseIds},assignmentId:null,period:{contains:'::SUBMITTED'}},select:{id:true,studentId:true,courseId:true,percentage:true,letterGrade:true,period:true,createdAt:true},orderBy:{createdAt:'desc'}}):[],
  studentIds.length?prisma.reportCard.findMany({where:{studentId:{in:studentIds}},select:{id:true,studentId:true,term:true,average:true,principalStatus:true,publicationStatus:true,approvedAt:true,portalPostedAt:true,updatedAt:true},orderBy:{updatedAt:'desc'}}):[],
 ])
 return success(res,{submissions:grades.map(item=>({...item,cycle:parsePeriod(item.period)})),reportCards:cards},'Teacher report-card workflow loaded')
}))

academicRecordsRouter.get('/review',requireRoles('admin','staff'),asyncHandler(async(req,res)=>{
 const academicYear=String(req.query.academicYear||''),term=String(req.query.term||''),status=String(req.query.status||'SUBMITTED')
 const where:any={assignmentId:null,period:academicYear?{startsWith:`${academicYear}::`,contains:`::${status}`}:{contains:`::${status}`}}
 const grades=await prisma.grade.findMany({
  where,
  include:{student:{include:{user:true}},course:{include:{teacher:{include:{user:true}}}}},
  orderBy:[{period:'desc'},{courseId:'asc'}],
 })
 const filtered=term?grades.filter(item=>parsePeriod(item.period).term===term):grades
 return success(res,filtered.map(item=>({...item,cycle:parsePeriod(item.period)})))
}))

academicRecordsRouter.post('/report-cards/generate',requireRoles('admin','staff'),asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const payload=cycleSchema.parse(req.body),submitted=periodKey(payload.academicYear,payload.term,'SUBMITTED')
 const grades=await prisma.grade.findMany({where:{assignmentId:null,period:submitted},include:{course:true,student:{include:{user:true}}}})
 if(!grades.length)throw new ApiError(400,'No submitted final grades exist for this cycle')
 const grouped=new Map<string,typeof grades>();for(const grade of grades)grouped.set(grade.studentId,[...(grouped.get(grade.studentId)||[]),grade])
 const window=attendanceWindow(payload.academicYear,payload.term)
 const attendanceRecords=await prisma.attendanceRecord.findMany({where:{studentId:{in:[...grouped.keys()]},date:window},select:{studentId:true,status:true}})
 const cards=await prisma.$transaction(async tx=>{
  const created=[]
  for(const [studentId,items] of grouped){const average=items.reduce((sum,item)=>sum+item.percentage,0)/items.length;const attendanceSummary=summarizeAttendance(attendanceRecords.filter(item=>item.studentId===studentId));created.push(await tx.reportCard.upsert({where:{studentId_term:{studentId,term:`${payload.academicYear} · ${payload.term}`}},create:{studentId,term:`${payload.academicYear} · ${payload.term}`,average,attendanceSummary,principalStatus:'READY_FOR_REVIEW',publicationStatus:'READY_FOR_REVIEW'},update:{average,attendanceSummary,principalStatus:'READY_FOR_REVIEW',publicationStatus:'READY_FOR_REVIEW'}}))}
  await tx.auditLog.create({data:{actorId:req.user!.sub,action:'REPORT_CARDS_GENERATED',targetType:'ReportCardCycle',metadata:{...payload,count:created.length,sourceGradeCount:grades.length}}})
  return created
 })
 return success(res,{count:cards.length,cards},'Report cards generated from submitted grades')
}))

academicRecordsRouter.get('/report-cards',requireRoles('admin','staff'),asyncHandler(async(req,res)=>{
 const cards=await prisma.reportCard.findMany({where:req.query.status?{publicationStatus:String(req.query.status) as any}:{},include:{student:{include:{user:true}},approvedBy:true},orderBy:{updatedAt:'desc'}})
 return success(res,cards)
}))

academicRecordsRouter.patch('/report-cards/:id/approve',requireRoles('admin'),asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const id=getRouteParam(req.params.id)
 const card=await prisma.$transaction(async tx=>{
  const current=await tx.reportCard.findUnique({where:{id}});if(!current)throw new ApiError(404,'Report card not found')
  const parts=current.term.split(' · ');const academicYear=parts[0],term=parts.slice(1).join(' · ')
  const submitted=periodKey(academicYear,term,'SUBMITTED'),approved=periodKey(academicYear,term,'APPROVED')
  const source=await tx.grade.findMany({where:{studentId:current.studentId,assignmentId:null,period:submitted}})
  if(!source.length)throw new ApiError(409,'The report card has no submitted source grades')
  await tx.grade.deleteMany({where:{studentId:current.studentId,assignmentId:null,period:approved}})
  for(const grade of source)await tx.grade.create({data:{studentId:grade.studentId,courseId:grade.courseId,assignmentId:null,score:grade.score,maxScore:grade.maxScore,percentage:grade.percentage,letterGrade:grade.letterGrade,period:approved}})
  const updated=await tx.reportCard.update({where:{id},data:{principalStatus:'APPROVED',publicationStatus:'APPROVED',approvedById:req.user!.sub,approvedAt:new Date()}})
  await tx.auditLog.create({data:{actorId:req.user!.sub,action:'REPORT_CARD_APPROVED',targetType:'ReportCard',targetId:id,metadata:{previousStatus:current.publicationStatus,academicYear,term,sourceGrades:source.map(x=>({courseId:x.courseId,percentage:x.percentage,letterGrade:x.letterGrade}))}}})
  return updated
 })
 return success(res,card,'Report card approved and official grades frozen')
}))

academicRecordsRouter.patch('/report-cards/:id/publish',requireRoles('admin','staff'),asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const id=getRouteParam(req.params.id)
 const card=await prisma.$transaction(async tx=>{
  const current=await tx.reportCard.findUnique({where:{id}});if(!current)throw new ApiError(404,'Report card not found')
  if(current.publicationStatus!=='APPROVED')throw new ApiError(409,'Only an approved report card may be published')
  const updated=await tx.reportCard.update({where:{id},data:{publicationStatus:'POSTED_TO_PORTAL',portalPostedAt:new Date()}})
  await tx.auditLog.create({data:{actorId:req.user!.sub,action:'REPORT_CARD_PUBLISHED',targetType:'ReportCard',targetId:id,metadata:{term:current.term,studentId:current.studentId}}})
  return updated
 })
 return success(res,card,'Approved report card published to the portal')
}))

academicRecordsRouter.get('/transcripts/:studentId',requireRoles('admin','staff','teacher','student','parent'),asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const studentId=getRouteParam(req.params.studentId)
 if(req.user!.role==='student'){const own=await prisma.studentProfile.findUnique({where:{userId:req.user!.sub},select:{id:true}});if(own?.id!==studentId)throw new ApiError(403,'Transcript access denied')}
 if(req.user!.role==='parent'){const link=await prisma.parentStudentLink.findUnique({where:{parentId_studentId:{parentId:req.user!.sub,studentId}}});if(!link)throw new ApiError(403,'Transcript access denied');const clearance=await getParentAcademicClearance(req.user!.sub);if(!clearance.allowed)throw new ApiError(402,clearance.reason)}
 const student=await prisma.studentProfile.findUnique({where:{id:studentId},include:{user:true}});if(!student)throw new ApiError(404,'Student not found')
 const grades=await prisma.grade.findMany({where:{studentId,assignmentId:null,period:{endsWith:'::APPROVED'}},include:{course:true},orderBy:{period:'asc'}})
 const rows=grades.map(item=>({...item,cycle:parsePeriod(item.period),credits:item.course.credits,qualityPoints:(item.percentage>=90?4:item.percentage>=80?3:item.percentage>=70?2:item.percentage>=60?1:0)*item.course.credits}))
 const credits=rows.reduce((sum,item)=>sum+item.credits,0),points=rows.reduce((sum,item)=>sum+item.qualityPoints,0)
 return success(res,{student:{id:student.id,studentNumber:student.studentNumber,name:[student.user.lastName,student.user.firstName].filter(Boolean).join(' '),grade:student.grade},rows,summary:{credits,cumulativeGpa:credits?Number((points/credits).toFixed(2)):null,officialRecords:rows.length},generatedAt:new Date().toISOString(),dataPolicy:rows.length?'APPROVED_RECORDS_ONLY':'NO_OFFICIAL_DATA'})
}))
