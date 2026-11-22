import {Router} from 'express'
import {Prisma} from '@prisma/client'
import {z} from 'zod'
import {prisma} from '../config/prisma.js'
import {authenticate,requireSuperAdmin,type AuthenticatedRequest} from '../middleware/auth.js'
import {ApiError,asyncHandler,success} from '../utils/api.js'
import {databaseActorId} from '../utils/databaseActor.js'
import {academicCalendars} from '../services/reportAttendance.service.js'
import {captureAcademicHistory} from '../services/schoolHistory.service.js'
import {historicalDigest} from '../utils/historicalRecord.js'
import {lockAcademicYears} from '../services/academicPeriodAccess.service.js'

export const schoolHistoryRouter=Router()
schoolHistoryRouter.use(authenticate,requireSuperAdmin(),(_req,res,next)=>{res.setHeader('Cache-Control','private, no-store');next()})
const year=z.string().regex(/^\d{4}-\d{4}$/).refine(value=>Number(value.slice(5))===Number(value.slice(0,4))+1)
const terms=['Semester 1 · Quarter 1','Semester 1 · Quarter 2','Semester 2 · Quarter 3','Semester 2 · Quarter 4','Semester 1','Semester 2','Annual final'] as const
schoolHistoryRouter.get('/catalog',asyncHandler(async(_req,res)=>{
 const [stored,calendars]=await Promise.all([prisma.$queryRaw<Array<{year:string}>>(Prisma.sql`SELECT DISTINCT metadata->>'academicYear' AS year FROM "AuditLog" WHERE "targetType"='SchoolHistoricalRecord' ORDER BY year DESC`),academicCalendars()])
 return success(res,{years:[...new Set([...calendars.map(c=>c.name),...stored.map(row=>row.year)])].sort().reverse(),calendars,terms})
}))
schoolHistoryRouter.get('/',asyncHandler(async(req,res)=>{
 const input=z.object({academicYear:z.string().max(20).optional(),term:z.string().max(100).optional(),entityType:z.enum(['STUDENT','TEACHER','PARENT','STAFF','ADMIN','COURSE']).optional(),q:z.string().max(160).default(''),page:z.coerce.number().int().min(1).max(10000).default(1)}).parse(req.query)
 const normalized=input.q.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()
 const parts=[Prisma.sql`"targetType"='SchoolHistoricalRecord'`]
 if(input.academicYear)parts.push(Prisma.sql`metadata->>'academicYear'=${input.academicYear}`)
 if(input.term)parts.push(Prisma.sql`metadata->>'term'=${input.term}`)
 if(input.entityType)parts.push(Prisma.sql`metadata->>'entityType'=${input.entityType}`)
 for(const word of normalized.split(/\s+/).filter(Boolean))parts.push(Prisma.sql`strpos(metadata->>'searchText',${word})>0`)
 const where=Prisma.join(parts,' AND ')
 const [rows,total]=await Promise.all([
 prisma.$queryRaw(Prisma.sql`SELECT id,"createdAt",metadata->>'academicYear' AS "academicYear",metadata->>'term' AS term,metadata->>'label' AS label,metadata->>'grade' AS grade,metadata->>'section' AS section,metadata->>'entityType' AS "entityType",metadata->>'entityId' AS "entityId",metadata->>'reason' AS reason,metadata->>'sha256' AS sha256 FROM "AuditLog" WHERE ${where} ORDER BY "createdAt" DESC,id DESC LIMIT 50 OFFSET ${(input.page-1)*50}`),
 prisma.$queryRaw<Array<{count:bigint}>>(Prisma.sql`SELECT count(*) AS count FROM "AuditLog" WHERE ${where}`)])
 return success(res,{rows,total:Number(total[0].count),page:input.page,pageSize:50})
}))
schoolHistoryRouter.post('/capture',asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const input=z.object({academicYear:year,term:z.enum(terms)}).strict().parse(req.body)
 const calendar=(await academicCalendars({strict:true})).find(c=>c.name===input.academicYear)
 if(!calendar)throw new ApiError(404,'Published academic year not found / Année scolaire publiée introuvable')
 const actorId=await databaseActorId(req.user!.sub)
 const result=await prisma.$transaction(async tx=>{await lockAcademicYears(tx,[input.academicYear],true);return captureAcademicHistory(tx,{...input,calendar,actorId,reason:'SUPERADMIN_MANUAL_CAPTURE'})},{maxWait:10000,timeout:60000})
 return success(res,result,'Historical snapshot preserved / Instantané historique conservé')
}))
schoolHistoryRouter.get('/:id',asyncHandler(async(req,res)=>{
 const row=await prisma.auditLog.findFirst({where:{id:String(req.params.id),targetType:'SchoolHistoricalRecord'},select:{id:true,targetId:true,createdAt:true,metadata:true}})
 if(!row)throw new ApiError(404,'Historical record not found / Dossier historique introuvable')
 let metadata=row.metadata as Record<string,any>
 if(metadata.payloadId){const payload=await prisma.auditLog.findFirst({where:{id:metadata.payloadId,targetId:row.targetId,targetType:{in:['SchoolHistoricalPayload','SchoolCourseArchive']}},select:{metadata:true}});if(!payload)throw new ApiError(409,'Historical payload unavailable / Contenu historique indisponible');metadata={...metadata,data:(payload.metadata as Record<string,any>).data}}
 return success(res,{...row,metadata,integrityVerified:historicalDigest(metadata.data)===metadata.sha256})
}))
