
import {Router} from 'express'
import {Prisma} from '@prisma/client'
import {z} from 'zod'
import multer from 'multer'
import {createHash} from 'node:crypto'
import {prisma} from '../config/prisma.js'
import {authenticate,type AuthenticatedRequest} from '../middleware/auth.js'
import {ApiError,asyncHandler,success} from '../utils/api.js'
import {databaseActorId} from '../utils/databaseActor.js'
import {hasDisciplineWorkspaceAccess} from '../utils/staffWorkspace.js'
import {academicCalendars} from '../services/reportAttendance.service.js'
import {familyEmailRecipients} from '../services/familyEmailRecipients.js'
import {queueMessageBatch} from '../services/messageBatch.js'

export const disciplineDirectorRouter=Router()
const id=z.string().min(1).max(160),name=(u:any)=>[u.lastName,u.middleName,u.firstName].filter(Boolean).join(' ')
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{const d=new Date(v+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===v})
const year=z.string().regex(/^\d{4}-\d{4}$/)
const statuses=['OPEN','INVESTIGATING','PARENT_CONTACTED','RESOLVED','ESCALATED'] as const
const severity=['LOW','MEDIUM','HIGH','CRITICAL'] as const
const schoolDay=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Kinshasa',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
async function permitted(req:AuthenticatedRequest,db:any=prisma){
 if(req.user!.sub==='configured-superadmin')return
 const user=await db.user.findUnique({where:{id:req.user!.sub},select:{permissions:true,accountBlockedAt:true}})
 if(!user||user.accountBlockedAt||!hasDisciplineWorkspaceAccess(user))throw new ApiError(403,'DISCIPLINE_ACCESS_REQUIRED')
}
disciplineDirectorRouter.use(authenticate,asyncHandler(async(req:AuthenticatedRequest,_res,next)=>{await permitted(req);_res.setHeader('Cache-Control','private, no-store');next()}))
const person={id:true,firstName:true,middleName:true,lastName:true,email:true,phone:true,accountBlockedAt:true}
const studentFields={id:true,studentNumber:true,grade:true,section:true,status:true,archive:{select:{id:true}},user:{select:person},parentLinks:{select:{parent:{select:person},relation:true}}} as const
const caseInclude={student:{select:studentFields},reportedBy:{select:person},resolvedBy:{select:person}} as const
const active=(s:any)=>!s.archive&&!s.user.accountBlockedAt&&String(s.status).toLowerCase()==='active'
function learner(s:any){return{id:s.id,name:name(s.user),studentNumber:s.studentNumber,grade:s.grade,section:s.section,active:active(s),parents:s.parentLinks.map((l:any)=>({id:l.parent.id,name:name(l.parent),email:l.parent.email,phone:l.parent.phone,relation:l.relation,blocked:Boolean(l.parent.accountBlockedAt)}))}}
function caseView(c:any){return{...c,suspensionStart:c.suspensionStart?.toISOString().slice(0,10)||null,suspensionEnd:c.suspensionEnd?.toISOString().slice(0,10)||null,student:learner(c.student),reportedBy:c.reportedBy?name(c.reportedBy):'',resolvedBy:c.resolvedBy?name(c.resolvedBy):'',version:c.updatedAt.toISOString()}}
async function log(tx:any,req:AuthenticatedRequest,action:string,targetType:string,targetId:string,metadata:any){await tx.auditLog.create({data:{actorId:await databaseActorId(req.user!.sub),action,targetType,targetId,metadata:JSON.parse(JSON.stringify(metadata))}})}
async function calendar(value?:string){const calendars=await academicCalendars({strict:true}),selected=calendars.find(c=>c.name===(value||calendars.find(c=>c.isCurrent)?.name));if(!selected)throw new ApiError(409,'DISCIPLINE_CALENDAR_REQUIRED');return{selected,calendars}}
disciplineDirectorRouter.get('/board',asyncHandler(async(req,res)=>{
 const input=z.object({academicYear:year.optional()}).strict().parse(req.query),{selected,calendars}=await calendar(input.academicYear)
 const from=new Date(selected.startDate.slice(0,10)+'T00:00:00+01:00'),to=new Date(selected.endDate.slice(0,10)+'T23:59:59.999+01:00')
 const [students,cases,incidents,records,snapshots]=await Promise.all([
  prisma.studentProfile.findMany({select:studentFields,orderBy:[{user:{lastName:'asc'}},{user:{firstName:'asc'}}]}),
  prisma.disciplineCase.findMany({where:{incidentDate:{gte:from,lte:to}},include:caseInclude,orderBy:[{incidentDate:'desc'},{id:'asc'}]}),
  prisma.incidentReport.findMany({where:{occurredAt:{gte:from,lte:to}},select:{id:true,reference:true,title:true,category:true,occurredAt:true,location:true,description:true,peopleInvolved:true,immediateActions:true,confidentiality:true,status:true,adminNotes:true,authorId:true,authorName:true,attachmentName:true,updatedAt:true},orderBy:{occurredAt:'desc'}}),
  prisma.auditLog.findMany({where:{action:{in:['DISCIPLINE_FOLLOWUP_HEAD','DISCIPLINE_SUPPORT_PLAN_HEAD']},metadata:{path:['academicYear'],equals:selected.name}},select:{id:true,targetId:true,metadata:true}}),
  prisma.auditLog.findMany({where:{action:'DISCIPLINE_CASE_CREATED',metadata:{path:['academicYear'],equals:selected.name}},select:{targetId:true,metadata:true}})
 ])
 const historic=!selected.isCurrent,savedStudents=new Map(snapshots.map(row=>[row.targetId,(row.metadata as any)?.student]));const historicalCases=cases.map(c=>{const dto=caseView(c),snapshot=savedStudents.get(c.id);return historic&&snapshot?{...dto,student:{...dto.student,name:snapshot.name,grade:snapshot.grade,section:snapshot.section}}:dto})
 return success(res,{academicYear:selected.name,years:calendars.map(c=>c.name).sort().reverse(),schoolDate:schoolDay(),calendar:{startDate:selected.startDate.slice(0,10),endDate:selected.endDate.slice(0,10)},serverUtc:new Date().toISOString(),students:students.filter(active).map(learner),cases:historicalCases,incidents,followups:records.filter(r=>r.id.startsWith('discipline-followup:')).map(r=>({id:r.targetId,...r.metadata as any})),plans:records.filter(r=>r.id.startsWith('discipline-plan:')).map(r=>({studentId:r.targetId,...r.metadata as any}))})
}))
const caseSchema=z.object({studentId:id,academicYear:year,incidentDate:date,category:z.string().trim().min(2).max(120),severity:z.enum(severity),incident:z.string().trim().min(5).max(5000),actionTaken:z.string().trim().max(3000).default(''),sourceIncidentId:id.optional(),suspensionStart:date.optional(),suspensionEnd:date.optional(),confirmed:z.literal(true),requestId:z.string().uuid()}).strict().superRefine((d,ctx)=>{if(Boolean(d.suspensionStart)!==Boolean(d.suspensionEnd)||d.suspensionStart&&d.suspensionEnd!<d.suspensionStart)ctx.addIssue({code:'custom',message:'DISCIPLINE_INVALID_SUSPENSION'})})
disciplineDirectorRouter.post('/cases',asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const d=caseSchema.parse(req.body),{selected}=await calendar(d.academicYear),today=schoolDay()
 if(d.incidentDate<selected.startDate.slice(0,10)||d.incidentDate>selected.endDate.slice(0,10)||d.incidentDate>today)throw new ApiError(400,'DISCIPLINE_INCIDENT_DATE')
 if(d.suspensionStart&&(d.suspensionStart<today||d.suspensionEnd!>selected.endDate.slice(0,10)))throw new ApiError(400,'DISCIPLINE_SUSPENSION_DATE')
 const saved=await prisma.$transaction(async tx=>{
  await permitted(req,tx);const requestKey='discipline-create:'+req.user!.sub+':'+d.requestId,requestHash=createHash('sha256').update(JSON.stringify(d)).digest('hex');
  await tx.$queryRawUnsafe('SELECT 1 FROM pg_advisory_xact_lock(hashtext($1))',requestKey);
  const prior=await tx.auditLog.findUnique({where:{id:requestKey}}),state=prior?.metadata as any;
  if(state){if(state.hash!==requestHash)throw new ApiError(409,'DISCIPLINE_CHANGED');return tx.disciplineCase.findUniqueOrThrow({where:{id:state.caseId},include:caseInclude})}
  const student=await tx.studentProfile.findUnique({where:{id:d.studentId},select:studentFields});if(!student||!active(student))throw new ApiError(404,'DISCIPLINE_ACTIVE_LEARNER_REQUIRED')
  if(d.sourceIncidentId&&!await tx.incidentReport.findUnique({where:{id:d.sourceIncidentId},select:{id:true}}))throw new ApiError(404,'DISCIPLINE_INCIDENT_NOT_FOUND')
  const c=await tx.disciplineCase.create({data:{studentId:d.studentId,reportedById:await databaseActorId(req.user!.sub),incidentDate:new Date(d.incidentDate+'T12:00:00+01:00'),category:d.category,severity:d.severity,incident:d.incident,actionTaken:d.actionTaken,...(d.suspensionStart?{suspensionStart:new Date(d.suspensionStart+'T00:00:00.000Z'),suspensionEnd:new Date(d.suspensionEnd+'T23:59:59.999Z')}:{}),status:'OPEN'},include:caseInclude})
  await log(tx,req,'DISCIPLINE_CASE_CREATED','DisciplineCase',c.id,{academicYear:d.academicYear,student:learner(student),sourceIncidentId:d.sourceIncidentId||null,suspensionStart:d.suspensionStart||null,suspensionEnd:d.suspensionEnd||null})
  await tx.auditLog.create({data:{id:requestKey,actorId:await databaseActorId(req.user!.sub),action:'DISCIPLINE_CASE_REQUEST',targetType:'DisciplineCase',targetId:c.id,metadata:{hash:requestHash,caseId:c.id}}})
  return c
 });return success(res,caseView(saved),'DISCIPLINE_SAVED',201)
}))
disciplineDirectorRouter.patch('/cases/:id',asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const target=id.parse(req.params.id),d=z.object({version:z.string().datetime(),status:z.enum(statuses),resolution:z.string().trim().max(5000),actionTaken:z.string().trim().max(3000),confirmed:z.literal(true)}).strict().parse(req.body)
 if(d.status==='RESOLVED'&&d.resolution.length<5)throw new ApiError(400,'DISCIPLINE_RESOLUTION_REQUIRED')
 const saved=await prisma.$transaction(async tx=>{await permitted(req,tx);const before=await tx.disciplineCase.findUnique({where:{id:target}});if(!before)throw new ApiError(404,'DISCIPLINE_CASE_NOT_FOUND');const changed=await tx.disciplineCase.updateMany({where:{id:target,updatedAt:new Date(d.version)},data:{status:d.status,resolution:d.resolution,actionTaken:d.actionTaken,resolvedById:d.status==='RESOLVED'?await databaseActorId(req.user!.sub):null}});if(changed.count!==1)throw new ApiError(409,'DISCIPLINE_CHANGED');await log(tx,req,'DISCIPLINE_CASE_REVIEWED','DisciplineCase',target,{previous:{status:before.status,resolution:before.resolution,actionTaken:before.actionTaken},next:d});return tx.disciplineCase.findUniqueOrThrow({where:{id:target},include:caseInclude})})
 return success(res,caseView(saved),'DISCIPLINE_SAVED')
}))
disciplineDirectorRouter.patch('/incidents/:id',asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const target=id.parse(req.params.id),d=z.object({version:z.string().datetime(),status:z.enum(['SUBMITTED','UNDER_REVIEW','CLOSED']),notes:z.string().trim().min(3).max(5000)}).strict().parse(req.body)
 await prisma.$transaction(async tx=>{await permitted(req,tx);const changed=await tx.incidentReport.updateMany({where:{id:target,updatedAt:new Date(d.version)},data:{status:d.status,adminNotes:d.notes}});if(changed.count!==1)throw new ApiError(409,'DISCIPLINE_CHANGED');await log(tx,req,'DISCIPLINE_INCIDENT_REVIEWED','IncidentReport',target,d)});return success(res,{id:target},'DISCIPLINE_SAVED')
}))
const followupSchema=z.object({academicYear:year,caseId:id,type:z.enum(['MEETING','COUNSELLING','RESTITUTION','CHECK_IN']),dueDate:date,status:z.enum(['PLANNED','DONE','MISSED']),participants:z.string().trim().max(1000),notes:z.string().trim().min(3).max(5000),nextStep:z.string().trim().max(2000),revision:z.number().int().min(0)}).strict()
disciplineDirectorRouter.put('/followups/:id',asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const target=z.string().uuid().parse(req.params.id),d=followupSchema.parse(req.body);const {selected}=await calendar(d.academicYear)
 const saved=await prisma.$transaction(async tx=>{await permitted(req,tx);const c=await tx.disciplineCase.findUnique({where:{id:d.caseId},select:{studentId:true,incidentDate:true}});if(!c)throw new ApiError(404,'DISCIPLINE_CASE_NOT_FOUND');const incidentDay=c.incidentDate.toISOString().slice(0,10);if(incidentDay<selected.startDate.slice(0,10)||incidentDay>selected.endDate.slice(0,10))throw new ApiError(409,'DISCIPLINE_CHANGED');const key='discipline-followup:'+target;await tx.$queryRawUnsafe('SELECT 1 FROM pg_advisory_xact_lock(hashtext($1))',key);const head=await tx.auditLog.findUnique({where:{id:key}}),previous=head?.metadata as any;if(previous?.revision===d.revision+1&&Object.entries(d).every(([k,v])=>k==='revision'||previous[k]===v))return previous;if(previous&&(previous.revision!==d.revision||previous.caseId!==d.caseId||previous.academicYear!==d.academicYear)||!previous&&d.revision!==0)throw new ApiError(409,'DISCIPLINE_CHANGED');const value={...d,studentId:c.studentId,revision:d.revision+1,updatedAt:new Date().toISOString(),updatedBy:await databaseActorId(req.user!.sub)};if(head){const updated=await tx.auditLog.updateMany({where:{id:key,metadata:{path:['revision'],equals:d.revision}},data:{metadata:value}});if(updated.count!==1)throw new ApiError(409,'DISCIPLINE_CHANGED')}else await tx.auditLog.create({data:{id:key,action:'DISCIPLINE_FOLLOWUP_HEAD',actorId:value.updatedBy,targetType:'DisciplineFollowup',targetId:target,metadata:value}});await log(tx,req,'DISCIPLINE_FOLLOWUP_SAVED','DisciplineCase',d.caseId,{followupId:target,previous:previous||null,next:value});return value});return success(res,{id:target,...saved},'DISCIPLINE_SAVED')
}))
disciplineDirectorRouter.put('/plans/:studentId',asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const target=id.parse(req.params.studentId),d=z.object({academicYear:year,revision:z.number().int().min(0),goals:z.string().trim().min(5).max(5000),supports:z.string().trim().min(3).max(5000),strengths:z.string().trim().max(3000),reviewDate:date,status:z.enum(['ACTIVE','REVIEW','COMPLETED']),progress:z.string().trim().max(5000)}).strict().parse(req.body);await calendar(d.academicYear)
 const saved=await prisma.$transaction(async tx=>{await permitted(req,tx);const student=await tx.studentProfile.findUnique({where:{id:target},select:studentFields});if(!student||!active(student))throw new ApiError(404,'DISCIPLINE_ACTIVE_LEARNER_REQUIRED');const key='discipline-plan:'+d.academicYear+':'+target;await tx.$queryRawUnsafe('SELECT 1 FROM pg_advisory_xact_lock(hashtext($1))',key);const head=await tx.auditLog.findUnique({where:{id:key}}),previous=head?.metadata as any;if(previous?.revision===d.revision+1&&Object.entries(d).every(([k,v])=>k==='revision'||previous[k]===v))return previous;if((previous?.revision||0)!==d.revision)throw new ApiError(409,'DISCIPLINE_CHANGED');const value={...d,student:learner(student),revision:d.revision+1,updatedAt:new Date().toISOString(),updatedBy:await databaseActorId(req.user!.sub)};if(head){const changed=await tx.auditLog.updateMany({where:{id:key,metadata:{path:['revision'],equals:d.revision}},data:{metadata:value}});if(changed.count!==1)throw new ApiError(409,'DISCIPLINE_CHANGED')}else await tx.auditLog.create({data:{id:key,action:'DISCIPLINE_SUPPORT_PLAN_HEAD',actorId:value.updatedBy,targetType:'DisciplineSupportPlan',targetId:target,metadata:value}});await log(tx,req,'DISCIPLINE_SUPPORT_PLAN_SAVED','StudentProfile',target,{previous:previous||null,next:value});return value});return success(res,{studentId:target,...saved},'DISCIPLINE_SAVED')
}))
disciplineDirectorRouter.get('/cases/:id/history',asyncHandler(async(req,res)=>{
 const target=id.parse(req.params.id);if(!await prisma.disciplineCase.findUnique({where:{id:target},select:{id:true}}))throw new ApiError(404,'DISCIPLINE_CASE_NOT_FOUND')
 const logs=await prisma.auditLog.findMany({where:{targetType:'DisciplineCase',targetId:target},select:{id:true,action:true,createdAt:true,metadata:true,actor:{select:{firstName:true,middleName:true,lastName:true}}},orderBy:{createdAt:'desc'},take:100})
 return success(res,logs.map(row=>({...row,actor:row.actor?name(row.actor):''})))
}))
disciplineDirectorRouter.get('/incidents/:id/attachment',asyncHandler(async(req,res)=>{
 const target=id.parse(req.params.id),item=await prisma.incidentReport.findUnique({where:{id:target},select:{attachmentData:true,attachmentMime:true,attachmentName:true}})
 if(!item?.attachmentData||!item.attachmentName)throw new ApiError(404,'DISCIPLINE_ATTACHMENT_NOT_FOUND')
 const filename=item.attachmentName.replace(/[\r\n"\\/]/g,'_');res.set('Content-Type',item.attachmentMime||'application/octet-stream');res.set('Content-Disposition','attachment; filename="'+filename+'"');res.set('X-Content-Type-Options','nosniff');res.set('Cache-Control','private, no-store');return res.send(item.attachmentData)
}))
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:10485760,files:1},fileFilter:(_req,file,cb)=>file.mimetype==='application/pdf'?cb(null,true):cb(new ApiError(400,'DISCIPLINE_PDF_ONLY'))})
disciplineDirectorRouter.post('/cases/:id/contact-parents',upload.single('attachment'),asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const target=id.parse(req.params.id),d=z.object({recipientIds:z.preprocess(v=>{if(typeof v!=='string')return v;try{return JSON.parse(v)}catch{return null}},z.array(id).min(1).max(20)),subject:z.string().trim().min(2).max(160),body:z.string().trim().min(3).max(10000),language:z.enum(['fr','en']),requestId:z.string().uuid()}).strict().parse(req.body)
 if(req.file&&!req.file.buffer.subarray(0,5).equals(Buffer.from('%PDF-')))throw new ApiError(400,'DISCIPLINE_PDF_ONLY')
 const c=await prisma.disciplineCase.findUnique({where:{id:target},include:caseInclude});if(!c)throw new ApiError(404,'DISCIPLINE_CASE_NOT_FOUND')
 const selected=[...new Set(d.recipientIds)],parents=c.student.parentLinks.map(l=>l.parent).filter(p=>selected.includes(p.id)&&!p.accountBlockedAt)
 if(parents.length!==selected.length||!active(c.student))throw new ApiError(403,'DISCIPLINE_LINKED_PARENTS_REQUIRED')
 const families=await familyEmailRecipients(parents),targets=parents.flatMap(parent=>(families.get(parent.id)||[]).map(t=>({userId:parent.id,name:t.name,email:t.email,phone:t.phone,relationship:t.relationship})))
 await permitted(req)
 const live=await prisma.studentProfile.findUnique({where:{id:c.studentId},select:studentFields})
 if(!live||!active(live)||!selected.every(parentId=>live.parentLinks.some(link=>link.parent.id===parentId&&!link.parent.accountBlockedAt)))throw new ApiError(409,'DISCIPLINE_LINKED_PARENTS_REQUIRED')
 const result=await queueMessageBatch({senderId:await databaseActorId(req.user!.sub),subject:d.subject,body:d.body,language:d.language,requestId:d.requestId,recipients:parents.map(p=>({id:p.id,role:'PARENT',name:name(p)})),targets,channels:['email'],attachment:req.file,personalizeParents:false,intent:{disciplineCaseId:target,recipientIds:selected.sort()}})
 await log(prisma,req,'DISCIPLINE_FAMILY_CONTACT_QUEUED','DisciplineCase',target,{batchId:result.batchId,parentIds:selected,language:d.language,subject:d.subject,attachmentName:req.file?.originalname||null,emailQueued:result.emailQueued})
 await prisma.disciplineCase.updateMany({where:{id:target,status:{in:['OPEN','INVESTIGATING']}},data:{status:'PARENT_CONTACTED'}})
 return success(res,result,'DISCIPLINE_CONTACT_QUEUED')
}))
disciplineDirectorRouter.get('/communications',asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const actorId=await databaseActorId(req.user!.sub),input=z.object({page:z.coerce.number().int().min(1).default(1),q:z.string().trim().max(150).default('')}).strict().parse(req.query)
 const where:Prisma.InternalMessageWhereInput={OR:[{senderId:actorId},{recipientId:actorId}],...(input.q?{AND:[{OR:[{subject:{contains:input.q,mode:'insensitive'}},{body:{contains:input.q,mode:'insensitive'}}]}]}:{})}
 const [rows,total]=await Promise.all([prisma.internalMessage.findMany({where,select:{id:true,subject:true,body:true,createdAt:true,readAt:true,attachmentName:true,senderId:true,recipientId:true,sender:{select:person},recipient:{select:person}},orderBy:{createdAt:'desc'},skip:(input.page-1)*20,take:20}),prisma.internalMessage.count({where})])
 return success(res,{page:input.page,pages:Math.ceil(total/20),total,rows:rows.map(row=>({...row,sender:name(row.sender),recipient:name(row.recipient),incoming:row.recipientId===actorId}))})
}))
disciplineDirectorRouter.patch('/communications/:id/read',asyncHandler(async(req:AuthenticatedRequest,res)=>{const actorId=await databaseActorId(req.user!.sub),target=id.parse(req.params.id);const changed=await prisma.internalMessage.updateMany({where:{id:target,recipientId:actorId,readAt:null},data:{readAt:new Date()}});return success(res,{read:changed.count>0})}))
