import { databaseActorId } from '../utils/databaseActor.js'
import { Router } from 'express'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '../config/prisma.js'
import { authenticate, requireRoles, type AuthenticatedRequest } from '../middleware/auth.js'
import { ApiError, asyncHandler, success } from '../utils/api.js'
import { academicCalendars } from '../services/reportAttendance.service.js'
import { PARENT_MEETING_KIND, parentMeetingRoster, meetingSaveSchema, meetingEvidence, meetingNarrative, meetingCounts, type MeetingEvidence } from '../services/parentMeeting.service.js'
import { parentMeetingDocument, parentMeetingFingerprint } from '../utils/parentMeetingDocument.js'
export const parentMeetingsRouter=Router()
const isMeeting=(report:any)=>report?.evidence?.kind===PARENT_MEETING_KIND
parentMeetingsRouter.get('/verify',asyncHandler(async(req,res)=>{
 const id=z.string().min(1).max(100).parse(req.query.document),fingerprint=z.string().regex(/^[A-F0-9]{64}$/i).parse(req.query.fingerprint)
 const report=await prisma.teacherActivityReport.findUnique({where:{id}})
 if(!isMeeting(report)||parentMeetingFingerprint(report!)!==fingerprint)throw new ApiError(404,'The report version could not be verified')
 res.setHeader('Cache-Control','no-store')
 const evidence=report!.evidence as unknown as MeetingEvidence
 return success(res,{valid:['SUBMITTED','REVIEWED'].includes(report!.status),registered:true,documentType:'PARENT_MEETING_REPORT',status:report!.status,academicYear:evidence.academicYear,term:evidence.term,className:evidence.className,issuedAt:report!.submittedAt||report!.updatedAt,documentId:id,fingerprint})
}))
parentMeetingsRouter.use(authenticate)
parentMeetingsRouter.get('/context',requireRoles('teacher'),asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const [roster,calendars]=await Promise.all([parentMeetingRoster(req.user!.sub),academicCalendars()]);res.setHeader('Cache-Control','private, no-store');return success(res,{...roster,calendars})
}))
parentMeetingsRouter.get('/',requireRoles('teacher'),asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const reports=await prisma.teacherActivityReport.findMany({where:{teacher:{userId:req.user!.sub},evidence:{path:['kind'],equals:PARENT_MEETING_KIND}},orderBy:{updatedAt:'desc'}});res.setHeader('Cache-Control','private, no-store');return success(res,reports)
}))
parentMeetingsRouter.post('/save',requireRoles('teacher'),asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const payload=meetingSaveSchema.parse(req.body),roster=await parentMeetingRoster(req.user!.sub),evidence=meetingEvidence(payload,roster)
 const title=`${payload.language==='fr'?'Rencontre parents–école':'Parent–school conference'} · ${roster.className} · ${payload.term} · ${payload.meetingDate}`
 const report=await prisma.$transaction(async tx=>{
  await tx.$queryRaw(Prisma.sql`SELECT id FROM "TeacherProfile" WHERE id = ${roster.teacherId} FOR UPDATE`)
  const existing=payload.id?await tx.teacherActivityReport.findFirst({where:{id:payload.id,teacherId:roster.teacherId}}):await tx.teacherActivityReport.findFirst({where:{teacherId:roster.teacherId,evidence:{path:['clientKey'],equals:payload.clientKey}}})
  if(payload.id&&(!isMeeting(existing)||!existing))throw new ApiError(404,'Meeting report not found')
  if(existing&&!['DRAFT','RETURNED'].includes(existing.status))throw new ApiError(409,'This report has been submitted. The school authority must return it before revision.')
  if(existing&&!payload.id)return existing // Safe retry after an uncertain first save; never duplicate or overwrite it.
  const data={title,content:meetingNarrative(evidence),evidence:evidence as unknown as Prisma.InputJsonValue,recipientRole:payload.recipientRole,periodStart:new Date(payload.meetingDate+'T00:00:00Z'),periodEnd:new Date(payload.meetingDate+'T23:59:59Z')}
  if(existing){if(!payload.updatedAt||existing.updatedAt.toISOString()!==payload.updatedAt)throw new ApiError(409,'A newer version exists. Reload the saved report before making another change.');const changed=await tx.teacherActivityReport.updateMany({where:{id:existing.id,updatedAt:existing.updatedAt,status:{in:['DRAFT','RETURNED']}},data});if(changed.count!==1)throw new ApiError(409,'The report changed during saving. Reload it.');return tx.teacherActivityReport.findUniqueOrThrow({where:{id:existing.id}})}
  const saved=await tx.teacherActivityReport.create({data:{...data,teacherId:roster.teacherId,aiSource:'TEACHER_PARENT_CONFERENCE'}})
  await tx.auditLog.create({data:{actorId:req.user!.sub,action:'PARENT_MEETING_DRAFT_CREATED',targetType:'TeacherActivityReport',targetId:saved.id,metadata:{academicYear:payload.academicYear,term:payload.term,className:roster.className}}});return saved
 })
 return success(res,report,'Parent-meeting report saved')
}))
parentMeetingsRouter.post('/:id/submit',requireRoles('teacher'),asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const id=String(req.params.id),expected=z.object({updatedAt:z.string().datetime()}).strict().parse(req.body)
 const report=await prisma.$transaction(async tx=>{
  const existing=await tx.teacherActivityReport.findFirst({where:{id,teacher:{userId:req.user!.sub}}})
  if(!existing||!isMeeting(existing))throw new ApiError(404,'Meeting report not found')
  if(!['DRAFT','RETURNED'].includes(existing.status))return existing
  if(existing.updatedAt.toISOString()!==expected.updatedAt)throw new ApiError(409,'The saved report has changed. Reload it before submission.')
  const evidence=existing.evidence as unknown as MeetingEvidence
  if(meetingCounts(evidence).pending||evidence.summary.trim().length<20)throw new ApiError(400,'Mark every parent invitation and write a summary of at least 20 characters before submitting')
  const changed=await tx.teacherActivityReport.updateMany({where:{id,updatedAt:existing.updatedAt,status:{in:['DRAFT','RETURNED']}},data:{status:'SUBMITTED',submittedAt:new Date(),reviewerNote:null,reviewedAt:null}})
  if(changed.count!==1)throw new ApiError(409,'This report was already changed or submitted')
  const saved=await tx.teacherActivityReport.findUniqueOrThrow({where:{id}})
  const roles=existing.recipientRole==='SUPER_ADMINISTRATOR'?['ADMIN']:['ADMIN','STAFF']
  const recipients=await tx.user.findMany({where:existing.recipientRole==='SUPER_ADMINISTRATOR'?{email:process.env.SUPERADMIN_EMAIL||'superadmin@kcsnexus.com'}:{role:{in:roles as any}},select:{id:true,role:true}})
  if(!recipients.length)throw new ApiError(409,'No school leadership account is available. The report remains a draft; contact the school administrator.')
  if(recipients.length)await tx.notification.createMany({data:recipients.map(user=>({userId:user.id,title:evidence.language==='fr'?'Rapport de rencontre parents–école':'Parent–school conference report',message:`${evidence.teacherName} · ${evidence.className} · ${evidence.term}`,type:'INFO',link:user.role==='ADMIN'?'/admin/teacher-reports':'/portal/staff/reports'}))})
  await tx.auditLog.create({data:{actorId:req.user!.sub,action:'PARENT_MEETING_SUBMITTED',targetType:'TeacherActivityReport',targetId:id,metadata:{academicYear:evidence.academicYear,term:evidence.term,counts:meetingCounts(evidence),fingerprint:parentMeetingFingerprint(saved),recipientRole:existing.recipientRole}}});return saved
 })
 return success(res,report,'Meeting report submitted to school leadership')
}))
parentMeetingsRouter.get('/:id/document',requireRoles('teacher','staff','admin'),asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const report=await prisma.teacherActivityReport.findFirst({where:{id:String(req.params.id),...(req.user!.role==='teacher'?{teacher:{userId:req.user!.sub}}:{status:{in:['SUBMITTED','REVIEWED','RETURNED']}})}})
 if(!report||!isMeeting(report))throw new ApiError(404,'Meeting report not found')
 const language=z.enum(['fr','en']).default('en').parse(req.query.language);res.setHeader('Cache-Control','private, no-store');return success(res,await parentMeetingDocument(report,language))
}))
parentMeetingsRouter.post('/:id/review',requireRoles('admin','staff'),asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const payload=z.object({status:z.enum(['REVIEWED','RETURNED']),reviewerNote:z.string().trim().min(3).max(3000),updatedAt:z.string().datetime()}).strict().parse(req.body)
 const existing=await prisma.teacherActivityReport.findUnique({where:{id:String(req.params.id)}})
 if(!existing||!isMeeting(existing))throw new ApiError(404,'Meeting report not found')
 const actorId=await databaseActorId(req.user!.sub)
 const report=await prisma.$transaction(async tx=>{
  const changed=await tx.teacherActivityReport.updateMany({where:{id:existing.id,updatedAt:new Date(payload.updatedAt),status:{in:['SUBMITTED','REVIEWED']}},data:{status:payload.status,reviewerNote:payload.reviewerNote,reviewedAt:new Date()}})
  if(changed.count!==1)throw new ApiError(409,'This report changed or is not awaiting review')
  await tx.auditLog.create({data:{actorId,action:'PARENT_MEETING_'+payload.status,targetType:'TeacherActivityReport',targetId:existing.id,metadata:{reviewerNote:payload.reviewerNote}}})
  const teacher=await tx.teacherProfile.findUniqueOrThrow({where:{id:existing.teacherId},select:{userId:true}});await tx.notification.create({data:{userId:teacher.userId,title:'Parent–school conference report · '+payload.status,message:payload.reviewerNote,type:'INFO',link:'/portal/teacher/reports?view=academic'}})
  return tx.teacherActivityReport.findUniqueOrThrow({where:{id:existing.id}})
 });return success(res,report)
}))
