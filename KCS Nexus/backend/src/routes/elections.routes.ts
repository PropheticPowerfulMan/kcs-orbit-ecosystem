import {Router} from 'express'
import {randomBytes,randomUUID} from 'node:crypto'
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
 const u=await prisma.user.findUnique({where:{id:req.user!.sub},select:{permissions:true}}),permissions=u?.permissions||[]
 res.locals.electionManage=permissions.includes('nexus:elections-manage')
 if(!res.locals.electionManage&&!permissions.includes('nexus:elections-observe'))return next(new ApiError(403,'ELECTION_ADMIN_ACCESS_REQUIRED'))
 next()
}
const write=(req:any,res:any,next:any)=>res.locals.electionManage?next():next(new ApiError(403,'ELECTION_OBSERVER_READ_ONLY'))
const populationWhere=(kind:string)=>({accountBlockedAt:null,...(kind==='STUDENT'?{role:'STUDENT' as const,studentProfile:{status:{equals:'active',mode:'insensitive' as const},archive:null}}:{parentLinks:{some:{student:{status:{equals:'active',mode:'insensitive' as const},archive:null}}}})})
async function eligiblePopulation(e:any,db:any=prisma){
 const [people,participations]=await Promise.all([db.user.findMany({where:populationWhere(e.audience),select:personSelect}),db.schoolElectionParticipation.findMany({where:{electionId:e.id},select:{voterKey:true}})])
 const keys=new Set(people.filter((u:any)=>eligible(e,{user:u,classes:(e.audience==='STUDENT'?[u.studentProfile]:u.parentLinks.map((l:any)=>l.student)).filter(active)})).map((u:any)=>voterKey(e.id,u.id)))
 for(const p of participations)keys.add(p.voterKey)
 return keys.size
}
async function audit(tx:any,req:AuthenticatedRequest,action:string,targetId:string,metadata:any={}){await tx.auditLog.create({data:{actorId:await databaseActorId(req.user!.sub),action,targetType:'SchoolElection',targetId,metadata}})}
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
electionsRouter.get('/:audience/public',asyncHandler(async(req,res)=>{
 const kind=audience.parse(req.params.audience),rows=await prisma.schoolElection.findMany({where:{audience:kind,OR:[{status:{in:['DRAFT','OPEN','CLOSED','PUBLISHED']}},{status:'ARCHIVED',publishedAt:{not:null}}]},include,orderBy:{createdAt:'desc'},take:100})
 const clock=await prisma.$queryRaw<Array<{now:Date}>>`SELECT clock_timestamp() as now`
 res.set('Cache-Control','no-store');return success(res,{serverUtc:clock[0].now.toISOString(),elections:rows.map(e=>({...publicElection(e),offices:e.offices.map(publicOffice)}))})
}))
electionsRouter.get('/:audience/results',asyncHandler(async(req,res)=>{
 const kind=audience.parse(req.params.audience),e=await chooseElection(kind,typeof req.query.electionId==='string'?req.query.electionId:undefined)
 if(!e||!(e.status==='PUBLISHED'||e.status==='ARCHIVED'&&e.publishedAt))return success(res,{election:null,offices:[],published:false})
 const grouped=await prisma.schoolElectionChoice.groupBy({by:['candidateId','officeId','abstained'],where:{ballot:{electionId:e.id}},_count:{_all:true}}),participation=await prisma.schoolElectionParticipation.count({where:{electionId:e.id}})
 return success(res,{published:true,election:publicElection(e),participation,offices:e.offices.map(o=>({...publicOffice(o),candidates:o.candidates.filter(c=>c.status==='APPROVED'||grouped.some(g=>g.candidateId===c.id)).map(c=>({...publicCandidate(c),votes:grouped.find(g=>g.candidateId===c.id)?._count._all||0})),abstentions:grouped.filter(g=>g.officeId===o.id&&g.abstained).reduce((n,g)=>n+g._count._all,0)}))})
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
electionsRouter.get('/admin/access',asyncHandler(async(_req,res)=>success(res,{canManage:res.locals.electionManage,canObserve:true})))
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
 return success(res,{canManage:res.locals.electionManage,elections:res.locals.electionManage?rows:rows.map(e=>({...e,eligibleUserIds:[]}))})
}))
electionsRouter.get('/admin/people',write,asyncHandler(async(req,res)=>{
 const kind=audience.parse(req.query.audience),q=z.string().max(150).parse(req.query.q||''),tokens=q.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().split(/\s+/).filter(Boolean)
 const rows=await prisma.user.findMany({where:{accountBlockedAt:null,...(kind==='STUDENT'?{role:'STUDENT',studentProfile:{status:{equals:'active',mode:'insensitive'},archive:null}}:{parentLinks:{some:{student:{status:{equals:'active',mode:'insensitive'},archive:null}}}})},select:personSelect,orderBy:{lastName:'asc'}})
 return success(res,{people:rows.map(u=>({id:u.id,name:fullName(u),email:u.email,classes:(kind==='STUDENT'?[u.studentProfile]:(u.parentLinks||[]).map(l=>l.student)).filter(active).map(c=>({grade:c!.grade,section:c!.section}))})).filter(u=>tokens.every(t=>(u.name+' '+u.email+' '+u.classes.map(c=>c.grade+' '+c.section).join(' ')).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(t)))})
}))
const settings=z.object({title:name,academicYear:z.string().regex(/^\d{4}-\d{4}$/),startAt:z.coerce.date(),endAt:z.coerce.date(),eligibleGrades:z.array(z.string().max(50)).max(40).default([]),eligibleUserIds:z.array(id).max(3000).default([]),eligibilityMode:z.enum(['ALL','SELECTED']).default('ALL'),showInterimResults:z.boolean().default(false),allowAbstention:z.boolean().default(false)}).strict().refine(v=>v.endAt>v.startAt,{message:'ELECTION_INVALID_DATES'})
async function verifySettings(d:any){const calendars=await academicCalendars({strict:true});if(!calendars.some(c=>c.name===d.academicYear&&d.startAt.toISOString().slice(0,10)>=c.startDate.slice(0,10)&&d.endAt.toISOString().slice(0,10)<=c.endDate.slice(0,10)))throw new ApiError(400,'ELECTION_PUBLISHED_SCHOOL_YEAR_REQUIRED');if(d.eligibilityMode==='SELECTED'&&!d.eligibleUserIds.length)throw new ApiError(400,'ELECTION_SELECT_VOTERS_REQUIRED')}
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
 const reveal=['CLOSED','PUBLISHED','ARCHIVED'].includes(e.status)||e.showInterimResults,groups=reveal?await prisma.schoolElectionChoice.groupBy({by:['officeId','candidateId','abstained'],where:{ballot:{electionId:e.id}},_count:{_all:true}}):[]
 const logs=await prisma.auditLog.findMany({where:{targetType:'SchoolElection',targetId:e.id},select:{id:true,action:true,createdAt:true,metadata:true},orderBy:{createdAt:'desc'},take:100})
 const snapshot=logs.find(l=>l.action==='SCHOOL_ELECTION_CLOSURE_COUNTS')?.metadata as any
 const eligibleCount=['CLOSED','PUBLISHED','ARCHIVED'].includes(e.status)&&typeof snapshot?.eligibleCount==='number'?snapshot.eligibleCount:await eligiblePopulation(e)
 return success(res,{election:publicElection(e),participation:e._count.participations,ballots:e._count.ballots,eligibleCount,turnout:eligibleCount?Math.round(e._count.participations/eligibleCount*10000)/100:null,talliesVisible:reveal,offices:e.offices.map(o=>({...publicOffice(o),candidates:o.candidates.map(c=>({...publicCandidate(c),status:c.status,votes:reveal?groups.find(g=>g.candidateId===c.id)?._count._all||0:null})),abstentions:reveal?groups.filter(g=>g.officeId===o.id&&g.abstained).reduce((n,g)=>n+g._count._all,0):null})),audit:logs,storage:'KCS_NEXUS_POSTGRESQL',legacyImport:e.audience==='PARENT'?'PENDING_VERIFIED_EXPORT':'LEGACY_NEXUS_EMPTY_AT_CUTOVER'})
}))
