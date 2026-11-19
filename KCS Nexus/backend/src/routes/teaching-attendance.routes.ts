import {teachingScheduleEditor,publishTeachingSchedule} from '../services/teachingSchedule.service.js'
import { Router } from 'express'
import { z } from 'zod'
import { authenticate, requireRoles, type AuthenticatedRequest } from '../middleware/auth.js'
import { prisma } from '../config/prisma.js'
import { env } from '../config/env.js'
import { ApiError, asyncHandler, success } from '../utils/api.js'
import { hasPrincipalWorkspaceAccess } from '../utils/staffWorkspace.js'
import { TEACHING_TIMEZONE, dayOfSchool } from '../utils/teachingAttendance.js'
import { courseRegularity, markTeachingTime, reviewTeachingSession, saveSessionStudents, sessionRegister, teachingBoard, teachingServerTime, validTeachingDate } from '../services/teachingAttendance.service.js'

export const teachingAttendanceRouter = Router()
teachingAttendanceRouter.use(authenticate)
teachingAttendanceRouter.use((_req,res,next)=>{res.setHeader('Cache-Control','private, no-store');next()})
const date=z.string().refine(validTeachingDate,'Invalid school date')
const locator=z.object({courseId:z.string().min(1).max(150),scheduleKey:z.string().min(1).max(200),date})
const filters=z.object({
 from:date.optional(),to:date.optional(),courseId:z.string().min(1).max(150).optional(),teacherUserId:z.string().min(1).max(150).optional(),
 className:z.string().trim().max(80).optional(),room:z.string().trim().max(100).optional(),search:z.string().trim().max(200).optional(),
 searchScope:z.enum(['sessions','learners']).optional(),status:z.enum(['UPCOMING','AWAITING_ENTRY','UNRECORDED','IN_CLASS','MISSING_EXIT','COMPLETED']).optional(),
 reviewStatus:z.enum(['PENDING','ACKNOWLEDGED','FOLLOW_UP','JUSTIFIED']).optional(),
}).strict()
async function isManager(req:AuthenticatedRequest) {
  if(req.user!.sub==='configured-superadmin')return true
  const user=await prisma.user.findUnique({where:{id:req.user!.sub},select:{role:true,permissions:true}})
  return hasPrincipalWorkspaceAccess(user)
}
async function principalActor(req:AuthenticatedRequest) {
  if(!await isManager(req))throw new ApiError(403,'TEACHING_PRINCIPAL_REQUIRED')
  if(req.user!.sub!=='configured-superadmin')return req.user!.sub
  const user=await prisma.user.findUnique({where:{email:env.SUPERADMIN_EMAIL},select:{id:true}})
  if(!user)throw new ApiError(409,'TEACHING_AUDIT_IDENTITY_UNAVAILABLE')
  return user.id
}
teachingAttendanceRouter.get('/clock',requireRoles('teacher','admin'),asyncHandler(async(_req,res)=>{
  const now=await teachingServerTime()
  return success(res,{serverUtc:now.toISOString(),schoolDate:dayOfSchool(now),schoolTimezone:TEACHING_TIMEZONE,authority:'PostgreSQL clock_timestamp'})
}))
teachingAttendanceRouter.get('/mine',requireRoles('teacher'),asyncHandler(async(req:AuthenticatedRequest,res)=>{
  const query=filters.parse(req.query),today=dayOfSchool(await teachingServerTime())
  return success(res,await teachingBoard({...query,from:query.from||today,to:query.to||query.from||today,teacherUserId:req.user!.sub}))
}))
teachingAttendanceRouter.get('/principal',asyncHandler(async(req:AuthenticatedRequest,res)=>{
  await principalActor(req)
  const query=filters.parse(req.query),today=dayOfSchool(await teachingServerTime())
  return success(res,await teachingBoard({...query,from:query.from||today,to:query.to||query.from||today}))
}))
teachingAttendanceRouter.post('/mark',requireRoles('teacher'),asyncHandler(async(req:AuthenticatedRequest,res)=>{
  const body=locator.extend({action:z.enum(['ENTRY','EXIT']),note:z.string().trim().max(1000).optional()}).strict().parse(req.body)
  const saved=await markTeachingTime(req.user!.sub,body,body.action,body.note)
  return success(res,saved,body.action==='ENTRY'?'TEACHING_ENTRY_SAVED':'TEACHING_EXIT_SAVED')
}))
teachingAttendanceRouter.get('/sessions/:id/learners',asyncHandler(async(req:AuthenticatedRequest,res)=>{
  const id=z.string().min(1).max(150).parse(req.params.id)
  return success(res,await sessionRegister(id,req.user!.sub,await isManager(req)))
}))
teachingAttendanceRouter.put('/sessions/:id/learners',requireRoles('teacher'),asyncHandler(async(req:AuthenticatedRequest,res)=>{
  const id=z.string().min(1).max(150).parse(req.params.id)
  const body=z.object({revision:z.number().int().min(0),entries:z.array(z.object({studentId:z.string().min(1).max(150),status:z.enum(['PRESENT','ABSENT','LATE','EXCUSED','SICK','SUSPENDED']),note:z.string().trim().max(500).optional()}).strict()).min(1).max(1000)}).strict().parse(req.body)
  return success(res,await saveSessionStudents(id,req.user!.sub,body.revision,body.entries),'TEACHING_ROSTER_SAVED')
}))
teachingAttendanceRouter.post('/review',asyncHandler(async(req:AuthenticatedRequest,res)=>{
  const actorId=await principalActor(req)
  const body=locator.extend({status:z.enum(['ACKNOWLEDGED','FOLLOW_UP','JUSTIFIED']),note:z.string().trim().min(3).max(2000)}).strict().parse(req.body)
  return success(res,await reviewTeachingSession(actorId,body,body.status,body.note),'TEACHING_REVIEW_SAVED')
}))
teachingAttendanceRouter.get('/regularity',requireRoles('teacher'),asyncHandler(async(req:AuthenticatedRequest,res)=>{
  const query=z.object({courseId:z.string().min(1).max(150),academicYear:z.string().regex(/^\d{4}-\d{4}$/),term:z.string().regex(/^(Annual final|Semester [12]( · Quarter [1-4])?)$/)}).strict().parse(req.query)
  return success(res,await courseRegularity(req.user!.sub,query.courseId,query.academicYear,query.term))
}))

const scheduleScope=z.object({courseId:z.string().min(1).max(150),academicYear:z.string().regex(/^\d{4}-\d{4}$/),semester:z.coerce.number().int().min(1).max(2)})
teachingAttendanceRouter.get('/schedule',asyncHandler(async(req:AuthenticatedRequest,res)=>{
 await principalActor(req)
 const query=scheduleScope.strict().parse(req.query)
 const loaded=await teachingScheduleEditor(query.courseId,query.academicYear,query.semester)
 return success(res,{classes:loaded.classes,entries:loaded.entries})
}))
teachingAttendanceRouter.put('/schedule',asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const actorId=await principalActor(req)
 const body=scheduleScope.extend({entries:z.array(z.object({day:z.enum(['Monday','Tuesday','Wednesday','Thursday','Friday']),startTime:z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),endTime:z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),room:z.string().trim().max(100),className:z.string().min(1).max(80),period:z.number().int().min(1).max(30)}).strict()).max(50)}).strict().parse(req.body)
 return success(res,await publishTeachingSchedule(actorId,body.courseId,body.academicYear,body.semester,body.entries),'TEACHING_SCHEDULE_PUBLISHED')
}))
