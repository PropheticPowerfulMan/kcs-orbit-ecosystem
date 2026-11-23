import {Router} from 'express'
import {randomUUID} from 'node:crypto'
import {Prisma} from '@prisma/client'
import {z} from 'zod'
import {prisma} from '../config/prisma.js'
import {authenticate,type AuthenticatedRequest} from '../middleware/auth.js'
import {ApiError,asyncHandler,success} from '../utils/api.js'
import {earlyYearsAssignment,earlyYearsDomains,earlyYearsStages,observationDateAllowed,developmentalSnapshot} from '../utils/earlyYearsPolicy.js'
import {academicPeriodAccess,protectGradebookEntry} from '../services/academicPeriodAccess.service.js'
import {quarterTerms,academicPeriodIsReadOnly,futureGradebookPeriods} from '../utils/academicPeriodPolicy.js'
import {attendanceWindowForCalendar} from '../services/reportAttendance.service.js'

export const earlyYearsRouter=Router()
earlyYearsRouter.use(authenticate)
const year=z.string().regex(/^\d{4}-\d{4}$/),term=z.string().refine(v=>quarterTerms.includes(v)),date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const name=(u:any)=>[u.lastName,u.middleName,u.firstName].filter(Boolean).join(' ')
async function actor(userId:string,db:any=prisma){
 const u=await db.user.findUnique({where:{id:userId},select:{id:true,firstName:true,middleName:true,lastName:true,teacherProfile:{select:{status:true,homeroomGrade:true,homeroomSection:true}}}})
 const assignment=earlyYearsAssignment(u?.teacherProfile)
 return u&&assignment?{...assignment,id:u.id,name:name(u)}:null
}
async function scoped(req:AuthenticatedRequest){
 const a=await actor(req.user!.sub);if(!a)throw new ApiError(403,'EARLY_YEARS_CLASS_ACCESS_REQUIRED')
 const access=await academicPeriodAccess(prisma,a.id),academicYear=year.parse(req.query.academicYear||access.activeAcademicYear),selectedTerm=term.parse(req.query.term||access.activeEntryTerm||quarterTerms[3])
 const calendar=access.calendars?.find(c=>c.name===academicYear);if(!calendar)throw new ApiError(503,'EARLY_YEARS_PUBLISHED_CALENDAR_REQUIRED')
 const readOnly=academicPeriodIsReadOnly(access,academicYear,selectedTerm)||futureGradebookPeriods(access,academicYear).includes(selectedTerm)
 return{actor:a,access,academicYear,term:selectedTerm,calendar,readOnly}
}
const whereFor=(s:any,type:string)=>({targetType:type,AND:[{metadata:{path:['academicYear'],equals:s.academicYear}},{metadata:{path:['term'],equals:s.term}},{metadata:{path:['grade'],equals:s.actor.grade}},{metadata:{path:['section'],equals:s.actor.section}}]})
const rosterWhere=(a:any)=>({grade:{equals:a.grade,mode:'insensitive' as const},...(a.section?{section:{equals:a.section,mode:'insensitive' as const}}:{}),status:{equals:'active',mode:'insensitive' as const},archive:null})
earlyYearsRouter.get('/context',asyncHandler(async(req:AuthenticatedRequest,res)=>{
 res.set('Cache-Control','private, no-store');const a=await actor(req.user!.sub)
 if(!a)return success(res,{enabled:false})
 const access=await academicPeriodAccess(prisma,a.id)
 return success(res,{enabled:true,assignment:a,academicYear:access.activeAcademicYear,term:access.activeEntryTerm,years:access.calendars?.map(c=>c.name)||[],terms:quarterTerms,domains:earlyYearsDomains})
}))
earlyYearsRouter.get('/board',asyncHandler(async(req:AuthenticatedRequest,res)=>{
 res.set('Cache-Control','private, no-store');const s=await scoped(req),classWhere=whereFor(s,'EarlyYearsObservation')
 const [roster,history]=await Promise.all([
  prisma.studentProfile.findMany({where:rosterWhere(s.actor),select:{id:true,studentNumber:true,grade:true,section:true,user:{select:{firstName:true,middleName:true,lastName:true}}},orderBy:{user:{lastName:'asc'}}}),
  prisma.auditLog.findMany({where:classWhere as any,select:{id:true,metadata:true},orderBy:{createdAt:'desc'}})
 ])
 const students=roster.map(c=>({id:c.id,studentNumber:c.studentNumber,grade:c.grade,section:c.section,name:name(c.user),historical:false}))
 for(const record of history){const value=record.metadata as any;if(value?.studentId&&!students.some(c=>c.id===value.studentId))students.push({id:value.studentId,studentNumber:value.studentNumber||'',grade:s.actor.grade,section:s.actor.section,name:value.studentName||'Archived learner',historical:true})}
 const selectedId=typeof req.query.studentId==='string'?req.query.studentId:students[0]?.id
 if(selectedId&&!students.some(c=>c.id===selectedId))throw new ApiError(403,'EARLY_YEARS_LEARNER_ACCESS_REQUIRED')
 const records=history.filter(r=>(r.metadata as any)?.studentId===selectedId),count=history.length
 const [plan,team,clock]=await Promise.all([
  prisma.auditLog.findUnique({where:{id:'early-years-plan:'+s.academicYear+':'+s.term+':'+s.actor.grade+':'+s.actor.section},select:{metadata:true}}),
  prisma.teacherProfile.findMany({where:{homeroomGrade:{equals:s.actor.grade,mode:'insensitive'},...(s.actor.section?{homeroomSection:s.actor.section}:{OR:[{homeroomSection:null},{homeroomSection:''}]}),status:{in:['HOMEROOM_TEACHER','ASSISTANT_TEACHER']}},select:{status:true,user:{select:{firstName:true,middleName:true,lastName:true}}}}),
  prisma.$queryRaw<Array<{now:Date}>>`SELECT clock_timestamp() as now`
 ])
 const observations=records.map(r=>({id:r.id,...r.metadata as any})).sort((a,b)=>b.date.localeCompare(a.date)||b.updatedAt.localeCompare(a.updatedAt)),offset=z.coerce.number().int().min(0).max(100000).parse(req.query.offset||0)
 const bounds=attendanceWindowForCalendar(s.academicYear,s.term,s.calendar),schoolDate=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Kinshasa'}).format(clock[0].now)
 return success(res,{schoolDate,periodStart:bounds.gte.toISOString().slice(0,10),periodEnd:bounds.lte.toISOString().slice(0,10),assignment:s.actor,academicYear:s.academicYear,term:s.term,readOnly:s.readOnly||Boolean(students.find(c=>c.id===selectedId)?.historical),years:s.access.calendars?.map(c=>c.name),terms:quarterTerms,domains:earlyYearsDomains,students,selectedId: selectedId||null,observations:observations.slice(offset,offset+40),total:observations.length,nextOffset:offset+40<observations.length?offset+40:null,development:developmentalSnapshot(observations),classObservationCount:count,plan:plan?.metadata||{revision:0,theme:'',play:'',smallGroup:'',story:'',movement:'',inclusion:'',families:''},team:team.map(t=>({name:name(t.user),role:t.status==='HOMEROOM_TEACHER'?'MAIN':'ASSISTANT'}))})
}))
const observation=z.object({revision:z.number().int().min(0).default(0),academicYear:year,term,studentId:z.string().min(1).max(150),date,domain:z.string().refine(v=>earlyYearsDomains.some(d=>d.id===v)),stage:z.enum(earlyYearsStages),context:z.enum(['PLAY','SMALL_GROUP','ROUTINE','OUTDOORS','FAMILY']),evidence:z.string().trim().min(10).max(3000),nextStep:z.string().trim().max(1500).default('')}).strict()
async function saveObservation(req:AuthenticatedRequest,res:any){
 const d=observation.parse(req.body);req.query.academicYear=d.academicYear;req.query.term=d.term;const s=await scoped(req)
 const key=req.params.observationId?z.string().regex(/^early-years-observation:[a-f0-9-]{36}$/).parse(req.params.observationId):'early-years-observation:'+randomUUID()
 const saved=await prisma.$transaction(async tx=>{
  await protectGradebookEntry(tx,d.academicYear,d.term,s.actor.id)
  const fresh=await actor(s.actor.id,tx);if(!fresh||fresh.grade!==s.actor.grade||fresh.section!==s.actor.section)throw new ApiError(409,'EARLY_YEARS_ASSIGNMENT_CHANGED')
  const student=await tx.studentProfile.findFirst({where:{id:d.studentId,...rosterWhere(fresh)},select:{id:true,studentNumber:true,user:{select:{firstName:true,middleName:true,lastName:true}}}});if(!student)throw new ApiError(403,'EARLY_YEARS_LEARNER_ACCESS_REQUIRED')
  const bounds=attendanceWindowForCalendar(d.academicYear,d.term,s.calendar),clock=await tx.$queryRaw<Array<{now:Date}>>`SELECT clock_timestamp() as now`,today=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Kinshasa'}).format(clock[0].now)
  if(!observationDateAllowed(d.date,bounds.gte.toISOString(),bounds.lte.toISOString(),today))throw new ApiError(400,'EARLY_YEARS_DATE_OUTSIDE_PERIOD')
  await tx.$queryRaw(Prisma.sql`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${key}))`)
  const old=await tx.auditLog.findUnique({where:{id:key}}),previous=old?.metadata as any
  if(req.params.observationId&&!old)throw new ApiError(404,'EARLY_YEARS_OBSERVATION_NOT_FOUND')
  if(old&&(old.targetType!=='EarlyYearsObservation'||previous.studentId!==d.studentId||previous.grade!==fresh.grade||previous.section!==fresh.section||previous.academicYear!==d.academicYear||previous.term!==d.term))throw new ApiError(403,'EARLY_YEARS_LEARNER_ACCESS_REQUIRED')
  if(old&&fresh.role!=='MAIN'&&previous.createdBy!==fresh.id)throw new ApiError(403,'EARLY_YEARS_AUTHOR_OR_MAIN_REQUIRED')
  if((previous?.revision||0)!==d.revision)throw new ApiError(409,'EARLY_YEARS_REVISION_CONFLICT')
  const value={...d,revision:d.revision+1,grade:fresh.grade,section:fresh.section,studentName:name(student.user),studentNumber:student.studentNumber,createdBy:previous?.createdBy||fresh.id,author:previous?.author||fresh.name,updatedBy:fresh.name,updatedAt:clock[0].now.toISOString()}
  await tx.auditLog.upsert({where:{id:key},create:{id:key,actorId:fresh.id,action:'EARLY_YEARS_OBSERVATION_HEAD',targetType:'EarlyYearsObservation',targetId:d.studentId,metadata:value},update:{metadata:value}})
  await tx.auditLog.create({data:{actorId:fresh.id,action:'EARLY_YEARS_OBSERVATION_SAVED',targetType:'EarlyYearsObservationHistory',targetId:key,metadata:value}})
  return{id:key,...value}
 },{timeout:15000})
 return success(res,saved,'EARLY_YEARS_OBSERVATION_SAVED')
}
earlyYearsRouter.post('/observations',asyncHandler(saveObservation))
earlyYearsRouter.patch('/observations/:observationId',asyncHandler(saveObservation))
const text=z.string().trim().max(2000)
earlyYearsRouter.put('/plan',asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const d=z.object({academicYear:year,term,revision:z.number().int().min(0),theme:text,play:text,smallGroup:text,story:text,movement:text,inclusion:text,families:text}).strict().parse(req.body)
 req.query.academicYear=d.academicYear;req.query.term=d.term;const s=await scoped(req),key='early-years-plan:'+d.academicYear+':'+d.term+':'+s.actor.grade+':'+s.actor.section
 const saved=await prisma.$transaction(async tx=>{
  await protectGradebookEntry(tx,d.academicYear,d.term,s.actor.id);const fresh=await actor(s.actor.id,tx);if(!fresh||fresh.grade!==s.actor.grade||fresh.section!==s.actor.section)throw new ApiError(409,'EARLY_YEARS_ASSIGNMENT_CHANGED')
  await tx.$queryRaw(Prisma.sql`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${key}))`)
  const old=await tx.auditLog.findUnique({where:{id:key}}),previous=old?.metadata as any;if((previous?.revision||0)!==d.revision)throw new ApiError(409,'EARLY_YEARS_REVISION_CONFLICT')
  const value={...d,grade:fresh.grade,section:fresh.section,revision:d.revision+1,updatedBy:fresh.name,updatedAt:new Date().toISOString()}
  await tx.auditLog.upsert({where:{id:key},create:{id:key,actorId:fresh.id,action:'EARLY_YEARS_PLAN_HEAD',targetType:'EarlyYearsPlan',targetId:key,metadata:value},update:{metadata:value}})
  await tx.auditLog.create({data:{actorId:fresh.id,action:'EARLY_YEARS_PLAN_SAVED',targetType:'EarlyYearsPlanHistory',targetId:key,metadata:value}});return value
 },{timeout:15000});return success(res,saved,'EARLY_YEARS_PLAN_SAVED')
}))
