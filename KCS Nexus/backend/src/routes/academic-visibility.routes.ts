import {Router} from 'express'
import {z} from 'zod'
import {Prisma} from '@prisma/client'
import {prisma} from '../config/prisma.js'
import {authenticate,requireSuperAdmin,type AuthenticatedRequest} from '../middleware/auth.js'
import {academicVisibilityPolicy,visibilitySettingsId} from '../services/academicVisibility.service.js'
import {databaseActorId} from '../utils/databaseActor.js'
import {ApiError,asyncHandler,success} from '../utils/api.js'
const permissions=z.object({grades:z.boolean(),reportCards:z.boolean(),transcripts:z.boolean()}).strict()
const rule=z.object({id:z.string().min(1).max(80),audience:z.enum(['student','parent','both']),effect:z.enum(['ALLOW','DENY']).default('ALLOW'),grade:z.string().trim().max(40).optional(),section:z.string().trim().max(40).optional(),studentNumbers:z.array(z.string().trim().min(1).max(100)).max(1000).optional(),parentIds:z.array(z.string().min(1).max(150)).max(1000).optional(),academicYear:z.string().regex(/^\d{4}-\d{4}$/).or(z.literal('')).optional(),term:z.string().trim().max(100).optional(),courseIds:z.array(z.string().min(1).max(150)).max(500).optional(),permissions}).strict().refine(r=>Boolean(r.grade||r.studentNumbers?.length||r.parentIds?.length||r.academicYear||r.term||r.courseIds?.length),'Choose a class, learner, parent, period or course for this targeted rule.').refine(r=>Object.values(r.permissions).some(Boolean),'Choose at least one academic feature.').refine(r=>!r.courseIds?.length||(!r.permissions.reportCards&&!r.permissions.transcripts),'Course targets apply to grades only; official documents are released as a whole.').refine(r=>!r.permissions.transcripts||(!r.academicYear&&!r.term),'Use class, learner or parent targets for complete transcripts, not a single period.')
const schema=z.object({revision:z.number().int().min(0),enabled:z.boolean(),defaults:z.object({student:permissions,parent:permissions}).strict(),rules:z.array(rule).max(100)}).strict()
export const academicVisibilityRouter=Router()
academicVisibilityRouter.use(authenticate,requireSuperAdmin())
academicVisibilityRouter.get('/',asyncHandler(async(_req,res)=>{
 const[policy,students,parents,courses]=await Promise.all([academicVisibilityPolicy(),prisma.studentProfile.findMany({where:{status:{equals:'active',mode:'insensitive'}},select:{id:true,studentNumber:true,grade:true,section:true,user:{select:{firstName:true,middleName:true,lastName:true}}},orderBy:{user:{lastName:'asc'}}}),prisma.user.findMany({where:{parentLinks:{some:{}}},select:{id:true,firstName:true,middleName:true,lastName:true,email:true,parentLinks:{select:{student:{select:{studentNumber:true,grade:true,section:true}}}}},orderBy:{lastName:'asc'}}),prisma.course.findMany({select:{id:true,name:true,grade:true},orderBy:{name:'asc'}})])
 res.setHeader('Cache-Control','private, no-store');return success(res,{policy,students,parents,courses},'Academic release controls loaded')
}))
academicVisibilityRouter.put('/',asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const input=schema.parse(req.body);if(new Set(input.rules.map(r=>r.id)).size!==input.rules.length)throw new ApiError(400,'Duplicate rule identifier')
 const actorId=await databaseActorId(req.user!.sub)
 const saved=await prisma.$transaction(async tx=>{
  await tx.$queryRaw(Prisma.sql`SELECT 1 FROM pg_advisory_xact_lock(hashtext('nexus-academic-visibility'))`)
  const current=await tx.auditLog.findUnique({where:{id:visibilitySettingsId},select:{metadata:true}})
  const previous=current?.metadata as {revision?:number}|null
  if((previous?.revision??0)!==input.revision)throw new ApiError(409,'Les réglages ont changé. Rechargez avant de réessayer. / Settings changed. Reload before retrying.')
  const policy={...input,revision:input.revision+1}
  await tx.auditLog.upsert({where:{id:visibilitySettingsId},create:{id:visibilitySettingsId,actorId,action:'ACADEMIC_VISIBILITY_SETTINGS',targetType:'AcademicVisibility',targetId:'school',metadata:policy as unknown as Prisma.InputJsonValue},update:{actorId,metadata:policy as unknown as Prisma.InputJsonValue}})
  await tx.auditLog.create({data:{actorId,action:'ACADEMIC_VISIBILITY_CHANGED',targetType:'AcademicVisibility',targetId:'school',metadata:{previous:current?.metadata??null,next:policy} as unknown as Prisma.InputJsonValue}})
  return policy
 })
 res.setHeader('Cache-Control','private, no-store');return success(res,saved,'Academic release controls saved')
}))
