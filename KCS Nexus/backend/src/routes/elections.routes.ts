import {Router} from 'express'
import {createHash,randomBytes,randomUUID} from 'node:crypto'
import jwt,{type SignOptions} from 'jsonwebtoken'
import {env} from '../config/env.js'
import {assertAccountAccess} from '../services/accountAccess.service.js'
import {ELECTION_LAUNCH_TTL_MS,electionManagementAccess,electionLaunchUrl,electionReturnPath} from '../utils/electionLaunchPolicy.js'
import multer from 'multer'
import path from 'node:path'
import {mkdir,writeFile,unlink} from 'node:fs/promises'
import {uploadPath} from '../utils/uploadStorage.js'
import {validateMediaUpload} from '../utils/mediaUpload.js'
import {Prisma} from '@prisma/client'
import {z} from 'zod'
import {prisma} from '../config/prisma.js'
import {authenticate,requireSuperAdmin,type AuthenticatedRequest} from '../middleware/auth.js'
import {ApiError,asyncHandler,success} from '../utils/api.js'
import {databaseActorId} from '../utils/databaseActor.js'
import {academicCalendars} from '../services/reportAttendance.service.js'
import {electionOfficeMatches,validSchoolBallot,electionWindowOpen,voterKey} from '../utils/schoolElectionPolicy.js'

export const electionsRouter=Router()
const audience=z.enum(['PARENT','STUDENT']),id=z.string().min(1).max(160),name=z.string().trim().min(2).max(160)
const scope=z.enum(['GLOBAL','CLASS']),statuses=z.enum(['DRAFT','OPEN','CLOSED','PUBLISHED','ARCHIVED'])
const order={orderBy:[{displayOrder:'asc' as const},{id:'asc' as const}]}
const include={offices:{...order,include:{candidates:{orderBy:[{ballotNumber:'asc' as const},{lastName:'asc' as const}]}}}}
const fullName=(u:any)=>[u.lastName,u.middleName,u.firstName].filter(Boolean).join(' ')
const active=(s:any)=>s&&String(s.status).toLowerCase()==='active'&&!s.archive
const studentSelect={id:true,grade:true,section:true,status:true,archive:{select:{id:true}}}
const personSelect={id:true,role:true,firstName:true,middleName:true,lastName:true,email:true,accessCode:true,accountBlockedAt:true,permissions:true,studentProfile:{select:studentSelect},parentLinks:{select:{student:{select:studentSelect}}}}
const publicCandidate=(c:any)=>({id:c.id,officeId:c.officeId,firstName:c.firstName,middleName:c.middleName,lastName:c.lastName,name:fullName(c),grade:c.grade,section:c.section,biography:c.biography,photoUrl:c.photoUrl,ballotNumber:c.ballotNumber})
const publicElection=(e:any)=>({id:e.id,title:e.title,audience:e.audience,academicYear:e.academicYear,startAt:e.startAt,endAt:e.endAt,status:e.status,publishedAt:e.publishedAt,allowAbstention:e.allowAbstention})
const publicOffice=(o:any)=>({id:o.id,name:o.name,scope:o.scope,grade:o.grade,section:o.section,displayOrder:o.displayOrder,candidates:o.candidates.filter((c:any)=>c.status==='APPROVED').map(publicCandidate)})
async function electionPerson(userId:string,kind:string,db:any=prisma){
 const u=await db.user.findUnique({where:{id:userId},select:personSelect})
 if(!u||u.accountBlockedAt)throw new ApiError(403,'ELECTION_ACCOUNT_INACTIVE')
 const children=(u.parentLinks||[]).map((l:any)=>l.student).filter(active)
 const classes=kind==='STUDENT'?u.role==='STUDENT'&&active(u.studentProfile)?[u.studentProfile]:[]:children
 if(kind==='STUDENT'&&!classes.length||kind==='PARENT'&&u.role!=='PARENT'&&!u.parentLinks.length)throw new ApiError(403,'ELECTION_WRONG_ELECTORATE')
 return{user:u,classes}
}
function electoralClasses(e:any,p:any){return p.classes.filter((c:any)=>!e.eligibleGrades.length||e.eligibleGrades.some((g:string)=>g.toLowerCase()===c.grade.toLowerCase()))}
function eligible(e:any,p:any){return electoralClasses(e,p).length>0&&(e.eligibilityMode!=='SELECTED'||e.eligibleUserIds.includes(p.user.id))}
async function manager(req:AuthenticatedRequest,res:any,next:any){
 if(req.user?.sub==='configured-superadmin'){res.locals.electionManage=true;return next()}
 const u=await prisma.user.findUnique({where:{id:req.user!.sub},select:{role:true,permissions:true}}),access=electionManagementAccess(req.user!.sub,u)
 res.locals.electionManage=access==='MANAGE'
 if(!access)return next(new ApiError(403,'ELECTION_ADMIN_ACCESS_REQUIRED'))
 next()
}
const officeVersion=(office:any)=>createHash('sha256').update(JSON.stringify([office.id,office.name,office.displayOrder])).digest('hex')
const write=(req:any,res:any,next:any)=>res.locals.electionManage?next():next(new ApiError(403,'ELECTION_OBSERVER_READ_ONLY'))
const populationWhere=(kind:string)=>({accountBlockedAt:null,...(kind==='STUDENT'?{role:'STUDENT' as const,studentProfile:{status:{equals:'active',mode:'insensitive' as const},archive:null}}:{parentLinks:{some:{student:{status:{equals:'active',mode:'insensitive' as const},archive:null}}}})})
async function eligiblePopulation(e:any,db:any=prisma){
 const [people,participations]=await Promise.all([db.user.findMany({where:populationWhere(e.audience),select:personSelect}),db.schoolElectionParticipation.findMany({where:{electionId:e.id},select:{voterKey:true}})])
 const keys=new Set(people.filter((u:any)=>eligible(e,{user:u,classes:(e.audience==='STUDENT'?[u.studentProfile]:u.parentLinks.map((l:any)=>l.student)).filter(active)})).map((u:any)=>voterKey(e.id,u.id)))
 for(const p of participations)keys.add(p.voterKey)
 return keys.size
}
async function audit(tx:any,req:AuthenticatedRequest,action:string,targetId:string,metadata:any={}){const actorId=await databaseActorId(req.user!.sub),actor=await tx.user.findUnique({where:{id:actorId},select:{firstName:true,middleName:true,lastName:true}});await tx.auditLog.create({data:{actorId,action,targetType:'SchoolElection',targetId,metadata:{...metadata,actorName:actor?fullName(actor):''}}})}
async function lockedElection(tx:Prisma.TransactionClient,electionId:string,exclusive=false){
 if(exclusive)await tx.$queryRaw(Prisma.sql`SELECT id FROM "SchoolElection" WHERE id=${electionId} FOR UPDATE`)
 else await tx.$queryRaw(Prisma.sql`SELECT id FROM "SchoolElection" WHERE id=${electionId} FOR SHARE`)
 const e=await tx.schoolElection.findUnique({where:{id:electionId},include});if(!e)throw new ApiError(404,'ELECTION_NOT_FOUND');return e
}
async function chooseElection(kind:string,requested?:string){
 if(requested){const e=await prisma.schoolElection.findUnique({where:{id:requested},include});if(!e||e.audience!==kind)throw new ApiError(404,'ELECTION_NOT_FOUND');return e}
 const now=new Date(),current=await prisma.schoolElection.findFirst({where:{audience:kind,status:'OPEN',startAt:{lte:now},endAt:{gte:now}},include,orderBy:{startAt:'desc'}})
 return current||await prisma.schoolElection.findFirst({where:{audience:kind,status:{not:'ARCHIVED'}},include,orderBy:{createdAt:'desc'}})
}
const launchAudience=z.enum(['PARENT','STUDENT','ADMIN'])
const ticketKey=(ticket:string)=>'school-election-launch:'+createHash('sha256').update(ticket).digest('hex')
const launchFailure=()=>new ApiError(401,'ELECTION_LAUNCH_EXPIRED_OR_USED')
async function launchUser(subject:string,db:any=prisma){
 const actorId=await databaseActorId(subject),user=await db.user.findUnique({where:{id:actorId},select:{...personSelect,passwordChangedAt:true}})
 if(!user||user.accountBlockedAt)throw new ApiError(403,'ELECTION_ACCOUNT_INACTIVE')
 return user
}
electionsRouter.get('/personal-portrait',authenticate,asyncHandler(async(req:AuthenticatedRequest,res)=>{const actorId=await databaseActorId(req.user!.sub),user=await prisma.user.findUnique({where:{id:actorId},select:{avatar:true,accountBlockedAt:true}});res.setHeader('Cache-Control','private, no-store');return success(res,{image:user&&!user.accountBlockedAt&&user.avatar&&/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(user.avatar)?user.avatar:null})}))
electionsRouter.post('/launch',authenticate,asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const input=z.object({audience:launchAudience,language:z.enum(['fr','en']).default('fr'),theme:z.enum(['light','dark']).default('light'),returnPath:z.string().max(500).optional()}).strict().parse(req.body)
 const subject=req.user!.sub,user=await launchUser(subject)
 if(input.audience==='ADMIN'){if(!electionManagementAccess(subject,user))throw new ApiError(403,'ELECTION_ADMIN_ACCESS_REQUIRED')}
 else await electionPerson(user.id,input.audience)
 const clock=await prisma.$queryRaw<Array<{now:Date}>>`SELECT clock_timestamp() as now`,ticket=randomBytes(32).toString('base64url')
 const metadata={subject,userId:user.id,audience:input.audience,language:input.language,theme:input.theme,returnPath:electionReturnPath(input.audience,input.returnPath),expiresAt:new Date(clock[0].now.getTime()+ELECTION_LAUNCH_TTL_MS).toISOString(),passwordVersion:user.passwordChangedAt?.toISOString()||null}
 await prisma.auditLog.create({data:{id:ticketKey(ticket),actorId:user.id,action:'ELECTION_LAUNCH_ISSUED',targetType:'ElectionLaunchTicket',targetId:user.id,metadata}})
 res.set('Cache-Control','private, no-store');return success(res,{url:electionLaunchUrl(input.audience,ticket)})
}))
electionsRouter.post('/exchange',asyncHandler(async(req,res)=>{
 const input=z.object({audience:launchAudience,ticket:z.string().regex(/^[A-Za-z0-9_-]{43}$/)}).strict().parse(req.body),key=ticketKey(input.ticket)
 const issued=await prisma.auditLog.findUnique({where:{id:key},select:{metadata:true,action:true,targetType:true}})
 const snapshot=issued?.metadata as any
 if(!issued||issued.targetType!=='ElectionLaunchTicket'||issued.action!=='ELECTION_LAUNCH_ISSUED'||snapshot.audience!==input.audience||typeof snapshot.subject!=='string')throw launchFailure()
 await assertAccountAccess(snapshot.subject)
 const session=await prisma.$transaction(async tx=>{
  await tx.$queryRaw(Prisma.sql`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${key}))`)
  const head=await tx.auditLog.findUnique({where:{id:key}}),value=head?.metadata as any,clock=await tx.$queryRaw<Array<{now:Date}>>`SELECT clock_timestamp() as now`
  if(!head||head.action!=='ELECTION_LAUNCH_ISSUED'||head.targetType!=='ElectionLaunchTicket'||value.audience!==input.audience||!Number.isFinite(Date.parse(value.expiresAt))||clock[0].now.getTime()>=Date.parse(value.expiresAt))throw launchFailure()
  const user=await launchUser(value.subject,tx);if(user.id!==value.userId||head.actorId!==user.id||(user.passwordChangedAt?.toISOString()||null)!==value.passwordVersion)throw launchFailure()
  const access=input.audience==='ADMIN'?electionManagementAccess(value.subject,user):null
  if(input.audience==='ADMIN'){if(!access)throw new ApiError(403,'ELECTION_ADMIN_ACCESS_REQUIRED')}
  else await electionPerson(user.id,input.audience,tx)
  const usedAt=clock[0].now.toISOString(),changed=await tx.auditLog.updateMany({where:{id:key,action:'ELECTION_LAUNCH_ISSUED'},data:{action:'ELECTION_LAUNCH_USED',metadata:{...value,usedAt}}})
  if(changed.count!==1)throw launchFailure()
  await tx.auditLog.create({data:{actorId:user.id,action:'ELECTION_LAUNCH_COMPLETED',targetType:'ElectionLaunchEvent',targetId:key,metadata:{audience:input.audience,readOnly:access==='OBSERVE'}}})
  return{subject:value.subject,role:value.subject==='configured-superadmin'?'admin':user.role.toLowerCase(),audience:input.audience,readOnly:access==='OBSERVE',language:value.language,theme:value.theme,returnPath:electionReturnPath(input.audience,value.returnPath)}
 },{maxWait:10000,timeout:15000})
 const token=jwt.sign({sub:session.subject,role:session.role,sessionScope:'elections',electionAudience:session.audience,electionReadOnly:session.readOnly},env.JWT_SECRET,{expiresIn:env.JWT_EXPIRES_IN as SignOptions['expiresIn']})
 res.set('Cache-Control','private, no-store');return success(res,{token,audience:session.audience,language:session.language,theme:session.theme,returnPath:session.returnPath,readOnly:session.readOnly})
}))
async function electionReader(req:AuthenticatedRequest,kind:string){
 if(req.user!.sub==='configured-superadmin')return
 const user=await prisma.user.findUnique({where:{id:req.user!.sub},select:{role:true,permissions:true}})
 if(electionManagementAccess(req.user!.sub,user))return
 await electionPerson(req.user!.sub,kind)
}
electionsRouter.get('/:audience/public',authenticate,asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const kind=audience.parse(req.params.audience);await electionReader(req,kind);const rows=await prisma.schoolElection.findMany({where:{audience:kind,OR:[{status:{in:['DRAFT','OPEN','CLOSED','PUBLISHED']}},{status:'ARCHIVED',publishedAt:{not:null}}]},include,orderBy:{createdAt:'desc'},take:100})
 const clock=await prisma.$queryRaw<Array<{now:Date}>>`SELECT clock_timestamp() as now`
 res.set('Cache-Control','no-store');return success(res,{serverUtc:clock[0].now.toISOString(),elections:rows.map(e=>({...publicElection(e),offices:e.offices.map(publicOffice)}))})
}))
electionsRouter.get('/:audience/results',authenticate,asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const kind=audience.parse(req.params.audience);await electionReader(req,kind);const e=await chooseElection(kind,typeof req.query.electionId==='string'?req.query.electionId:undefined)
 if(!e||!(e.status==='PUBLISHED'||e.status==='ARCHIVED'&&e.publishedAt))return success(res,{election:null,offices:[],published:false})
 const grouped=await prisma.schoolElectionChoice.groupBy({by:['candidateId','officeId','abstained'],where:{ballot:{electionId:e.id}},_count:{_all:true}}),participation=await prisma.schoolElectionParticipation.count({where:{electionId:e.id}})
 return success(res,{published:true,election:publicElection(e),participation,offices:e.offices.map(o=>({...publicOffice(o),candidates:o.candidates.filter(c=>c.status==='APPROVED'||grouped.some(g=>g.candidateId===c.id)).map(c=>({...publicCandidate(c),votes:grouped.find(g=>g.candidateId===c.id)?._count._all||0})),abstentions:grouped.filter(g=>g.officeId===o.id&&g.abstained).reduce((n,g)=>n+g._count._all,0)}))})
}))
electionsRouter.get('/:audience/history',authenticate,asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const kind=audience.parse(req.params.audience);await electionReader(req,kind)
 const input=z.object({year:z.string().regex(/^\d{4}-\d{4}$/).optional(),status:z.enum(['CLOSED','PUBLISHED','ARCHIVED']).optional(),q:z.string().trim().max(150).default(''),page:z.coerce.number().int().min(1).max(10000).default(1)}).strict().parse(req.query)
 const where:Prisma.SchoolElectionWhereInput={audience:kind,status:input.status||{in:['CLOSED','PUBLISHED','ARCHIVED']},...(input.year?{academicYear:input.year}:{}),AND:input.q.split(/\s+/).filter(Boolean).map(word=>({OR:[{title:{contains:word,mode:'insensitive'}},{academicYear:{contains:word,mode:'insensitive'}}]}))}
 const [rows,total,years]=await Promise.all([prisma.schoolElection.findMany({where,orderBy:[{startAt:'desc'},{id:'asc'}],skip:(input.page-1)*12,take:12,include:{_count:{select:{offices:true,participations:true}}}}),prisma.schoolElection.count({where}),prisma.schoolElection.findMany({where:{audience:kind,status:{in:['CLOSED','PUBLISHED','ARCHIVED']}},distinct:['academicYear'],select:{academicYear:true},orderBy:{academicYear:'desc'}})])
 res.set('Cache-Control','private, no-store')
 return success(res,{page:input.page,total,pages:Math.ceil(total/12),years:years.map(y=>y.academicYear),elections:rows.map(e=>({...publicElection(e),offices:e._count.offices,participation:e.publishedAt?e._count.participations:null}))})
}))
electionsRouter.get('/:audience/session',authenticate,asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const kind=audience.parse(req.params.audience),person=await electionPerson(req.user!.sub,kind),e=await chooseElection(kind,typeof req.query.electionId==='string'?req.query.electionId:undefined)
 res.set('Cache-Control','private, no-store')
 const voter={name:fullName(person.user),classes:person.classes.map((c:any)=>({grade:c.grade,section:c.section}))}
 if(!e)return success(res,{voter,election:null,offices:[],applications:[],hasVoted:false,receipt:null,eligible:true,canApply:false,canVote:false})
 const allowed=eligible(e,person),[participation,applications]=await Promise.all([prisma.schoolElectionParticipation.findUnique({where:{electionId_voterKey:{electionId:e.id,voterKey:voterKey(e.id,person.user.id)}},select:{receiptCode:true,submittedAt:true}}),prisma.schoolElectionCandidate.findMany({where:{electionId:e.id,memberUserId:person.user.id},include:{office:true},orderBy:{createdAt:'desc'}})])
 const offices=e.offices.filter(o=>electionOfficeMatches(o,electoralClasses(e,person))).map(publicOffice),complete=offices.length>0&&offices.every(o=>o.candidates.length>0||e.allowAbstention)
 return success(res,{voter,election:publicElection(e),offices,applications:applications.map(a=>({...publicCandidate(a),status:a.status,officeName:a.office.name})),eligible:allowed||Boolean(participation),currentlyEligible:allowed,hasVoted:Boolean(participation),receipt:participation,canApply:allowed&&e.status==='DRAFT',canVote:allowed&&complete&&electionWindowOpen(e,new Date())&&!participation})
}))
electionsRouter.post('/:audience/applications',authenticate,asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const kind=audience.parse(req.params.audience),d=z.object({officeId:id,biography:z.string().trim().min(40).max(4000),photoUrl:z.string().url().max(2000).refine(v=>v.startsWith('https://')).optional(),consent:z.literal(true)}).strict().parse(req.body)
 const result=await prisma.$transaction(async tx=>{
  const office=await tx.schoolElectionOffice.findUnique({where:{id:d.officeId}});if(!office)throw new ApiError(404,'ELECTION_OFFICE_NOT_FOUND')
  const e=await lockedElection(tx,office.electionId,true),p=await electionPerson(req.user!.sub,kind,tx)
  if(e.audience!==kind||!eligible(e,p)||!electionOfficeMatches(office,electoralClasses(e,p)))throw new ApiError(403,'ELECTION_OUTSIDE_CONSTITUENCY')
  if(e.status!=='DRAFT')throw new ApiError(409,'ELECTION_APPLICATIONS_CLOSED')
  const u=p.user,c=p.classes[0],created=await tx.schoolElectionCandidate.create({data:{officeId:office.id,electionId:e.id,memberUserId:u.id,firstName:u.firstName,middleName:u.middleName,lastName:u.lastName,grade:kind==='STUDENT'?c.grade:null,section:kind==='STUDENT'?c.section:null,biography:d.biography,photoUrl:d.photoUrl||null}})
  await audit(tx,req,'SCHOOL_ELECTION_CANDIDACY_SUBMITTED',e.id,{candidateId:created.id,officeId:office.id,publicationConsent:true});return{id:created.id,status:created.status}
 },{timeout:15000}).catch((error:any)=>{if(error?.code==='P2002')throw new ApiError(409,'ELECTION_APPLICATION_ALREADY_EXISTS');throw error})
 return success(res,result,'ELECTION_APPLICATION_SAVED',201)
}))
const candidatePhotoParser=multer({storage:multer.memoryStorage(),limits:{fileSize:5*1024*1024,files:1,fields:0,parts:1},fileFilter:(_req,file,next)=>['image/jpeg','image/png','image/webp'].includes(file.mimetype)?next(null,true):next(new ApiError(415,'ELECTION_INVALID_PHOTO'))}).single('file')
const candidatePhoto=(req:any,res:any,next:any)=>candidatePhotoParser(req,res,(error:any)=>next(error instanceof multer.MulterError&&error.code==='LIMIT_FILE_SIZE'?new ApiError(413,'ELECTION_PHOTO_LIMIT'):error))
electionsRouter.post('/:audience/applications/:id/photo',authenticate,candidatePhoto,asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const kind=audience.parse(req.params.audience),candidateId=id.parse(req.params.id),file=req.file
 if(!file||!validateMediaUpload(file))throw new ApiError(415,'ELECTION_INVALID_PHOTO')
 let stored:string|undefined
 try{
  const saved=await prisma.$transaction(async tx=>{
   const candidate=await tx.schoolElectionCandidate.findUnique({where:{id:candidateId}});if(!candidate||candidate.memberUserId!==req.user!.sub)throw new ApiError(403,'ELECTION_CANDIDATE_ACCESS_REQUIRED')
   const e=await lockedElection(tx,candidate.electionId,true),person=await electionPerson(req.user!.sub,kind,tx)
   if(e.audience!==kind||!eligible(e,person))throw new ApiError(403,'ELECTION_NOT_ELIGIBLE')
   if(e.status!=='DRAFT'||candidate.status!=='PENDING')throw new ApiError(409,'ELECTION_CANDIDATES_FROZEN')
   const filename=randomUUID()+path.extname(file.originalname).toLowerCase(),directory=uploadPath('elections');await mkdir(directory,{recursive:true});stored=path.join(directory,filename);await writeFile(stored,file.buffer,{flag:'wx'})
   const photoUrl='/api/uploads/elections/'+filename
   await tx.schoolElectionCandidate.update({where:{id:candidate.id},data:{photoUrl}})
   await audit(tx,req,'SCHOOL_ELECTION_CANDIDATE_PHOTO',e.id,{candidateId:candidate.id,bytes:file.size})
   return{photoUrl}
  },{timeout:15000})
  return success(res,saved,'ELECTION_PHOTO_SAVED')
 }catch(error){if(stored)await unlink(stored).catch(()=>undefined);throw error}
}))
electionsRouter.post('/:audience/vote',authenticate,asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const kind=audience.parse(req.params.audience),d=z.object({electionId:id,idempotencyKey:z.string().uuid(),choices:z.array(z.object({officeId:id,candidateId:id.nullable().optional(),abstained:z.boolean().default(false)}).strict()).min(1).max(100)}).strict().parse(req.body)
 const result=await prisma.$transaction(async tx=>{
  const e=await lockedElection(tx,d.electionId),p=await electionPerson(req.user!.sub,kind,tx)
  if(e.audience!==kind)throw new ApiError(403,'ELECTION_NOT_ELIGIBLE')
  const key=voterKey(e.id,p.user.id);await tx.$queryRaw(Prisma.sql`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${e.id+':'+key}))`)
  const existing=await tx.schoolElectionParticipation.findUnique({where:{electionId_voterKey:{electionId:e.id,voterKey:key}},select:{receiptCode:true,submittedAt:true}})
  if(existing)return{...existing,alreadyRecorded:true}
  if(!eligible(e,p))throw new ApiError(403,'ELECTION_NOT_ELIGIBLE')
  const clock=await tx.$queryRaw<Array<{now:Date}>>`SELECT clock_timestamp() as now`;if(!electionWindowOpen(e,clock[0].now))throw new ApiError(409,'ELECTION_VOTING_CLOSED')
  const offices=e.offices.filter(o=>electionOfficeMatches(o,electoralClasses(e,p))).map(o=>({...o,candidates:o.candidates.filter(c=>c.status==='APPROVED')}))
  if(!validSchoolBallot(offices,d.choices,e.allowAbstention))throw new ApiError(400,'ELECTION_INVALID_BALLOT')
  await tx.schoolElectionBallot.create({data:{electionId:e.id,idempotencyKey:d.idempotencyKey,choices:{create:d.choices.map(c=>({officeId:c.officeId,candidateId:c.abstained?null:c.candidateId,abstained:c.abstained}))}}})
  // This receipt proves participation; it does not identify a ballot or a choice.
  const receipt=await tx.schoolElectionParticipation.create({data:{electionId:e.id,voterKey:key,receiptCode:'KCS-VOTE-'+randomBytes(8).toString('hex').toUpperCase(),grade:kind==='STUDENT'?p.classes[0].grade:null,section:kind==='STUDENT'?p.classes[0].section:null},select:{receiptCode:true,submittedAt:true}})
  return{...receipt,alreadyRecorded:false}
 },{maxWait:15000,timeout:20000})
 return success(res,result,'ELECTION_BALLOT_RECORDED',201)
}))

electionsRouter.use('/admin',authenticate,asyncHandler(manager))
electionsRouter.get('/admin/access',asyncHandler(async(req:AuthenticatedRequest,res)=>success(res,{canManage:res.locals.electionManage,canObserve:true,advancedAdministration:true,canGrantPermissions:req.user!.sub==='configured-superadmin'})))
electionsRouter.get('/admin/administrators',requireSuperAdmin(),asyncHandler(async(_req,res)=>{
 const rows=await prisma.user.findMany({where:{accountBlockedAt:null,NOT:{permissions:{has:'nexus:media-only'}}},select:{id:true,firstName:true,middleName:true,lastName:true,role:true,permissions:true,updatedAt:true},orderBy:{lastName:'asc'}})
 return success(res,{people:rows.map(u=>({id:u.id,name:fullName(u),role:u.role,version:u.updatedAt.toISOString(),access:u.permissions.includes('nexus:elections-manage')?'MANAGE':u.permissions.includes('nexus:elections-observe')?'OBSERVE':'NONE'}))})
}))
electionsRouter.put('/admin/administrators/:id',requireSuperAdmin(),asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const d=z.object({access:z.enum(['MANAGE','OBSERVE','NONE']),version:z.string().datetime()}).strict().parse(req.body),userId=id.parse(req.params.id)
 const result=await prisma.$transaction(async tx=>{const u=await tx.user.findUnique({where:{id:userId},select:{id:true,permissions:true,updatedAt:true,accountBlockedAt:true}});if(!u||u.accountBlockedAt||u.permissions.includes('nexus:media-only'))throw new ApiError(403,'ELECTION_ACCOUNT_INACTIVE');if(u.updatedAt.toISOString()!==d.version)throw new ApiError(409,'ELECTION_ACCESS_CHANGED');const permissions=u.permissions.filter(v=>!['nexus:elections-manage','nexus:elections-observe'].includes(v));if(d.access!=='NONE')permissions.push(d.access==='MANAGE'?'nexus:elections-manage':'nexus:elections-observe');const saved=await tx.user.updateMany({where:{id:u.id,updatedAt:u.updatedAt},data:{permissions}});if(saved.count!==1)throw new ApiError(409,'ELECTION_ACCESS_CHANGED');await tx.auditLog.create({data:{actorId:await databaseActorId(req.user!.sub),action:'SCHOOL_ELECTION_ACCESS_UPDATED',targetType:'User',targetId:u.id,metadata:{access:d.access}}});return{access:d.access}});return success(res,result,'ELECTION_ACCESS_SAVED')
}))
electionsRouter.get('/admin/metadata',asyncHandler(async(_req,res)=>{
 const calendars=await academicCalendars({strict:true}),clock=await prisma.$queryRaw<Array<{now:Date}>>`SELECT clock_timestamp() as now`
 return success(res,{calendars:calendars.map(c=>({name:c.name,startDate:c.startDate,endDate:c.endDate,isCurrent:c.isCurrent})),schoolTimezone:'Africa/Kinshasa',serverUtc:clock[0].now.toISOString(),grades:['K3','K4','K5',...Array.from({length:12},(_,i)=>'Grade '+(i+1))]})
}))
electionsRouter.get('/admin/elections',asyncHandler(async(req,res)=>{
 const kind=audience.parse(req.query.audience),rows=await prisma.schoolElection.findMany({where:{audience:kind},include:{...include,_count:{select:{participations:true,ballots:true,candidates:true}}},orderBy:{createdAt:'desc'}})
 return success(res,{canManage:res.locals.electionManage,elections:rows.map(e=>({...e,eligibleUserIds:res.locals.electionManage?e.eligibleUserIds:[],offices:e.offices.map(o=>({...o,version:officeVersion(o)}))}))})
}))
electionsRouter.get('/admin/people',write,asyncHandler(async(req,res)=>{
 const kind=audience.parse(req.query.audience),q=z.string().max(150).parse(req.query.q||''),tokens=q.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().split(/\s+/).filter(Boolean)
 const rows=await prisma.user.findMany({where:{accountBlockedAt:null,...(kind==='STUDENT'?{role:'STUDENT',studentProfile:{status:{equals:'active',mode:'insensitive'},archive:null}}:{parentLinks:{some:{student:{status:{equals:'active',mode:'insensitive'},archive:null}}}})},select:personSelect,orderBy:{lastName:'asc'}})
 return success(res,{people:rows.map(u=>({id:u.id,name:fullName(u),email:u.email,classes:(kind==='STUDENT'?[u.studentProfile]:(u.parentLinks||[]).map(l=>l.student)).filter(active).map(c=>({grade:c!.grade,section:c!.section}))})).filter(u=>tokens.every(t=>(u.name+' '+u.email+' '+u.classes.map(c=>c.grade+' '+c.section).join(' ')).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(t)))})
}))
const settings=z.object({title:name,academicYear:z.string().regex(/^\d{4}-\d{4}$/),startAt:z.coerce.date(),endAt:z.coerce.date(),eligibleGrades:z.array(z.string().max(50)).max(40).default([]),eligibleUserIds:z.array(id).max(3000).default([]),eligibilityMode:z.enum(['ALL','SELECTED']).default('ALL'),showInterimResults:z.boolean().default(false),allowAbstention:z.boolean().default(false)}).strict().refine(v=>v.endAt>v.startAt,{message:'ELECTION_INVALID_DATES'})
const schoolDate=(value:Date)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Kinshasa',year:'numeric',month:'2-digit',day:'2-digit'}).format(value)
async function verifySettings(d:any){const calendars=await academicCalendars({strict:true});if(!calendars.some(c=>c.name===d.academicYear&&schoolDate(d.startAt)>=c.startDate.slice(0,10)&&schoolDate(d.endAt)<=c.endDate.slice(0,10)))throw new ApiError(400,'ELECTION_PUBLISHED_SCHOOL_YEAR_REQUIRED');if(d.eligibilityMode==='SELECTED'&&!d.eligibleUserIds.length)throw new ApiError(400,'ELECTION_SELECT_VOTERS_REQUIRED')}
electionsRouter.post('/admin/elections',write,asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const {audience:kind,...input}=z.object({audience,...settings.innerType().shape}).strict().parse(req.body),d=settings.parse(input);await verifySettings(d)
 const saved=await prisma.$transaction(async tx=>{const e=await tx.schoolElection.create({data:{...d,audience:kind,createdById:req.user!.sub}});await audit(tx,req,'SCHOOL_ELECTION_CREATED',e.id,{audience:kind});return e});return success(res,saved,'ELECTION_CREATED',201)
}))
electionsRouter.put('/admin/elections/:id/settings',write,asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const d=settings.parse(req.body);await verifySettings(d)
 const saved=await prisma.$transaction(async tx=>{const e=await lockedElection(tx,id.parse(req.params.id),true);if(e.status!=='DRAFT'||await tx.schoolElectionBallot.count({where:{electionId:e.id}}))throw new ApiError(409,'ELECTION_SETTINGS_FROZEN');const updated=await tx.schoolElection.update({where:{id:e.id},data:d});await audit(tx,req,'SCHOOL_ELECTION_SETTINGS_UPDATED',e.id);return updated},{timeout:15000});return success(res,saved,'ELECTION_SETTINGS_SAVED')
}))
electionsRouter.post('/admin/elections/:id/offices',write,asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const d=z.object({name,scope,grade:z.string().trim().max(50).nullable().optional(),section:z.string().trim().max(30).nullable().optional(),displayOrder:z.number().int().min(0).max(100)}).strict().parse(req.body)
 if(d.scope==='CLASS'&&!d.grade)throw new ApiError(400,'ELECTION_CLASS_REQUIRED')
 const saved=await prisma.$transaction(async tx=>{const e=await lockedElection(tx,id.parse(req.params.id),true);if(e.status!=='DRAFT')throw new ApiError(409,'ELECTION_OFFICES_FROZEN');const o=await tx.schoolElectionOffice.create({data:{...d,electionId:e.id,grade:d.scope==='CLASS'?d.grade:null,section:d.scope==='CLASS'?d.section:null}});await audit(tx,req,'SCHOOL_ELECTION_OFFICE_CREATED',e.id,{officeId:o.id});return o});return success(res,saved,'ELECTION_OFFICE_CREATED',201)
}))
electionsRouter.patch('/admin/candidates/:id/status',write,asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const d=z.object({status:z.enum(['APPROVED','REJECTED','WITHDRAWN'])}).strict().parse(req.body),candidate=await prisma.schoolElectionCandidate.findUnique({where:{id:id.parse(req.params.id)}});if(!candidate)throw new ApiError(404,'ELECTION_CANDIDATE_NOT_FOUND')
 const saved=await prisma.$transaction(async tx=>{const e=await lockedElection(tx,candidate.electionId,true);if(e.status!=='DRAFT'||await tx.schoolElectionBallot.count({where:{electionId:e.id}}))throw new ApiError(409,'ELECTION_CANDIDATES_FROZEN');const fresh=await tx.schoolElectionCandidate.findUniqueOrThrow({where:{id:candidate.id}});if(d.status==='APPROVED'){const person=await electionPerson(fresh.memberUserId,e.audience,tx),office=e.offices.find(o=>o.id===fresh.officeId)!;if(!eligible(e,person)||!electionOfficeMatches(office,electoralClasses(e,person)))throw new ApiError(403,'ELECTION_OUTSIDE_CONSTITUENCY')}const max=await tx.schoolElectionCandidate.aggregate({where:{officeId:candidate.officeId},_max:{ballotNumber:true}});const updated=await tx.schoolElectionCandidate.update({where:{id:candidate.id},data:{status:d.status,...(d.status==='APPROVED'&&!fresh.ballotNumber?{ballotNumber:(max._max.ballotNumber||0)+1}:{})}});await audit(tx,req,'SCHOOL_ELECTION_CANDIDATE_'+d.status,e.id,{candidateId:candidate.id});return updated});return success(res,saved,'ELECTION_CANDIDATE_UPDATED')
}))
electionsRouter.patch('/admin/elections/:id/status',write,asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const d=z.object({status:statuses}).strict().parse(req.body),saved=await prisma.$transaction(async tx=>{
  const e=await lockedElection(tx,id.parse(req.params.id),true);await tx.$queryRaw(Prisma.sql`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${'kcs-open-election:'+e.audience}))`);const allowed:Record<string,string[]>={DRAFT:['OPEN','ARCHIVED'],OPEN:['CLOSED'],CLOSED:['OPEN','PUBLISHED','ARCHIVED'],PUBLISHED:['ARCHIVED'],ARCHIVED:[]}
  if(!allowed[e.status]?.includes(d.status))throw new ApiError(409,'ELECTION_INVALID_TRANSITION')
  if(d.status==='OPEN'){
   if(!e.offices.length||e.offices.some(o=>!o.candidates.some(c=>c.status==='APPROVED')&&!e.allowAbstention))throw new ApiError(409,'ELECTION_APPROVED_CANDIDATES_REQUIRED')
   const clock=await tx.$queryRaw<Array<{now:Date}>>`SELECT clock_timestamp() as now`;if(clock[0].now>e.endAt)throw new ApiError(409,'ELECTION_WINDOW_ENDED')
   const other=await tx.schoolElection.findFirst({where:{audience:e.audience,status:'OPEN',id:{not:e.id}}});if(other)throw new ApiError(409,'ELECTION_ANOTHER_OPEN_ELECTION')
  }
  if(d.status==='CLOSED'){
   const eligibleCount=await eligiblePopulation(e,tx),participations=await tx.schoolElectionParticipation.count({where:{electionId:e.id}}),ballots=await tx.schoolElectionBallot.count({where:{electionId:e.id}})
   if(participations!==ballots)throw new ApiError(409,'ELECTION_INTEGRITY_MISMATCH')
   await tx.auditLog.create({data:{actorId:await databaseActorId(req.user!.sub),action:'SCHOOL_ELECTION_CLOSURE_COUNTS',targetType:'SchoolElection',targetId:e.id,metadata:{eligibleCount,participations,ballots}}})
  }
  if(d.status==='PUBLISHED'&&await tx.schoolElectionParticipation.count({where:{electionId:e.id}})!==await tx.schoolElectionBallot.count({where:{electionId:e.id}}))throw new ApiError(409,'ELECTION_INTEGRITY_MISMATCH')
  const updated=await tx.schoolElection.update({where:{id:e.id},data:{status:d.status,...(d.status==='PUBLISHED'?{publishedAt:new Date()}:{})}});await audit(tx,req,'SCHOOL_ELECTION_STATUS_CHANGED',e.id,{from:e.status,to:d.status});return updated
 },{timeout:15000});return success(res,saved,'ELECTION_STATUS_UPDATED')
}))
electionsRouter.get('/admin/elections/:id/monitoring',asyncHandler(async(req,res)=>{
 const e=await prisma.schoolElection.findUnique({where:{id:id.parse(req.params.id)},include:{...include,_count:{select:{participations:true,ballots:true}}}});if(!e)throw new ApiError(404,'ELECTION_NOT_FOUND')
 const participationByClass=await prisma.schoolElectionParticipation.groupBy({by:['grade','section'],where:{electionId:e.id},_count:{_all:true}})
 const reveal=['CLOSED','PUBLISHED','ARCHIVED'].includes(e.status)||e.showInterimResults,groups=reveal?await prisma.schoolElectionChoice.groupBy({by:['officeId','candidateId','abstained'],where:{ballot:{electionId:e.id}},_count:{_all:true}}):[]
 const logs=await prisma.auditLog.findMany({where:{targetType:'SchoolElection',targetId:e.id},select:{id:true,action:true,createdAt:true,metadata:true},orderBy:{createdAt:'desc'},take:100})
 const snapshot=logs.find(l=>l.action==='SCHOOL_ELECTION_CLOSURE_COUNTS')?.metadata as any
 const eligibleCount=['CLOSED','PUBLISHED','ARCHIVED'].includes(e.status)&&typeof snapshot?.eligibleCount==='number'?snapshot.eligibleCount:await eligiblePopulation(e)
 return success(res,{election:publicElection(e),participation:e._count.participations,ballots:e._count.ballots,eligibleCount,turnout:eligibleCount?Math.round(e._count.participations/eligibleCount*10000)/100:null,talliesVisible:reveal,participationByClass:participationByClass.map(r=>({grade:r.grade,section:r.section,count:r._count._all})),offices:e.offices.map(o=>({...publicOffice(o),candidates:o.candidates.map(c=>({...publicCandidate(c),status:c.status,votes:reveal?groups.find(g=>g.candidateId===c.id)?._count._all||0:null})),abstentions:reveal?groups.filter(g=>g.officeId===o.id&&g.abstained).reduce((n,g)=>n+g._count._all,0):null})),audit:logs,storage:'KCS_NEXUS_POSTGRESQL',legacyImport:e.audience==='PARENT'?'PENDING_VERIFIED_EXPORT':'LEGACY_NEXUS_EMPTY_AT_CUTOVER'})
}))

// Changes to preparation and deadlines are separate from immutable ballot records.
electionsRouter.patch('/admin/offices/:id',write,asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const data=z.object({name,displayOrder:z.number().int().min(0).max(100),version:z.string().regex(/^[a-f0-9]{64}$/)}).strict().parse(req.body),officeId=id.parse(req.params.id)
 const saved=await prisma.$transaction(async tx=>{const found=await tx.schoolElectionOffice.findUnique({where:{id:officeId}});if(!found)throw new ApiError(404,'ELECTION_OFFICE_NOT_FOUND');const e=await lockedElection(tx,found.electionId,true),office=e.offices.find(o=>o.id===officeId);if(!office)throw new ApiError(404,'ELECTION_OFFICE_NOT_FOUND');if(e.status!=='DRAFT')throw new ApiError(409,'ELECTION_OFFICES_FROZEN');if(officeVersion(office)!==data.version)throw new ApiError(409,'ELECTION_ACCESS_CHANGED');const updated=await tx.schoolElectionOffice.update({where:{id:officeId},data:{name:data.name,displayOrder:data.displayOrder}});await audit(tx,req,'SCHOOL_ELECTION_OFFICE_UPDATED',e.id,{officeId,previous:{name:office.name,displayOrder:office.displayOrder},next:{name:data.name,displayOrder:data.displayOrder}});return updated});return success(res,saved)
}))
electionsRouter.delete('/admin/offices/:id',write,asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const data=z.object({version:z.string().regex(/^[a-f0-9]{64}$/),confirmed:z.literal(true)}).strict().parse(req.body),officeId=id.parse(req.params.id)
 await prisma.$transaction(async tx=>{const found=await tx.schoolElectionOffice.findUnique({where:{id:officeId}});if(!found)throw new ApiError(404,'ELECTION_OFFICE_NOT_FOUND');const e=await lockedElection(tx,found.electionId,true),office=e.offices.find(o=>o.id===officeId);if(!office)throw new ApiError(404,'ELECTION_OFFICE_NOT_FOUND');if(e.status!=='DRAFT')throw new ApiError(409,'ELECTION_OFFICES_FROZEN');if(officeVersion(office)!==data.version)throw new ApiError(409,'ELECTION_ACCESS_CHANGED');if(office.candidates.length)throw new ApiError(409,'ELECTION_OFFICE_HAS_CANDIDACIES');await tx.schoolElectionOffice.delete({where:{id:office.id}});await audit(tx,req,'SCHOOL_ELECTION_EMPTY_OFFICE_REMOVED',e.id,{officeId,name:office.name,scope:office.scope,grade:office.grade,section:office.section})});return success(res,{removed:true})
}))
electionsRouter.post('/admin/elections/:id/duplicate',write,requireSuperAdmin(),asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const data=z.object({title:name,academicYear:z.string().regex(/^\d{4}-\d{4}$/),startAt:z.coerce.date(),endAt:z.coerce.date()}).strict().refine(d=>d.endAt>d.startAt,{message:'ELECTION_INVALID_DATES'}).parse(req.body)
 await verifySettings({...data,eligibilityMode:'ALL',eligibleUserIds:[]})
 const saved=await prisma.$transaction(async tx=>{const e=await lockedElection(tx,id.parse(req.params.id)),copy=await tx.schoolElection.create({data:{...data,audience:e.audience,createdById:req.user!.sub,eligibleGrades:e.eligibleGrades,eligibilityMode:'ALL',eligibleUserIds:[],allowAbstention:e.allowAbstention,showInterimResults:false,offices:{create:e.offices.map(o=>({name:o.name,scope:o.scope,grade:o.grade,section:o.section,displayOrder:o.displayOrder}))}}});await audit(tx,req,'SCHOOL_ELECTION_TEMPLATE_DUPLICATED',copy.id,{sourceElectionId:e.id,copied:'OFFICES_AND_RULES_ONLY',candidatesCopied:false,votesCopied:false,targetingRequiresReview:true});return copy},{timeout:15000});return success(res,saved,'ELECTION_CREATED',201)
}))
electionsRouter.post('/admin/elections/:id/extend',write,requireSuperAdmin(),asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const data=z.object({endAt:z.coerce.date(),reason:z.string().trim().min(10).max(1000),confirmed:z.literal(true)}).strict().parse(req.body),calendars=await academicCalendars({strict:true})
 const saved=await prisma.$transaction(async tx=>{const e=await lockedElection(tx,id.parse(req.params.id),true),clock=await tx.$queryRaw<Array<{now:Date}>>`SELECT clock_timestamp() as now`;if(!['OPEN','CLOSED'].includes(e.status))throw new ApiError(409,'ELECTION_EXTENSION_NOT_ALLOWED');const calendar=calendars.find(c=>c.name===e.academicYear);if(!calendar||data.endAt<=e.endAt||data.endAt<=clock[0].now||schoolDate(data.endAt)>calendar.endDate.slice(0,10))throw new ApiError(400,'ELECTION_INVALID_EXTENSION');const updated=await tx.schoolElection.update({where:{id:e.id},data:{endAt:data.endAt}});await audit(tx,req,'SCHOOL_ELECTION_DEADLINE_EXTENDED',e.id,{from:e.endAt.toISOString(),to:data.endAt.toISOString(),reason:data.reason,previousVotesPreserved:true,statusUnchanged:e.status});return updated});return success(res,saved)
}))
electionsRouter.get('/admin/elections/:id/audit',asyncHandler(async(req,res)=>{
 const electionId=id.parse(req.params.id),query=z.object({page:z.coerce.number().int().min(1).max(10000).default(1),q:z.string().trim().max(150).default('')}).strict().parse(req.query)
 if(!await prisma.schoolElection.findUnique({where:{id:electionId},select:{id:true}}))throw new ApiError(404,'ELECTION_NOT_FOUND')
 const where:Prisma.AuditLogWhereInput={targetType:'SchoolElection',targetId:electionId,...(query.q?{OR:[{action:{contains:query.q,mode:'insensitive'}},{metadata:{path:['reason'],string_contains:query.q}}]}:{})}
 const [rows,total]=await Promise.all([prisma.auditLog.findMany({where,orderBy:[{createdAt:'desc'},{id:'desc'}],skip:(query.page-1)*25,take:25,include:{actor:{select:{firstName:true,middleName:true,lastName:true}}}}),prisma.auditLog.count({where})])
 return success(res,{page:query.page,total,pages:Math.ceil(total/25),events:rows.map(row=>({id:row.id,action:row.action,date:row.createdAt,actor:(row.metadata as any)?.actorName||(row.actor?fullName(row.actor):'KCS'),metadata:row.metadata}))})
}))
