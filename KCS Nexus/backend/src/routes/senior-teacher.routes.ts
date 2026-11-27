import {updateRegistryEntity} from './registry.routes.js'
import {Router} from 'express'
import {Prisma} from '@prisma/client'
import {z} from 'zod'
import {prisma} from '../config/prisma.js'
import {authenticate,requireSuperAdmin,type AuthenticatedRequest} from '../middleware/auth.js'
import {asyncHandler,success,ApiError} from '../utils/api.js'
import {databaseActorId} from '../utils/databaseActor.js'
import {SENIOR_WORKSPACE_PERMISSION,hasSeniorWorkspaceAccess} from '../utils/staffWorkspace.js'
import {inactiveStudentStatus} from '../services/accountAccess.service.js'
import {academicCalendars} from '../services/reportAttendance.service.js'
import {lockAcademicYears} from '../services/academicPeriodAccess.service.js'
import {SENIOR_CHECKLIST,SENIOR_STATUSES,isFinalYear,readiness,duplicateApplication} from '../utils/seniorTeacherPolicy.js'

export const seniorTeacherRouter=Router()
seniorTeacherRouter.use(authenticate)
const id=z.string().min(1).max(150),yearSchema=z.string().regex(/^\d{4}-\d{4}$/).refine(v=>Number(v.slice(5))===Number(v.slice(0,4))+1)
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{const d=new Date(v+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===v})
const checklist=z.object({goals:z.enum(['TODO','IN_PROGRESS','DONE','NOT_APPLICABLE']),shortlist:z.enum(['TODO','IN_PROGRESS','DONE','NOT_APPLICABLE']),requirements:z.enum(['TODO','IN_PROGRESS','DONE','NOT_APPLICABLE']),documents:z.enum(['TODO','IN_PROGRESS','DONE','NOT_APPLICABLE']),statement:z.enum(['TODO','IN_PROGRESS','DONE','NOT_APPLICABLE']),references:z.enum(['TODO','IN_PROGRESS','DONE','NOT_APPLICABLE']),funding:z.enum(['TODO','IN_PROGRESS','DONE','NOT_APPLICABLE'])}).strict()
const application=z.object({id:z.string().uuid(),university:z.string().trim().min(1).max(200),country:z.string().trim().max(100),program:z.string().trim().min(1).max(200),intake:z.string().trim().min(1).max(80),deadline:date.or(z.literal('')),status:z.enum(SENIOR_STATUSES),url:z.string().max(1000).refine(v=>!v||(/^https:\/\//i.test(v)&&(()=>{try{return new URL(v).protocol==='https:'}catch{return false}})())),notes:z.string().trim().max(2000),archived:z.boolean()}).strict()
const planSchema=z.object({revision:z.number().int().min(0),pathway:z.enum(['UNDECIDED','UNIVERSITY','COLLEGE','VOCATIONAL','GAP_YEAR']),intendedStudy:z.string().trim().max(300),destinations:z.string().trim().max(300),advisorNote:z.string().trim().max(5000),nextMeetingDate:date.or(z.literal('')),checklist,applications:z.array(application).max(40)}).strict().superRefine((v,ctx)=>{
 if(new Set(v.applications.map(a=>a.id)).size!==v.applications.length)ctx.addIssue({code:'custom',message:'SENIOR_DUPLICATE_ID'})
 if(duplicateApplication(v.applications))ctx.addIssue({code:'custom',message:'SENIOR_DUPLICATE_APPLICATION'})
})
const emptyPlan=()=>({revision:0,pathway:'UNDECIDED',intendedStudy:'',destinations:'',advisorNote:'',nextMeetingDate:'',checklist:Object.fromEntries(SENIOR_CHECKLIST.map(k=>[k,'TODO'])),applications:[]})
const name=(user:{lastName:string;middleName:string|null;firstName:string})=>[user.lastName,user.middleName,user.firstName].filter(Boolean).join(' ')
const headId=(year:string,studentId:string)=>'senior-plan:'+year+':'+studentId
const fields={id:true,studentNumber:true,grade:true,section:true,status:true,archive:{select:{id:true}},user:{select:{lastName:true,middleName:true,firstName:true,accountBlockedAt:true}}} as const
async function permitted(req:AuthenticatedRequest,db:Prisma.TransactionClient|typeof prisma=prisma){
 if(req.user!.sub==='configured-superadmin')return
 const user=await db.user.findUnique({where:{id:req.user!.sub},select:{role:true,permissions:true,accountBlockedAt:true}})
 if(!user||user.accountBlockedAt||!hasSeniorWorkspaceAccess(user))throw new ApiError(403,'SENIOR_ACCESS_REQUIRED')
}
// This capability is intentionally limited to learner email; it grants no general registry editing.
seniorTeacherRouter.get('/learner-emails',asyncHandler(async(req:AuthenticatedRequest,res)=>{
 await permitted(req)
 const rows=await prisma.studentProfile.findMany({where:{status:{equals:'active',mode:'insensitive'},archive:{is:null}},select:{id:true,studentNumber:true,grade:true,section:true,user:{select:{firstName:true,middleName:true,lastName:true,email:true}}},orderBy:[{grade:'asc'},{user:{lastName:'asc'}}],take:10000})
 res.setHeader('Cache-Control','private, no-store');return success(res,rows.map(row=>({...row,name:name(row.user),email:row.user.email,user:undefined})))
}))
seniorTeacherRouter.patch('/learner-emails/:studentId',asyncHandler(async(req:AuthenticatedRequest,res)=>{
 await permitted(req)
 const payload=z.object({email:z.string().trim().email().max(320).transform(v=>v.toLowerCase()),expectedEmail:z.string().max(320)}).strict().parse(req.body)
 const student=await prisma.studentProfile.findUnique({where:{id:id.parse(req.params.studentId)},select:{id:true,studentNumber:true,status:true,archive:{select:{id:true}},user:{select:{id:true,email:true,orbitUserId:true}}}})
 if(!student||student.archive||inactiveStudentStatus(student.status))throw new ApiError(404,'Élève actif introuvable. / Active learner not found.')
 if(student.user.email.trim().toLowerCase()!==payload.expectedEmail.trim().toLowerCase())throw new ApiError(409,'L’adresse a changé. Actualisez avant de modifier. / Email changed. Refresh before editing.')
 if(await prisma.user.findFirst({where:{id:{not:student.user.id},email:{equals:payload.email,mode:'insensitive'}},select:{id:true}}))throw new ApiError(409,'Cette adresse appartient déjà à un autre compte. / This email already belongs to another account.')
 res.locals.learnerEmailOnly=true;res.locals.expectedLearnerEmail=payload.expectedEmail
 req.params={entityType:'student',identifier:student.user.orbitUserId||student.studentNumber}
 req.query.identifierType=student.user.orbitUserId?'orbitId':'externalId'
 req.body={email:payload.email}
 await updateRegistryEntity(req,res)
}))

// Only Root may delegate this additional workspace. Primary roles and credentials never change here.
seniorTeacherRouter.get('/access',requireSuperAdmin(),asyncHandler(async(_req,res)=>{
 const rows=await prisma.user.findMany({where:{accountBlockedAt:null,teacherProfile:{isNot:null}},select:{id:true,firstName:true,middleName:true,lastName:true,permissions:true,role:true},orderBy:{lastName:'asc'}})
 return success(res,rows.filter(row=>!['STUDENT','PARENT'].includes(row.role)&&!row.permissions.includes('nexus:media-only')).map(row=>({id:row.id,name:name(row),enabled:hasSeniorWorkspaceAccess(row)})))
}))
seniorTeacherRouter.put('/access/:userId',requireSuperAdmin(),asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const target=id.parse(req.params.userId),{enabled}=z.object({enabled:z.boolean()}).strict().parse(req.body),actorId=await databaseActorId(req.user!.sub)
 const result=await prisma.$transaction(async tx=>{
  await tx.$queryRaw(Prisma.sql`SELECT id FROM "User" WHERE id=${target} FOR UPDATE`)
  const row=await tx.user.findUnique({where:{id:target},select:{role:true,permissions:true,accountBlockedAt:true,teacherProfile:{select:{id:true}}}})
  if(!row||!row.teacherProfile||row.accountBlockedAt||['STUDENT','PARENT'].includes(row.role)||row.permissions.includes('nexus:media-only'))throw new ApiError(404,'SENIOR_ELIGIBLE_TEACHER_REQUIRED')
  const permissions=row.permissions.filter(p=>p!==SENIOR_WORKSPACE_PERMISSION);if(enabled)permissions.push(SENIOR_WORKSPACE_PERMISSION)
  await tx.user.update({where:{id:target},data:{permissions}})
  await tx.auditLog.create({data:{actorId,action:enabled?'SENIOR_WORKSPACE_GRANTED':'SENIOR_WORKSPACE_REVOKED',targetType:'User',targetId:target,metadata:{enabled,previouslyEnabled:hasSeniorWorkspaceAccess(row),primaryRoleUnchanged:row.role}}})
  return{id:target,enabled}
 });return success(res,result)
}))
seniorTeacherRouter.use(asyncHandler(async(req:AuthenticatedRequest,_res,next)=>{await permitted(req);next()}))
seniorTeacherRouter.get('/board',asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const requested=req.query.academicYear===undefined?undefined:yearSchema.parse(req.query.academicYear),calendars=await academicCalendars(),activeYear=calendars.find(c=>c.isCurrent)?.name??null,year=requested||activeYear
 if(!year)throw new ApiError(409,'SENIOR_CALENDAR_UNAVAILABLE')
 const [students,heads,closed,clock]=await Promise.all([
  prisma.studentProfile.findMany({select:fields,orderBy:[{section:'asc'},{studentNumber:'asc'}]}),
  prisma.auditLog.findMany({where:{targetType:'SeniorUniversityPlan',action:'SENIOR_PLAN_HEAD',metadata:{path:['academicYear'],equals:year}},select:{targetId:true,metadata:true}}),
  prisma.auditLog.findFirst({where:{targetType:'AcademicPeriodClosure',action:'ACADEMIC_PERIOD_CLOSED',AND:[{metadata:{path:['academicYear'],equals:year}},{metadata:{path:['term'],equals:'Annual final'}}]},select:{id:true}}),
  prisma.$queryRaw<Array<{now:Date}>>`SELECT clock_timestamp() as now`
 ])
 const saved=new Map(heads.map(h=>[h.targetId,h.metadata as any])),current=year===activeYear
 const rows=students.filter(s=>current?isFinalYear(s.grade)&&!s.archive&&!inactiveStudentStatus(s.status)&&!s.user.accountBlockedAt:saved.has(s.id)).map(s=>{
  const plan=saved.get(s.id)||emptyPlan(),snapshot=plan.student
  return{id:s.id,name:current?name(s.user):(snapshot?.name||name(s.user)),studentNumber:s.studentNumber,grade:current?s.grade:(snapshot?.grade||'Grade 12'),section:current?s.section:(snapshot?.section||''),plan,readiness:readiness(plan.checklist),editable:current&&!closed&&!s.archive&&!inactiveStudentStatus(s.status)&&!s.user.accountBlockedAt}
 })
 return success(res,{academicYear:year,activeAcademicYear:activeYear,years:[...new Set([...calendars.map(c=>c.name),year])].sort().reverse(),readOnly:!current||Boolean(closed),serverUtc:clock[0].now.toISOString(),schoolDate:new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Kinshasa',year:'numeric',month:'2-digit',day:'2-digit'}).format(clock[0].now),rows})
}))
seniorTeacherRouter.put('/plans/:studentId',asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const studentId=id.parse(req.params.studentId),year=yearSchema.parse(req.query.academicYear),draft=planSchema.parse(req.body),calendars=await academicCalendars({strict:true}),actorId=await databaseActorId(req.user!.sub)
 if(!calendars.some(c=>c.name===year&&c.isCurrent))throw new ApiError(409,'SENIOR_YEAR_READ_ONLY')
 const result=await prisma.$transaction(async tx=>{
  await lockAcademicYears(tx,[year]);await tx.$queryRaw(Prisma.sql`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${headId(year,studentId)}))`)
  await permitted(req,tx)
  const [student,closed,head]=await Promise.all([tx.studentProfile.findUnique({where:{id:studentId},select:fields}),tx.auditLog.findFirst({where:{targetType:'AcademicPeriodClosure',action:'ACADEMIC_PERIOD_CLOSED',AND:[{metadata:{path:['academicYear'],equals:year}},{metadata:{path:['term'],equals:'Annual final'}}]},select:{id:true}}),tx.auditLog.findUnique({where:{id:headId(year,studentId)}})])
  if(!student||!isFinalYear(student.grade)||student.archive||inactiveStudentStatus(student.status)||student.user.accountBlockedAt)throw new ApiError(404,'SENIOR_GRADE12_REQUIRED')
  if(closed)throw new ApiError(409,'SENIOR_YEAR_READ_ONLY')
  const previous=head?.metadata as any
  if((previous?.revision??0)!==draft.revision)throw new ApiError(409,'SENIOR_REVISION_CONFLICT')
  if(previous?.applications?.some((a:any)=>!draft.applications.some(b=>b.id===a.id)))throw new ApiError(409,'SENIOR_ARCHIVE_APPLICATION_INSTEAD')
  const now=await tx.$queryRaw<Array<{now:Date}>>`SELECT clock_timestamp() as now`
  const plan={...draft,revision:draft.revision+1,academicYear:year,student:{id:student.id,name:name(student.user),grade:student.grade,section:student.section},updatedAt:now[0].now.toISOString(),updatedBy:actorId}
  await tx.auditLog.upsert({where:{id:headId(year,studentId)},create:{id:headId(year,studentId),actorId,action:'SENIOR_PLAN_HEAD',targetType:'SeniorUniversityPlan',targetId:studentId,metadata:plan},update:{actorId,metadata:plan}})
  await tx.auditLog.create({data:{actorId,action:'SENIOR_PLAN_SAVED',targetType:'SeniorUniversityHistory',targetId:studentId,metadata:plan}})
  return{plan,readiness:readiness(plan.checklist)}
 },{timeout:10000});return success(res,result,'SENIOR_PLAN_SAVED')
}))
seniorTeacherRouter.get('/plans/:studentId/history',asyncHandler(async(req,res)=>{
 const studentId=id.parse(req.params.studentId),year=yearSchema.parse(req.query.academicYear)
 const head=await prisma.auditLog.findUnique({where:{id:headId(year,studentId)},select:{id:true}})
 if(!head)throw new ApiError(404,'SENIOR_PLAN_NOT_FOUND')
 const rows=await prisma.auditLog.findMany({where:{targetType:'SeniorUniversityHistory',targetId:studentId,metadata:{path:['academicYear'],equals:year}},orderBy:{createdAt:'desc'},take:50,select:{createdAt:true,metadata:true,actor:{select:{firstName:true,middleName:true,lastName:true}}}})
 return success(res,rows.map(row=>({createdAt:row.createdAt,revision:(row.metadata as any)?.revision,actor:row.actor?name(row.actor):'',snapshot:row.metadata})))
}))
